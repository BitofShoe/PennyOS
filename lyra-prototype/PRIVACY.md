# Privacy

Penny is local-first. The app is built to run on your machine and talk to your local LM Studio server.

## Stored Locally

- browser settings and transcript shell state in localStorage
- live memory files under ignored `data/` paths
- optional QA/eval artifacts under ignored output/artifact paths

Browser snapshots strip raw uploaded image data before persistence.

## Not Sent by Default

- no hosted model API calls
- no third-party font/CDN calls from the browser UI
- no public telemetry
- no cloud sync

## Web Reading

Penny's web tools can fetch public pages when enabled, but they block private/internal/local network targets by default. Set `PENNY_WEB_ALLOW_PRIVATE_NET=1` only for deliberate local-network testing.

## LAN Mode

`PENNY_LAN_SHARE=1` exposes Penny on your local network. Use a long `PENNY_API_TOKEN`, enter it only on devices you control, and turn LAN mode off when you no longer need it.
