# CYD / Pixsim: JPEG image and live stream

**CYD App Explorer:** https://aibuilders-cyd.vercel.app . Public source, a tiny
app starter, copyable setup/AI prompts, and app submissions are available without
requesting repository access. See [hosting status](HOSTING.md) for the pending
`aib.club/cyd` shortlink and the distinction between the public directory and
not-yet-deployed authenticated Amsterdam rendering.

Local, independently implemented server using Puppeteer and the
`GET /` JPEG protocol from [SharkSharp/cyd-browser](https://github.com/SharkSharp/cyd-browser).
Supports a frozen test image or shared live JPEG captures, an MJPEG browser
preview, and basic preview click/key controls. A board-specific viewer with Wi-Fi
setup and authenticated OTA is in [firmware/](firmware/README.md). USB communication
and a verified factory recovery backup are available. Viewer compilation is not
proof of physical streaming; verify the board after an authorized upload.
Pixsim source is unchanged.

## Clubria event remote on the smaller TFT

Short setup help is served at **`http://localhost:3088/cyd`** (also reachable on
the trusted LAN using the computer address). It explains power vs data, Wi-Fi vs
picture freshness, measured vs expected FPS, and the limits on microphone/auth.
`pnpm package:bridge` creates `artifacts/downloads/cyd-bridge.zip` from a strict
source-file allowlist; the guide serves it at `/cyd/download.zip` after bridge
restart. No credentials, browser profiles, backups, firmware binaries or device
configuration are exported. The ZIP is for already-flashed boards. Source and
app-directory contributions: https://github.com/Clubria/robobuilders-cyd .
The `aib.club/cyd` redirect still requires its owner's configuration.

`pnpm dev:clubria` uses the same JPEG/touch transport at240×320, rendering the
live Clubria **existing event timer**, not a replacement recorder application.
Set `CLUBRIA_URL` to choose a different starting event. The default opens
`https://aibuilders.club/e/AMS-Oct21/timer?record=1&cyd=mini`.

Receiver-only `?cyd=mini` adds a small event chooser from Clubria's public
directory and a few size overrides for the existing `CompactRecorder` and
`TimerBottomBar` current/next previews. `city=AMS` selects the directory city;
change the query for another city. No full-site mini theme is installed, and the
flag has no special effect in an ordinary browser outside this bridge.
The PostHog/Umami consent prompt is visually hidden in this receiver view only,
without clicking accept/decline or modifying the stored consent preference.

Clubria permissions remain intact: an unauthenticated browser can read the timer
but cannot see recorder/slide-control actions. The bridge neither signs in nor
records, advances live slides, or chooses cookie consent automatically. This TFT
has no built-in mic; a VPS-rendered browser also cannot access the Mac's mic.
Actual recording needs an explicitly authorized, supported audio source.

`pnpm test:clubria` captures `artifacts/clubria-tft-{timer,events}.png`, checks
240×320 layout/event-picker touch against the public site, and tests scrolling
on a local fixture without touching live recorder/slide actions.22 Node tests
also cover native touch scaling/cancellation and isolation from Pixsim controls.
The first physical Clubria JPEG received `USBFRAME OK 1` (10,009 bytes); continuous
USB was started. Physical visual/touch confirmation and signed-in controls are
separate from those checks. Amsterdam hosting has not been configured.

## Reusable setup skills

For a different screen, see the [earlier screen project reference](docs/earlier-screen-reference.md)
for the recovered ESP32-2432S028R V3 sketch configuration, compatibility cautions,
and an installation handoff prompt. Its hardware configuration is not yet verified.

Two project-local skills are in [.opencode/skills/](.opencode/skills/INSTALL.md):
`cyd-setup` (USB connect/retry, hardware specs) and `cyd-wifi` (phone provisioning).
The [install guide](.opencode/skills/INSTALL.md) includes a copy/paste setup prompt.
The [confirmed specifications](.opencode/skills/cyd-setup/references/specs.md)
distinguish historical physical verification from current connection status.

The pending [native launcher firmware](firmware/README.md#native-launcher-v1)
adds swipe-controlled Snake while waiting, a small Wi-Fi button with one-word
status, private phone/QR provisioning, and a USB setup-handover message. Firmware
builds/host tests are separate from installation and physical verification.

With the portrait bridge already running, `pnpm connect:cyd --stream` waits for
the matching USB adapter, tests one decoded image, then forwards video and touch.
It retries within bounded limits; multiple/busy adapters require help. It does not
flash firmware, change Wi-Fi or create a login service. `pnpm package:skills`
creates a ZIP and two `.skill` packages under `artifacts/skill-bundles/`, using a
public-file allowlist that excludes credentials, factory backups and logs.

## CYD Compact and latency tasks

Current world zoom is restored to1.10 to avoid exposed side edges. Framing now
uses a−52 logical vertical offset instead of shrinking the scene horizontally.
DOM controls and the horizontal camera position remain unchanged.

Current controls:44-physical-pixel skills and a48-pixel contextual action are
spread across the bottom (x12/96/180 at defaults), with Jump available again as an
icon but no duplicate floating caption. Profile/globe/mic move to the top row.
The profile sits left of the32-pixel globe; its circular artwork is uniformly
sized to32/.9 pixels and clipped10% at the bottom, giving a flat edge and the same
32-pixel visible height as the globe. Earlier control-layout notes below are
historical.

Reload recovery: CYD styles previously disappeared after the live game replaced
its document (physically observed as the old chat/full HUD returning). The bridge
now reinstalls compact/portrait/world/presence/weather adaptations on every
same-origin document load and checks for missing styles each second. `/health`
exposes `uiInstalls` and `uiErrors`. A real-browser reload/navigation/head-reset
test covers this; the native character/Hub handlers remain intact.
The same guard verifies360×480 logical viewport and2/3 DPR, repairing an external
diagnostic resize instead of silently streaming a differently shaped game. Attach
read-only diagnostic Puppeteer sessions with `defaultViewport:null`; the default
connection viewport otherwise resizes existing pages.

The native presence list now uses zero row gap/padding,12-physical-pixel names,
and23-pixel rows. It appears after650 ms standing still, disappears during actual
motion, and hides behind menus/conversations. The camera-only vertical offset is
now−36 logical pixels (previously−8), moving the world down about20.5 physical
pixels at the1.1 zoom without moving DOM controls.

Compact weather uses the game's native visual visibility API to stop atmospheric
rain/snow/mist/lightning locally, without forcing clear weather or changing its
wet-feet rain value. Outdoor transitions are constrained until cleanup. Normal
Pixsim source/weather outside this isolated receiver is unchanged. Browser checks
cover visual disabling, transitions and restoration.

Host graphics inspection confirmed hardware WebGL on the Mac's Apple M4 through
ANGLE/Metal. No cloud deployment or Nosana account access was performed. A GPU
cloud renderer would add WAN latency and does not remove the ESP32 JPEG/LCD cost.
Cloud-gaming inspirations: keep one newest frame, bounded queues, separate input,
frame-age/draw telemetry, and stale-frame retention in LCD RAM rather than writing
each image to flash. Retaining the stale physical image instead of automatic
receiver fallback is a proposed firmware change, **not installed yet**.

Latest browser-only UI changes: the profile chooser has a direct **Hub** button
that invokes the native People menu, without importing/creating characters.
The CYD filter defaults to **Not in game**, hiding already-playable cards on the
current native page. It explicitly says `This page · Next for more`; native
pagination/counts remain unfiltered. This is not a complete pre-pagination
missing-person directory. Hub/picker controls have32-physical-pixel minimum touch
heights, compact full-screen Hub layout, and no street HUD/speech over the menus.

Only the newest control for each HUD slot remains visible during native swaps;
the extra CYD caption and native hover titles are suppressed, retaining the native
world action prompt instead of two competing Mount/Play labels. Native world
press-and-slide walking/release is retained and tested, not replaced by synthetic
Space presses. Speech is smaller and scrolls within the top35% of the physical
screen; text chat input stays hidden.

Compact seeds the supported `pixsim_globe_driving=off` preference before boot and
hides driving controls. The existing non-driving renderer remains; a historical
simple renderer and genuine simple/complex legend switch are **not implemented**.
No Pixsim source was edited or deployed for these bridge adaptations.

Checks:20 unit tests, interaction/Hub/duplicate-slot fixtures, a dedicated
`pnpm test:speech` top-band/scroll test, and production-browser profile/Hub/slide/
non-driving-globe checks passed (including corrective focused reruns). Native
already-played-character confirmation is respected, not bypassed in testing.

Further speed work: current full-frame JPEG/LCD drawing measured about88 ms,
versus31–42 ms receive. A40 MHz LCD experiment could reduce the SPI wire floor
from51.2 to30.7 ms, but needs explicit physical stability/visual testing;24 MHz is
unchanged. Tile-difference transport can avoid unchanged LCD work but needs a new
bounded protocol, keyframes and firmware. PSRAM is not a plug-in speed upgrade for
this board. A future replacement should have built-in PSRAM and a faster LCD bus;
ESP32-S3 helps buffering, while an ESP32-P4 board with wireless connectivity can
also use hardware JPEG decoding. No new board FPS is promised.

Latest installed Wi-Fi update (2026-10-17): the board reuses its image HTTP/TCP
connection and no longer waits250 ms after each successful draw. Three steady
completed-draw windows measured7.40,7.57 and7.63 FPS at JPEG quality65; latest
receive times were31–42 ms and JPEG/LCD draw88 ms. A startup window containing a
server interruption was excluded. The earlier baseline was25 image requests in
10 seconds, not a completed-draw measurement. These are one scene's hardware
samples, not a24 FPS/full-motion guarantee.

During live playback the receiver overlays only a tiny muted green dot, not the
large Wi-Fi/Live label or white panel. Briefly press/release BOOT during Wi-Fi
playback to toggle completed-draw FPS and latest network/draw timing. Holding BOOT
three seconds still opens setup; do not hold it at reset/power-on.

The profile button once again opens the native character picker. CYD hides its
overlapping profile-edit form and keeps native selection/confirmation handlers.
Text chat is always hidden. Mic gets a separate reserved slot and no longer
replaces the profile; it forwards only an available native voice-room action.
This confirmed board has no built-in microphone: the existing action uses the
Mac microphone, with no permission grants or recording started automatically.
Production-browser tests verified picker open/next/confirm through forwarded
taps. Physical picker touch and actual audio remain user-verification steps.

Current UI update: Compact now requests JPEG quality65 for fewer compression
artifacts (the quality35 measurements below are historical). Bottom controls are
40 physical pixels, with a44-pixel contextual action. A contextual `Jump` button
and its caption are hidden without hiding other actions such as Play/Talk/Mount;
native keyboard/world gestures are unchanged. The browser preview defaults to
the exact240×320 output, with an optional1.5×360×480 display size. Enlargement
does not add source detail. These browser changes do not require a firmware flash;
physical touch responsiveness still needs device confirmation.

`pnpm dev:compact` keeps the same isolated game and movement, but enables the
game's existing lightweight animation mode before boot, emulates reduced motion,
removes DOM character-switch decoration/HTML transitions, and uses JPEG quality35.
It now uses Chrome's continuous JPEG screencast with a **24 FPS host publication
target**, rather than individual screenshot calls. This does not change device
firmware or remove the USB bandwidth / Wi-Fi polling limits.
It deliberately does **not** use `?s=n`: that also hides the native action HUD.
Normal Pixsim source, assets, firmware and baud remain unchanged.

Persistent HTTP/IndexedDB reuse is enabled through a separate per-origin Chrome
profile in ignored `artifacts/browser-cache/cyd-compact/`. This is a full isolated
profile (cookies and localStorage too), not an asset-only cache. Never export it.
The live JPEG endpoint remains `no-store` so caches cannot freeze the stream.

Current bottom row is a reserved48-pixel mic slot at the left corner (invisible
when unavailable), a52-pixel contextual Talk/Play/Mount action, then two48-pixel
actions. Availability never moves the remaining controls.

Tap the top-left avatar to show/hide the native chat UI above the action row;
the compact avatar no longer opens character selection. Closing chat releases
text-field focus. Scenes without native chat (for example some flight states)
show an availability notice instead of a non-working toggle. Double-tap the **world canvas** within the game's300 ms window
for the same contextual action as Space (Mount/Talk/etc.). This preserves the
game's native gesture; there is no additional Space event to fire an action twice.
Redundant same-position mouse moves are skipped to preserve that gesture's time
budget under rendering load; real drag samples and ordered release are retained.
Chat visibility is not an on-device keyboard or new text-entry transport.

- [x] Add bounded USB detection/reconnection and a public-only skills pack.
- [x] Verify native click, road-style dragging/HTML drop and orderly release on the Mac.
- [x] Measure same-source JPEG sizes with HUD present (`pnpm test:latency`).
- [x] Enable supported lightweight settings and isolated persistent caches.
- [x] Move/hide mic without row shift; enlarge the contextual action.
- [x] Remove synthetic intermediate mouse steps; retain separate touch forwarding.
- [x] Expose frame age and USB send/draw/ACK timing, without claiming physical latency.
- [x] Add bounded latest-frame Chrome screencast publication and avatar chat toggle.
- [x] Verify native double-tap and Space reach the same contextual handler exactly once on the Mac.
- [x] Verify sustained Compact USB delivery: about1.4 FPS with board draw acknowledgements.
- [ ] Record user visual confirmation of Compact road-drag walking; physical touch forwarding is verified.
- [ ] Finish trusted2.4 GHz Wi-Fi handover; current network credentials are not configured/verified.
- [ ] Add a source-supported all-canvas-FX-off policy preserving gameplay; lightweight is not all-FX-off.
- [ ] Generate compact playable sprite variants **with matching frame metadata**; no unsafe sheet substitution.
- [ ] Consider dirty-region/tile transport if USB must remain; requires protocol/firmware work and authorized physical validation.

Controlled240×320 same-pixel comparison: quality35 was6198 bytes versus8400 at55
(about26% less data). The theoretical115200-baud wire floor fell from731 to540 ms;
actual delivery includes JPEG capture, transfer, decode and acknowledgement.
`screenshotMs` includes Chromium screenshot/CDP work, not just JPEG encoding.
Helper `frame-ready-to-ACK estimate` starts after capture completion and excludes
server-to-header transit; it is not physical touch-to-display latency.

First live Compact check: over120 board-acknowledged frames at approximately1.42
FPS, compared with around1.05 FPS immediately before switching. Frame sizes were
about6.2–6.6 KB, send/draw/ACK about680–720 ms, and frame-ready-to-ACK estimates
about720–850 ms. Physical input forwarding recorded67 operations, zero errors,
latest22 ms at the health check. These are one scene/session's measurements, not
a high-FPS guarantee or visual confirmation of walking after the change.

### Toward24 FPS on the device

A short240×320, quality35, isolated production-game benchmark on this Mac measured:

| Capture path | Host FPS | Mean JPEG bytes |
| --- | ---: | ---: |
| Sequential Puppeteer screenshots (6 seconds) | 16.99 | 7,632 |
| Direct CDP screenshot, `optimizeForSpeed` (6 seconds) | 19.95 | 13,918 |
| CDP continuous JPEG screencast (8 seconds) | 59.95 | 6,897 |

These are one idle scene's **host delivery** measurements, not device FPS,
walking-scene guarantees, or60 distinct visible changes per second. The selected
compact path targets24 FPS, acknowledges discarded Chrome frames, and keeps
only the newest complete JPEG. `captureMs` is null for screencasts because event
handling time is not browser capture time. `screencastFrames`, `capturedFrames`,
`captureMode`, `frameAgeMs` and errors are available in `/health`.

Subsequent live bridge samples measured **17.85–20.28 FPS**, below the24 FPS
target, with zero capture errors and valid240×320 JPEGs. The short60 FPS benchmark
must not be presented as sustained performance. The latest USB session was about
1.8 FPS after startup, with completed-draw acknowledgements; smaller flight-scene
images are not a controlled same-scene speed comparison. Updated controls passed
unit/USB checks and production/local browser integration checks using a full run
plus corrective focused reruns. Physical avatar/chat and double-tap confirmation,
Wi-Fi handover and24 FPS device playback remain pending. The required separate
Codex review could not run: the configured models were unsupported or deprecated.

Recommended next transport experiment (requires separately approved firmware):

1. Finish trusted-LAN Wi-Fi provisioning; remove the firmware's250 ms polling cap.
2. Reuse one TCP/WebSocket connection with bounded buffers and completed-draw
   sequence acknowledgements. Drop obsolete frames, never grow a video queue.
3. Benchmark receive, JPEG decode and LCD draw separately. At24 MHz, a full
   RGB565240×320 LCD write alone takes at least51.2 ms; even perfect network
   compression cannot make that full-screen path24 FPS. A40 MHz write would have
   a30.7 ms wire floor, but board stability and total throughput need physical tests.
4. Prefer a **tile-difference codec** for pixel art: compare quantized source pixels
   on the Mac, send only changed16×16 tiles, and let the LCD retain unchanged
   pixels. Choose raw RGB565, palette/RLE or JPEG patches per region. Include a
   base sequence, bounds checks, full keyframes and resynchronization on mismatch.
   Lossy JPEG byte differences are not a valid pixel-difference detector.
5. Scrolling can change most tiles. Hardware vertical scroll helps only compatible
   movements; arbitrary copy/scroll needs a framebuffer or redraw. One RGB565
   frame is153,600 bytes, two307,200 bytes, before Wi-Fi/application allocations
   on this no-PSRAM ESP32. Do not assume a double buffer will fit.

Moving to a VPS is useful for independence from the Mac, not an automatic speed
improvement: cheap VPS instances can render WebGL more slowly and add WAN latency.
The library here is Puppeteer, not Playwright; both use Chromium, and switching
wrappers alone does not eliminate screenshot overhead.

H.264 is not the first choice on this original ESP32 without PSRAM or a hardware
video decoder. Espressif's [H.264 component benchmarks](https://components.espressif.com/components/espressif/esp_h264/versions/1.1.0/readme?language=en)
use roughly1 MB even for320×192 software decoding on an ESP32-S3, already more
than this board's total SRAM. That is evidence against this particular H.264
path, not proof that every specialized codec is impossible. JPEG is already
compressed; changing its container to MJPEG does not add inter-frame compression.

Wi-Fi plus Bluetooth does not combine their bandwidth: they [share one2.4 GHz
radio and time-slice](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/coexist.html).
BLE can be useful for provisioning, but should not carry a second video lane.
Reliable24 FPS during full-screen motion remains an unverified hardware target.

## Stream Pixsim now

For the current device layout, run `pnpm dev:cyd`. It opens the deployed New York
game in an isolated browser, adapts it to portrait (360×480 logical, 240×320 output),
keeps only the avatar and a bottom row of three action buttons plus mic, and hides
chat/extra HUD. Hold/Stop controls are removed. The buttons are 48 physical pixels,
aligned to the LCD pixel grid. UI text is increased approximately 20%; the world
gets a mild saturation/contrast boost and pixel-art image rendering. The room-gated mic uses the existing Pixsim voice
control and the Mac's microphone, never automatic recording. See
[firmware setup and transport limits](firmware/README.md).

User-confirmed USB video and road-drag walking work. Sustained USB testing at
115200 baud delivered about 0.9 FPS, with over 1100 forwarded input events and
typical input-forwarding times around 20–65 ms. This is not fast video. Higher
serial rates were unreliable, so they are not the default. Wi-Fi setup and its
real device frame rate remain unverified; the Mac's target is 8 FPS, not a
claim that the physical display already achieves 8 FPS.

With Pixsim running on port 4736, stop only this bridge's previous server and run:

```sh
pnpm dev:pixsim
```

Open <http://localhost:3088/preview>. This runs a separate, isolated Pixsim
session at `/newyork?s=n&ui=min`, waits ten seconds for assets, and captures at
a target of 4 FPS. Click the image or use the arrow/jump buttons to control that
session, not your existing Pixsim browser tab. Captures continue when no preview
is connected. There is no audio or personal login/profile sharing.

`/stream.mjpg` provides MJPEG for a browser. The ESP32 instead polls `/` or
`/frame.jpg` for the latest JPEG with Content-Length, as in the original protocol.
All clients share one capture loop. Slow clients skip frames; capture calls never
overlap or queue up. Maximum four simultaneous MJPEG clients. `/health` reports
frame sequence, capture duration/errors and stream client count. A capture failure
keeps the last successful frame, so check its timestamp if the image freezes.

For another city or rate:

```sh
FRAME_SOURCE=pixsim STREAM=1 FPS=4 PIXSIM_URL='http://localhost:4736/amsterdam?s=n&ui=min' pnpm dev
```

`FPS` accepts integers 1–60 and is a target, not measured CYD performance.
`CAPTURE_MODE=screenshot` is the default; `screencast` selects continuous Chrome
JPEG capture (enabled by `dev:compact`). Browser
input is bounded and allowlisted. Hostnames are restricted to localhost and the
Mac's interface IPs captured at startup, with same-origin browser input checks.
Pixsim HTTP navigation errors fail startup rather than streaming an error page.
The server has no authentication: anyone on the
trusted LAN who can reach it can view/control this separate session.

## Frozen image test

```sh
pnpm install
pnpm test
pnpm test:browser
pnpm dev
```

Open <http://localhost:3088/preview>. The server renders **one** 320×240 baseline
JPEG at startup, closes its isolated browser, and serves that same image on each
request. `/` and `/frame.jpg` return binary JPEG with Content-Length, not HTML.
`/health` reports image request counts, last client address and user agent. A Mac
preview request also counts; this is not proof that a physical board connected.

Uses the Mac's installed Google Chrome when available. Otherwise set
`CHROME_PATH` to a Chrome/Chromium executable, or install Puppeteer's browser with
`pnpm exec puppeteer browsers install chrome`. No personal browser profile is used.

## Connect the board

1. Confirm the exact rear label, screen controller, touch controller and pin map.
2. Get USB data working. A powered screen alone does not prove a USB connection;
   look for `/dev/cu.usbserial*`, `/dev/cu.wchusbserial*`, `/dev/cu.SLAB*`, or
   `/dev/cu.usbmodem*`. Try a known data cable, direct USB port and reconnect.
3. Adapt and compile firmware for the confirmed board, keeping Wi-Fi secrets out
   of source. Do not flash the upstream standard-CYD firmware unchanged.
4. Put the ESP32 on 2.4 GHz Wi-Fi on the same LAN as this Mac. Guest/client
   isolation can prevent access even with the same network name.
5. Use `http://<MAC_LAN_IP>:3088/` as the firmware URL. Never use `localhost` on
   the ESP32. `pnpm dev` prints candidate interface IPs; select the actual LAN IP.
6. Allow incoming Node traffic in the macOS firewall if requested. Check the
   preview URL from a phone on that Wi-Fi before debugging device HTTP code.
7. Verify the color bars, white image border, orientation and a matching ESP32
   request in `/health` before enabling streaming or touch forwarding.

The server listens on all interfaces for LAN access and has no authentication.
Use a trusted LAN only. Do not port-forward it or expose it to the internet.

## Hardware findings (not physical verification)

- [JC2432W328 documentation](https://github.com/maxpill/JC2432W328) identifies
  an ST7789 display, 240×320 native pixels, and CST820 **capacitive** touch.
  These claims still need checking against the connected board/revision.
- SharkSharp's standard firmware config is ILI9341 plus XPT2046 **resistive**
  touch, so it is not a drop-in match.
- Capacitive touch is a touch technology, not an alternative to TFT: this board
  can have both a TFT LCD and a capacitive touch layer.
- The reported model is documented as 2.8 inches. If this screen is larger,
  verify the rear label rather than assuming its resolution or pin mapping.

## Earlier project search

No matching CYD browser/firmware project was found in current Pixsim source or
the `Repos/z. Backup - Ai builder repos` and `Repos/z. Backup other projects`
folders. A CYD test was found outside Repos:

- `/Users/ap/Documents/3D Printing/sketch_sep4a/sketch_sep4a.ino`
- `/Users/ap/Documents/3D Printing/sketch_sep4a/lgfx_user.h`

That sketch tests colors, Wi-Fi, Bluetooth and touch. It identifies itself as
ESP32-2432S028R V3 and uses ST7789 plus XPT2046, not CST820. It is preserved
unchanged and was not assumed to be working hardware evidence.

## One Pixsim screenshot without streaming

With Pixsim running on port 4736, start the bridge with:

```sh
FRAME_SOURCE=pixsim CAPTURE_WAIT_MS=10000 pnpm dev
```

Or generate a local test artifact without starting another server:

```sh
FRAME_SOURCE=pixsim CAPTURE_WAIT_MS=10000 pnpm test:browser
```

This captures the unauthenticated landing view after the wait, not necessarily
an in-game scene. Set `PIXSIM_URL` to the desired read-only/game entry route.
Without `STREAM=1` it stays frozen until restart; no login, board touch forwarding,
video playback or physical-device frame-rate performance is verified by this test.

Other environment options: `WIDTH`, `HEIGHT`, `JPEG_QUALITY`, `PORT`. Dimensions
must match the confirmed firmware orientation. Measure actual ESP32 decode/draw
time before increasing frame rate or promising video playback.
