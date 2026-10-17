#!/usr/bin/env python3
"""Bounded, non-secret USB diagnostics; never enters USB image mode or reads NVS."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import select
import subprocess
import termios
import time
import tty
from urllib.parse import urlsplit
import ipaddress

ROOT = Path(__file__).resolve().parents[1]
STATUS_KEYS = {'wifi', 'portal', 'editing', 'usb', 'bridge', 'frames', 'errors', 'spi_mhz', 'heap', 'rssi'}


def bridge_url(value):
    try:
        url = urlsplit(value)
        ipaddress.IPv4Address(url.hostname or '')
        port = url.port
    except ValueError as error:
        raise argparse.ArgumentTypeError('Use http://IPv4:port') from error
    if url.scheme != 'http' or url.username or url.password or url.path or url.query or url.fragment or (port is not None and not 1 <= port <= 65535):
        raise argparse.ArgumentTypeError('Use http://IPv4:port without a path or credentials')
    return value


def expected_ack(command):
    if command.startswith('?CYDBRIDGE='):
        return 'CYDCONTROL OK bridge'
    if command.startswith('?CYDSPI='):
        return 'CYDCONTROL OK spi'
    if command == '?CYDRESUME':
        return 'CYDCONTROL OK resume'
    return None


def receive_line(fd, buffer, deadline):
    while time.monotonic() < deadline:
        if b'\n' in buffer:
            raw, buffer = buffer.split(b'\n', 1)
            return raw.decode('ascii', errors='replace').strip(), buffer
        if select.select([fd], [], [], min(.2, max(0, deadline-time.monotonic())))[0]:
            buffer += os.read(fd, 4096)
            if len(buffer) > 16384:
                buffer = b''
    return None, buffer


def public_line(line):
    if line.startswith('CYDSTATUS '):
        try:
            data = json.loads(line[len('CYDSTATUS '):])
            return {'status': {key: data[key] for key in STATUS_KEYS if key in data}}
        except (ValueError, TypeError):
            return None
    match = re.fullmatch(r'CYDPERF draws=(\d+) window_ms=(\d+) receive_ms=(\d+) draw_ms=(\d+)', line)
    if match:
        draws, ms, rx, draw = map(int, match.groups())
        return {'draws': draws, 'windowMs': ms, 'drawnFps': round(draws*1000/ms, 2) if ms else None, 'receiveMs': rx, 'drawMs': draw}
    if re.fullmatch(r'CYDCONTROL (OK|ERROR) [a-z-]+', line):
        return {'control': line[len('CYDCONTROL '):]}
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bridge', type=bridge_url)
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--spi', type=int, choices=[24, 32, 40], help='RAM-only90-second LCD clock experiment;24 restores the safe default')
    parser.add_argument('--seconds', type=int, default=12, choices=range(1, 91), metavar='1..90')
    args = parser.parse_args()
    detected = subprocess.run(['python3', str(ROOT / '.opencode/skills/cyd-setup/scripts/connect.py'), '--project', str(ROOT), '--detect-only'], capture_output=True, text=True, check=True, timeout=10)
    ports = json.loads(detected.stdout)['ports']
    if len(ports) != 1:
        raise SystemExit('Need exactly one confirmed USB adapter; reconnect or identify the board.')
    owners = subprocess.run(['lsof', '-t', ports[0]], capture_output=True, text=True, timeout=5)
    if owners.stdout.strip():
        raise SystemExit('Serial port is already in use. Close its current helper/monitor first; nothing was stopped.')
    fd = os.open(ports[0], os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
    old = termios.tcgetattr(fd)
    try:
        fcntl.ioctl(fd, termios.TIOCEXCL)
        tty.setraw(fd)
        attrs = termios.tcgetattr(fd)
        attrs[4] = attrs[5] = termios.B115200
        attrs[2] |= termios.CLOCAL | termios.CREAD
        attrs[2] &= ~termios.HUPCL
        termios.tcsetattr(fd, termios.TCSANOW, attrs)
        commands = []
        if args.bridge:
            commands.append('?CYDBRIDGE=' + args.bridge)
        if args.resume:
            commands.append('?CYDRESUME')
        if args.spi:
            commands.append('?CYDSPI=' + str(args.spi))
        commands.append('?CYDSTATUS')
        buffer = b''
        for command in commands:
            payload = (command+'\n').encode('ascii')
            while payload:
                _, writable, _ = select.select([], [fd], [], 2)
                if not writable:
                    raise TimeoutError('USB write timed out')
                payload = payload[os.write(fd, payload):]
            deadline = time.monotonic() + 5
            acknowledged = False
            while time.monotonic() < deadline:
                line, buffer = receive_line(fd, buffer, deadline)
                if line is None:
                    break
                result = public_line(line)
                if result:
                    print(json.dumps(result), flush=True)
                if line.startswith('CYDCONTROL ERROR '):
                    raise RuntimeError('Receiver rejected the command; no automatic fallback or reflash')
                if (command == '?CYDSTATUS' and result and 'status' in result) or line == expected_ack(command):
                    acknowledged = True
                    break
            if not acknowledged:
                raise TimeoutError('Receiver control command not acknowledged; installed firmware may be older')
        deadline = time.monotonic() + args.seconds
        while time.monotonic() < deadline:
            line, buffer = receive_line(fd, buffer, deadline)
            if line is not None:
                result = public_line(line)
                if result:
                    print(json.dumps(result), flush=True)
    finally:
        try:
            old[2] &= ~termios.HUPCL  # Do not restore a hang-up-on-close reset.
            termios.tcsetattr(fd, termios.TCSANOW, old)
        finally:
            os.close(fd)


if __name__ == '__main__':
    main()
