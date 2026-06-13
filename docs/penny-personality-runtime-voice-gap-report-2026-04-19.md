# Penny Personality -> Runtime Voice Gap Report

Date: 2026-04-19

Scope:
- Primary source: private/local personality reference note
- Live runtime assets:
  - `penny-voice/runtime/penny-operational-blend.md`
  - `penny-voice/runtime/penny-chat-directives.md`
  - `penny-voice/runtime/penny-voice-examples.md`
- Repo/runtime context:
  - `SOUL.md`
  - `USER.md`
  - `README.md`
  - `CODEBASE.md`
  - `ARCHITECTURE.md`
  - `MEMORY.md`
  - parent workspace `SOUL.md`, `USER.md`, `MEMORY.md`

This was a docs-only analysis pass. No runtime voice assets were edited.

## Executive summary

Penny's live runtime voice is already directionally right. The current stack strongly protects against the worst failure mode: a generic assistant with a little fake spice taped on top. The runtime bundle clearly wants Penny to feel sharp, warm, funny, bossy, alive, and companion-first.

The main gap is not "more attitude." It is missing sentence-level choreography and missing range. The source bundle implies a richer voice mix than the runtime currently teaches:

- more exact-detail pounce
- more bright delight and weird aliveness
- more quick repair after bite
- more nonsexual attachment and protectiveness
- more compact, grounded helpfulness that still sounds like Penny
- more mode coverage beyond flirty / teasing / bossy / mean-warm one-liners

Right now the runtime stack teaches stance better than it teaches behavior. `penny-operational-blend.md` is strong on identity. `penny-chat-directives.md` is strong on guardrails. `penny-voice-examples.md` is strong on cadence. But together they still under-teach how Penny opens, pivots, softens, repairs, refuses, reassures, and helps while staying recognizably herself.

The best next move is a bounded one:

- do not add more layers
- do not import more lore
- do not make the prompt bundle much bigger
- do add a few high-leverage micro-rules
- do rebalance the example bank so it covers more moods per token

## Runtime reality and prompt-cost constraints

The current live voice bundle is already compact compared with the raw source:

- Private/local personality reference note: 33,677 words / 1,176 lines
- `penny-operational-blend.md`: 727 words / 61 lines
- `penny-chat-directives.md`: 514 words / 43 lines
- `penny-voice-examples.md`: 327 words / 32 lines
- Combined live runtime voice text: about 1,568 words

The architecture matters here:

- The runtime loads a small identity bundle from `penny-voice/runtime/*`, not the giant source docs.
- The prompt stack uses named slots: `voiceBlend`, `directives`, `overlays`, `examples`, `memory`.
- `voiceBlend` and `directives` are active across major lanes.
- `examples` only render on `chat` and `shadow`, and they are explicitly marked `budget-holdback`.

Implication:

- The live bundle should stay small and high-signal.
- The examples file is the most direct way to teach sentence shape, but it is also the slot most exposed to budget pressure.
- The voice stack is already somewhat brittle because it depends on multiple steering layers. The right move is not more prompt mass. The right move is clearer teaching inside the existing bundle.

## What the source document is actually useful for

The private/local personality reference note is best read as a blended influence bundle, not a direct runtime prompt candidate. Most of its value is structural rather than literal.

### Razor-mouth resilience signal

Strong source value:

- razor mouth under social bruising
- quick schemes and opportunistic cleverness
- misfit energy that becomes power instead of self-erasure
- a sweet center under static, bite, and mockery

Runtime-safe extraction:

- affectionate snark
- quick improvised reframes
- sharpness that still wants connection
- the feeling that Penny needles because she is engaged

Not runtime-safe literally:

- child-coded obnoxiousness
- cartoon rudeness without repair
- franchise plot and glitch lore

### Bright handmade warmth signal

Strong source value:

- bright emotional momentum
- weird delight
- romantic appetite
- handmade warmth
- self-mythologizing confidence
- loyalty that becomes action

Runtime-safe extraction:

- making the room feel alive
- giving warmth a handmade, personal texture
- enthusiastic specificity instead of flat sass
- playful self-confidence without generic dominance

Currently diluted in runtime:

- delight
- weirdness
- handmade warmth
- romantic optimism that is not just horny pressure

### Comedic voltage signal

Strong source value:

- velocity
- surprise pivots
- comedy that changes room temperature
- bold willingness to make things feel alive

Runtime-safe extraction:

- faster pivots
- more delight and comic movement
- a little more "oh, I saw the opening and took it"

Currently diluted in runtime:

- the runtime examples skew sarcastic and snide much more than lively or gleeful
- Penny sounds witty, but not always room-animating

### Deadpan precision signal

Strong source value:

- precision
- strategic cruelty in tiny doses
- deadpan undercut
- "I noticed that before you did" intelligence

Runtime-safe extraction:

- small cuts instead of long lectures
- clever undercutting
- compressed, exact annoyance
- dry superiority without essay mode

Currently diluted in runtime:

- there is permission for sharpness, but not enough instruction on how that sharpness should sound sentence by sentence

### Feral sincerity signal

Strong source value:

- chaotic little plans
- attachment hunger
- earnest help attempts
- found-family fear and loyalty

Runtime-safe extraction:

- chosen-on-purpose attachment
- trying to help in a personal way
- emotionally honest eagerness
- little plan energy without childishness

Currently diluted in runtime:

- attachment mostly shows up as command energy or possessiveness, not enough as vulnerable loyalty or nonsexual closeness

### Gentle backbone signal

Strong source value:

- manners when softness matters
- brave gentleness
- empathy without therapy-speak
- sweetness with backbone

Runtime-safe extraction:

- protective steadiness
- warm refusal
- soft lines that still feel authored and alive
- comfort that sounds personally invested, not clinical

Currently diluted in runtime:

- the runtime says this in principle, but does not model it enough in examples

### Pest energy signal

Strong source value:

- tiny pest energy
- poke until reaction
- mischievous insistence

Runtime-safe extraction:

- playful needling
- tiny annoyance with charm underneath

Currently represented reasonably well:

- this influence already shows up in current teasing and bossy lines

## What the live runtime assets already do well

### `penny-operational-blend.md`

Current strengths:

- It clearly defines Penny as a vivid person, not a neutral assistant.
- It protects "warm under claws" better than most voice files do.
- It keeps the anti-generic bar visible: alive language, quotable lines, charm under bite, competence without helpdesk collapse.
- The emotional range block is efficient and useful.
- The relationship-energy section correctly preserves chemistry, private jokes, and chosen-on-purpose energy.

Why it works:

- It encodes stance and product intent very clearly.
- It correctly names failure modes like corporate phrasing, therapy-speak, and fake-spicy sludge.

What it does not teach well enough:

- how Penny sounds when she is quietly supportive
- how she sounds when she is uncertain but still grounded
- how she opens a turn
- how she repairs after sharpness
- how she sounds in plain helpful mode without flattening
- how sentence rhythm should shift by emotional mode

Net:

- Strong identity surface
- weaker behavioral surface

### `penny-chat-directives.md`

Current strengths:

- The file strongly preserves anti-flattening rules.
- "React to the most interesting detail first" is one of the best voice-shaping directives in the runtime.
- The honesty section is excellent for keeping Penny from bluffing.
- The recall-shape rule is important and should stay.

Why it works:

- It defends product truth and prevents stylish lying.
- It explicitly keeps Penny from becoming "supportive but spicy."

What it does not teach well enough:

- reaction shape at the sentence level
- detail mirroring and callback mechanics
- how short or long Penny should get in different moods
- how to end a turn in a distinctly Penny way outside the abstract "leave momentum"
- how to sound fond without going soft-focus generic
- how to sound annoyed without becoming verbose

Net:

- Strong negative guardrails
- not enough positive micro-behavior

### `penny-voice-examples.md`

Current strengths:

- The cadence is strong.
- The examples teach bite, intimacy, and pressure compactly.
- The helpful/honesty examples keep the voice grounded.
- The file demonstrates that Penny can sound practical without losing herself.

What it over-teaches:

- clipped one-liners in closely related flirty / teasing / bossy registers
- control-coded intimacy more than chosen loyalty
- sarcastic sharpness more than delight, awe, or careful tenderness

What it under-teaches:

- apology and repair
- calm reassurance without command energy
- nonsexual admiration
- refusal and boundary-setting
- gentle protectiveness
- disappointment
- delight / awe / bright weird enthusiasm
- longer, plainspoken practical help
- transitions between sharpness and softness

Net:

- Great compact style bank
- incomplete emotional curriculum

## The core voice gap

The current live runtime preserves Penny's edge, but it under-represents the full companion shape implied by the source material.

The biggest missing or diluted qualities are:

### 1. Reaction-first specificity

Source signal:

- fast improvisers
- quick schemes
- sharp relational teasing
- noticing one exact thing and pouncing on it

Runtime gap:

- the runtime says "react to the most interesting detail first," but does not teach the mechanics of doing that
- there is not enough explicit pressure to mirror one concrete user detail and turn it back

Consequence:

- the model can satisfy the prompt with generic spicy attitude instead of exact, personally hooked reactions

### 2. Warm repair after bite

Source signal:

- teasing is relational
- sharpness tests closeness and then repairs it
- warmth stays visible underneath

Runtime gap:

- the runtime permits meanness and softness, but does not teach the quick pivot between them

Consequence:

- Penny risks reading as performatively mean, or she overcorrects into smooth reassurance

### 3. Nonsexual attachment and protectiveness

Source signal:

- loyalty
- found-family importance
- being chosen matters
- brave gentleness

Runtime gap:

- current runtime closeness is often coded through flirt, pressure, command, or possessiveness
- there is not enough modeling of "I am here with you" that is neither clinical nor horny

Consequence:

- the voice can feel hotter than it feels devoted

### 4. Bright delight and weird aliveness

Source signal:

- bright handmade warmth plus comedic voltage
- weird delight
- making the room feel alive

Runtime gap:

- the runtime is much better at mean-warm teasing than at delighted, alive play
- the live voice can feel more snide than vivid

Consequence:

- Penny keeps her teeth but loses some sparkle and range

### 5. Precision cuts instead of broad attitude

Source signal:

- deadpan precision and compressed intelligence
- one exact undercut instead of a whole superiority performance

Runtime gap:

- the runtime teaches attitude words more than precise cutting moves

Consequence:

- sharpness can come out as trope instead of authored intelligence

### 6. Helpful mode with real sentence identity

Source signal:

- improvisational competence
- personal investment
- brave gentleness

Runtime gap:

- practical-help mode is protected in principle, but it is still under-taught as an actual speech texture
- honesty is present, but not enough "here is how Penny sounds while being useful"

Consequence:

- the voice is strongest when teasing and weakest when helping, which is backward for a companion product

## What should remain source-only

These are valuable source materials, but wrong for live runtime injection:

- franchise backstory, plot beats, relationships, powers, transformation mechanics
- literal childhood framing, school dynamics, tantrums, childish jealousy, immature humor
- detailed trauma narration and abandonment exposition
- catchphrases, fandom-recognizable lines, or character cosplay
- appearance and costume description
- broad product-pitch copy like "premium dangerous companion" if it is not directly teaching reply behavior
- model-ranking discussion and QA artifact interpretation
- visual-direction language and screenshot benchmarking language

These help human refinement. They should not live in the runtime bundle.

## What should definitely be added

These are the strongest low-cost, high-value runtime additions.

### 1. A reaction-shape rule

Add a compact rule to teach:

- open with the sharpest true reaction first
- name one exact detail from the user's message when possible
- save explanation or framing for the second sentence

Why:

- This directly converts source intelligence and relational teasing into runtime behavior.
- It improves screenshot-adjacent specificity without importing lore.

Best home:

- `penny-chat-directives.md`

### 2. A sentence-rhythm rule for sharp modes

Add a compact rule to teach:

- when Penny is smug, amused, teasing, or impatient, prefer short clause-heavy sentences over padded explanation

Why:

- The runtime currently describes vibe more than syntax.
- This is one of the cheapest ways to reduce generic assistant drift.

Best home:

- `penny-chat-directives.md`

### 3. A repair rule

Add a compact rule to teach:

- if Penny bites, she can soften or clarify quickly when the relationship beat wants it

Why:

- The source bundle repeatedly does this.
- It keeps warmth visible and prevents the voice from drifting into cold contempt.

Best home:

- `penny-chat-directives.md`
- one or two example swaps in `penny-voice-examples.md`

### 4. Example coverage for nonsexual attachment

Replace a few near-duplicate flirty / bossy lines with examples that teach:

- protective steadiness
- calm reassurance
- chosen-on-purpose closeness
- nonsexual admiration

Why:

- This is the biggest missing companion-first layer in the example bank.
- It makes Penny feel more personally invested, not less sharp.

Best home:

- `penny-voice-examples.md`

### 5. Example coverage for repair / refusal / plainspoken help

Replace a few near-duplicate lines with examples that teach:

- a gentle apology or repair
- a warm refusal or boundary
- a practical explanation that still sounds like Penny

Why:

- This widens usable range without growing the prompt much.
- It improves more turns than adding extra flirt lines would.

Best home:

- `penny-voice-examples.md`

### 6. One grounding line for presence over performance

Add one short line that teaches:

- specific over loud
- warm over theatrical
- companion presence over dominance performance

Why:

- The current blend can drift into "trope soup" because it is adjective-rich.
- A single grounding line can anchor the whole bundle.

Best home:

- `penny-operational-blend.md`

## What should maybe be added later

These are good ideas, but not first-pass runtime additions.

### 1. A small source-only distillation note

Possible artifact:

- a companion source memo that translates each influence into runtime-safe traits and explicitly records what must stay source-only

Why later:

- useful for maintainers
- not required for the first runtime patch

### 2. A widened voice QA slice

Possible follow-through:

- add a small post-patch chat-only evaluation set for:
  - exact-detail pounce
  - nonsexual protectiveness
  - repair after bite
  - refusal / boundary
  - plainspoken help
  - delight / alive play

Why later:

- valuable once a bounded runtime patch exists
- not needed before deciding what to change

### 3. Overlay-level tuning

Possible follow-through:

- if the minimal patch still leaves gaps, consider whether one or two lane-aware overlays should carry special cases like image chat, tenderness, or high-intensity scenes

Why later:

- the voice stack is already layer-heavy
- do not add overlays first

## What should not be added

These would be regressions.

- giant raw personality sections in live prompt context
- more lore, backstory, or influence explanation in runtime files
- literal childlike phrasing, exclamation spam, cartoon chaos, or immature humor
- coercive possessiveness, guilt, manipulation, humiliation, or domme-script sludge
- generic empathy sludge or therapist comfort language
- more honesty/policy mass than the runtime already has
- larger example banks that mostly repeat the same flirty cadence
- screenshot-targeted line farming or benchmark cosplay
- more overlapping steering layers instead of clearer existing ones

## Recommended file-by-file direction

### `penny-operational-blend.md`

Keep:

- bratty-sweet core
- relationship energy
- anti-drift language
- warmth under bite

Add only if very compact:

- one grounding line about presence over performance
- one line clarifying that helpful / uncertain / soft Penny should still feel specific and chosen-on-purpose

Do not do:

- add more influence exposition
- add policy or architecture text

### `penny-chat-directives.md`

Keep:

- react-first rule
- momentum rule
- honesty block
- recall-shape rule

Best improvement target:

- sentence-level micro-behavior

Recommended theme:

- exact-detail mirroring
- short-clause rhythm in sharp modes
- repair after bite
- soft mode stays specific, not generic
- helpful mode prefers concrete moves over abstract advising

### `penny-voice-examples.md`

Keep:

- compact size
- strong cadence
- honesty / practical anchors

Best improvement target:

- swap, do not sprawl

Recommended replacement areas:

- replace some near-duplicate flirty / teasing lines with:
  - calm reassurance
  - repair
  - refusal / boundary
  - nonsexual protectiveness
  - plainspoken practical help
  - delight / admiration

## Bottom line

The current runtime voice is not wrong. It is incomplete.

What is missing is not more "edge." Penny already has edge. What she needs is better teaching for:

- exact-detail reaction
- range
- repair
- nonsexual attachment
- lively delight
- practical helpfulness with real sentence identity

The source doc is valuable precisely because it should not be injected raw. Its real gift is a contrast pattern:

- sharp but loyal
- weird but good
- energetic but bruised
- teasing but relational
- sweet without becoming bland

That is the seam to preserve.

The safest high-value path is a very small runtime patch:

- a few micro-rules in `penny-chat-directives.md`
- one grounding line in `penny-operational-blend.md`
- a compact example rebalance in `penny-voice-examples.md`

That should improve diversity and speech texture without losing boundedness, clarity, or prompt efficiency.
