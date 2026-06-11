# PennyOS User Guide, Setup Manual, and FAQ

> Category: Public/external explanation
> Authority: Public/external explanation
> Status: Current snapshot as of 2026-06-10
> Use this for: first-run help, local model setup, feature orientation, and honest FAQ copy.
> Do not use this for: binding runtime law, live model guarantees, or release proof. Use [../../README.md](../../README.md), [../../INSTALL.md](../../INSTALL.md), and current QA receipts for that.

Hi. If you are reading this because Penny opened and then immediately started asking about "local brain lanes," congratulations: you have reached the part where the cute interface admits it still needs an actual model server.

This guide is for normal humans, not just the people who enjoy saying "OpenAI-compatible endpoint" before breakfast.

## The Short Version

PennyOS has two pieces:

1. The Penny app: the desktop window, local server sidecar, UI, memory files, tools, settings, and personality scaffolding.
2. A local model runtime: LM Studio, llama.cpp, or another OpenAI-compatible server that actually runs the model.

The Windows desktop package includes the first piece. It does not bundle LM Studio, llama.cpp, model weights, embedding models, or a model manager. That is intentional for this release slice. Penny should not silently download models, load models, unload models, or mess with a live runtime you already have open.

If you only remember one sentence:

> Start LM Studio or llama.cpp, load a chat model, start its local API server, then open PennyOS Settings -> First-run local brain setup and pick the model Penny can see.

## Quick Start Checklist

1. Install PennyOS.
2. Install LM Studio, or set up llama.cpp if you are comfortable with command-line local inference.
3. Download a chat/instruct model.
4. Load the model in the local runtime.
5. Start the runtime's OpenAI-compatible local server.
6. Open PennyOS.
7. Go to Settings -> First-run local brain setup.
8. Press Refresh.
9. Pick a Chat model and Tool model.
10. Save model setup.

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
- Rust, Cargo, Node, npm, or a repo checkout for the end user.

Build machines still need build tools. End users should not need developer tools just to launch the installed app.

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
- Whether Penny may fall back to another compatible loaded model.

That saves a local preference so you do not have to edit `.env` just because LM Studio or llama.cpp reports a slightly different model id.

### Voice

The old browser read-aloud path used Windows/browser system voices. If it sounded like a dusty robot in a hallway, that is because it was not Penny's real voice.

PennyOS now has a runtime voice path for a separately running Speaches server:

- Open Settings.
- Set the Speaches URL, model, and voice.
- Click Refresh voice.
- Enable the voice toggle once Penny reports that Speaches is reachable and the configured model is ready.

When enabled, Penny speaks completed assistant replies after the normal chat response finishes. Stop and Replay controls live beside the voice setup.

PennyOS still does not bundle Speaches, llama.cpp, TTS model weights, or voice downloads. If Speaches is not running, the toggle stays disabled and Penny chats silently.

Source/dev sidecar harnesses for search, docs/RAG, and audio experiments may exist in the repository, but they are not exposed in the consumer Settings UI and are not part of the downloadable app runtime. Runtime voice uses `/api/penny/voice/*`, not the review sidecar routes.

## FAQ

### Does PennyOS work without LM Studio or llama.cpp?

The app can open, but model-backed chat needs a local OpenAI-compatible endpoint. Without that endpoint, Penny can only report readiness/fallback state.

### Does PennyOS download or load models for me?

No. Not in this slice. Penny preserves your live LM Studio/llama.cpp state by default. That means she should not unload, reload, or swap models behind your back.

### Is LM Studio plug-and-play once installed?

Almost. Install LM Studio, download a model, load the model, start the local server, then refresh Penny's Settings. The missing step is usually "start the server" or "load the model."

### Why does Penny mention embeddings?

Embeddings help semantic memory retrieval. They are useful, but they are not required for basic chat. If the embedding model is missing, Penny should say so and use keyword fallback.

### What is the best model?

There is no permanent answer. Use a strong instruction/chat model that fits your hardware. If you want Penny to feel vivid, avoid tiny or generic models. If you want speed, use a smaller model or a separate Tool lane. If you want image reactions, load a vision-capable model and make sure your server supports image input.

### What is the worst model?

For Penny specifically: embedding-only models as chat, base models with no chat tuning, and models that flatten all personality. Technically running is not the same as feeling good.

### Will the desktop app cross wires with my older Penny?

Packaged Penny writes to app-data paths. Older source/dev Penny usually writes to checkout-local ignored data paths. The biggest risk is running both on the same port. Use one at a time unless you intentionally changed ports.

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

### The sprite flickers while typing

That should not happen. The desktop UI now pauses the sprite idle animation while the composer is focused and keeps expression changes tied to real mood/state transitions.

## Source Notes

This guide was refreshed against:

- LM Studio docs for app capabilities, downloads, local server, and OpenAI-compatible endpoints.
- llama-cpp-python docs for an OpenAI-compatible llama.cpp server path.
- PennyOS repo docs and runtime behavior as of 2026-06-10.
