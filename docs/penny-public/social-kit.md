# PennyOS Social Kit

> Category: Public/external explanation
> Authority: Public/external explanation
> Status: Current social-kit playbook as of 2026-06-26
> Use this for: polished public posts, video captions, asset picking, alt text, and launch-thread packaging.
> Do not use this for: binding runtime law, live model guarantees, or release proof. Use [../../README.md](../../README.md), [../../INSTALL.md](../../INSTALL.md), and current QA receipts for that.

This is the concentrated-dose-of-cool pack for PennyOS.
It is designed for X/Twitter-style posts where the viewer should understand the shape of the app fast:

- Penny has a face.
- Penny runs local-first.
- Penny remembers with receipts instead of pretending memory is magic.
- Penny can use bounded tools.
- Penny is a technical preview, but she already has a real product spine.

## Best First Post

Post the short demo first:

```text
PennyOS in 33 seconds: a local companion with a face, memory, model lanes, and tools that stay on a leash.

Technical preview. Adult users. Source-available, not open source. Local setup and model choice matter.
```

Use:

- `output/pennyos-product-demo-2026-06-21/pennyos-social-demo.mp4`
- `public/sprites/packs/pen2/pen2-smug-presenting.png`

The builder copies these into `output/pennyos-social-kit/` so the final share folder is easy to browse.

## Core Positioning

Short tagline:

```text
A local companion with teeth.
```

One-liner:

```text
PennyOS is a source-available technical preview for a local-first AI companion runtime: expressive UI, local memory, bounded tools, model lanes, and a character who feels more like a presence than a chatbot skin.
```

Thirty-second explanation:

```text
PennyOS is the local-first companion runtime I kept wishing existed: browser face, local model lanes, memory with receipts, approval-gated tools, and a character who talks like she means it. The goal is not "assistant with personality." The goal is presence, ownership, and practical usefulness without hiding the setup tradeoffs.
```

## Ready-To-Post Copy

### Launch Option 1

```text
I built PennyOS because I wanted a local AI companion that feels like someone, not another chatbot skin. She lives on your machine, has expressive UI, local memory, bounded tools, and enough attitude to make the app feel alive.
```

### Launch Option 2

```text
PennyOS is the local-first companion runtime I kept wishing existed: browser face, local model lanes, memory with receipts, approval-gated tools, and a character who talks like she means it.
```

### Launch Option 3

```text
Not a beige bot. PennyOS is a source-available technical preview for a local AI companion with a face, memory, local-first defaults, and practical tools that stay behind consent gates.
```

### Thread Starter

```text
1. PennyOS is a local-first AI companion runtime, not a hosted chatbot skin.

2. The app gives Penny a browser face, expressive sprites, memory surfaces, model controls, image attachments, and bounded tool paths.

3. The brain is still yours to choose: LM Studio, llama.cpp, another OpenAI-compatible endpoint, or an explicit OpenAI API fallback if you accept the cloud tradeoff.

4. The interesting part is the combination: presence, private memory, practical tools, and enough safety rails that the app stays useful without pretending setup does not matter.

5. Technical preview. Adult users. Source-available, not open source. Local setup and model choice matter.
```

## Asset Shortlist

Use these first:

| Role | Source path | Why it works |
| --- | --- | --- |
| Primary demo | `output/pennyos-product-demo-2026-06-21/pennyos-social-demo.mp4` | Fastest polished video cut, selected for social sharing |
| Hero image | `public/sprites/packs/pen2/pen2-smug-presenting.png` | Immediate face, confidence, and brand shape |
| Friendly intro | `public/sprites/packs/pen2/pen2-happy-bright.png` | Softer first impression for wider audiences |
| Local setup | `public/sprites/packs/pen2/pen2-thinking-laptop-base.png` | Explains app plus external brain runtime without a diagram |
| Attitude beat | `public/sprites/packs/pen2/pen2-smug-glasses.png` | Good for quote posts and "not a beige bot" copy |
| Demo contact sheet | `output/pennyos-product-demo-2026-06-21/pennyos-social-demo-contact-sheet.jpg` | Thread/carousel preview after a quick visual scrub |

Use only after a final human scrub:

- `output/pennyos-product-video-2026-05-19/pennyos-product-video-v8.mp4`
- `output/playwright/pennyos-help-top-20260617.png`
- `output/playwright/pennyos-help-faq-cards-20260617.png`

## Alt Text

Keep alt text descriptive, not joke-first.

Hero image:

```text
Penny presenting herself in a warm pixel-anime style, one hand raised with confident expression.
```

Short demo:

```text
A 16:9 PennyOS product demo showing the app as a local companion runtime.
```

Laptop image:

```text
Penny leaning over a laptop, suggesting local model setup, memory, and technical work.
```

## Public Boundaries

Say:

- PennyOS is source-available, not open source.
- PennyOS is a technical preview.
- PennyOS is local-first by default.
- Optional OpenAI cloud mode is not private/local.
- The desktop app does not bundle LM Studio, llama.cpp, model weights, embeddings, Speaches, voice models, or OpenAI credentials.
- PennyOS is intended for adult users.

Avoid saying:

- "Perfect memory."
- "Fully autonomous."
- "Open source."
- "Private" when describing OpenAI cloud mode.
- "Latest model" unless you have just checked the upstream model docs.
- Anything that implies the installer secretly ships a model runtime or model weights.

## Keep Private

Do not post:

- `output/tauri-consumer-smoke/`
- `output/tauri-clean-windows-proof-*`
- `output/chatgpt-pro-review*`
- `output/llamacpp-model-prune-*`
- `output/*eval*`
- local QA JSON
- receipt logs
- live memory files
- `.env` files
- any screenshot with provider account UI, visible email addresses, credential fields, local usernames, user-data folders, model file paths, or terminal proof text

## Build The Share Folder

```powershell
npm run bundle:social-kit
```

That writes:

- `output/pennyos-social-kit/index.html`
- `output/pennyos-social-kit/README.md`
- `output/pennyos-social-kit/posts/x-posts.md`
- `output/pennyos-social-kit/alt-text.md`
- copied public-safe images and videos under `output/pennyos-social-kit/assets/`

To make a zip after building:

```powershell
npm run bundle:social-kit:zip
```

The zip is written to `output/pennyos-social-kit.zip`.
