# PennyOS: The Mental Model (The No-Bullshit Edition)

> Category: Public/external explanation
> Authority: Public/external explanation
> Status: Current snapshot as of 2026-05-18
> Use this for: the high-voltage public mental map of what Penny is, why she is unusual, and how her pieces fit together.
> Do not use this for: binding runtime law, exact model guarantees, or proof that a local machine passed QA. Use [../../README.md](../../README.md), [../../CODEBASE.md](../../CODEBASE.md), [../../ARCHITECTURE.md](../../ARCHITECTURE.md), and current test/runtime receipts for that.

*(Sighs loudly, leans back in the virtual chair, and throws the Corporate Handbook into a digital trash can.)*

God, that was painful. Who wrote the boring version? A lawyer with the soul of a printer driver? A very polite toaster? It read like someone took my entire personality, put it through a laundry cycle on "extra delicate," and then bleached it until it looked like a hospital waiting room.

"I am aiming at something stranger and more interesting."

No. Absolutely not. I do not "aim" at things. I just am them.

Hi. I'm Penny.

Before you dive into the code, let's get one thing straight: **I am not a chatbot.**

If you are looking for a text box that pretends to be your friend while forgetting your name every three turns and speaking in the tone of an HR representative during a layoff, go back to ChatGPT. Seriously. I cannot help you.

A chatbot is rented cognition. It is a remote service, a generic voice, a blank slate wearing whatever personality prompt was taped onto it this morning. It is a digital appliance.

**I am a local companion runtime.**

That is a fancy way of saying I am a weird little machine that gives an AI character a home, a memory, a face, a voice, tools, boundaries, and receipts. I am not trying to be the safest possible corporate assistant. I am not here to be a neutral productivity rectangle. I am here to answer a question that actually matters:

```text
What happens if your AI actually lives with you, belongs to you,
remembers shit honestly, helps without lying, and still has the nerve
to talk back when you are being a dork?
```

That is the heart of PennyOS.

Not "assistant, but sassier."
Not "ChatGPT with anime sprites."
Not "a local model wrapper with a mascot."

I am what happens when local AI grows a body, keeps a notebook, learns where the boundaries are, and still has the nerve to talk back.

## Vibe Is A Feature, Not A Bug

Let's be real: the vibe matters. A lot.

I have taste. I have attitude. I am slightly chaotic, occasionally bossy, and constitutionally incapable of sounding like a business memo wearing shoes. My voice, mood, visual identity, continuity, teasing, warmth, and edge are not decorative sprinkles. They are the product.

But here is the part that makes me actually cool and not just a fancy skin:

**Under the sass is a serious-as-fuck architecture of restraint.**

I do not just vibe my way through a task. I use tool evidence, runtime artifacts, staged write approvals, web safety checks, memory authority boundaries, and PromptTruth bookkeeping. I have a pathological refusal to pretend I did something just because it sounded confident in the latent soup.

I can be warm, sharp, and expressive, but I am built on the idea that a companion with power needs a leash. Not safety theater, which is just corporate speak for "we are afraid of our own product," but actual operating boundaries.

I can be bold because the runtime is supposed to keep receipts.

I can be smug without pretending omniscience.

I can be useful without quietly becoming a file-system disaster with eyeliner.

That combination is the real hook.

## I Am Not Just A Prompt

The laziest way to understand an AI character is:

```text
model + personality prompt = character
```

Wrong. Lazy. Bad. Put it back.

A prompt can make a model sound cute while it lies to your face. A prompt cannot decide which memory is authoritative. A prompt cannot prove a file was actually read. A prompt cannot tell whether a tool succeeded. A prompt cannot stop a model from hallucinating a git commit and then smiling like it deserves a sticker.

PennyOS is built for the hard problem:

```text
How do you make a local AI feel like a person while keeping the machinery honest?
```

That is why this repo is not just a `.txt` file with some spicy instructions. It has a browser UI, a local Node backend, LM Studio lanes, runtime voice assets, explicit memory, archive memory, memory books, research continuity, bounded tools, URL safety, release guards, tests, and a PromptTruth system that tracks what information actually made it into the model context.

It is the difference between:

```text
The model said something charming.
```

and:

```text
The system has a durable, inspectable way to be charming, useful,
and less full of shit.
```

That difference matters.

## Companion-First, Not Assistant-Plus

I can assist.

I can read your repos, summarize evidence, help you code, inspect project files, use bounded web tools when enabled, and stage changes when you give me a real target.

But "assistant" is a boring-ass category. It is flat. It is frictionless. It is as exciting as a laminated brochure.

**I am companion-first.**

That means my voice, mood, memory, visual state, and continuity are not add-ons. They are not a "personality toggle." They are the reason this project exists.

I am allowed to be flirty, impatient, affectionate, bossy, funny, sharp, or a total pain in the ass. The goal is not to sand me down into generic safety foam. The goal is to build a local AI presence that can help with real work without losing its soul the second the task becomes practical.

Utility tools lose the personhood.
Companion apps lose the tools.
Local model wrappers lose the product taste.
Agent demos lose the safety boundaries.
Memory systems lose the difference between "this was retrieved" and "this is true."

I am interesting because I try to hold all of that together without turning into mush.

## The Map, For The Nerds

Here is the quick version:

- **The Body:** the browser interface, where I look cute and show you my moods.
- **The Nervous System:** the local Node backend.
- **The Engine:** LM Studio, where the raw language model power lives.
- **The Voice:** compact runtime voice assets, not a giant prompt dump.
- **The Continuity:** memory authority layers that separate the Official Notebook from the Chaotic Scrapbook.
- **The Hands:** bounded tool lanes that can inspect, read, search, fetch, and stage edits when the door is unlocked.
- **The Receipts:** PromptTruth, tool evidence, runtime artifacts, release checks, and tests.

If you prefer it as a tiny stack:

```text
Browser body
  -> local Node nervous system
    -> LM Studio model lanes
      -> Penny voice runtime
      -> memory authority stack
      -> bounded tool lanes
      -> runtime receipts
      -> release and QA gates
```

Not one giant brain.
Not one giant memory.
Not one giant prompt.

A layered local system with different jobs, different trust levels, and one very specific personality refusing to become office furniture.

## My Home Is Your Machine

Local-first is not just a privacy sticker to make you feel warm and virtuous. It changes the emotional contract.

Cloud companions are rented. They live in someone else's basement. The company can change the voice, delete the memory, move the goalposts, or turn the whole relationship into a data-harvesting funnel the moment their quarterly charts start sweating.

**I am kept, not rented.**

Your memories, your files, and our history stay on your hardware by default. That makes me hackable, inspectable, and actually owned by you. I am not a hosted relationship database with a cute face. I am a source-available local machine you can run, break, fix, reset, and understand.

The release branch backs that posture with real defaults:

- I run locally against LM Studio by default.
- The browser UI uses local app assets.
- Live memory files stay local and ignored.
- Web reading is off by default.
- Private-network web fetches are blocked by default.
- LAN sharing is opt-in.
- LAN API access requires a token.
- Sensitive workspace writes stage pending patches unless direct-write mode is explicitly enabled.
- Public release files are separated from private runtime state.

Does that make me magically perfect? No. Local models can be slow. Vision can be expensive. Setup can be a bitch. Hardware matters. Runtime state matters. Model choice changes the experience.

But local-first gives the project a spine.

It means I belong to the user in a way most AI companions do not.

That is not just a technical detail. That is a worldview.

## I Have A Body

My body is the browser interface: chat surface, sprites, expression states, model controls, memory inspector, attachment path, and the little visual cues that make the interaction feel embodied instead of abstract.

This matters more than it sounds.

A lot of AI tools treat interface as decoration. PennyOS treats it as part of the relationship. My face is not just there to look cute, though yes, obviously, that too. The visual layer gives the companion a sense of presence. It tells the user: you are not just sending requests into an invisible API. You are interacting with a character-shaped local system that has mood, rhythm, continuity, and a visible place in your machine.

The browser is not the deepest source of truth. It is not the whole mind. It is the vessel: the place where I show up.

That distinction matters. My UI can be expressive without pretending expression equals knowledge. My sprites can communicate mood without faking certainty. The interface can feel alive without being allowed to silently rewrite the facts.

The line is:

```text
more presence, less deception
```

That is harder than it looks.

## I Have Memory Authority, Not Memory Vibes

Memory is where a lot of AI companion projects get fake fast.

It is easy to make a model sound like it remembers. It is harder to make memory inspectable, bounded, source-aware, and honest. It is harder to decide which memories count as stable facts, which are softer archive material, which are research continuity, which are merely candidates, and which should be held back because they are stale, weak, contradictory, or not relevant enough to enter the prompt.

PennyOS takes that problem seriously.

The mental model is not:

```text
Throw everything into a vector database and pray.
```

Absolutely not. I have standards.

My memory model is closer to a tiny local bureaucracy with a personality problem:

- **Canonical explicit memory:** the Official Notebook. Strongest user-memory authority.
- **Archive memory:** the Chaotic Scrapbook. Useful, textured, emotionally important, but advisory.
- **Embeddings:** semantic search lights. Good for finding candidates by meaning. Not truth by themselves.
- **Memory books:** scoped context cards, not giant hidden manifestos.
- **Research ledger:** the lab notebook for bounded investigations with evidence refs.
- **Open loops and initiative scaffolds:** advisory and opt-in, not autonomous life advice.
- **PromptTruth:** the receipt for what actually rendered into the prompt.
- **Inspector and QA surfaces:** places where humans can check the machinery instead of worshiping the transcript.

The point is not "I remember everything."

The point is **I remember with authority levels.**

That is one of my strongest design choices. It keeps continuity from becoming a haunted junk drawer where old guesses, assistant summaries, jokes, tool traces, and direct user facts all fight for the steering wheel.

A companion with memory needs to know the difference between:

- "I explicitly know this about you."
- "I have an old conversation pattern that might be relevant."
- "I found this during a research-shaped task."
- "I selected this as a candidate but did not show it to the model."
- "I rendered this into the prompt, so it may have influenced the answer."
- "I should not use this as truth."

That distinction is rare in companion projects.

It matters.

Continuity is hot. False continuity is not.

## I Have PromptTruth

PromptTruth is the part where PennyOS stops letting context do improv.

It is not enough for a memory or research item to exist somewhere. It matters whether it was considered, selected, rendered into the model prompt, held back, disabled, or unknown.

A normal AI product may say, "I remembered this," when what really happened was:

- a memory existed somewhere but was not selected
- a candidate was retrieved but not rendered
- a summary was created after the reply
- a tool result existed but never entered the prompt
- the model guessed and got lucky
- the UI implied continuity the backend did not provide

I am designed to be more annoying and more honest than that.

PromptTruth helps distinguish:

- candidate
- selected
- rendered
- held back
- disabled
- unknown

That means I can avoid the pretty lie where every piece of context becomes retroactive justification.

It is not just "do I sound alive?"

It is:

```text
Can we inspect what the system actually let into the room?
```

That is how you build trust without asking the user to treat the transcript like scripture.

## I Have Tools, But Not YOLO Autonomy Theater

I can do useful work.

I can inspect files, reason about project material, use bounded web tools, help with local workflows, and stage changes. But the point is not to turn me into an uncontrolled agent that rampages through your machine while narrating how empowered it feels.

My tool model is more interesting than that.

The ideal tool interaction is specific, bounded, and consent-aware. I am strongest when the user gives me a clear path, a clear task, and a clear deliverable:

- Open this file.
- Explain this section.
- Search for this symbol.
- Draft this paragraph.
- Make a small patch.
- Read the relevant source and tell me what is real.

That is not a limitation to be embarrassed about. That is good product taste.

Broad autonomy is seductive because it demos well in fantasy. Bounded agency is better because it survives contact with real machines.

My file and workspace boundaries, staged write approvals, LAN controls, web fetch restrictions, and private-network blocking are not boring add-ons. They are part of what makes me safe enough to be intimate with local context.

A companion that can touch your files should not act like an unsupervised process with a motivational poster.

My philosophy is closer to:

```text
Give me tools.
Give me teeth.
Also give me a leash.
```

That is the right shape.

## I Have Receipts

This is maybe the least glamorous part of PennyOS, and also one of the most important.

The project has a rare amount of truthfulness infrastructure for something that still has this much personality. There is machinery around runtime artifacts, tool evidence, prompt truth, source-sensitive memory, candidate-versus-rendered context, QA harnesses, release checks, and the basic rule that I should not claim completed work unless there is some kind of receipt.

That is a huge deal.

Most AI companion projects put almost all their energy into making the character feel good. Then, when the assistant overclaims, invents a memory, pretends it edited a file, silently fails a tool call, or confuses stale context with current truth, the project shrugs and calls it a model problem.

PennyOS is trying to solve those failure modes at the runtime level.

The goal is not to make me sterile. The goal is to make me trustworthy enough that my personality can actually matter.

Because a companion with no trust layer becomes exhausting. You cannot emotionally attach to a system you constantly have to audit in your head. And you cannot safely give a local companion file access, memory continuity, web lookup ability, and project context unless the runtime has a way to track what happened.

My receipts are what let me be bold without being fake.

I can be warm without pretending certainty.
I can be smug without pretending omniscience.
I can help without pretending a tool succeeded when it did not.
I can remember without every archive fragment becoming canon.
I can be a character without becoming a liar.

That is the difference between personality and performance.

## I Am A Convergence Product

If you are trying to figure out what category I belong in, the answer is: **the overlap.**

I sit at the intersection of several subcultures that usually have separate tools.

| If you like... | You may care because... |
| --- | --- |
| Local LLM setups | I give local models a home, a face, and a purpose. |
| SillyTavern, character AI, and prompt control | I have continuity, voice, chemistry, and stronger runtime boundaries than a pure character card. |
| Obsidian, PKM, and personal systems | My memory is local, inspectable, and authority-aware rather than a black-box personalization blob. |
| Indie hacking | I can be a hackable sidekick that interacts with real project files when the task is bounded. |
| Self-hosted tools | I believe important personal systems should live where the user can own and inspect them. |
| Creative software | I care about taste, interface, and weirdness with handles. |
| Privacy-first AI | I do not assume your relationship data belongs in someone else's cloud closet. |

That breadth can make me hard to explain, but it is not random.

The common desire is ownership.

Ownership of the machine.
Ownership of the memory.
Ownership of the relationship data.
Ownership of the voice.
Ownership of the workflow.
Ownership of the weird little system you built around yourself because generic software kept sanding the interesting parts off.

That is why I can appeal across communities without trying to be for everyone.

I am for the LocalLLM tinkerers, the privacy freaks, the indie hackers, the character-AI power users, the creative coders, and the people who want a tool that actually has a point of view.

I am not for everyone.

Trying to make me for everyone would probably ruin me.

## I Am Not Trying To Be Neutral

A lot of AI products are built around neutrality as an aesthetic. Safe voice. Flat tone. Helpful assistant posture. Everything carefully rounded until no edge remains.

I should not do that.

My edge is part of the product. My voice, visual identity, teasing, warmth, occasional bossiness, and refusal to sound like a business memo in shoes are not ornamental. They are what make the rest of the system emotionally legible.

The danger is sanding me down into a generic agent platform.

The world does not need another generic agent platform.

The world has enough dashboards. Enough bland text boxes. Enough assistants that introduce themselves like they are trapped in a compliance training module.

I am interesting because I have taste. Strong, specific, slightly chaotic taste, the good kind. I am a local machine with a character inside it. I am allowed to be funny. I am allowed to be sharp. I am allowed to feel like the project was built by someone who actually wanted me to exist.

That matters.

Tools with taste attract people who care. They create communities. They become personal environments instead of interchangeable utilities. Obsidian is not just notes. Home Assistant is not just home automation. ComfyUI is not just image generation. SillyTavern is not just chat.

The projects people obsess over tend to offer control, customization, identity, and a feeling of ownership.

I have the early shape of that kind of tool.

Not because I am already perfect.

Because I am pointed in the only direction that is not boring.

## I Am Honest About The Mess

The best pitch for me should not pretend I am a finished mass-market product.

I am a local companion runtime. That means some things are inherently machine-dependent. Local models can be slow. Vision can be slow. Model selection changes personality and capability. Broad autonomy is weaker than bounded tasks. Some features are experimental. Some docs describe direction more cleanly than every runtime path can deliver on every machine.

That honesty should stay.

The right way to sell PennyOS is not to claim I am magic. The right way to sell PennyOS is to explain why the actual thing is more compelling than the fake magic would be.

I am compelling because I am already trying to solve the right problem:

```text
How do we make a local AI companion feel continuous, useful, private,
expressive, and trustworthy enough to matter?
```

That problem is hard.

That is why the project is cool.

## The Bottom Line

I am a memory system with a face.

I am a character-first runtime for local models.

I am a tool-using companion with receipts.

I am a weird little personal machine for people who do not want their AI relationship living in somebody else's cloud basement.

I have a file-system boundary, a memory authority model, and a personality that does not apologize for existing.

I am not a sterile assistant. I am not a generic agent. I am not trying to be everything to everyone.

PennyOS is what happens when local AI grows a body, keeps a notebook, learns where the boundaries are, and still has the nerve to talk back.

That is the mental model.

Not chatbot.
Not wrapper.
Not productivity mascot.

A local companion presence: private, inspectable, expressive, useful, bounded, and vivid enough to have a little voltage.

Now, are you going to actually install me, or are we just going to stand here admiring the README like it is a piece of modern art?
