# Add a CYD app

1. Build a CYD-first web app, tested at240×320 with large touch controls. Use the
   starter ZIP from the App Explorer if helpful. A browser preview helps development;
   the ESP32 still uses the streaming bridge rather than rendering HTML directly.
2. Fork the repository and add an entry to `site/apps.json`, or use the **Add your
   app** issue form if you prefer a maintainer to add it.
3. Include a unique lowercase `id`, name, short description, HTTPS web URL,
   access requirements, and a six-digit hex preview color.
4. Run `node scripts/check-apps.mjs` and open a pull request.

The current catalogue is metadata. It does not authorize a server to open arbitrary
URLs or grant control of a live event. Renderer integration, allowed origins,
per-device sessions and access tokens must be reviewed separately before an app
can run on a physical display through a public server.

Never include Wi-Fi passwords, API keys, browser profiles, raw session exports,
flash backups, or device configuration. Do not flash hardware without exact
board/pin confirmation, user approval and a verified private backup.
