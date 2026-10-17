#pragma once
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

namespace cyd {
inline bool usbIdleExpired(uint32_t now, uint32_t lastFrame) { return uint32_t(now - lastFrame) >= 5000; }
struct RetrySchedule {
  uint32_t last = 0, wait = 0;
  uint8_t failures = 0;
  bool ready(uint32_t now) const { return uint32_t(now - last) >= wait; }
  uint32_t seconds(uint32_t now) const { return ready(now) ? 0 : (wait - uint32_t(now - last) + 999) / 1000; }
  void reset() { last = wait = failures = 0; }
  void failed(uint32_t now) { last = now; if (failures < 5) ++failures; wait = 2000u << (failures - 1); if (wait > 30000) wait = 30000; }
  void succeeded(uint32_t now) { failures = 0; last = now; wait = 0; }
};
inline bool receiverRetryHit(uint16_t x, uint16_t y) { return x >= 12 && x < 114 && y >= 270 && y < 314; }
inline bool receiverSettingsHit(uint16_t x, uint16_t y) { return x >= 126 && x < 228 && y >= 270 && y < 314; }
inline int setupNavigationKey(uint16_t x, uint16_t y) {
  return x < 240 && y >= 270 && y < 320 ? (x < 120 ? 0 : 1) : -1;
}
inline int wizardTab(uint16_t x, uint16_t y, uint16_t width = 240, uint16_t height = 320) {
  return width && height && x < width && uint32_t(y) * 320 < uint32_t(height) * 44 ? uint32_t(x) * 4 / width : -1;
}
struct WizardGesture {
  int x = 0, y = 0;
  bool active = false;
  void begin(uint16_t px, uint16_t py) { x = px; y = py; active = py >= 44 && py < 224; }
  int finish(uint16_t px, uint16_t py) {
    const bool allowed = active; active = false;
    if (!allowed || py < 44 || py >= 224) return 0;
    const int dx = int(px) - x, dy = int(py) - y;
    if (abs(dx) >= 48 && abs(dx) > 2 * abs(dy)) return dx < 0 ? 1 : -1;
    if (abs(dx) < 12 && abs(dy) < 12) return x < 48 && px < 48 ? -1 : x >= 192 && px >= 192 ? 1 : 0;
    return 0;
  }
};
inline uint8_t nextWizardPage(uint8_t page) { return page < 2 ? page + 1 : 0; }
inline bool checklistHit(uint16_t x, uint16_t y) { return x < 240 && y >= 224 && y < 266; }
inline bool remotePoint(uint16_t& x, uint16_t& y) {
  if (x < 16 || x >= 223 || y < 44 || y >= 320) return false;
  x = uint32_t(x - 16) * 240 / 207;
  y = uint32_t(y - 44) * 320 / 276;
  return true;
}
struct DrawRate {
  uint32_t start = 0, count = 0, tenths = 0;
  bool started = false, usb = false, measured = false;
  void add(uint32_t now, bool overUSB) {
    if (!started || usb != overUSB) { start = now; count = 0; tenths = 0; measured = false; started = true; usb = overUSB; }
    else ++count;
    const uint32_t elapsed = now - start;
    if (elapsed >= 5000) { tenths = uint64_t(count) * 10000 / elapsed; start = now; count = 0; measured = true; }
  }
};
inline bool setupOriginAllowed(const char* origin) { return origin && strcmp(origin, "http://192.168.4.1") == 0; }
// Blank means reuse only for the exact saved network; open networks are explicit.
inline bool reuseWifiPassword(const char* saved, const char* requested, const char* password, bool open) {
  return !open && saved && requested && password && !*password && *saved && strcmp(saved, requested) == 0;
}
struct UsbSession {
  bool owned = false;
  bool pause() { const bool notify = owned; owned = false; return notify; }
};
enum Direction : uint8_t { Right, Down, Left, Up };
enum class TouchTarget : uint8_t { None, Network, Play, Snake, Remote, Ignore };

// Live view: a4px marker with a16x16 touch area. Receiver/setup keeps its button.
inline bool networkHit(uint16_t x, uint16_t y, bool live = false) {
  return x >= (live ? 224 : 168) && x < 240 && y < (live ? 16 : 48);
}
inline TouchTarget touchTarget(uint16_t x, uint16_t y, bool launcher, bool details) {
  if (networkHit(x, y, !launcher && !details)) return TouchTarget::Network;
  if (details) return y >= 270 && y < 320 ? TouchTarget::Play : TouchTarget::Ignore;
  return launcher ? TouchTarget::Snake : TouchTarget::Remote;
}

inline const char* connectionLabel(bool usb, bool portal, bool connecting, bool wifi, bool live) {
  if (usb && live) return "USB";
  if (connecting) return "Connecting";
  if (portal) return "Setup";
  if (!wifi) return "Offline";
  return live ? "Live" : "Joined";
}

struct Swipe {
  int x = 0, y = 0;
  bool used = false;
  void begin(int px, int py) { x = px; y = py; used = false; }
  bool sample(int px, int py, Direction& direction) {
    const int dx = px - x, dy = py - y;
    if (used || (abs(dx) < 18 && abs(dy) < 18)) return false;
    direction = abs(dx) >= abs(dy) ? (dx > 0 ? Right : Left) : (dy > 0 ? Down : Up);
    used = true;
    return true;
  }
};

struct Snake {
  static constexpr uint16_t Side = 18, Capacity = Side * Side;
  uint16_t cells[Capacity] = {};
  uint16_t length = 4, food = 0;
  Direction direction = Right, pending = Right;
  bool alive = true, won = false, queued = false, started = false;

  bool contains(uint16_t cell, uint16_t count) const {
    for (uint16_t i = 0; i < count; ++i) if (cells[i] == cell) return true;
    return false;
  }
  void placeFood(uint32_t random) {
    food = random % Capacity;
    for (uint16_t i = 0; i < Capacity && contains(food, length); ++i) food = (food + 1) % Capacity;
  }
  void reset(uint32_t random) {
    length = 4; direction = pending = Right; alive = true; won = queued = started = false;
    for (uint16_t i = 0; i < length; ++i) cells[i] = 9 * Side + 8 - i;
    placeFood(random);
  }
  bool turn(Direction value) {
    if (!alive || queued) return false;
    if (!started) {
      // First swipe can start in any direction, including left. Orient the
      // initial body behind the head instead of immediately hitting itself.
      const int x = cells[0] % Side, y = cells[0] / Side;
      for (uint16_t i = 1; i < length; ++i) {
        cells[i] = (y + (value == Up ? i : value == Down ? -int(i) : 0)) * Side
          + x + (value == Left ? i : value == Right ? -int(i) : 0);
      }
      direction = value; started = true;
      if (contains(food, length)) placeFood(food);
    } else if (value == Direction((direction + 2) % 4)) return false;
    pending = value; queued = true;
    return true;
  }
  void step(uint32_t random) {
    if (!alive) return;
    started = true;
    direction = pending; queued = false;
    int x = cells[0] % Side, y = cells[0] / Side;
    if (direction == Right) ++x;
    if (direction == Left) --x;
    if (direction == Down) ++y;
    if (direction == Up) --y;
    if (x < 0 || x >= Side || y < 0 || y >= Side) { alive = false; return; }
    const uint16_t next = y * Side + x;
    const bool growing = next == food;
    if (contains(next, length - (growing ? 0 : 1))) { alive = false; return; }
    if (growing && length < Capacity) ++length;
    for (uint16_t i = length - 1; i > 0; --i) cells[i] = cells[i - 1];
    cells[0] = next;
    if (length == Capacity) { won = true; alive = false; }
    else if (growing) placeFood(random);
  }
};
} // namespace cyd
