#!/usr/bin/env python3
"""Bounded macOS USB detection/reconnect; uses the project's installed viewer.

No flashing, dependency installation, server killing, or Wi-Fi configuration.
"""
import argparse
import json
from pathlib import Path
import plistlib
import signal
import subprocess
import sys
import time
import urllib.request

USB_ID = (0x1A86, 0x7523)


class SetupError(Exception):
    pass


def ports_from_registry(roots):
    ports = set()

    def walk(node, usb=None):
        if 'idVendor' in node and 'idProduct' in node:
            usb = (node['idVendor'], node['idProduct'])
        port = node.get('IOCalloutDevice')
        if usb == USB_ID and isinstance(port, str) and port.startswith('/dev/cu.'):
            ports.add(port)
        for child in node.get('IORegistryEntryChildren', []):
            walk(child, usb)

    for root in roots:
        walk(root)
    return sorted(ports)


def discover(timeout=10):
    if sys.platform != 'darwin':
        raise SetupError('This helper requires macOS; ask for a platform-specific serial detector.')
    try:
        result = subprocess.run(['ioreg', '-a', '-l', '-r', '-c', 'IOUSBHostDevice'],
                                capture_output=True, check=True, timeout=timeout)
        # ioreg emits zero bytes (not an empty plist) when no USB roots exist.
        if not result.stdout.strip():
            return []
        return ports_from_registry(plistlib.loads(result.stdout))
    except (OSError, subprocess.SubprocessError, plistlib.InvalidFileException, ValueError) as error:
        raise SetupError('USB discovery failed; inspect macOS USB/accessory access. No serial port was opened.') from error


def select_port(ports, requested=None):
    if requested:
        return requested if requested in ports else None
    if len(ports) > 1:
        raise SetupError('Multiple 1a86:7523 adapters: ' + ', '.join(ports) +
                         '. Ask which is the CYD, then use --port; do not guess.')
    return ports[0] if ports else None


def wait_port(requested, seconds, scan=None, clock=time.monotonic, sleep=time.sleep):
    deadline = clock() + seconds
    while True:
        remaining = deadline - clock()
        if remaining <= 0:
            raise SetupError('No matching USB data adapter. Ask to replug the known data cable/adapter, '
                             'approve the macOS accessory prompt, or try a direct USB port; then retry.')
        ports = scan() if scan else discover(timeout=min(10, remaining))
        port = select_port(ports, requested)
        if clock() >= deadline:
            raise SetupError('USB discovery exceeded the wait deadline. Ask to check the data cable/accessory access, then retry.')
        if port:
            return port
        remaining = deadline - clock()
        sleep(min(2, remaining))


def check_available(port):
    # macOS callout and dial-in nodes address the same serial hardware.
    dialin = '/dev/tty.' + port.removeprefix('/dev/cu.')
    try:
        result = subprocess.run(['lsof', '-t', port, dialin], capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.SubprocessError) as error:
        raise SetupError('Could not check serial ownership; do not open the port blindly.') from error
    # lsof can return 1 when one node has no owner, even if the other prints PIDs.
    if result.stdout.strip():
        raise SetupError(f'Serial port {port} is busy (PID {result.stdout.strip()}). '
                         'Reuse its live viewer or ask its owner to close it; no process was stopped.')
    if result.returncode not in (0, 1) or result.stderr.strip():
        raise SetupError('Serial ownership check failed; inspect lsof before connecting.')


def validate_health(status):
    if not (isinstance(status, dict) and status.get('ok') is True and status.get('mode') == 'live-stream'
            and status.get('source') == 'pixsim'
            and (status.get('width'), status.get('height')) == (240, 320)
            and (status.get('viewWidth'), status.get('viewHeight')) == (360, 480)):
        raise SetupError('Port 3088 is not the expected live portrait Pixsim bridge. '
                         'Ask about server ownership before replacing it with pnpm dev:cyd.')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise SetupError('Local bridge redirected; refusing another host.')


def check_bridge():
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        with opener.open('http://localhost:3088/health', timeout=5) as response:
            status = json.load(response)
    except (OSError, ValueError) as error:
        raise SetupError('Bridge unavailable. Start pnpm dev:cyd in the project and retry health; '
                         'do not start a second server if port 3088 is already owned.') from error
    validate_health(status)


def run_viewer(command, *, cwd, timeout=None, capture_output=False, text=False):
    # Explicitly release our child's UART/touch state on timeout or parent stop.
    with subprocess.Popen(command, cwd=cwd, text=text,
                          stdout=subprocess.PIPE if capture_output else None,
                          stderr=subprocess.PIPE if capture_output else None) as child:
        try:
            stdout, stderr = child.communicate(timeout=timeout)
            return subprocess.CompletedProcess(command, child.returncode, stdout, stderr)
        except BaseException:
            if child.poll() is None:
                child.terminate()
                try:
                    child.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait()
            raise


def connect(project, requested=None, wait=60, attempts=3, stream=False,
            find=wait_port, available=check_available, bridge=check_bridge,
            run=run_viewer, sleep=time.sleep):
    script = project / 'scripts' / 'usb_stream.py'
    if not script.is_file() or not (project / 'firmware/cyd_pixsim/board_display.h').is_file():
        raise SetupError('Project files missing. Ask for the existing robobuilders-cyd directory; do not invent a remote.')
    for attempt in range(attempts):
        # Ambiguity, busy ports and wrong servers are blockers, not retryable faults.
        bridge()
        port = find(requested, wait)
        available(port)
        bridge()  # The server may have changed during the insertion wait.
        command = [sys.executable, str(script), '--port', port, '--baud', '115200']
        print(f'Attempt {attempt + 1}/{attempts}: {port}; verify one JPEG first.', flush=True)
        try:
            # Keep one UART reader across first-image validation and streaming:
            # reopening could miss a device setup request immediately after ACK.
            result = run(command + (['--verify-and-stream'] if stream else ['--once']), cwd=project,
                         timeout=None if stream else 60, capture_output=not stream, text=True)
            if result.stdout:
                print(result.stdout, end='', flush=True)
            if result.returncode == 75:
                print('Device requested Wi-Fi setup; leaving USB paused, without reconnecting.', flush=True)
                return
            if result.returncode == 0 and (stream or 'USBFRAME OK ' in (result.stdout or '')):
                return
        except subprocess.TimeoutExpired:
            print('Viewer test timed out; retrying at the same reliable baud.', flush=True)
        if attempt + 1 < attempts:
            print('Connection failed; retrying after two seconds. No firmware change.', flush=True)
            sleep(2)
    raise SetupError('Reconnect attempts exhausted. Ask to release BOOT and reset/replug the known board. '
                     'Check viewer firmware/cable; do not auto-flash or increase baud.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, default=Path.cwd())
    parser.add_argument('--port', help='Explicit callout port; must match VID/PID')
    parser.add_argument('--wait', type=int, default=60, help='Maximum seconds waiting for insertion per attempt (1–60)')
    parser.add_argument('--attempts', type=int, default=3, help='Total connection attempts (1–3)')
    parser.add_argument('--stream', action='store_true', help='Start continuous video/touch after one successful image')
    parser.add_argument('--detect-only', action='store_true', help='List matching adapters; no HTTP or serial access')
    # pnpm versions differ in whether they forward the optional '--' separator.
    arguments = sys.argv[1:]
    args = parser.parse_args(arguments[1:] if arguments[:1] == ['--'] else arguments)
    # Let run_viewer's interrupt cleanup stop only our own viewer child.
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    if not 1 <= args.wait <= 60 or not 1 <= args.attempts <= 3:
        parser.error('--wait must be 1–60 and --attempts 1–3')
    try:
        if args.detect_only:
            print(json.dumps({'vid': '1a86', 'pid': '7523', 'ports': discover()}))
        else:
            connect(args.project.resolve(), args.port, args.wait, args.attempts, args.stream)
    except SetupError as error:
        print(f'Setup needs help: {error}', file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print('Stopped this connection helper; other servers were left alone.')
        return 130
    except OSError:
        print('Setup needs help: local command failed. Check Python/project permissions; no firmware changed.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
