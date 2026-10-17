# CYD setup skills

Includes `cyd-setup` (specs, automatic USB detection and bounded reconnect) and
`cyd-wifi` (safe phone-based handover). Requires the existing robobuilders-cyd
application and an already flashed, confirmed GUITION JC2432W328 viewer.

## Install

These skills are already project-local in this checkout. OpenCode discovers
`.opencode/skills/<name>/SKILL.md`; a new session may be needed to refresh discovery.

For the ZIP on another machine, unzip it, then copy the **two skill folders** into
the project `.opencode/skills/` (OpenCode) or `.claude/skills/` (Claude Code). Check
for an existing folder of the same name before copying; do not overwrite unrelated
skills. Alternatively install globally under `~/.config/opencode/skills/` or
`~/.claude/skills/`. Individual `.skill` files are ZIP packages for clients that
support skill import; otherwise unzip and copy the folders. Do not assume a cloud
chat client can access USB or run this local project.

The pack contains instructions/helper code, not the application, Chrome, firmware,
drivers, Wi-Fi credentials or factory backups. Use the user's existing project
copy; there is no known public Git remote for this local prototype.

## Simple MacBook starter prompt — no Pixsim

> Set up video streaming from my MacBook to the GUITION JC2432W328 using the
> supplied board specs. Don't use Pixsim: start with a simple animated clock and
> color bars at240×320. Detect the USB data connection automatically, verify one
> image, then stream using the existing viewer firmware. Retry at most three
> times; don't reflash without permission. Measure delivered FPS and delay, then
> optimize JPEG size/quality and local Wi-Fi for responsiveness. Give me simple
> commands and report what was actually verified.

The hardware section of `cyd-setup/references/specs.md` supplies the confirmed
ST7789/CST820 pin map. The two bundled skills below currently automate the existing
Pixsim project; the neutral prompt above is the general streaming starter, not a
claim that those application-specific helpers already run an animated-clock demo.

## Optional existing Pixsim project prompt

> Use the cyd-setup skill to connect my already confirmed GUITION JC2432W328 to
> Pixsim. Locate my existing robobuilders-cyd project, reuse or start its portrait
> bridge, and wait up to 60 seconds for the known USB data adapter. Check the viewer
> handshake and one decoded image before starting live video and touch. Retry at
> most three times at 115200 baud. If USB is missing, busy, ambiguous or the viewer
> does not respond, ask the next specific question instead of guessing. Do not
> flash, erase, change Wi-Fi, stop another session's server, or record audio.
> Leave it running and tell me which transport is active and what was verified.

On OpenCode, mention `@cyd-setup` explicitly if discovery does not pick it up.

## Direct command in the original project

With `pnpm dev:compact` (or `pnpm dev:cyd`) already running:

```sh
pnpm connect:cyd --stream
```

This waits for insertion and retries disconnect/startup faults within bounded
limits. It does not register an always-on login service. Without `--stream`, it
tests one image only: the screen will not keep updating or forwarding touch.

For a copied/global skill, let the agent use its actual skill directory:

```sh
python3 <skill-directory>/cyd-setup/scripts/connect.py --project <project-directory> --stream
```

USB video is approximately1 FPS. For faster transport, paste:

> Use cyd-wifi to move my CYD to home2.4 GHz Wi-Fi. Verify the Mac bridge is
> reachable from my phone before pausing USB. Guide me through the local board
> portal without asking for passwords in chat. Confirm board-origin requests and
> road-drag walking. If setup fails, offer to restore USB.
