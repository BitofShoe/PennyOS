# Penny Configuration Profiles

Penny is a local app, so configuration is mostly environment variables in `.env` or the current shell. Start from `.env.example`, then choose the smallest profile that matches the run.

## Minimal Local Companion

Use this for normal localhost chat.

```dotenv
HOST=127.0.0.1
PORT=4317
PENNY_LAN_SHARE=0
PENNY_WEB_SEARCH_ENABLED=0
PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=0
PENNY_STATIC_EMBED_MODE=off
```

Boundary: no LAN sharing, no outbound web reading, no direct workspace writes.

## Web-Reading Opt-In

Use this when you explicitly want Penny to read public web pages.

```dotenv
PENNY_WEB_SEARCH_ENABLED=1
PENNY_WEB_ALLOW_PRIVATE_NET=0
```

Boundary: public web fetches are allowed, but loopback, private, link-local, multicast, reserved, and metadata-style targets remain blocked.

## LAN / Phone

Use this only on a trusted local network.

```dotenv
PENNY_LAN_SHARE=1
PENNY_API_TOKEN=replace-with-a-long-random-token
PENNY_REQUIRE_API_TOKEN=0
PENNY_API_ALLOW_LOCAL_NO_TOKEN=0
```

Boundary: every `/api/*` request from LAN clients requires the token. Turn this off when you are done.

## Browser Smoke QA

Use this for release browser checks against the isolated mock LM Studio server.

```powershell
npm run qa:browser:install
npm run qa:browser:smoke
```

Boundary: the smoke harness writes ignored reports under `output/playwright/` and uses disposable memory paths.

## Memory-Heavy QA

Use one memory harness at a time. Do not overlap voice QA, memory QA, and eval probes against the same live model setup.

```dotenv
PENNY_QA_STRICT_NO_MODEL_OPS=1
PENNY_QA_MANAGE_MODELS=0
```

Boundary: preserve loaded model state unless a specific QA task explicitly grants model-management permission.

## Static Embedding Experiment

Use this only for local experiments or explicit compare runs.

```dotenv
PENNY_STATIC_EMBED_MODE=live-shadow
PENNY_STATIC_EMBED_PROVIDER=model2vec-potion-8m
```

Boundary: static candidates are discovery hints only. They are not canonical memory, not truth authority, and not a reason to raise prompt limits.
