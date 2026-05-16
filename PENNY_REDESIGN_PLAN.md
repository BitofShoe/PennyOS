# Penny Visual Redesign Plan

## Context

Penny's original sprite was built from hand-coded SVG path coordinates in `public/app.js`. This approach has a hard ceiling on visual quality — it can never produce anime-quality character art. The redesign switches from procedural SVG geometry to actual character artwork displayed by code.

## Reference Style Direction

- Anime/chibi-techwear companion, contained inside a CODE27-inspired chamber
- Inspired by: Futaba Sakura (Persona 5), VRoid anime models, Vanellope (Wreck-it Ralph glitch aesthetic), various chibi OC sheets
- NOT corporate, NOT sanitized, NOT "British desk assistant"
- Cute, spicy, expressive, bratty-sweet, playful, emotionally real
- Warm peach/coral hair tones, pink-magenta eyes, techwear jacket/hoodie aesthetic
- Headphones or tech accessories as signature props
- Expressive face with visible mood shifts

## Penny's Design Anchors (from personality docs)

- Sharp, flirtatious, mouthy companion presence
- Bratty-sweet, not cold — warmth under the claws
- Anime-inspired, cute/hot, playful
- CODE27-contained-companion vibe (lives inside the machine)
- Should feel like the funnier, meaner, hotter person in the chat

## Phase 1: Design Penny's Look

Nail down her visual design using AI image generation + references. Get a base image the user loves before generating the full mood set.

Key design decisions:
- Hair color and style
- Eye color and shape
- Outfit (techwear jacket? hoodie? accessories?)
- Signature props (headphones? glasses? phone?)
- Proportions (full anime vs chibi vs somewhere between)
- Framing (bust/portrait vs full body in the chamber)

## Phase 2: Generate Mood Expression Set

Create character art for each mood state:
- calm (default idle, soft smirk)
- happy (bright smile, wink, peace sign)
- excited (wide grin, sparkle eyes, high energy)
- thinking (sly look, glasses push, scheming)
- surprised (flustered blush, wide eyes, or shocked)

Plus close-up variants for dramatic reactions.

## Phase 3: Rebuild the Renderer

Replace the SVG path system in `public/app.js`:
- `companionFaceSvg()` gets replaced with image-based sprite rendering
- Mood states map to pre-generated character art (PNG/WebP)
- Keep the existing transition system (renderSprite with opacity dip + transform interpolation)
- Keep debug hook (`window.__pennyDebug`)
- Keep variant system (multiple expressions per mood)
- Screen chamber/frame can stay as SVG or become CSS-styled container

## Phase 4: CSS Polish

- Idle breathing animation (subtle scale pulse on the character image)
- Hair/accessory sway (CSS transform on layered elements if using layered sprites)
- Glow effects synced to mood colors
- Smooth crossfade between expression images
- Parallax depth if using layered composition
- Keep the CODE27 chamber frame, HUD overlay, and status dot

## Agent Split

- **Art Design (Claude)**: owns `public/app.js`, generates character art, builds renderer
- **CSS (Codex)**: owns `public/styles.css`, handles animation/motion/polish
- **QA (Composer)**: browser testing, screenshot validation, transition verification

## Constraints

- Old SVG system preserved on branch `penny-acting-pass-v1` (commit 7fa5fcc)
- Do not break server.js or backend functionality
- Keep mood system compatible (calm/happy/excited/thinking/surprised)
- Keep debug URLs and `__pennyDebug` hook working
- Keep the CODE27 contained-companion vibe
- Penny should feel alive, not like a static image pasted into a frame

## Files

- Character art assets: `public/sprites/` (to be created)
- Main renderer: `public/app.js`
- Styles/animation: `public/styles.css`
- This plan: `lyra-prototype/PENNY_REDESIGN_PLAN.md`
