# CYD App Explorer

- Public site: https://aibuilders-cyd.vercel.app
- Source: https://github.com/Clubria/robobuilders-cyd
- App additions: `site/apps.json` pull request or the **Add an app** issue form.
- Shortlink to configure in Clubria Links: `cyd` → `https://aibuilders-cyd.vercel.app/`.

The public site, catalogue and sanitized downloads are static. No device or private
browser data is deployed. The ESP32 still needs Wi-Fi plus the local bridge;
authenticated Amsterdam rendering and a device-native app carousel are not live.

## Shortlink status

`aib.club/cyd` currently redirects to `aibuilders.club/cyd`, not the explorer.
Clubria's shortlink creation requires `shortLinks:update` in an authenticated
session. No authorized Clubria session was available here, so the shortlink was
not created and must not be advertised as working yet. An authorized operator
can create the permanent `cyd` slug with the destination above.

## Publish changes

The root `vercel.json` builds only `artifacts/site`. Maintainers can publish the
already-reviewed static build with their authenticated Vercel CLI:

```sh
pnpm build:site
pnpm test:site
vercel link --cwd artifacts/site --project aibuilders-cyd --scope admin-2433s-projects
vercel deploy --cwd artifacts/site --prod --scope admin-2433s-projects
```

When Git integration is connected, inspect its deployment for the intended commit
before running another CLI deployment. Verify the production alias, both ZIPs,
and `/apps.json` anonymously. Never point a public domain at the unauthenticated
port3088 bridge.
