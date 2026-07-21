# Penny Configuration Profiles

Penny is a local app, so configuration is mostly environment variables in `.env` or the current shell. Start from `.env.example`, then choose the smallest profile that matches the run.

## Minimal Local Companion

Use this for normal localhost chat.

```dotenv
HOST=127.0.0.1
PORT=4317
PENNY_LAN_SHARE=0
PENNY_WEB_SEARCH_ENABLED=0
PENNY_WEB_ANSWER_MODE=model
PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=0
PENNY_STATIC_EMBED_MODE=off
PENNY_ENABLE_OPEN_LOOP_PROMPT=1
PENNY_ENABLE_BOUNDED_INITIATIVE=1
PENNY_ENABLE_TURN_STATE_PROMPT=1
```

Boundary: no LAN sharing, no outbound web reading, no direct workspace writes. The shipped local companion profile keeps bounded open-loop, initiative, and turn-state prompt bridges on with conservative caps; remove those lines to return to the raw server default of off.

## llama.cpp / Generic Endpoint

Use this when LM Studio is not the local model server.

```dotenv
PENNY_LMSTUDIO_BASE=http://127.0.0.1:18080/v1
PENNY_LMSTUDIO_EMBED_BASE=
PENNY_LOCAL_LLM_BACKEND=llama_cpp
PENNY_LOCAL_LLM_TRANSPORT=chat
```

Boundary: `PENNY_LMSTUDIO_*` names are historical compatibility names for Penny's configured local OpenAI-compatible endpoint. Doctor skips LM Studio CLI/preset checks in this profile and validates `/v1/models` plus chat/tool readiness instead.

## Optional OpenAI Platform Cloud

Use this only when you explicitly choose a cloud provider instead of a local model runtime. The normal Settings path is Brain connection -> Connect OpenAI cloud; this profile documents the resulting env shape.

```dotenv
PENNY_MODEL_PROVIDER=openai_cloud
PENNY_LOCAL_LLM_BACKEND=openai_compatible
PENNY_LOCAL_RUNTIME_LABEL=OpenAI API (cloud)
PENNY_LMSTUDIO_BASE=https://api.openai.com/v1
PENNY_LMSTUDIO_EMBED_BASE=https://api.openai.com/v1
PENNY_LOCAL_LLM_TRANSPORT=chat
PENNY_SKIP_LMSTUDIO_PREP=1
PENNY_LMSTUDIO_CHAT_MODEL=gpt-5.6
PENNY_LMSTUDIO_TOOL_MODEL=gpt-5.6
PENNY_LMSTUDIO_EMBED_MODEL=text-embedding-3-small
PENNY_LMSTUDIO_API_KEY=sk-your-openai-platform-api-key
```

Boundary: this is not private/local. Prompts, memory context, and tool context can leave the machine, and API usage may cost money. A ChatGPT subscription is not an API key. Keep local mode as the default unless you deliberately opt into this profile.

## Web-Reading Opt-In

Use this when you explicitly want Penny to read public web pages.

```dotenv
PENNY_WEB_SEARCH_ENABLED=1
PENNY_WEB_ANSWER_MODE=model
PENNY_WEB_ALLOW_PRIVATE_NET=0
```

Use `PENNY_WEB_ANSWER_MODE=direct` for the older fast deterministic result-list response. The Settings -> Web access card manages both values and requires a PennyOS restart after saving.

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
