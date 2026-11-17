# Development

Users only need `setup.html`. Development requires Node.js 22+.

```powershell
npm install
npx playwright-core install chromium
npm run check
```

To use an installed Microsoft Edge instead of downloading Chromium:

```powershell
npm install
$env:CAPTURE_BROWSER_CHANNEL = 'msedge'
npm run check
Remove-Item Env:CAPTURE_BROWSER_CHANNEL
```

There are no runtime dependencies or secrets to configure. `.env.example` documents the optional browser setting; it is not loaded automatically.

## Files

| Path | Purpose |
| --- | --- |
| `setup.html` | Ready-to-use setup guide and bookmark. |
| `src/capture.js` | Browser exporter source. |
| `scripts/build-setup.cjs` | Builds the self-contained setup page. |
| `tests/verify.cjs` | Offline browser checks with fictional tasks. |
| `docs/demo.html` | Fictional page used for the screenshot. |

`npm run build` rebuilds `setup.html`. Commit the generated page whenever its source changes. `npm run screenshot` runs the checks and regenerates the demo and screenshot.

The tests use intercepted navigation, without signing in to Slack. They cover text, senders, links, reminders, missing metadata, completion filters, virtualized scrolling, view switching, manual picking, CSV escaping, diagnostics, bookmark execution, and clearing captured data.

For a live check, open `setup.html`, add the bookmark, and capture a small To-dos view. Compare the count with Slack and check one task's text, sender, and message link. Keep real exports out of Git.
