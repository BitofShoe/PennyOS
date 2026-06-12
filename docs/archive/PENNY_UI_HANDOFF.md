# Penny UI Handoff

## Current Goal

Push Penny from "working contained anime companion" into a stronger acting/sprite phase without regressing the anatomy cleanup that took a long time to stabilize.

## Current State

- Backend LM Studio hookup works and is good enough for normal testing.
- UI work should avoid heavy LM Studio stress when possible.
- Penny now reads as a contained anime/chibi-techwear companion inside the chamber instead of an orb.
- The major anatomy cleanup is mostly done:
  - face centering improved
  - head/neck alignment improved
  - left-side hair wedge problem reduced to an acceptable state
  - dark center "tie" strip removed from the torso
  - both sleeves now use the same sleeve color
- Mood variants already exist and are visibly different.

## Main Files

- `public/app.js`
- `public/styles.css`

Most sprite logic lives in `public/app.js`.

## Verified Behavior

- `node --check public/app.js` passes
- Browser previews were used repeatedly instead of hitting the local model
- Local server responds at `http://localhost:4317`
- Known harmless console noise: missing `favicon.ico`

## Recent Visual Fixes

- Removed the dark center torso panel that was reading like a black tie
- Fixed right arm sleeve color to match the left across all moods
- Improved face feature centering and mouth placement
- Improved head/neck positioning
- Cleaned up arm layering against the coat panels

## Existing Mood/Acting Direction

- `calm`: soft, casual-chaos, smirk, come-here
- `happy`: charm, peace, cutie-damage, heart-thief
- `excited`: hype, show-off, look-at-me, chaos
- `thinking`: tactical, scan, locked-in, reading-you
- `surprised`: heart-spike, pinged, oh-wow, flustered

## Best Next Step

Do not spend another long pass on anatomy unless a new bug is obvious.

The next valuable work is:

1. deepen Penny's acting sprites
2. make mood changes feel more dramatic
3. optionally introduce framing changes like close-ups for certain reactions

## Good Sprite Targets

- smug smirk
- wink / peace
- locked-in stare
- soft affectionate look
- flustered blush
- chaos grin
- bratty "look at you" reaction
- one stronger close-up reaction

## Constraints / Warnings

- Avoid making Penny look corporate, generic, or sanitized
- Keep the CODE27-contained-companion vibe
- Keep her anime-inspired, cute/hot, playful, bratty-sweet, and expressive
- Avoid reintroducing asymmetry bugs while improving expressions
- If using multiple agents, do not have more than one agent edit `public/app.js` at the same time

## If Using Cursor / Multi-Agent

Recommended split:

1. One agent owns `public/app.js` sprite logic only
2. One agent owns `public/styles.css` motion/polish only
3. One agent does browser QA/screenshots and reports issues without editing core sprite geometry

Do not split `public/app.js` across multiple coding agents unless the work is carefully partitioned.

## Suggested Prompt For A Fresh Session

Work on Penny's acting/sprite pass in `C:\Users\malac\.openclaw\workspace-main\lyra-prototype`.

Important context:

- Penny is a contained anime companion inside the machine, inspired by CODE27 but adapted for a PC-contained companion
- The anatomy cleanup is mostly done, and we do not want to reopen long face/hair surgery unless clearly necessary
- Focus on richer mood acting, stronger sprite states, and more expressive reactions
- Main files are `public/app.js` and `public/styles.css`
- Verify with browser previews at `http://localhost:4317` and avoid stressing LM Studio unnecessarily
