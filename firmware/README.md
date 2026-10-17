# GUITION JC2432W328 Pixsim viewer

## Additional board: ESP32-024 (2.4-inch resistive)

The photographed PCB marked `ESP32-024` is a separate unit. USB interrogation
identified ESP32-D0WD-V3 rev3.1 with4 MB flash. Its board profile is selected only
with `--build-property 'compiler.cpp.extra_flags=-DCYD_BOARD_ESP32_024'`; omitting
that flag retains the original GUITION profile. Keep build outputs separate.

- Display: ST7789,240×320, SPI mode3 at24 MHz, SCLK14/MOSI13/MISO12,
  DC2/CS15/reset−1.
- Touch: XPT2046-compatible resistive controller, shared SPI2 bus at1 MHz,
  CS33/IRQ36. First boot asks for corner-target calibration, saved locally in NVS.
- Backlight: **GPIO27**, confirmed by the vendor schematic and factory
  `User_Setup.h`. Some online prose incorrectly says GPIO21. Do not drive both.
- References: [model-specific example](https://github.com/F1ATB/ESP32-2432S028-2432S024-2432S032-JC2432W328/blob/main/Ecran.h),
  [vendor download](https://www.tztstore.com/goods/show-7983.html), schematic
  `SCH_ESP32-2.4TFT_1-ESP32-2.4TFT_2023-12-19.png`.

Both profiles compile and30 existing host tests pass. Backup/upload/image/touch
verification are separate steps; compilation alone does not prove hardware output.
On2026-10-17 the smaller unit's complete4 MB factory image was privately backed
up, SHA-256 recorded, and verified against flash by matching device digest.
The ESP32-024 build was then uploaded at115200 baud with all four segment hashes
verified, without a whole-chip erase. The user completed first-boot calibration
and saw the receiver screen. A12,945-byte Pixsim image received `USBFRAME OK 1`
after decode/draw (1322 ms send/draw/ACK at115200 baud). Continuous USB was then
started; visual correctness and road-drag touch mapping still need user confirmation.
The required Codex review was attempted but the available model rejected the
connected account. Never reuse the larger board's backup or saved credentials.

This sketch replaces the factory widget demo. It is specific to the board
confirmed in the user's rear-label photo, not the resistive Sunton CYD.

## Minimal receiver

### Latest pending revision (not installed)

The latest source has32-pixel manual checkboxes, consistent Back/Done/Run buttons,
Done advancing from the Wi-Fi QR to phone setup, and thin chevrons with20%-wide
edge-tap areas on native setup pages. Checklist taps take priority over edge
navigation. The computer checkbox links to `localhost:3088/preview`, not8080.

An explicit `--negotiate --baud 460800` USB experiment starts at115200, requires
the firmware's exact switch ACK, then tests high speed. It restores115200 on
normal exit, or firmware falls back after30 seconds without a completed draw.
The reboot default remains115200. Example command (after this revision is
intentionally uploaded):

```sh
python3 scripts/usb_stream.py --negotiate --baud 460800 --once
```

No faster-USB hardware result is claimed. The board disconnected before this
revision could be uploaded or tested.33 host checks and the ESP32-024 build pass.
Previous installation records below describe earlier revisions. The optional
`pnpm dev:clubria:fast` profile renders at4 FPS/quality50 on the computer; this is
not proof of4 FPS over USB. Codex review is blocked by exhausted API credits.

### Always-available tabs, checklist and connection feedback

The latest wording pass removes forward-looking instructions and Next/Run
buttons from the QR pages. Each has its current task, one short scan label,
Done/Undo and an X to return to Run. Top tabs and setup swipes handle navigation.
Detailed speed examples live in the computer guide rather than on the tiny screen.
The guide offers a short prompt for an AI coding agent to start the local bridge,
detect the display without flashing, save the LAN address and guide Wi-Fi setup.
`aib.club/CYD` remains a proposed public entry point, not a working deployed URL.

New source keeps **1 Run / 2 Wi-Fi / 3 Phone / 4 Restart** clickable during
playback. The240×320 remote image is uniformly fitted into207×276 pixels at
(16,44); forwarded touches map back to source coordinates. Header taps stay local,
side margins do not click the app, and a release outside the image uses the last
valid remote point. Setup pages also accept left/right swipes and edge taps;
the full left/right bottom halves activate their respective buttons. Live app
swipes retain their original scrolling behavior. Native QR pages pause USB and
Wi-Fi image painting so incoming pictures cannot overwrite setup or restart.

Done/Undo creates a **manual** green tab tick, not connection proof. These marks
reset on reboot. The waiting page separately identifies the board, power, actual
Wi-Fi join status and recent pictures. A short BOOT press during playback shows
the current transport and measured completed-draw FPS (including USB). Speed
examples remain labeled: roughly1 FPS USB, previously5–7 FPS game Wi-Fi on the
2.8-inch unit, and a3 FPS Clubria computer target, not promises for this unit.

The bridge serves concise computer instructions and a source-only ZIP at `/cyd`.
The public repository is https://github.com/Clubria/robobuilders-cyd .
`aib.club/cyd` and authenticated Amsterdam rendering are not live.
Tests cover proportional header hit areas, remote mapping, swipes, bottom buttons
and transport-specific FPS windows. Both board profiles compile,22 Node and32
Python/C++ checks pass, and the setup/help pages pass browser checks. This
revision was uploaded to the ESP32-024 with all segment hashes verified, followed
by a7,715-byte scaled JPEG acknowledged as `USBFRAME OK 1` (899 ms send/draw/ACK).
That confirms decode/draw, not physical tab accuracy or completed Wi-Fi setup.
USB is left as power only after the one-image check. The guide/download are live
on the local bridge; its ZIP response digest matched the source archive manifest.
Codex review remains unavailable because the model rejects the connected account.

### Four-page wizard update: recovery upload verified

Installed source adds native top tabs **1 Run / 2 Connect / 3 Scan / 4 Reset**.
Connect and Scan show the two setup QR steps; Reset opens a confirmation page
and restarts only after a separate button release, never erasing saved settings.
Address taps now open phone setup instead of the optional number pad. Tabs stay
off live playback.30 host tests, phone-page checks and the ESP32-024 build pass.

The first2026-10-17 upload to the smaller unit stopped at29.4% of the application
transfer with `The chip stopped responding`. After the user requested continuation,
USB interrogation reconfirmed the smaller unit's MAC and4 MB flash. The retry
completed with **all four segment hashes verified**. Post-reset USB diagnostics
responded with `editing:false`, no errors, the saved bridge address intact and
Wi-Fi not yet configured. NVS was not erased; the private backup is preserved.
The wizard is now installed and running, but its visible tabs, QR scans and
physical touch mapping still require confirmation on the TFT.
The required Codex review was attempted but rejected by the connected account.

### Two-step QR setup (installed on the ESP32-024)

Open Settings, tap the live top-right corner, or hold BOOT3 seconds while running.
Step1 shows only the setup-network QR and short join instructions. After the
phone joins, tap **Next** for step2's `http://192.168.4.1/` QR. The phone page asks
for home2.4 GHz Wi-Fi and password, with one **Connect** button. Saved connections
are retained; the prefilled renderer address and open-network option are under
**Advanced**. Back/Next/Done use separate44-pixel-high release-confirmed buttons.
No network passwords or QR contents are logged or captured.

The current renderer address was saved privately on this unit before upload;
it is not baked into the shared firmware. After upload, the physical USB status
confirmed the saved address, no active USB image session, and no configured Wi-Fi.
USB is left as power only while the user performs setup. The live Clubria bridge
remains running.30 host tests, phone setup browser checks and both board builds
passed; upload segment hashes matched. Physical QR scanning/joining is pending.

### Top-right Wi-Fi shortcut

Live playback shows a4×4-pixel muted marker at the extreme top-right. A tap
starting and ending in its16×16-pixel corner touch area opens the existing
Wi-Fi setup flow. The rest of the old72×48 top-right region now passes through
to the game during playback. Receiver/setup screens retain their larger button;
BOOT remains the fallback. Existing packet-boundary USB handover is reused.

Uploaded to the smaller ESP32-024 with all segment hashes verified. A subsequent
13,238-byte JPEG received `USBFRAME OK 1`; USB video was restarted. All30 host
tests pass including live/launcher touch boundaries. Physical corner tapping and
Wi-Fi provisioning still need user confirmation.

### Pending diagnostic/clock experiment source (not flashed)

New source adds a bounded physical-USB `?CYDSTATUS` / `?CYDBRIDGE=http://IPv4:port`
and `?CYDRESUME` control path, separate from the USB image handshake. It reports
only non-secret state and can repair the bridge URL without exposing credentials.
`pnpm receiver` is its host helper. These commands are not present in the current
installed firmware until a separately verified upload.

An optional `?CYDSPI=24|32|40` test is RAM-only. Default/reboot remains24 MHz;
experimental rates fall back after90 seconds when the main loop is responsive
(fallback is deferred during OTA). No higher-clock hardware experiment has been
run or visually validated. The user reported current playback fast, so the working
installed firmware and clock were left unchanged. Host tests/builds cover the
parser and helper; they are not hardware compatibility evidence.

### Faster Wi-Fi and unobtrusive status (installed)

The latest authorized upload verified all segment hashes on the recorded board,
preserving NVS. Live video now has only a radius2 muted green dot; the white
receiver still provides connection diagnostics when not playing. A short BOOT
press toggles an optional on-device debug panel with completed-draw FPS and latest
receive/JPEG+LCD draw milliseconds. A three-second hold still opens setup.

Successful requests reuse one HTTP/TCP connection and immediately allow the next
frame; errors close the connection and retain capped retry backoff. Connections
are also closed when the bridge base URL changes. Bounds, partial-image checks
and stale-frame rejection remain. `CYDPERF` serial lines count completed Wi-Fi
draws over measured windows; they do not count USB draws or host captures.

Post-upload hardware samples:38 draws/5132 ms,38/5022 ms and39/5110 ms, or
7.40–7.63 FPS. Latest receive31–42 ms; draw88 ms. The startup sample spanning
server restart was excluded. This is one scene, not guaranteed movement FPS or
end-to-end input latency. The old250 ms polling floor described below is historical.

### Change the Mac address without a phone

Tap the saved bridge URL on the receiver's waiting screen. A native numeric pad
lets you enter only the final IPv4 number (for example `61`), then **Save + retry**.
The first three numbers and HTTP port remain unchanged. No Wi-Fi password is
requested. **Back** cancels without saving; **Del** corrects a digit. Values outside
0–255 are rejected. This is for a changed Mac address on the same subnet, not
switching networks. Hostnames, HTTPS URLs or a different subnet still use Settings
and the full phone form. Receiving pauses while editing. Saving updates the active
bridge URL and the current saved network preset before retrying.

This keypad update was uploaded to the same confirmed board with every segment
hash verified; NVS was retained. Parser/keypad tests and the firmware build passed.
Physical keypad accuracy and Wi-Fi playback after entering the corrected address
still require confirmation on the device.

Installation: the user-authorized USB upload on2026-10-17 completed on the
confirmed ESP32-D0WD-V3 rev3.1 (MAC matching the recorded unit), with hashes
verified for every uploaded segment. The existing NVS region was not erased.
The private recorded4 MB factory recovery image was confirmed present without
reading/exporting its contents. Post-reset serial observation still reported
`Frame HTTP status=-1 length=-1`; physical Wi-Fi playback and visual UI/touch
verification remain unresolved. Host build/tests pass; the separate required
Codex review was attempted but unavailable for the connected account.

The latest source makes the default waiting view a flat white receiver, not Snake.
It shows Wi-Fi join state separately from the latest Mac-stream result, the saved
bridge URL, and a retry countdown. `Retry` retries saved settings immediately;
`Settings` opens the private phone setup flow. Back from setup returns to the
receiver without silently closing the setup AP; tap Retry to resume receiving.
Snake code is retained but is not the default view or gesture target.

Failed Mac requests back off from2 seconds to a30-second cap. Wi-Fi join attempts
remain bounded to20 seconds, then retry with the same capped backoff while the
setup portal is closed. Manual setup pauses automatic joins. Successful image
requests retain the existing250 ms polling floor; this change is reliability/UI,
not a higher physical-FPS claim. No buffers or request queues are added.

The phone page is also flat white, with up to three saved network/bridge presets.
Each newly saved network reuses an existing slot or replaces the oldest inserted
slot. Passwords remain in device-local NVS and never appear in phone HTML, response
bodies, browser storage or logs. Saved profiles are not encrypted against physical
flash reads. Saving a preset is not proof its network or stream is reachable.

Existing active settings and setup/OTA password are preserved. Compilation and
Mac/browser tests are separate from firmware installation and physical checks.
The historical Snake launcher notes below describe the preceding interface.

## Native launcher v1

The new source adds a local waiting screen; physical installation/verification
must be recorded separately from a successful build. It does not change display
pins, SPI speed, baud, partition layout, or Pixsim source.

- **Snake:** runs entirely on the ESP32, using less than1 KB of game state and no
  framebuffer/PSRAM. Swipe in any direction to start; later swipes turn, without
  reversing into the body. Tap after losing to restart. The game waits for the
  first swipe rather than dying while the user reads the screen.
- **Wi-Fi:** a small top-right button, with a72×48 touch region, opens setup.
  A single muted word underneath reads `Offline`, `Setup`, `Connecting`,
  `Waiting`, `Live`, or `USB`. `Waiting` means Wi-Fi is joined but no fresh Pixsim
  frames have arrived; it is not advertised as a working stream.
- **Phone setup:** QR joins the device's password-protected temporary network.
  Open `http://192.168.4.1`, find a2.4 GHz network, enter credentials privately,
  check the saved Mac base URL under **Pixsim bridge**, then Save. Scanning is
  asynchronous; phone-page waits and the20-second join attempt are bounded.
  Tap **Play Snake** to hide instructions without stopping the setup AP.
- **Hotspot:** both CYD and Mac must join the same2.4 GHz hotspot. If provisioning
  from the hotspot phone itself, enable the hotspot after saving. Isolation on
  some hotspots still needs testing; a phone alone does not run the renderer.
- **Automatic fallback:** after4 seconds without a successful device draw,
  the native waiting game replaces the old image. Fresh frames return to Pixsim.
  Host JPEGs older than3 seconds are not sent/drawn as if live.
- **Safe USB handover:** finish the current packet, emit `USBSETUP REQUEST`, then
  discard late USB image packets rather than overwrite setup. The updated Mac
  helper exits75 and the reconnect wrapper treats that as intentional: it never
  automatically steals the connection back. A new explicit `pnpm connect:cyd
  --stream` is the USB fallback and closes the setup AP. BOOT held3 seconds while
  running remains another way to open setup.

Credentials/QR remain device-local. The phone endpoints accept configuration only
on the setup AP; browser writes additionally check Origin. No saved password is
returned, prefilled, or logged. Ordinary setup does not erase NVS or factory data.
`CYDUI READY snake=1 wifi=touch version=1` is a non-secret firmware boot marker.

Checks: `pnpm test:usb` includes host-compiled C++ Snake/swipe/status tests with
AddressSanitizer/UBSan and USB handover regression tests. `pnpm test:setup` runs
the real embedded phone HTML in Chrome with fixture networks, including a hostile
SSID, validation/retry, join failure, password clearing and narrow layout. These
do not prove physical touch, QR scanning, Wi-Fi connectivity or display appearance.

## Hardware and build

### Saved connection usability update

The pending source update preserves the saved home network, password, setup/OTA
password and bridge URL across restarts. On the phone setup page, leave the
password blank to reuse it **only for the same saved network**. A different network
requires its own password; an open network must be explicitly selected. Passwords
are never returned to the browser. The bridge field is visible without expanding
advanced settings, so a changed Mac address can be fixed without retyping Wi-Fi.

The native launcher and setup screen explicitly show `Wi-Fi: connected`, `joining`
or `offline`. The launcher separately shows the last Mac stream outcome (not yet
checked, unreachable, HTTP status, stale/bad image, decode failure or live).
`Joined` means Wi-Fi only, not a working stream. This update does not add a browser
video decoder or change the existing polling limit. Build/tests do not prove it
has been installed or physically verified.

- ESP32-D0WD-V3 revision 3.1, 4 MB flash, no PSRAM.
- ST7789, native 240×320, viewer now uses **portrait 240×320**.
- HSPI: SCLK 14, MOSI 13, MISO 12, DC 2, CS 15, reset -1.
- Backlight GPIO27.
- CST820: SDA 33, SCL 32, reset 25, no interrupt, I2C address 0x15.
- Pin reference: [openHASP's dedicated configuration](https://github.com/HASwitchPlate/openHASP/blob/master/user_setups/esp32/guition-jc2432w328.ini).

Compiled with Arduino ESP32 core 3.3.0 and LovyanGFX 1.2.7, using the installed
library without modifying it:

```sh
artifacts/tools/arduino-cli compile \
  --fqbn 'esp32:esp32:esp32:PartitionScheme=min_spiffs,FlashMode=dio,FlashFreq=40,UploadSpeed=115200' \
  --libraries '/Users/ap/Documents/3D Printing/libraries' \
  --output-dir artifacts/firmware-build firmware/cyd_pixsim
```

The project-local CLI lives in ignored `artifacts/tools`. This is not installed
system-wide. The `min_spiffs` scheme leaves two approximately 1.9 MB app slots for
wireless updates. The sketch bounds each JPEG to 64 KB; larger responses are rejected.

The viewer upload was authorized and completed with all uploaded segment hashes
verified. A serial boot check reached `display initialized (320x240)` and
`Setup portal active`. The later USB-image update also verified every uploaded
segment, and a **single 15,266-byte Pixsim JPEG** received `USBFRAME OK 1` after
decode/draw. No continuous USB stream was started. Visual confirmation of the
Pixsim image, color correctness, touch mapping, Wi-Fi provisioning and OTA are
still separate verification steps.

## First image over USB, no Wi-Fi setup

With the Mac bridge running and the board connected:

```sh
python3 scripts/usb_stream.py --once
```

The current helper obtains exclusive serial access and checks the viewer's identity and
readiness before sending. It fetches one baseline JPEG from the local bridge,
sends `CYDJPEG\n` + 32-bit little-endian byte length + JPEG bytes, then waits for
`USBFRAME OK` after successful drawing. Both ends reject images above 64 KB.
The helper neither uses proxies nor follows HTTP redirects. No Wi-Fi credentials
are read, embedded or transmitted by this mode.

The current portrait update received `USBFRAME OK 1` for a 10,011-byte JPEG at
115200 baud. It renders a logical 360×480 view into the physical 240×320 screen,
with only the avatar, action controls and a room-gated mic, without chat.
The mic forwards Pixsim's existing voice-room button, only after a user click;
it is disabled on streets where that button is unavailable. It uses the Mac's
microphone, not nonexistent on-board microphone hardware. Recording was not tested
or enabled automatically.

Pointer down/move/up events are read by a separate host thread even during JPEG
transfers. Moves coalesce; press/release ordering is retained. The CST820 is
single-touch. The user subsequently confirmed road dragging/walking works. The
current portrait layout intentionally removes Hold/Stop controls; it presents
three action buttons and mic in one aligned bottom row. True two-finger input is
not supported by the controller.

The old installed viewer kept an image visible indefinitely. Launcher v1 instead
returns to Snake after4 seconds without a fresh draw. Hold BOOT for three seconds
while the app is running, or tap the new Wi-Fi button, to return to setup. Native
UART is 115200 baud for reliability; this is a slow initial transport, not a
video-frame-rate guarantee. Attempts at 921600 baud did not respond reliably;
230400 acknowledged over twenty frames at about 1.56 FPS but later lost responses.
The default is therefore restored to 115200, not advertised as fast video.
`pnpm test:usb` covers host packet framing and input ordering. Hardware
ACK and visual confirmation are distinct from those tests.

Current GUI adaptation is browser-side, with no new firmware upload needed:
48-physical-pixel bottom controls, approximately 20% larger UI text, subtle scene
vibrancy, and pixel-aligned coordinates. Production geometry was checked, including
overriding the game's saved inline thumb-slot positions while retaining React's
original button nodes and handlers. Canvas name labels are not individually resized
by the HTML font adjustment.

The JPEG-render/decode approach is inspired by SharkSharp/cyd-browser. The USB
framing, helper and GUITION display setup are independent adaptations, not an
upstream feature. The capacitive controller is not replaced with XPT2046 code.

## First boot after an authorized upload

1. With launcher v1 installed, the screen starts with Snake; tap the top-right
   **Wi-Fi** button. The prior viewer instead opened setup automatically.
2. Scan the device's QR, or join `CYD-Pixsim-...` from a phone using the random
   password shown on the device. Do not photograph/export the setup credentials.
3. Open <http://192.168.4.1> on that phone.
4. Enter the normal 2.4 GHz network name/password and the bridge **base URL**,
   for example `http://192.168.178.237:3088`, without `/preview` or `/frame.jpg`.
5. Save and reconnect the phone to the normal Wi-Fi. The board polls
   `/frame.jpg` and displays the latest JPEG. Taps send allowlisted `/input` actions.
6. Check the Mac's `/health` last-client address and user agent, plus the physical
   image. A Mac preview request does not prove the board connected.

Launcher v1 requests that the updated USB helper pause when Wi-Fi is tapped;
the prior firmware/helper needs manual pausing. Before either handover, on a
phone's normal Wi-Fi first check
`http://MAC_LAN_IP:3088/preview`. If unreachable, resolve LAN access/firewall before
entering that base URL into the board. No new Vercel deployment is needed: the
game is already deployed, while the persistent Puppeteer bridge stays on the Mac.

Credentials are entered on the device's temporary Wi-Fi setup web page and stored
locally in ESP32 NVS. They are not embedded in the sketch, echoed to the web page,
or printed to serial. NVS is not encrypted: anyone with physical flash-read access
can recover device state. Keep backups private. The setup Wi-Fi password is also
used for authenticated ArduinoOTA; record it privately before leaving setup.

Hold **BOOT for three seconds while the app is already running** to reopen setup.
Do not hold BOOT while resetting or powering on, which enters the ROM downloader.

The device requests HTTP JPEGs, not the browser's multipart MJPEG stream. Local
Snake swipes are native; Pixsim retains its forwarded single-touch gestures.
No on-device audio or high-FPS hardware guarantee is provided. The intended
network is a trusted LAN, never a public network or port-forwarded connection.

## Factory recovery

The complete original image is private under `artifacts/firmware-backups/`.
Its 4,194,304-byte length and SHA256 were recorded in the private manifest, and
`esptool verify-flash` matched its digest against the device before any upload.
Do not publish the image or pass it to an AI worker; it may contain device state.

Restoration is a separate, explicit operation that overwrites the full flash.
Only when requested, use the verified backup and the same board:

```sh
'/Users/ap/Library/Arduino15/packages/esp32/tools/esptool_py/5.0.0/esptool' \
  --chip esp32 --port /dev/cu.usbserial-110 --baud 115200 write-flash \
  0 artifacts/firmware-backups/factory-c82e18f8b1cc-20261013-115200.bin
```

No factory backup restoration is run automatically on an error.
