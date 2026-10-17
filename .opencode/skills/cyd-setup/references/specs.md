# Confirmed CYD / Pixsim specifications

These describe the user's confirmed unit, not every product sold as a CYD.
The board label, chip interrogation, flashed viewer, and user image/touch reports
are the evidence. Reconfirm hardware for a different unit.

## Hardware

| Item | Specification |
| --- | --- |
| Board | GUITION JC2432W328 |
| MCU | ESP32-D0WD-V3, revision 3.1; dual-core Xtensa LX6 (up to 240 MHz) |
| Memory | 520 KB on-chip SRAM; 4 MB flash; no PSRAM |
| Display | 2.8-inch ST7789 TFT, native 240×320; current portrait rotation 0 |
| Touch | CST820 capacitive, single-touch; CST8xx-compatible LovyanGFX driver |
| Display SPI pins | SCLK14, MOSI13, MISO12, DC2, CS15, reset−1 |
| Backlight | GPIO27 |
| Touch pins | SDA33, SCL32, reset25, IRQ−1; I2C address 0x15 |
| Firmware bus configuration | SPI write24 MHz/read10 MHz; touch I2C400 kHz |
| Wireless hardware | 2.4 GHz Wi-Fi; ESP32 Bluetooth capability, not implemented as this viewer's transport |
| USB serial adapter | VID `1a86`, PID `7523`; last verified port `/dev/cu.usbserial-110` |
| Working cable setup | USB-A-to-C data cable plus Mac adapter; accessory approval was required |
| Audio | No built-in microphone; no audio transport in this viewer |

USB VID/PID identifies an adapter type, not a globally unique board. The readiness
handshake identifies the installed viewer's dimensions/baud, not a unique chip
identity. Multiple adapters require explicit selection; no flash operation relies
on these two checks alone.

## Viewer and bridge

- macOS host; Node22+, pnpm, Python3 standard library, Puppeteer24 and Chrome.
- Game source: `https://pixsim.vercel.app/newyork`; source is not modified.
- Local bridge: `http://localhost:3088`; preview `/preview`, health `/health`,
  device image `/frame.jpg`, input `/input`. Browser MJPEG `/stream.mjpg` is not
  the board's transport. All clients control the same isolated game session.
- Browser viewport360×480 → output240×320, scale2/3.
- Avatar top-left; three action slots0/1/3 and room-gated mic along the bottom.
  Mic reserves the bottom-left48-pixel slot and is invisible when unavailable,
  without shifting anything. The contextual Talk/Play/Mount action is52 physical
  pixels and follows it; the other two actions are48 pixels, all pixel-aligned.
  Chat and Hold/Stop are removed; road dragging is walking.
- HTML UI font approximately1.2×, pixel-snapped; not a change to canvas text.
  Scene saturation1.12, contrast1.05, brightness1.02 and `image-rendering:pixelated`.
  This is a browser rendering adjustment, not a new on-device shader.
- UART115200, 16 KB firmware receive buffer, 64 KB maximum JPEG.
- Handshake: `CYDHELLO\n` → `CYDREADY2 240 320 115200`.
- Image packet: `CYDJPEG\n`, uint32 little-endian length, complete JPEG.
  `USBFRAME OK <sequence>` acknowledges decode/draw. Touch phases are
  `USBTOUCH D/M/U x y`; host forwarding is ordered and coalesces moves.
- Firmware build verified with Arduino ESP32 core3.3.0, LovyanGFX1.2.7,
  `esp32:esp32:esp32:PartitionScheme=min_spiffs,FlashMode=dio,FlashFreq=40,UploadSpeed=115200`.
- Firmware supports device-local Wi-Fi provisioning and authenticated ArduinoOTA.
  Hold BOOT three seconds while the application is running for setup; not at reset.

## Verified versus pending

- Factory4 MB backup privately saved and digest-verified before upload. Do not
  include backups, credentials, local manifests, or setup-password photos in exports.
- Firmware uploads and decoded portrait JPEG acknowledged. User confirmed image,
  USB video, touch, and road-drag walking. These are historical checks, not proof
  that a future reconnect or changed UI works on the physical board.
- Sustained115200 USB: approximately0.9 FPS; over1100 physical input events in the
  prior run, typical host forwarding20–65 ms. That latency is not end-to-end visual
  latency. 921600 failed readiness;230400 later lost replies; keep115200.
- Mac capture target8 FPS, commonly around50–70 ms per capture in prior checks.
  Target is not measured device FPS. Read current health and actual helper logs.
- `pnpm dev:compact` is an isolated CYD Compact browser profile, not a rewritten
  Pixsim engine. It seeds the supported lightweight animation preference before
  boot, uses reduced-motion, disables the DOM character-switch effect/HTML
  transitions and uses JPEG quality35. Canvas weather/other FX are not all disabled.
  Smaller downloaded playable sprite variants have not been generated.
- Persistent caching uses a separate, per-origin Chrome profile under ignored
  `artifacts/browser-cache/cyd-compact/`. It retains cookies, localStorage and
  IndexedDB as well as HTTP assets, enabling the game's existing texture caches.
  Do not export the profile; it is not the personal browser profile. Live JPEGs
  stay `no-store` so image caching cannot cause frozen frames.
- A controlled same-pixel240×320 comparison with HUD present measured6198-byte
  quality35 versus8400-byte quality55 images (about26% smaller). Theoretical
  115200-baud wire floors were540 versus731 ms, excluding other work. This is
  not measured FPS or evidence of a new on-board firmware/transport.
- The helper logs send/draw/ACK duration and a frame-ready-to-ACK estimate.
  Frame-ready timestamps are after capture completion; the estimate excludes
  capture time and server-to-header transit, and is not touch-to-display latency.
- Initial live Compact USB run: over120 acknowledged frames atabout1.42 FPS,
  6.2–6.6 KB frames, send/draw/ACK about680–720 ms. Physical input forwarding
  reached67 operations, zero errors, latest22 ms. Compact walking still needs
  user visual confirmation; do not infer it from input count alone.
- Wi-Fi provisioning, board Wi-Fi FPS, OTA use, and actual mic recording remain
  unverified. Wi-Fi is the next bandwidth improvement, not an already completed one.
- No Git remote/deployment is required; Vercel hosts the game, the Mac hosts the
  bridge. A VPS or browser-driver swap does not fix the active slow UART link.
- The bridge is unauthenticated: trusted LAN only, no port forwarding. Credentials
  belong in the device portal/NVS or ignored local config, never prompts or logs.

## Source distinction

JPEG viewing was inspired by `https://github.com/SharkSharp/cyd-browser`.
The GUITION configuration and local USB bridge are independent adaptations.
Do not flash the upstream ILI9341/XPT2046 resistive-CYD configuration on this
ST7789/CST820 capacitive unit. Preserve any included upstream licensing.
