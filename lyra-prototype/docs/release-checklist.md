# Penny Release Checklist

Run before cutting a public release branch or package:

- `npm ci`
- `npm run check`
- `npm test`
- `npm run preflight`
- `npm pack --dry-run --ignore-scripts --json`
- `git diff --check`
- `node scripts/check-release-artifacts.js`
- `node scripts/check-frontend-privacy.js`

Expected release properties:

- default bind host is loopback
- LAN sharing requires `PENNY_LAN_SHARE=1`
- LAN API access requires a token
- workspace write tools stage pending patches unless direct-write mode is explicitly enabled
- web fetches block private/internal targets unless explicitly allowed
- generated artifacts, local memory, local logs, private notes, and secrets are not tracked
- README, install, security, and privacy docs match the current code
