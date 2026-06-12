# Privacy

Penny is local-first. The app is built to run on your machine and talk to your local LM Studio, llama.cpp, or other local OpenAI-compatible server by default.

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
- no outbound web reading unless `PENNY_WEB_SEARCH_ENABLED=1`

## Optional OpenAI Cloud Mode

Settings -> Brain connection can save an OpenAI Platform API key for users who choose the easier cloud path instead of a local model runtime. This is off by default.

When OpenAI cloud mode is enabled, Penny may send model prompts, memory context, tool context, and embedding requests to OpenAI, and API usage may cost money. A ChatGPT subscription is not an API key. The API key is written to Penny's server-side app config `.env`; it is not stored in browser localStorage and route responses only return a redacted preview.

## Web Reading

Penny's web tools are off by default. When `PENNY_WEB_SEARCH_ENABLED=1`, they can fetch public pages, but they block private/internal/local network targets by default. Set `PENNY_WEB_ALLOW_PRIVATE_NET=1` only for deliberate local-network testing.

The README uses remote badge images for GitHub display. The local Penny browser UI itself does not fetch third-party fonts, CDN assets, or telemetry.

## LAN Mode

`PENNY_LAN_SHARE=1` exposes Penny on your local network. Use a long `PENNY_API_TOKEN`, enter it only on devices you control, and turn LAN mode off when you no longer need it.

## Localhost Reads

The default release posture treats loopback as trusted for non-mutating API reads. Other programs on your machine can reach ordinary local GET routes if they can connect to `127.0.0.1:4317`. Set `PENNY_REQUIRE_API_TOKEN=1` if you want every `/api/*` route token-gated.
