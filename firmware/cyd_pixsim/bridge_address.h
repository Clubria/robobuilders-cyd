#pragma once
#include <stdint.h>
#include <string.h>

namespace cyd {
struct BridgeAddress { uint8_t ip[4] = {}; uint16_t port = 80; };
inline bool decimal(const char*& text, unsigned maximum, unsigned& value) {
  if (*text < '0' || *text > '9') return false;
  value = 0;
  do { value = value * 10 + unsigned(*text++ - '0'); if (value > maximum) return false; }
  while (*text >= '0' && *text <= '9');
  return true;
}
inline bool parseBridgeAddress(const char* text, BridgeAddress& result) {
  if (!text || strncmp(text, "http://", 7)) return false;
  text += 7;
  for (unsigned i = 0; i < 4; ++i) {
    unsigned value;
    if (!decimal(text, 255, value)) return false;
    result.ip[i] = uint8_t(value);
    if (i < 3 && *text++ != '.') return false;
  }
  result.port = 80;
  if (*text == ':') { unsigned port; ++text; if (!decimal(text, 65535, port) || !port) return false; result.port = uint16_t(port); }
  return !*text;
}
inline bool parseLastOctet(const char* text, unsigned& value) {
  return text && decimal(text, 255, value) && !*text;
}
inline bool receiverAddressHit(uint16_t x, uint16_t y) { return x >= 12 && x < 228 && y >= 188 && y < 230; }
// -1 outside; 0..9 digits; 10 cancel; 11 delete; 12 save.
inline int addressKey(uint16_t x, uint16_t y) {
  if (x >= 12 && x < 228 && y >= 270 && y < 314) return 12;
  if (x < 12 || x >= 228 || y < 100 || y >= 260) return -1;
  const int column = (x - 12) / 72, row = (y - 100) / 40;
  if ((x - 12) % 72 >= 68 || (y - 100) % 40 >= 36) return -1;
  return row < 3 ? row * 3 + column + 1 : column == 0 ? 10 : column == 1 ? 0 : 11;
}
}
