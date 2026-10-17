#!/usr/bin/env python3
"""Mac-only UART JPEG stream. No Wi-Fi credentials or extra Python packages."""
import argparse
import os
import fcntl
import select
import signal
import struct
import termios
import time
import tty
import urllib.request
import array
import queue
import threading
import sys
from usb_input import InputWorker, touch_command

MAX_JPEG = 65536
MAGIC = b"CYDJPEG\n"
SETUP_EXIT = 75  # Intentional on-device handover, never an automatic reconnect.


class SetupRequested(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Local bridge redirects are not allowed")


HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())


def packet(frame):
    if not 4 <= len(frame) <= MAX_JPEG or not frame.startswith(b"\xff\xd8") or not frame.endswith(b"\xff\xd9"):
        raise ValueError("Frame must be a complete JPEG of at most 64 KB")
    return MAGIC + struct.pack("<I", len(frame)) + frame


class UART:
    def __init__(self, port, baud=115200, width=240, height=320):
        self.fd = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
        try:
            fcntl.ioctl(self.fd, termios.TIOCEXCL)
            tty.setraw(self.fd)
            attrs = termios.tcgetattr(self.fd)
            native_baud = getattr(termios, f'B{baud}', None)
            attrs[4] = attrs[5] = native_baud or termios.B115200
            attrs[2] |= termios.CLOCAL | termios.CREAD
            attrs[2] &= ~termios.HUPCL
            for name in ['CRTSCTS', 'CCTS_OFLOW', 'CRTS_IFLOW', 'CDTR_IFLOW', 'CDSR_OFLOW']:
                attrs[2] &= ~getattr(termios, name, 0)
            termios.tcsetattr(self.fd, termios.TCSANOW, attrs)
            if native_baud is None:
                # Darwin IOSSIOSPEED, used for non-standard UART rates by pyserial too.
                fcntl.ioctl(self.fd, 0x80045402, array.array('I', [baud]))
            fcntl.ioctl(self.fd, termios.TIOCMBIC, array.array('i', [termios.TIOCM_DTR | termios.TIOCM_RTS]))
        except BaseException:
            os.close(self.fd)
            raise
        self.buffer = bytearray()
        self.lines = []
        self.messages = queue.Queue(maxsize=128)
        self.stopped = threading.Event()
        self.setup_requested = threading.Event()
        self.failure = None
        self.inputs = None
        self.baud = baud
        self.width, self.height = width, height
        self.reader = threading.Thread(target=self.receive, daemon=True)
        self.reader.start()

    def receive(self):
        try:
            while not self.stopped.is_set():
                self.read(0.05)
                while self.lines:
                    line = self.lines.pop(0)
                    self.handle_line(line)
        except BaseException as error:
            self.failure = error

    def handle_line(self, line):
        if line == 'USBSETUP REQUEST':
            self.setup_requested.set()
            return
        command = touch_command(line, self.width, self.height)
        if command and self.inputs and not self.setup_requested.is_set():
            self.inputs.submit(command)
        elif line.startswith(("USBFRAME ", "CYDREADY", "CYDCONTROL ")):
            self.messages.put_nowait(line)

    def check_setup(self):
        if self.setup_requested.is_set():
            raise SetupRequested()

    def message(self, timeout):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            self.check_setup()
            if self.failure:
                raise ConnectionError("USB receiver stopped") from self.failure
            try:
                return self.messages.get(timeout=min(0.1, max(0, end - time.monotonic())))
            except queue.Empty:
                pass
        raise TimeoutError("No viewer response; check firmware and cable")

    def ready(self):
        self.send(b"CYDHELLO\n")
        end = time.monotonic() + 15
        while time.monotonic() < end:
            line = self.message(max(0, end - time.monotonic()))
            if line == f"CYDREADY2 {self.width} {self.height} {self.baud}":
                return
        raise TimeoutError("No viewer identity/readiness response; no JPEG was sent")

    def negotiate(self, baud):
        if baud not in (115200, 230400, 460800):
            raise ValueError('Negotiated speed must be 115200, 230400 or 460800')
        self.send(f'?CYDBAUD={baud}\n'.encode('ascii'))
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            line = self.message(max(0, deadline - time.monotonic()))
            if line.startswith('CYDCONTROL ERROR '):
                raise RuntimeError('Receiver rejected UART speed; no JPEG sent')
            if line == 'CYDCONTROL OK baud':
                # Receiver flushes its old-rate ACK then changes speed after30ms.
                time.sleep(.08)
                attrs = termios.tcgetattr(self.fd)
                native = getattr(termios, f'B{baud}', None)
                attrs[4] = attrs[5] = native or termios.B115200
                termios.tcsetattr(self.fd, termios.TCSANOW, attrs)
                if native is None:
                    fcntl.ioctl(self.fd, 0x80045402, array.array('I', [baud]))
                self.baud = baud
                return
        raise TimeoutError('UART switch not acknowledged; no JPEG sent')

    def read(self, timeout):
        if select.select([self.fd], [], [], timeout)[0]:
            data = os.read(self.fd, 4096)
            if not data:
                raise ConnectionError("USB device disconnected")
            self.buffer.extend(data)
            while b"\n" in self.buffer:
                line, _, self.buffer = self.buffer.partition(b"\n")
                self.lines.append(line.decode("utf-8", errors="replace").strip())
            if len(self.buffer) > 8192:
                self.buffer.clear()

    def send(self, data, timeout=12):
        self.check_setup()
        end = time.monotonic() + timeout
        offset = 0
        while offset < len(data):
            remaining = end - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("USB write timed out")
            if self.failure:
                raise ConnectionError("USB receiver stopped") from self.failure
            _, writable, _ = select.select([], [self.fd], [], remaining)
            if writable:
                try:
                    offset += os.write(self.fd, data[offset:offset + 1024])
                except BlockingIOError:
                    pass

    def close(self):
        self.stopped.set()
        self.reader.join(timeout=1)
        if self.inputs:
            self.inputs.close()
        os.close(self.fd)


def acknowledge(uart):
    end = time.monotonic() + 8
    while time.monotonic() < end:
        line = uart.message(max(0, end - time.monotonic()))
        if line.startswith("USBFRAME OK "):
            return line
        if line.startswith("USBFRAME ERROR"):
            raise RuntimeError(line)
    raise TimeoutError("No board decode acknowledgement")


def frame_age(value):
    try:
        age = int(value)
        return age if age >= 0 else None
    except (TypeError, ValueError):
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", default="/dev/cu.usbserial-110")
    parser.add_argument("--server", default="http://localhost:3088")
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--verify-and-stream", action="store_true", help="Verify the first draw then stream on the same UART connection")
    parser.add_argument("--frames", type=int, default=0, help="Stop after this many acknowledged frames; 0 runs continuously")
    parser.add_argument("--baud", type=int, choices=[115200, 230400, 460800, 921600], default=115200)
    parser.add_argument('--negotiate', action='store_true', help='Switch from115200 at runtime; restore on exit, board falls back after30s without draws')
    args = parser.parse_args()
    base = args.server.rstrip("/")
    if base not in ["http://localhost:3088", "http://127.0.0.1:3088"]:
        parser.error("USB helper only connects to this Mac's local bridge on port 3088")
    with HTTP.open(base + '/health', timeout=5) as response:
        status = __import__('json').load(response)
    width, height = status['width'], status['height']
    if (width, height) not in [(240, 320), (320, 240)]:
        parser.error('Bridge dimensions must match a CYD orientation')
    if args.negotiate and args.baud == 921600:
        parser.error('Bounded runtime negotiation supports at most460800')
    uart = UART(args.port, 115200 if args.negotiate else args.baud, width, height)
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    count = 0
    started = time.monotonic()
    try:
        uart.ready()
        if args.negotiate and args.baud != 115200:
            uart.negotiate(args.baud)
            uart.ready()
            print(f'Experimental USB {args.baud}; default115200 will be restored.', flush=True)
        started = time.monotonic()
        uart.inputs = InputWorker(base, HTTP)
        print("Confirmed compatible 240x320 viewer ready; sending JPEG", flush=True)
        stale = False
        while True:
            uart.check_setup()
            # Acknowledge every draw before sending another frame. UART is not a video codec.
            req = urllib.request.Request(base + "/frame.jpg", headers={"User-Agent": "CYD-USB-bridge", "X-Input-Source": "usb"})
            with HTTP.open(req, timeout=5) as response:
                received_at = time.monotonic()
                age = frame_age(response.headers.get('X-Frame-Age-Ms'))
                if response.headers.get_content_type() != "image/jpeg":
                    raise ValueError("Local bridge did not return image/jpeg")
                frame = response.read(MAX_JPEG + 1)
            if age is not None and age > 3000:
                if args.once:
                    raise TimeoutError('Mac frame is stale; no JPEG sent')
                if not stale:
                    print('Mac frame stale; holding USB frames so the local waiting game can appear.', flush=True)
                stale = True
                time.sleep(0.25)
                continue
            stale = False
            for attempt in range(3):
                try:
                    transfer_at = time.monotonic()
                    uart.send(packet(frame))
                    acknowledgement = acknowledge(uart)
                    acknowledged_at = time.monotonic()
                    break
                except (TimeoutError, RuntimeError):
                    if attempt == 2:
                        raise
                    print('USB frame response lost; resynchronizing before retry', flush=True)
                    # Longer than the receiver's inactivity timeout; don't inject a header into a partial JPEG.
                    time.sleep(5.1)
                    uart.ready()
            count += 1
            if count == 1 and args.verify_and_stream:
                print('Image acknowledged. Continuing video and touch on the same UART connection.', flush=True)
            if count == 1 or count % 10 == 0 or args.once:
                fps = count / max(0.001, time.monotonic() - started)
                transfer_ms = round((acknowledged_at - transfer_at) * 1000)
                frame_ready_to_ack_ms = age + round((acknowledged_at - received_at) * 1000) if age is not None else 'unknown'
                print(f"{acknowledgement}; {len(frame)} bytes; USB average {fps:.2f} FPS; "
                      f"send/draw/ACK {transfer_ms} ms; frame-ready-to-ACK estimate {frame_ready_to_ack_ms} ms; input {uart.inputs.stats}", flush=True)
            if args.once or (args.frames > 0 and count >= args.frames):
                break
    except SetupRequested:
        print('USBSETUP REQUEST: USB paused for on-device Wi-Fi setup. Mac bridge left running.', flush=True)
        return SETUP_EXIT
    except KeyboardInterrupt:
        print("Stopped this USB stream", flush=True)
    finally:
        if args.negotiate and uart.baud != 115200 and not uart.setup_requested.is_set():
            try:
                uart.negotiate(115200)
                print('USB restored to115200.', flush=True)
            except (TimeoutError, RuntimeError, OSError, ConnectionError, SetupRequested):
                print('USB restore unconfirmed; board idle fallback is30 seconds.', flush=True)
        uart.close()


if __name__ == "__main__":
    sys.exit(main())
