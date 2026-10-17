# CYD / Pixsim bridge

Follow `/Users/ap/Repos/AGENTS.md` when available. This project began as a local
hardware prototype. The user-authorized repository is now
`https://github.com/Clubria/robobuilders-cyd`; keep credentials, browser profiles,
backups and device configuration out of commits and downloads.

## Scope and hardware safety
- Keep Pixsim source unchanged unless the user requests changes there.
- Confirm the exact board, display controller, touch controller, and pin mapping
  before flashing. Do not assume a standard ESP32-2432S028R configuration.
- Keep Wi-Fi credentials in ignored local configuration; never log or commit them.
- Preserve upstream licensing and distinguish upstream source from local changes.

## Review and checks
- No `ai:workers` harness is available. Use built-in read-only subagents for bounded
  research/review when useful; Codex must perform final review of code automatically
- Test the single-image transport before adding continuous screenshot streaming.
- Run focused checks for changed server/firmware behavior and report separately
  what was tested on the Mac and what was verified on the physical board.

## Local server
- Use `pnpm dev` from this directory for the bridge, on port 3088.
- Before finishing, curl `http://localhost:3088/health`; start the server if needed
  and leave it running. Do not stop servers started by other sessions.
