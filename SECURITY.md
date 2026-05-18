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
- Memory mutation/review/consolidation routes: local token required by default
- Secret-bearing project file reads: blocked by default, while `.env.example` remains readable
- Web reading/search: off by default
- Private-network web fetches: blocked by default
- Frontend third-party asset calls: blocked by guard

## Security-Relevant Environment Variables

- `PENNY_LAN_SHARE=1` binds to `0.0.0.0` and prints LAN URLs.
- `PENNY_API_TOKEN` sets the token required for LAN API calls.
- `PENNY_ALLOWED_HOSTS` adds comma-separated allowed Host names.
- `PENNY_REQUIRE_API_TOKEN=1` requires the API token for all `/api/*` routes.
- `PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=1` lets write tools apply bytes directly.
- `PENNY_WEB_SEARCH_ENABLED=1` enables public web search/read tools.
- `PENNY_WEB_ALLOW_PRIVATE_NET=1` allows deliberate local/private network web fetches.

Pending workspace edits are process-memory only for this release and disappear when Penny restarts.

## Reporting Issues

Open a private security report with:

- affected version or commit
- reproduction steps
- expected and actual behavior
- whether LAN sharing, direct writes, or private web fetches were enabled
