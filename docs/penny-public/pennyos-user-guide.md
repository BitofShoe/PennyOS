# PennyOS User Guide, Setup Manual, and FAQ

> Category: Public/external explanation
> Authority: Public/external explanation
> Status: Current snapshot as of 2026-06-11
> Use this for: first-run help, local model setup, feature orientation, and honest FAQ copy.
> Do not use this for: binding runtime law, live model guarantees, or release proof. Use [../../README.md](../../README.md), [../../INSTALL.md](../../INSTALL.md), and current QA receipts for that.

Hi. If you are reading this because Penny opened and then immediately started asking about "local brain lanes," congratulations: you have reached the part where the cute interface admits it still needs an actual model server.

This guide is for normal humans, not just the people who enjoy saying "OpenAI-compatible endpoint" before breakfast.

## Table of Contents

- [The Short Version](#the-short-version)
- [Quick Start Checklist](#quick-start-checklist)
- [What The Desktop App Includes](#what-the-desktop-app-includes)
- [Mobile / Phone Access](#mobile--phone-access)
- [OpenAI Cloud Setup](#openai-cloud-setup)
- [LM Studio Setup](#lm-studio-setup)
- [Embedding Model Setup](#embedding-model-setup)
- [llama.cpp Setup](#llamacpp-setup)
- [Speaches Voice Setup](#speaches-voice-setup)
- [Picking Models](#picking-models)
- [Feature Map](#feature-map)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [Source Notes](#source-notes)

## The Short Version

PennyOS has two pieces:

1. The Penny app: the desktop window, local server sidecar, UI, memory files, tools, settings, and personality scaffolding.
2. A brain runtime: usually a local model runtime like LM Studio or llama.cpp, or optionally OpenAI Platform API cloud mode if you choose the less-private-but-easier route.

The Windows desktop package includes the first piece. It does not bundle LM Studio, llama.cpp, Speaches, model weights, embedding models, voice models, OpenAI credentials, or a model manager. That is intentional for this release slice. Penny should not silently download models, load models, unload models, or mess with a live runtime you already have open.

If you only remember one sentence:

> Start LM Studio or llama.cpp, load a chat model, start its local API server, then open PennyOS Settings -> First-run local brain setup and pick the model Penny can see.

If that is too much setup right now, use Settings -> Brain connection -> Connect OpenAI cloud. That path is easier, but it is not private/local and it can cost money.

## Quick Start Checklist

1. Install PennyOS.
2. Install LM Studio, set up llama.cpp if you are comfortable with command-line local inference, or get an OpenAI Platform API key for the optional cloud path.
3. Download a chat/instruct model.
4. Load the model in the local runtime.
5. Start the runtime's OpenAI-compatible local server.
6. Open PennyOS.
7. Go to Settings -> First-run local brain setup.
8. Press Refresh.
9. Pick a Chat model and Tool model.
10. Optional but recommended: download/load an embedding model, then pick it in the Embedding model dropdown.
11. Save model setup.
12. Optional cloud fallback: go to Settings -> Brain connection, paste an OpenAI Platform API key, confirm the warning, save, then reopen PennyOS.
13. Optional: install and start Speaches if you want Penny to speak replies.
14. Optional: configure Settings -> Speaches voice, press Refresh voice, then enable the voice toggle.

Penny should then be able to chat through the loaded model. Semantic memory may still report fallback if the embedding lane is missing. That is not a startup failure.

## What The Desktop App Includes

The installed Windows app includes:

- Penny's Tauri window.
- A bundled Penny Node sidecar.
- The Penny server runtime tree.
- The public UI, sprites, Settings screen, and seed memory files.
- Writable app-data state for packaged mode.

It does not include:

- LM Studio.
- llama.cpp.
- Model weights.
- Embedding models.
- Speaches, TTS model downloads, or bundled voice models.
- OpenAI API keys or cloud account setup.
- Rust, Cargo, Node, npm, or a repo checkout for the end user.

Build machines still need build tools. End users should not need developer tools just to launch the installed app.

## Mobile / Phone Access

Phone access is possible, but it is intentionally no longer "just open whatever URL looked plausible." Penny is local-first, and LAN mode exposes your chat/memory API to another device on your network. That means it needs an explicit LAN start and an access token.

Current truth:

- The installed Tauri desktop app binds its bundled server to `127.0.0.1` for the local desktop window.
- The phone/LAN flow is currently the source/dev server flow on port `4317`.
- LAN sharing must be explicitly enabled with `PENNY_LAN_SHARE=1`.
- Every `/api/*` request in LAN mode requires the Penny API token.
- Do not put this on the public internet. Same trusted Wi-Fi only.

### Start Penny For Phone Access

From Windows PowerShell in the Penny checkout:

```powershell
cd C:\Path\To\PennyOS
$env:PENNY_LAN_SHARE = "1"
$env:PENNY_API_TOKEN = "choose-a-long-random-token"
$env:PENNY_SKIP_LMSTUDIO_PREP = "1"
npm start
```

Use a real random-ish token, not your LM Studio model name, not an OpenAI key, and not `password` unless you enjoy making future-you sigh audibly.

If you do not set `PENNY_API_TOKEN`, Penny will generate one for that process and print it in the terminal. That works, but it changes on restart. Setting your own token is less annoying.

### Find The Phone URL

The terminal should print LAN URLs when LAN sharing is on. Use the Windows Wi-Fi IPv4 address:

```text
http://<your-wifi-ipv4>:4317
```

Do not use these on your phone:

- `http://localhost:4317`
- `http://127.0.0.1:4317`
- A WSL adapter address like `http://172.x.x.x:4317`

If you need to find the Wi-Fi address manually:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike "169.254*" -and $_.IPAddress -ne "127.0.0.1" } |
  Select-Object InterfaceAlias,IPAddress,PrefixLength,AddressState
```

Pick the `Wi-Fi` address and open `http://<that-address>:4317` on your phone.

### Save The Token On Your Phone

On the phone:

1. Open the LAN URL.
2. Open Settings.
3. Find API access.
4. Paste the exact `PENNY_API_TOKEN` value.
5. Tap Save token.
6. Refresh the page if chat or status had already failed.

The phone browser stores that token locally and sends it as `X-Penny-Access-Token` on future API calls.

If you restart Penny with a different token, clear and re-save the token on the phone.

### Phone Access Troubleshooting

If the phone cannot open Penny:

- Make sure phone and PC are on the same Wi-Fi.
- Make sure Penny was started with `PENNY_LAN_SHARE=1`.
- Use the Windows Wi-Fi IPv4 address, not `localhost`, not `127.0.0.1`, and not the WSL adapter.
- Allow Node/Penny through Windows Firewall on private networks if Windows asks.
- Stop any stale Penny server and restart one normal LAN listener on port `4317`.

If Penny opens but chat/status fails:

- Save the token in Settings -> API access.
- Check for typos or extra spaces.
- If Penny generated the token, copy the freshly printed token from the current terminal.
- If you changed `PENNY_API_TOKEN`, clear the old phone token and save the new one.

## OpenAI Cloud Setup

This is the easier accessibility path when you want Penny to work without downloading a local LLM first. It is also the less-private path, so I am going to be extremely clear instead of cute about it.

OpenAI cloud mode means:

- Penny sends model requests to the OpenAI API.
- Your messages can leave your computer.
- Memory context and tool context can be included in prompts.
- API usage may cost money.
- A ChatGPT Plus/Pro subscription is not enough. You need an OpenAI Platform API key.

If you want the local-first promise, use LM Studio or llama.cpp instead. If you want the easiest path to "Penny can answer right now," cloud mode is useful.

### What You Need

1. An OpenAI Platform account.
2. An API key from the OpenAI Platform dashboard.
3. PennyOS installed and opening normally.

OpenAI's API docs describe bearer API-key authentication and say API keys are secrets that should not be exposed in client-side code. Penny's setup route stores the key server-side in the app config `.env`, not in browser localStorage.

OpenAI currently documents `gpt-5.5` as the latest model slug and `text-embedding-3-small` as a current embedding model. Penny uses those as the cloud defaults for this setup path.

### Get An OpenAI Platform API Key

This is the part that is easy to blur together with ChatGPT login. Do not worry: it is a different door, but it is a normal door.

1. Open the OpenAI Platform dashboard in your browser:

   ```text
   https://platform.openai.com/
   ```

2. Sign in with your OpenAI account.
3. If the dashboard asks you to create or select an organization/project, do that.
4. Check billing or usage limits before you hand the key to any app:
   - Add billing only if you are comfortable using paid API credits.
   - Set a monthly budget or usage limit if the dashboard offers it.
   - Remember that API usage is separate from a ChatGPT subscription.
5. Open the API keys page:

   ```text
   https://platform.openai.com/api-keys
   ```

6. Create a new secret key.
7. Give it a boring, recognizable name such as `PennyOS desktop`.
8. Copy the key immediately. The dashboard may only show it once.
9. Paste it into PennyOS Settings -> Brain connection -> Connect OpenAI cloud.
10. Do not paste the key into screenshots, chat messages, public issues, docs, or a browser console.

If you lose the key, do not panic. Create a new one, save it in Penny, then delete/revoke the old key from the dashboard if you are not using it anywhere else.

If Penny says the key is invalid:

- Make sure you copied the whole key with no spaces before or after it.
- Make sure it is an OpenAI Platform API key, not a ChatGPT password, not a Codex token, and not the Penny LAN access token.
- Make sure the project/org tied to the key can use the model you selected.
- Make sure billing or usage limits are not blocking requests.
- Try the default model names before custom model names.

### Connect Penny To OpenAI

1. Open PennyOS.
2. Open Settings.
3. Find Brain connection.
4. Click Connect OpenAI cloud.
5. Paste your OpenAI Platform API key.
6. Leave the default models unless you know what you are doing:
   - Chat model: `gpt-5.5`
   - Tool model: `gpt-5.5`
   - Embedding model: `text-embedding-3-small`
7. Check the cloud disclosure.
8. Click Save OpenAI cloud setup.
9. Wait for Penny to validate the key.
10. Close and reopen PennyOS.

Why the reopen? Penny's model/provider env is read when the bundled local server starts. The Settings button writes the config safely; reopening starts Penny with that new config.

### Switch Back To Local

In Settings -> Brain connection, click Switch back to local default, then close and reopen PennyOS.

That restores the normal LM Studio default:

```text
http://127.0.0.1:1234/v1
```

You will still need LM Studio, llama.cpp, or another local OpenAI-compatible runtime running for local model-backed chat.

## LM Studio Setup

LM Studio is the easiest path for most Windows users.

Official sources:

- [LM Studio app docs](https://lmstudio.ai/docs/app)
- [LM Studio local server docs](https://lmstudio.ai/docs/developer/core/server)
- [LM Studio OpenAI compatibility docs](https://lmstudio.ai/docs/developer/openai-compat)

The shape is simple:

1. Download and install LM Studio.
2. Open LM Studio.
3. Search for a chat/instruct model.
4. Download it.
5. Load it.
6. Open the Developer or Local Server area.
7. Start the API server.
8. Keep the server on port `1234` unless you changed Penny's `.env`.

Penny's default local endpoint is:

```text
http://127.0.0.1:1234/v1
```

LM Studio's OpenAI-compatible docs show the same basic idea: point the OpenAI-compatible base URL at `http://localhost:1234/v1`, then use the model identifier LM Studio exposes.

### LM Studio Visual Checkpoints

You are looking for these states:

- A model is downloaded.
- A model is loaded, not merely visible in your library.
- The local server is started.
- The model list endpoint would show a model under `/v1/models`.
- PennyOS Settings -> First-run local brain setup says the local brain is ready or lets you pick the visible model.

If LM Studio is open but Penny says no model is ready, the usual reason is that the server is not started or the model is installed but not loaded.

## Embedding Model Setup

Embeddings are a separate memory-search lane. They are not Penny's chat brain, and they are not the Tool model. They turn text into vectors so semantic memory can find "the thing we talked about" even when the wording is not identical.

You can use Penny without an embedding model. In that case she should say semantic memory is in fallback and use keyword retrieval. That is acceptable for basic chat. For the better memory experience, install and serve one embedding model too.

Good practical shape:

1. In LM Studio, search for an embedding model.
2. Download it.
3. Load or expose it through the local server so `/v1/models` can see it.
4. Open PennyOS Settings -> First-run local brain setup.
5. Press Refresh.
6. Pick it in the Embedding model dropdown.
7. Save model setup.

Known useful embedding-model IDs you may see:

- `text-embedding-embeddinggemma-300m@f32`
- `text-embedding-nomic-embed-text-v1.5`

The exact ID depends on the runtime and how the model was downloaded. If LM Studio shows `text-embedding-embeddinggemma-300m@f32` loaded and Penny is still configured for `text-embedding-nomic-embed-text-v1.5`, that mismatch is not a chat failure. It just means semantic memory is probably using fallback until you pick the loaded embedding model in Settings.

Do not pick an embedding-only model for Chat or Tool. Embedding models are for memory search, not conversation.

## llama.cpp Setup

llama.cpp is more manual. It is powerful, but it expects you to know where your GGUF model is and how you want to serve it.

The friendlier documented route is `llama-cpp-python`, which provides an OpenAI-compatible server:

- [llama-cpp-python OpenAI-compatible server docs](https://llama-cpp-python.readthedocs.io/en/latest/server/)

The docs show the basic install and launch shape:

```bash
pip install llama-cpp-python[server]
python3 -m llama_cpp.server --model <model_path>
```

Then point Penny at that server. Example `.env` shape:

```dotenv
PENNY_LOCAL_LLM_BACKEND=llama_cpp
PENNY_LMSTUDIO_BASE=http://127.0.0.1:18080/v1
PENNY_LOCAL_LLM_TRANSPORT=chat
```

The `PENNY_LMSTUDIO_*` names are historical. In this mode they mean "Penny's configured local OpenAI-compatible endpoint."

If you split chat and embeddings across two llama.cpp servers, keep them on separate ports and do not expose an embedding-only model as the chat model.

## Speaches Voice Setup

Speaches is a separate local speech server. PennyOS does not install it, bundle it, or download TTS models for you. That keeps the desktop app smaller and avoids surprising your machine with extra model downloads.

Use Speaches only if you want Penny to speak completed assistant replies. It does not replace LM Studio or llama.cpp for chat. The normal shape is:

```text
PennyOS chat -> LM Studio or llama.cpp
PennyOS voice -> Speaches
```

Official sources:

- [Speaches GitHub](https://github.com/speaches-ai/speaches)
- [Speaches installation docs](https://speaches.ai/installation/)
- [Speaches text-to-speech docs](https://speaches.ai/usage/text-to-speech/)

The easiest Windows route is Docker Desktop. If you do not already have Docker installed, install [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) first, then restart PowerShell.

### Start Speaches With Docker

CPU mode is the safest first test:

```powershell
docker volume create hf-hub-cache
docker run --rm -d --name speaches -p 8000:8000 -v hf-hub-cache:/home/ubuntu/.cache/huggingface/hub ghcr.io/speaches-ai/speaches:latest-cpu
```

That starts Speaches at:

```text
http://127.0.0.1:8000
```

If you already know your Docker GPU setup is working, Speaches also documents GPU/CUDA images. Start with CPU first unless you are intentionally debugging GPU acceleration.

If Docker logs show `CUDAExecutionProvider` errors while the request still ends with `POST /v1/audio/speech ... 200 OK`, Speaches tried CUDA, could not load the CUDA/cuDNN libraries inside that container, and fell back to CPU. That is noisy, but it is not a Penny failure. CPU mode is fine for short completed replies if generation latency feels acceptable.

### Download Or Check The TTS Model

Speaches' TTS docs use Kokoro as the example model:

```text
speaches-ai/Kokoro-82M-v1.0-ONNX
```

Some Speaches setups can fetch/cache models when first used, but TTS may require an explicit model download. If Penny says the voice model is not ready, install `uv` and use Speaches' CLI:

```powershell
uvx speaches-cli model download speaches-ai/Kokoro-82M-v1.0-ONNX
uvx speaches-cli model ls --task text-to-speech
```

Then check that Speaches is answering:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/v1/models -UseBasicParsing
```

You can also generate a tiny test WAV:

```powershell
$body = @{
  input = "Hello from Penny."
  model = "speaches-ai/Kokoro-82M-v1.0-ONNX"
  voice = "af_heart"
  response_format = "wav"
  speed = 1.0
} | ConvertTo-Json

Invoke-WebRequest http://127.0.0.1:8000/v1/audio/speech -Method POST -ContentType "application/json" -Body $body -OutFile penny-voice-test.wav
```

Open `penny-voice-test.wav`. If that file sounds good, Penny has something real to call.

### Configure PennyOS Voice

In PennyOS:

1. Open Settings.
2. Find Speaches voice.
3. Set Speaches URL to `http://127.0.0.1:8000`.
4. Set model to `speaches-ai/Kokoro-82M-v1.0-ONNX`.
5. Set voice to `af_heart`.
6. Adjust Voice boost and Voice speed if needed.
7. Click Save voice.
8. Click Refresh voice.
9. Enable voice once Penny reports Speaches is reachable and the model is ready.

When voice is enabled, Penny speaks the completed assistant reply after chat finishes. Use Stop to interrupt playback and Replay to hear the last spoken response again.

If the toggle stays disabled, it usually means Speaches is not running, the URL/port is wrong, or the configured TTS model is not visible from `/v1/models`.

Penny exposes Speaches' supported `speed` setting. Lower values speak more slowly; higher values speak faster. Penny does not currently expose pitch because the local Speaches `/v1/audio/speech` API does not advertise a pitch field. If pitch control appears later, it should be through a real supported backend setting or honest audio post-processing, not a fake slider.

## Picking Models

Penny is personality-sensitive. A model can be technically strong and still make her sound like a laminated office sign.

Use these as practical guidelines, not permanent law.

### Good Fits

- Instruction-tuned chat models.
- Models with enough capacity to hold personality, context, and tool instructions at the same time.
- Models your machine can run without constant paging or painful stalls.
- Vision-capable models if you want screenshot/image reactions.
- A smaller fast model for the Tool lane if you do lots of file/project work.

### Bad Fits

- Embedding-only models as the Chat lane.
- Base models that were not tuned for chat.
- Tiny models when you care about personality and nuance.
- Huge models that technically load but make every turn miserable.
- Models that refuse character voice and turn everything into generic assistant paste.

### Good Starting Families

As a snapshot, not a promise:

- Gemma-style instruction models have been useful for Penny's personality work on this machine.
- Qwen-style coder/instruct models can be useful for tool-heavy or code-heavy work.
- Larger models usually preserve more character and reasoning, but only if your hardware can keep them responsive.
- Quantized GGUF/QAT variants are normal in local inference. Pick the strongest one your machine can run comfortably.

Penny's Settings dropdown may show more than one class of model:

- Loaded or exposed models: these are the plug-and-play choices.
- Installed models: these may exist on disk but still need to be loaded or served.
- Configured/saved preferences: these are Penny's remembered lane choices.

If the Tool dropdown auto-picks the loaded model but Chat does not, refresh the status and prefer the model Penny reports as resolved. A stale saved preference should not outrank the resolved loaded model.

## Feature Map

### Chat

Talk to Penny like a person when you want presence, mood, image reactions, and banter. Be concrete when you want work.

Better:

```text
Open README.md and tell me what the install path assumes.
```

Worse:

```text
Be agentic.
```

The second one sounds fun, but it is fog wearing a tiny hat.

### Memory

Explicit memory is local and canonical. Archive memory is additive and review-gated before promotion. Semantic memory depends on an embedding lane, but Penny should fall back to keyword retrieval when embeddings are missing.

Packaged desktop mode stores writable state in app-data paths. Source/dev mode normally uses checkout-local ignored data files. Do not run two Penny instances on the same port unless you deliberately know what you are doing.

### Model Controls

Settings -> First-run local brain setup lets you pick:

- Chat model.
- Tool model.
- Embedding model.
- Whether Penny may fall back to another compatible loaded model.

That saves a local preference so you do not have to edit `.env` just because LM Studio or llama.cpp reports a slightly different model id.

### Voice

The old browser read-aloud path used Windows/browser system voices. If it sounded like a dusty robot in a hallway, that is because it was not Penny's real voice.

PennyOS now has a runtime voice path for a separately running Speaches server:

- Open Settings.
- Set the Speaches URL, model, and voice.
- Adjust Voice boost and Voice speed.
- Click Refresh voice.
- Enable the voice toggle once Penny reports that Speaches is reachable and the configured model is ready.

When enabled, Penny speaks completed assistant replies after the normal chat response finishes. Stop and Replay controls live beside the voice setup.

PennyOS still does not bundle Speaches, llama.cpp, TTS model weights, or voice downloads. If Speaches is not running, the toggle stays disabled and Penny chats silently. See [Speaches Voice Setup](#speaches-voice-setup) for the full install path.

Source/dev sidecar harnesses for search, docs/RAG, and audio experiments may exist in the repository, but they are not exposed in the consumer Settings UI and are not part of the downloadable app runtime. Runtime voice uses `/api/penny/voice/*`, not the review sidecar routes.

## FAQ

### Does PennyOS work without LM Studio or llama.cpp?

Yes, if you configure OpenAI cloud mode with an OpenAI Platform API key. Without either a local OpenAI-compatible endpoint or OpenAI cloud mode, the app can open, but model-backed chat can only report readiness/fallback state.

### Is OpenAI cloud private like local mode?

No. Local mode keeps model requests on your machine or LAN runtime. OpenAI cloud mode can send prompts, memory context, and tool context to OpenAI. It is optional, explicit, and meant as an accessibility fallback when local models are too much setup.

### Does PennyOS download or load models for me?

No. Not in this slice. Penny preserves your live LM Studio/llama.cpp state by default. That means she should not unload, reload, or swap models behind your back.

### Do I have to install Speaches separately?

Yes, if you want runtime voice. Speaches is optional and separate from PennyOS. Chat still works through LM Studio, llama.cpp, or another OpenAI-compatible endpoint without Speaches.

### Is LM Studio plug-and-play once installed?

Almost. Install LM Studio, download a model, load the model, start the local server, then refresh Penny's Settings. The missing step is usually "start the server" or "load the model."

### Why does Penny mention embeddings?

Embeddings help semantic memory retrieval. They are useful, but they are not required for basic chat. If the embedding model is missing, Penny should say so and use keyword fallback. For the best memory behavior, download/load an embedding model in LM Studio or llama.cpp, then choose it in Settings -> First-run local brain setup.

### What is the best model?

There is no permanent answer. Use a strong instruction/chat model that fits your hardware. If you want Penny to feel vivid, avoid tiny or generic models. If you want speed, use a smaller model or a separate Tool lane. If you want image reactions, load a vision-capable model and make sure your server supports image input.

### What is the worst model?

For Penny specifically: embedding-only models as chat, base models with no chat tuning, and models that flatten all personality. Technically running is not the same as feeling good.

### Will the desktop app cross wires with my older Penny?

Packaged Penny writes to app-data paths. Older source/dev Penny usually writes to checkout-local ignored data paths. The biggest risk is running both on the same port. Use one at a time unless you intentionally changed ports.

### Can I use the installed desktop app from my phone?

Not directly in this snapshot. The installed Tauri app starts its bundled server for the local desktop window and binds it to `127.0.0.1`. Phone access currently means starting the source/dev server in LAN mode with `PENNY_LAN_SHARE=1` and a Penny API token.

### Where is the in-app help?

Open PennyOS Settings and click "Open setup guide." That page is bundled under `public/pennyos-help.html`, so the desktop runtime packages it with the app.

## Troubleshooting

### Penny opens, but chat does not answer

Check:

- Is LM Studio or llama.cpp running?
- Is the local server started?
- Is a chat model loaded?
- Does Penny Settings show a resolved Chat model?
- Is the endpoint URL correct?

### The dropdown is full of models

Loaded/exposed models are the safe first picks. Installed-only entries may be useful preferences, but Penny cannot use them until the runtime actually serves them.

### The voice sounds terrible

If it sounds like the old Windows/browser robot, you are not using Penny's runtime voice path. The consumer UI no longer uses browser `speechSynthesis`; configure local Speaches in Settings or leave voice off.

Kokoro voices vary a lot. The upstream voice list grades some voices much higher than others, and short one-line replies can sound worse than naturally punctuated sentences. Try `af_bella`, `af_heart`, or `af_nicole` first, then use Voice speed for pacing. Pitch is not currently a Speaches/Kokoro setting in Penny.

### Voice toggle stays disabled

Check:

- Is Speaches running at `http://127.0.0.1:8000`?
- Does `http://127.0.0.1:8000/v1/models` answer?
- Does the model list include `speaches-ai/Kokoro-82M-v1.0-ONNX`?
- Did you save the Speaches URL/model/voice in PennyOS Settings?
- Did you click Refresh voice after starting Speaches?

### Speaches logs show CUDA errors, but voice works

That usually means Speaches tried ONNX Runtime's CUDA provider, could not find the needed CUDA/cuDNN libraries in the container, and fell back to CPU. If audio generation succeeds, you can ignore it for now. To make it disappear for real, either run a CPU-only/provider-pinned Speaches setup or intentionally set up the Speaches GPU image with Docker/NVIDIA CUDA support. Do not mix those two paths casually.

### The sprite flickers while typing

That should not happen. The desktop UI now pauses the sprite idle animation while the composer is focused and keeps expression changes tied to real mood/state transitions.

## Source Notes

This guide was refreshed against:

- LM Studio docs for app capabilities, downloads, local server, and OpenAI-compatible endpoints.
- llama-cpp-python docs for an OpenAI-compatible llama.cpp server path.
- OpenAI API docs for bearer API-key authentication, current model guidance, and embedding model defaults.
- Speaches docs for install paths and `/v1/audio/speech` text-to-speech behavior.
- Penny LAN/phone reset runbook, `INSTALL.md`, and API security code for current LAN/token behavior.
- PennyOS repo docs and runtime behavior as of 2026-06-11.
