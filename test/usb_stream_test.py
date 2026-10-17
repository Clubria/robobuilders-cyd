import importlib.util
from pathlib import Path
import struct
import unittest
import sys
import threading
import json
import queue
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from usb_input import touch_command, InputWorker

spec = importlib.util.spec_from_file_location("usb_stream", Path(__file__).parents[1] / "scripts/usb_stream.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PacketTest(unittest.TestCase):
    def test_runtime_baud_switch_requires_exact_ack_and_rejects_unsafe_rates(self):
        uart = object.__new__(module.UART)
        uart.fd, uart.baud = 99, 115200
        sent = []
        uart.send = sent.append
        uart.message = lambda timeout: 'CYDCONTROL ERROR command'
        with self.assertRaises(RuntimeError): uart.negotiate(460800)
        self.assertEqual(uart.baud,115200)
        with self.assertRaises(ValueError): uart.negotiate(921600)
        uart.message = lambda timeout: 'CYDCONTROL OK baud'
        with patch.object(module.time,'sleep'), patch.object(module.termios,'tcgetattr',return_value=[0,0,0,0,0,0,[]]), patch.object(module.termios,'tcsetattr'), patch.object(module.fcntl,'ioctl'):
            uart.negotiate(460800)
        self.assertEqual(uart.baud,460800)
        self.assertEqual(sent[-1],b'?CYDBAUD=460800\n')

    def test_device_setup_request_interrupts_ack_and_does_not_forward_more_touch(self):
        uart = object.__new__(module.UART)
        uart.setup_requested = threading.Event()
        uart.width, uart.height = 240, 320
        uart.messages = queue.Queue(maxsize=128)
        uart.failure = None
        events = []
        class Inputs:
            def submit(self, command): events.append(command)
        uart.inputs = Inputs()
        uart.handle_line('USBTOUCH D 10 20')
        self.assertEqual(len(events), 1)
        uart.handle_line('USBSETUP REQUEST')
        uart.handle_line('USBTOUCH M 15 20')
        self.assertEqual(len(events), 1)
        with self.assertRaises(module.SetupRequested): uart.message(1)
        with self.assertRaises(module.SetupRequested): uart.send(b'never sent')

    def test_frame_age_metadata_is_optional_and_nonnegative(self):
        self.assertEqual(module.frame_age('125'), 125)
        for value in [None, 'bad', '-1']:
            self.assertIsNone(module.frame_age(value))
    def test_pointer_phases_and_bounds(self):
        for code, phase in [('D', 'down'), ('M', 'move'), ('U', 'up')]:
            self.assertEqual(touch_command(f'USBTOUCH {code} 100 200'), {'action': 'pointer', 'phase': phase, 'x': 100, 'y': 200})
        for line in ['USBTOUCH D 320 0', 'USBTOUCH M -1 0', 'USBTOUCH U 0 240', 'USBTOUCH X 0 0', 'USBTOUCH D bad 1']:
            self.assertIsNone(touch_command(line))
        self.assertIsNotNone(touch_command('USBTOUCH D 239 319', 240, 320))
        self.assertIsNone(touch_command('USBTOUCH D 240 319', 240, 320))

    def test_redirects_are_denied(self):
        with self.assertRaises(ValueError):
            module.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://outside.example')

    def test_input_worker_coalesces_moves_and_keeps_press_release_order(self):
        entered, release, done = threading.Event(), threading.Event(), threading.Event()
        events = []
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{}'
        class Opener:
            def open(self, request, timeout):
                command = json.loads(request.data)
                events.append(command)
                if len(events) == 1:
                    entered.set(); release.wait(2)
                if sum(e['phase'] == 'up' for e in events) == 2:
                    done.set()
                return Response()
        worker = InputWorker('http://localhost:3088', Opener())
        try:
            worker.submit({'action':'pointer','phase':'down','x':0,'y':0})
            self.assertTrue(entered.wait(1))
            for i in range(100): worker.submit({'action':'pointer','phase':'move','x':i,'y':0})
            for phase in ['up','down','up']: worker.submit({'action':'pointer','phase':phase,'x':99,'y':0})
            release.set(); self.assertTrue(done.wait(2))
            self.assertEqual([e['phase'] for e in events], ['down','move','up','down','up'])
            self.assertEqual(worker.stats['coalesced'], 99)
        finally:
            release.set(); worker.close()
    def test_binary_framing_preserves_bytes(self):
        jpeg = b"\xff\xd8\x00\x80\xff\xd9"
        wire = module.packet(jpeg)
        self.assertEqual(wire[:8], b"CYDJPEG\n")
        self.assertEqual(struct.unpack("<I", wire[8:12])[0], len(jpeg))
        self.assertEqual(wire[12:], jpeg)

    def test_rejects_invalid_or_oversized_frames(self):
        for frame in [b"", b"HTML", b"\xff\xd8broken", b"\xff\xd8" + b"x" * 65536 + b"\xff\xd9"]:
            with self.assertRaises(ValueError):
                module.packet(frame)


if __name__ == "__main__":
    unittest.main()
