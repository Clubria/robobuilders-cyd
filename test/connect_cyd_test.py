import contextlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location('connect_cyd', ROOT / '.opencode/skills/cyd-setup/scripts/connect.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
pack_spec = importlib.util.spec_from_file_location('package_cyd', ROOT / 'scripts/package_cyd_skills.py')
packager = importlib.util.module_from_spec(pack_spec)
pack_spec.loader.exec_module(packager)


class ConnectTest(unittest.TestCase):
    def test_macos_empty_usb_registry_is_absence_not_discovery_failure(self):
        with patch.object(helper.sys, 'platform', 'darwin'):
            with patch.object(helper.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, b'', b'')):
                self.assertEqual(helper.discover(), [])

    def test_usb_tree_maps_only_matching_adapters_and_tracks_nearest_usb_parent(self):
        roots = [{'idVendor': 0x1a86, 'idProduct': 0x7523, 'IORegistryEntryChildren': [
            {'IORegistryEntryChildren': [{'IOCalloutDevice': '/dev/cu.usbserial-new'}]},
            {'idVendor': 1, 'idProduct': 2, 'IOCalloutDevice': '/dev/cu.wrong'},
            {'IOCalloutDevice': '/dev/tty.usbserial-new'}]},
            {'idVendor': 1, 'idProduct': 2, 'IOCalloutDevice': '/dev/cu.other'}]
        self.assertEqual(helper.ports_from_registry(roots), ['/dev/cu.usbserial-new'])

    def test_ambiguous_adapters_require_selection_even_if_old_port_exists(self):
        ports = ['/dev/cu.usbserial-110', '/dev/cu.usbserial-220']
        with self.assertRaisesRegex(helper.SetupError, 'Multiple'):
            helper.select_port(ports)
        self.assertEqual(helper.select_port(ports, ports[1]), ports[1])
        self.assertIsNone(helper.select_port(ports, '/dev/cu.unknown'))

    def test_wait_accepts_insertion_and_times_out_without_wall_clock_sleep(self):
        scans = iter([[], [], ['/dev/cu.new']])
        now = [0]
        sleep = lambda seconds: now.__setitem__(0, now[0] + seconds)
        self.assertEqual(helper.wait_port(None, 6, lambda: next(scans), lambda: now[0], sleep), '/dev/cu.new')
        with self.assertRaisesRegex(helper.SetupError, 'accessory'):
            helper.wait_port(None, 3, lambda: [], lambda: now[0], sleep)

    def test_busy_port_never_stops_process_or_opens_uart(self):
        with patch.object(helper.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '123\n', '')) as run:
            with self.assertRaisesRegex(helper.SetupError, 'PID 123'):
                helper.check_available('/dev/cu.test')
            run.assert_called_once_with(['lsof', '-t', '/dev/cu.test', '/dev/tty.test'], capture_output=True, text=True, timeout=5)

    def test_busy_port_detected_with_partial_lsof_success(self):
        with patch.object(helper.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, '456\n', '')):
            with self.assertRaisesRegex(helper.SetupError, 'PID 456'):
                helper.check_available('/dev/cu.test')

    def test_port_discovered_after_deadline_is_not_accepted(self):
        now = [0]
        def slow_scan():
            now[0] = 61
            return ['/dev/cu.late']
        with self.assertRaisesRegex(helper.SetupError, 'deadline'):
            helper.wait_port(None, 60, slow_scan, lambda: now[0], lambda _: None)

    def test_bad_health_rejected_before_usb(self):
        good = dict(ok=True, mode='live-stream', source='pixsim', width=240, height=320, viewWidth=360, viewHeight=480)
        helper.validate_health(good)
        for bad in [[], {}, {**good, 'mode': 'static-image'}, {**good, 'width': 320}, {**good, 'source': 'fixture'}]:
            with self.assertRaises(helper.SetupError):
                helper.validate_health(bad)
        with patch.object(helper, 'check_bridge'):
            with self.assertRaises(helper.SetupError):
                helper.connect(ROOT, bridge=lambda: helper.validate_health({}), find=lambda *_: self.fail('USB must not be opened'))

    def invoke(self, run, **kwargs):
        with contextlib.redirect_stdout(io.StringIO()):
            return helper.connect(ROOT, find=lambda *_: '/dev/cu.test', available=lambda _: None,
                                  bridge=lambda: None, run=run, sleep=lambda _: None, **kwargs)

    def test_stream_starts_only_after_one_ack_and_uses_reliable_baud(self):
        commands = []
        def run(command, **kwargs):
            commands.append(command)
            return subprocess.CompletedProcess(command, 0, 'USBFRAME OK 1\n', '')
        self.invoke(run, stream=True)
        self.assertEqual(len(commands), 1)
        self.assertEqual(commands[0][-1], '--verify-and-stream')
        self.assertEqual(commands[0][-3:-1], ['--baud', '115200'])

    def test_image_only_does_not_start_continuous_video(self):
        calls = []
        def run(command, **kwargs):
            calls.append(command)
            return subprocess.CompletedProcess(command, 0, 'USBFRAME OK 1\n', '')
        self.invoke(run)
        self.assertEqual(len(calls), 1)

    def test_setup_handover_never_reconnects_after_image_or_stream(self):
        for during_stream in [False, True]:
            commands = []
            def run(command, **kwargs):
                commands.append(command)
                output = ('USBFRAME OK 1\n' if during_stream else '') + 'USBSETUP REQUEST\n'
                return subprocess.CompletedProcess(command, 75, output, '')
            self.invoke(run, stream=True)
            self.assertEqual(len(commands), 1)

    def test_missing_ack_and_timeouts_are_bounded_and_never_start_stream(self):
        for timeout in [False, True]:
            calls = []
            def run(command, **kwargs):
                calls.append(command)
                if timeout:
                    raise subprocess.TimeoutExpired(command, 60)
                return subprocess.CompletedProcess(command, 0, 'Stopped this USB stream\n', '')
            with self.assertRaisesRegex(helper.SetupError, 'exhausted'):
                self.invoke(run)
            self.assertEqual(len(calls), 3)
            self.assertTrue(all(command[-1] == '--once' for command in calls))

    def test_disconnect_rechecks_port_and_image_before_resuming(self):
        commands = []
        results = iter([(1, ''), (0, 'USBFRAME OK 2\n')])
        def run(command, **kwargs):
            commands.append(command)
            code, output = next(results)
            return subprocess.CompletedProcess(command, code, output, '')
        self.invoke(run, stream=True)
        self.assertEqual([command[-1] for command in commands], ['--verify-and-stream', '--verify-and-stream'])

    def test_health_rechecked_after_insertion_wait_and_before_stream(self):
        calls = []
        def bridge():
            calls.append('health')
            if len(calls) == 2:
                raise helper.SetupError('changed server')
        with self.assertRaisesRegex(helper.SetupError, 'changed server'):
            helper.connect(ROOT, find=lambda *_: '/dev/cu.test', available=lambda _: None,
                           bridge=bridge, run=lambda *_: self.fail('must not send image'))

    def test_stream_never_reopens_uart_after_image_validation(self):
        availability = []
        commands = []
        def available(port):
            availability.append(port)
        def run(command, **kwargs):
            commands.append(command)
            return subprocess.CompletedProcess(command, 0, 'USBFRAME OK 1\n', '')
        with contextlib.redirect_stdout(io.StringIO()):
            helper.connect(ROOT, find=lambda *_: '/dev/cu.test', available=available,
                           bridge=lambda: None, run=run, stream=True)
        self.assertEqual(len(commands), 1)
        self.assertEqual(len(availability), 1)


class PackagingTest(unittest.TestCase):
    def test_archive_has_only_public_allowlisted_files(self):
        with tempfile.TemporaryDirectory() as directory:
            outputs = packager.package(Path(directory))
            with zipfile.ZipFile(outputs[0]) as archive:
                expected = {'INSTALL.md'} | {f'{skill}/{relative}' for skill, files in packager.FILES.items() for relative in files}
                self.assertEqual(set(archive.namelist()), expected)
                self.assertIsNone(archive.testzip())

    def test_symlink_exports_refused_before_output_written(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'skills'
            source.mkdir()
            private = root / 'private.txt'
            private.write_text('fixture only; not a real secret')
            (source / 'INSTALL.md').symlink_to(private)
            destination = root / 'output'
            with self.assertRaises(ValueError):
                packager.package(destination, source)
            self.assertFalse(destination.exists())


class CleanupTest(unittest.TestCase):
    def test_timeout_terminates_and_reaps_only_owned_child(self):
        with tempfile.TemporaryDirectory() as directory:
            pid_file = Path(directory) / 'pid'
            code = f'import os,time; from pathlib import Path; Path({str(pid_file)!r}).write_text(str(os.getpid())); time.sleep(30)'
            with self.assertRaises(subprocess.TimeoutExpired):
                helper.run_viewer([sys.executable, '-c', code], cwd=ROOT, timeout=0.5, capture_output=True, text=True)
            pid = int(pid_file.read_text())
            with self.assertRaises(ProcessLookupError):
                os.kill(pid, 0)

    def test_interrupt_terminates_owned_child(self):
        with patch.object(helper.subprocess, 'Popen') as popen:
            child = popen.return_value.__enter__.return_value
            child.communicate.side_effect = KeyboardInterrupt
            child.poll.return_value = None
            with self.assertRaises(KeyboardInterrupt):
                helper.run_viewer(['fixture'], cwd=ROOT)
            child.terminate.assert_called_once()
            child.wait.assert_called_once_with(timeout=3)
            child.kill.assert_not_called()


if __name__ == '__main__':
    unittest.main()
