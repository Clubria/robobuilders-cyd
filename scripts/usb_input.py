"""Bounded, ordered pointer forwarding independent of JPEG UART writes."""
import collections
import json
import threading
import time
import urllib.request


def touch_command(line, width=320, height=240):
    parts = line.split()
    if len(parts) != 4 or parts[0] != "USBTOUCH" or parts[1] not in ["D", "M", "U"]:
        return None
    try:
        x, y = int(parts[2]), int(parts[3])
    except ValueError:
        return None
    if not 0 <= x < width or not 0 <= y < height:
        return None
    return {"action": "pointer", "phase": {"D": "down", "M": "move", "U": "up"}[parts[1]], "x": x, "y": y}


class InputWorker:
    def __init__(self, base, opener):
        self.base, self.opener = base, opener
        self.pending = collections.deque()
        self.condition = threading.Condition()
        self.stopped = False
        self.stats = {"events": 0, "errors": 0, "coalesced": 0, "last_ms": 0}
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()

    def submit(self, command):
        with self.condition:
            if self.stopped:
                return
            if command["phase"] == "move" and self.pending and self.pending[-1][0]["phase"] == "move":
                self.pending.pop(); self.stats["coalesced"] += 1
            if len(self.pending) >= 64:
                # Fail closed: a lost release must not leave a game button held.
                self.pending.clear()
                self.pending.append(({"action": "pointer", "phase": "cancel"}, time.monotonic()))
                self.stats["errors"] += 1
            else:
                self.pending.append((command, time.monotonic()))
            self.condition.notify()

    def send(self, command):
        req = urllib.request.Request(self.base + "/input", data=json.dumps(command).encode(),
            headers={"Content-Type": "application/json", "X-Input-Source": "usb"}, method="POST")
        with self.opener.open(req, timeout=2) as response:
            response.read()

    def run(self):
        while True:
            with self.condition:
                self.condition.wait_for(lambda: self.pending or self.stopped)
                if self.stopped:
                    return
                command, received = self.pending.popleft()
            try:
                self.send(command)
                self.stats["events"] += 1
                self.stats["last_ms"] = round((time.monotonic() - received) * 1000)
            except (OSError, ValueError):
                self.stats["errors"] += 1
                try:
                    self.send({"action": "pointer", "phase": "cancel"})
                except (OSError, ValueError):
                    pass

    def close(self):
        with self.condition:
            self.stopped = True; self.pending.clear(); self.condition.notify()
        self.thread.join(timeout=3)
        try:
            self.send({"action": "pointer", "phase": "cancel"})
        except (OSError, ValueError):
            pass
