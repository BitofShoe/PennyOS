# Security

## Supported Model

Penny is a local companion app. It is not designed to be hosted on the public internet.

## Defaults

- Server bind host: `127.0.0.1`
- LAN sharing: off
- API token: required for LAN mode and sensitive local mutations
- Host and Origin validation: enabled for `/api/*`
- JSON content type required for API mutations
- Workspace writes: pending approval by default
- Memory read/inspector/export routes: local token required by default
- Memory mutation/review/purge/consolidation routes: local token required by default
- OpenAI provider setup routes: local token required by default, API key redacted from responses
- Model changes and voice generation routes: local token required by default
- Secret-bearing project file reads: blocked by default, while `.env.example` remains readable
- Web reading/search: off by default
- Private-network web fetches: blocked by default
- Frontend third-party asset calls: blocked by guard

## Security-Relevant Environment Variables

- `PENNY_LAN_SHARE=1` binds to `0.0.0.0` and prints LAN URLs.
- `PENNY_API_TOKEN` sets the token required for LAN API calls.
- `PENNY_ALLOWED_HOSTS` adds comma-separated allowed Host names.
- `PENNY_REQUIRE_API_TOKEN=1` requires the API token for all `/api/*` routes.
- `PENNY_API_ALLOW_LOCAL_NO_TOKEN=1` deliberately keeps loopback API routes tokenless even when they would normally require the configured local token. Leave it off for consumer builds.
- `PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=1` lets write tools apply bytes directly.
- `PENNY_WEB_SEARCH_ENABLED=1` enables public web search/read tools.
- `PENNY_WEB_ALLOW_PRIVATE_NET=1` allows deliberate local/private network web fetches.
- `PENNY_MODEL_PROVIDER=openai_cloud` plus `PENNY_LMSTUDIO_API_KEY` routes model calls through the OpenAI API. This is opt-in cloud mode, not the local/private default.

Pending workspace edits are stored only in ignored local state at `data/penny-pending-workspace-writes.json`. They remain approval-gated, expire by TTL, and re-check the base file hash before applying.

## Loopback Trust Boundary

By default, Penny trusts localhost only for ordinary non-sensitive local GET routes. Memory reads, memory inspector, memory export, memory mutations/review/purge/consolidation, workspace-write approvals, model changes, provider setup, and voice generation require the local token by default. LAN clients do not get loopback trust: `PENNY_LAN_SHARE=1` requires a token for every `/api/*` route.

The browser gets that token through an HttpOnly loopback bootstrap cookie. This is a web/origin and accidental-local-access boundary, not a malware boundary: software already running as you on the same machine can still interact with local loopback services. If you do not want any localhost API route trusted without a token, set `PENNY_REQUIRE_API_TOKEN=1` so every `/api/*` route requires the token too. This protects against curious local processes better, but it also makes direct API poking less convenient.

`PENNY_API_ALLOW_LOCAL_NO_TOKEN=1` deliberately bypasses those strong local route token checks for loopback callers only. Keep it off for consumer builds unless you are doing controlled local diagnostics.

## Cloud Provider Boundary

OpenAI cloud setup writes the API key through token-gated `/api/penny/provider/*` routes. Do not paste API keys into LAN clients you do not control, screenshots, issue reports, logs, or public docs. Cloud mode can send prompt, memory, and tool context off-device; local mode is the recommended default when privacy is the priority.

## Reporting Issues

Open a private security report with:

- affected version or commit
- reproduction steps
- expected and actual behavior
- whether LAN sharing, direct writes, or private web fetches were enabled
