---
name: cyd-wifi
description: Move the confirmed GUITION JC2432W328 Pixsim viewer from slow USB to trusted 2.4 GHz Wi-Fi, or diagnose CYD LAN connectivity and speed. Use for phone provisioning, faster frames, bridge URL questions, or restoring USB after a failed Wi-Fi handover. Keep credentials off chat and preserve the working stream until the user is ready.
compatibility: A local agent with the existing robobuilders-cyd project, a Mac bridge, the confirmed flashed viewer, and a phone on a trusted LAN.
---

# CYD Wi-Fi handover

1. Read the project's AGENTS.md, README.md and firmware/README.md. If missing,
   ask for the project location. Load `cyd-setup` for board specs or USB recovery.
   Verify the unit is the already confirmed GUITION JC2432W328, ST7789/CST820.
   This workflow provisions the installed viewer, not new firmware.
2. Check `http://localhost:3088/health`: live Pixsim, 240×320, capture advancing.
   Reuse the existing bridge, including Compact. If absent, start `pnpm dev:compact`
   when available (otherwise `pnpm dev:cyd`) in the project;
   bounded startup retries, no killing other sessions' servers.
3. Determine the Mac's current LAN IP from its active network interfaces and the
   bridge's candidate addresses. The prior `192.168.178.237` is an example, not a
   permanent setting. If networks changed after server startup, the host allowlist
   may need a restart of an owned bridge; ask if ownership is unclear.
4. Ask the user to open `http://<current-Mac-LAN-IP>:3088/preview` on their phone's
   normal home Wi-Fi. Wait for confirmation. A Mac self-request is not a phone
   test. If unreachable, check same LAN, guest/client isolation, VPN/proxy routing,
   and incoming Node firewall permission. Do not disable the firewall wholesale,
   request the password, deploy to Vercel, or expose unauthenticated port3088.
5. Only once phone access works and the user is ready, pause an owned USB helper.
   If another session owns it, ask before stopping it. USB frames take priority
   over board Wi-Fi polling. Explain that the image may freeze during setup.
6. Have the user hold BOOT for three seconds while the application is running,
   not during power-on/reset. Join `CYD-Pixsim-…` on the phone using the password
   displayed on the device; open `http://192.168.4.1`. Enter home2.4 GHz credentials
   there, not in chat, plus `http://<current-Mac-LAN-IP>:3088` as the bridge base URL.
   No `/preview`, `/frame.jpg`, `localhost`, or Pixsim HTML/Vercel URL. Save and
   reconnect the phone to home Wi-Fi. Record the setup/OTA password privately.
7. Allow up to three health checks, five seconds apart. Require new board-origin
   image requests/address/user agent, not Mac preview traffic; ask for a moving
   image and road-drag walking confirmation. Watch input count/errors while the
   user touches. Target8 FPS is not evidence of board8 FPS: measure completed
   device draws over an interval if instrumentation allows, otherwise say the
   physical rate is unmeasured. Do not fabricate a Wi-Fi FPS result from captures.
8. If the handover stalls, ask the next specific question: did it save, is the
   board on2.4 GHz, what non-secret error does the screen show, can the phone still
   reach the bridge? Retry after the relevant user action, not forever. Offer to
   restore USB with `cyd-setup` instead of leaving the screen frozen. Tell the user
   USB is the fallback, not proof Wi-Fi connected. No automatic erase/reflash.

Credentials live in ESP32 NVS (not encrypted against physical flash reads).
Do not read, export, log, or bundle passwords, NVS dumps, factory backups or setup
photos. Wi-Fi is the useful next step for the UART bandwidth bottleneck; Bluetooth,
multiple serial ports, a VPS or Playwright-for-Puppeteer substitution is not an
automatic fix. A trusted LAN is required because this bridge has no authentication.

Finish with current transport, actual evidence, remaining user actions and a final
localhost health curl. Leave the desired bridge running and report separately
Mac checks and physical-board confirmation.
