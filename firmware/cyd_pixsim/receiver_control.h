#pragma once
#include <stddef.h>
#include <stdint.h>
#include <string.h>

namespace cyd {
// Separate from CYDJPEG/HELLO; parsed only outside binary USB packets.
struct ControlLine {
  char text[224] = {};
  size_t length = 0;
  bool active = false, complete = false, overflow = false, carriage = false;
  void reset() { length = 0; active = complete = overflow = carriage = false; text[0] = 0; }
  bool consume(uint8_t byte) {
    if (!active && byte != '?') return false;
    active = true;
    if (byte == '\n') { text[length] = 0; complete = true; return true; }
    if (carriage) overflow = true;
    if (byte == '\r') { carriage = true; return true; }
    if (byte < 32 || byte > 126 || length >= sizeof(text) - 1) overflow = true;
    else if (!overflow) text[length++] = char(byte);
    return true;
  }
};
inline uint32_t experimentClock(const char* command) {
  if (!strcmp(command, "?CYDSPI=24")) return 24;
  if (!strcmp(command, "?CYDSPI=32")) return 32;
  if (!strcmp(command, "?CYDSPI=40")) return 40;
  return 0;
}
inline uint32_t experimentBaud(const char* command) {
  if (!strcmp(command, "?CYDBAUD=115200")) return 115200;
  if (!strcmp(command, "?CYDBAUD=230400")) return 230400;
  if (!strcmp(command, "?CYDBAUD=460800")) return 460800;
  return 0;
}
inline bool baudIdleExpired(uint32_t now, uint32_t lastProgress) { return uint32_t(now - lastProgress) >= 30000; }
}
