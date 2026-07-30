# Privacy

Penny is local-first. The app is built to run on your machine and talk to your local LM Studio, llama.cpp, or other local OpenAI-compatible server by default.

## Stored Locally

- browser settings and transcript shell state in localStorage
- live memory files under ignored `data/` paths
- packaged desktop memory/config/log state under the app's user app-data paths
- optional QA/eval artifacts under ignored output/artifact paths

Browser snapshots strip raw uploaded image data before persistence.

## Provider Errors And Hidden Reasoning

Provider responses are private boundary input. When a local or cloud model request fails, Penny discards the raw response body and exposes only a fixed public error code/message plus bounded metadata such as provider, operation, upstream status, retryability, and a safe reason code. Raw provider bodies, prompts, memory snippets, credentials, directives, and hidden reasoning must not enter JSON/SSE responses, browser transcript/localStorage, runtime artifacts, or default logs.

Hidden reasoning is not reconstructed into a visible reply by default. Diagnostic reasoning receipts retain only bounded metadata such as capability, requested policy, evidence-backed effective state, observed signal, character/token counts, and truncation state. They do not retain the reasoning text.

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

Penny's web tools are off by default. You can opt in from Settings -> Web access or with `PENNY_WEB_SEARCH_ENABLED=1`. When enabled, searches and public page contents may leave your computer, but Penny blocks private/internal/local network targets by default. Set `PENNY_WEB_ALLOW_PRIVATE_NET=1` only for deliberate local-network testing. Web-answer style changes how Penny presents fetched results; it does not change these network boundaries.

The README uses remote badge images for GitHub display. The local Penny browser UI itself does not fetch third-party fonts, CDN assets, or telemetry.

## LAN Mode

`PENNY_LAN_SHARE=1` exposes Penny on your local network. Use a long `PENNY_API_TOKEN`, enter it only on devices you control, and turn LAN mode off when you no longer need it.

## Localhost API Access

The local desktop UI receives a loopback session cookie. Memory reads, memory inspector, memory export, memory mutation/review/consolidation, workspace-write approval, model changes, and voice generation require that local session token even when LAN sharing is off.

Other programs on your machine can still reach ordinary non-sensitive local GET routes if they can connect to `127.0.0.1:4317`. Set `PENNY_REQUIRE_API_TOKEN=1` if you want every `/api/*` route token-gated.

## Uninstall And Data Retention

Uninstalling PennyOS removes the installed app files and shortcuts. It does not automatically delete your user memory/config/log state. To wipe packaged desktop state too, delete the PennyOS app-data folders for `com.bitofshoe.pennyos` under your Windows roaming/local app-data locations.
