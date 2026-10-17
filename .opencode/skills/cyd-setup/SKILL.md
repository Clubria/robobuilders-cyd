---
name: cyd-setup
description: Connect or reconnect the confirmed GUITION JC2432W328 Pixsim touchscreen on a Mac. Use for CYD USB setup, automatic connection when the data cable is inserted, frozen images, missing walking/touch, or retrying the local viewer. Detect the recorded USB adapter, verify one JPEG, then stream without reflashing or exposing credentials.
compatibility: A local coding agent with macOS shell access, Python 3, Node 22+, pnpm, Chrome/Chromium, and the robobuilders-cyd project.
---

# CYD setup and reconnect

## Read first

Read `references/specs.md` for the confirmed board and limits. Find the user's
`robobuilders-cyd` directory; use the current project if it contains
`scripts/usb_stream.py` and `firmware/cyd_pixsim/board_display.h`. If not, ask for
its location. Read its AGENTS.md and parent instructions. This skill is not the
application, firmware, or a background OS service; it requires the existing
project. Do not invent a repository URL or download arbitrary firmware.

Treat an ordinary "connect" request as permission to start the bridge and USB
viewer, not permission to flash, restore flash, install drivers, configure a login
service, change Wi-Fi, or record audio. Existing board evidence can be reused for
this same unit. For a replacement/unknown board, ask for the rear label and confirm
the display, touch controller, and pins before any firmware operation.

## Automatic connection

1. Check `python3 --version`, `node --version` (22+), and `pnpm --version`.
   If dependencies are missing, explain what is needed and ask before installing
   system software. If project dependencies are missing, use `pnpm install
   --frozen-lockfile` when the lockfile exists. Use installed Chrome or the
   project's documented browser install command; do not use a personal profile.
2. Curl `http://localhost:3088/health` with a five-second timeout. Reuse a healthy
   live Pixsim bridge with 240×320 output and 360×480 logical view. If absent,
   start `pnpm dev:compact` when available (otherwise `pnpm dev:cyd`) from the
   project in the agent's background-command tool.
   Retry health at most ten times, three seconds apart (startup waits for assets).
   Inspect its startup error if it fails. Do not kill another session's server or
   start a second listener. A static/wrong-size server requires an explained,
   owner-aware restart; ask if ownership is unclear.
3. Detect USB without opening the serial device:
   `python3 <skill-directory>/scripts/connect.py --project <project> --detect-only`.
   The helper maps macOS USB VID/PID `1a86:7523` to its actual callout port, rather
   than guessing that `/dev/cu.usbserial-110` never changes. Multiple matching
   adapters require the user to identify one; a busy port requires owner-aware
   handling. Never kill arbitrary Python/serial-monitor processes.
4. Once the user wants video, run in the background:
   `python3 <skill-directory>/scripts/connect.py --project <project> --wait 60 --attempts 3 --stream`.
   In this project, the equivalent is `pnpm connect:cyd --stream`.
   The helper waits up to 60 seconds for insertion, verifies the viewer handshake,
   sends one image and waits for decode/draw acknowledgement before continuous
   frames. Reconnect attempts are bounded to three; no firmware is changed.
   For image-only diagnosis, omit `--stream`. To choose an adapter after asking,
   add `--port /dev/cu.<selected-device>`; it must still match the known VID/PID.
5. Require `USBFRAME OK` as device decode/draw evidence. Check `/health` for fresh
   image requests with `CYD-USB-bridge`, and for input errors. Ask the user to
   drag on the road and check whether `inputCount` increases. A fresh preview,
   healthy capture loop, or handshake alone does not prove physical movement.

## Retry and ask, rather than guess

| Symptom | Next action / question |
| --- | --- |
| No matching USB after 60 seconds | Ask whether this is the previously working USB-A-to-C data cable plus adapter. Replug, approve the macOS accessory prompt, try a direct port. A lit screen proves power only. Retry once after a user action. Do not silently install a driver. |
| Multiple adapters | Ask which belongs to the CYD, or have the user unplug other serial adapters. Do not select by the old port name. |
| Serial busy | Report the owner PID. Ask to close the serial monitor, or reuse the known running stream. Stop only a helper this session owns, and only if needed. |
| No `CYDREADY2 240 320 115200` | Retry at 115200 only, within the three-attempt limit. Ask if BOOT is held, the board was reset into downloader mode, or firmware changed. Releasing BOOT and resetting is a user action, not an automatic flash. |
| JPEG ACK lost | Use the existing helper's bounded frame retries and resynchronization. After exhaustion, ask to replug/reset; preserve logs without Wi-Fi passwords. |
| Frozen image / cannot walk | First check whether USB was paused and Wi-Fi never completed. A one-shot image does not keep forwarding touch. Restore the requested live transport; check input count before editing game logic. |
| About one frame per second | State USB is still active at 115200. It is a bandwidth limit, not an 8-FPS device result. Offer `cyd-wifi`; do not raise baud automatically. |
| User expects true multitouch / on-board voice | Explain CST820 single-touch and absence of a built-in mic. Do not start recording; the existing mic control uses the Mac only after an explicit click. |

## Wi-Fi and safety

Use `cyd-wifi` only when the user wants that handover. Do not pause a working USB
stream until the phone can reach the Mac over the home LAN and the user is ready
to configure the board. If handover fails, offer to restore USB instead of leaving
a frozen screen. Never ask for Wi-Fi passwords in chat; enter them on the device's
local setup portal. Do not expose port 3088 publicly or use a Pixsim HTML/Vercel URL
as the JPEG bridge URL.

Keep Pixsim and upstream code unchanged. Do not read/share factory backups or
secret files. Any firmware operation needs separate approval, exact board/pin
confirmation, and a private verified backup first; failure recovery never means
automatic erase, factory restoration, or reflashing.

## Finish

Leave the requested bridge/stream running. A foreground script or agent background
job is not a persistent login service. Report: USB or Wi-Fi, port, image ACK,
freshness/input evidence, measured FPS versus target, and what still needs the
user's physical confirmation. Curl `/health` before finishing. If setup is blocked,
say the specific blocker and ask one actionable question.
