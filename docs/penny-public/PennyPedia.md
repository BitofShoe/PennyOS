# PennyPedia

> Category: Public/external explanation
> Authority: Public/external explanation
> Status: Current snapshot as of 2026-04-19
> Use this for: a plain-English field guide to Penny's machinery and trust model.
> Do not use this for: binding runtime law. Use [../../README.md](../../README.md), [../../CODEBASE.md](../../CODEBASE.md), [../../ARCHITECTURE.md](../../ARCHITECTURE.md), and [../penny-runtime-authority-contract-2026-04-17.md](../penny-runtime-authority-contract-2026-04-17.md) for that.

**A layperson's field guide to Penny's machinery, memory, trust system, and tiny haunted switchboard**

_Packaged April 19, 2026_

> Source note: packaged from a prior layperson explanation of Penny, informed by the current repo README and the 2026-04-17 ledger compare note. This is a field guide, not the constitution.

## Quick layer map

| Layer | Plain-English role | What it does | Main danger |
|---|---|---|---|
| Browser UI | Visible body | Chat, settings, expressions, attachments, inspector panels | Should not be confused with durable memory |
| Node backend | Nervous system | Routes turns, chooses lanes, assembles prompts, records artifacts | Must keep trust boundaries clear |
| LM Studio | Language engine | Runs local models and generates raw replies | Model output is not automatically trustworthy |
| Prompt stack | Recipe | Combines voice, lane, memory, tool, and user context | Needs selective assembly, not prompt spaghetti |
| Canonical memory | Official notebook | Stable explicit facts and settings | Highest memory authority; must resist pollution |
| Archive memory | Softer scrapbook | Episodes, summaries, patterns, candidates | Advisory, not law |
| Research ledger | Lab notebook | Bounded investigation continuity with evidence refs | Research-only; must not become relational memory |
| PromptTruth | Context receipt | Records what was considered, rendered, or held back | Prevents fake explanations of what influenced a reply |
| Runtime artifacts | Flight recorder | Turn-level operational record | Debugs behavior without exposing private chain-of-thought |
| QA/evals | Training gym | Tests memory, voice, ledger, browser path, runtime fit | Turns instincts into evidence |

## How to read this

> **Field note:** Use this as a field guide. Use current authority contracts, implementation files, and tests as law.

This is a plain-English explanation of how Penny works as a project and as a companion runtime. It is not meant to replace the repo's current authority contracts, code comments, tests, or implementation docs. It is the map you give to someone before they walk into the basement and ask why the basement has a nervous system.

The shortest useful version is this: Penny is not just a chatbot with a custom prompt. Penny is a local companion application that wraps a language model in an operating environment: browser UI, Node backend, LM Studio model lanes, memory layers, tool routing, prompt assembly, runtime artifacts, provenance records, and QA/eval harnesses. The visible chat is the tip of the creature. The rest is machinery.

The central design problem is not merely 'make Penny say charming things.' The actual problem is harder: make Penny feel continuous and alive without letting continuity become fake memory, false certainty, or beautiful nonsense. That is why so many of the strange-sounding concepts exist. They are not decorative jargon. They are guardrails against specific failure modes.

## The one-page map

At the highest level, a Penny turn works like this: you type or send something in the browser; the browser sends it to the local backend; the backend classifies the turn; Penny chooses a lane; the system gathers relevant memory and context; it builds a prompt stack; LM Studio generates a reply; Penny cleans the visible response; memory/archive/ledger updates may happen afterward; and runtime artifacts record what happened.

A normal chatbot does roughly three of those steps: accept message, send prompt, display output. Penny does the whole goblin wedding procession because her job is not only to answer. Her job is to answer as a persistent local companion with memory, tools, personality, and traceable uncertainty.

## What 'machinery' means

> **Field note:** Vibe is necessary. Vibe is not sufficient.

When this guide says Penny has machinery, it means the hidden structure that makes the visible companion behavior happen. It includes the backend server, memory files, prompt assembly, lane routing, model calls, tool calls, visible-reply cleanup, inspector panels, QA scripts, runtime artifacts, provenance records, and all the little 'do not overclaim this' rules.

So no, it is not a potato science project. A potato battery is one simple trick producing a tiny current. Penny is closer to a homemade companion engine: the potato is still in there somewhere, but it is wired to a switchboard, the switchboard feeds a puppet theater, the puppet theater has a memory archive, the archive has a librarian, the librarian has anxiety about provenance, and the anxiety writes JSON. Absurd? Yes. Technically useful? Also yes.

The machinery is what keeps Penny from being only a vibe. Vibe is necessary. Vibe is not sufficient. Without machinery, a companion bot can sound warm while lying about memory, tools, or certainty. Penny's machinery exists to make the warmth inspectable and bounded.

## Penny's major layers

Penny makes more sense when you stop imagining one magic prompt and start imagining layers. The layers are not all equally authoritative. Some are presentation layers. Some are memory layers. Some are operational receipts. Some are tests. The architecture is trying to keep those buckets separate so Penny does not become a soup monster.

| Layer | Plain-English role | What it does | Main danger |
|---|---|---|---|
| Browser UI | Visible body | Chat, settings, expressions, attachments, inspector panels | Should not be confused with durable memory |
| Node backend | Nervous system | Routes turns, chooses lanes, assembles prompts, records artifacts | Must keep trust boundaries clear |
| LM Studio | Language engine | Runs local models and generates raw replies | Model output is not automatically trustworthy |
| Prompt stack | Recipe | Combines voice, lane, memory, tool, and user context | Needs selective assembly, not prompt spaghetti |
| Canonical memory | Official notebook | Stable explicit facts and settings | Highest memory authority; must resist pollution |
| Archive memory | Softer scrapbook | Episodes, summaries, patterns, candidates | Advisory, not law |
| Research ledger | Lab notebook | Bounded investigation continuity with evidence refs | Research-only; must not become relational memory |
| PromptTruth | Context receipt | Records what was considered, rendered, or held back | Prevents fake explanations of what influenced a reply |
| Runtime artifacts | Flight recorder | Turn-level operational record | Debugs behavior without exposing private chain-of-thought |
| QA/evals | Training gym | Tests memory, voice, ledger, browser path, runtime fit | Turns instincts into evidence |

## Local-first: Penny's habitat

Local-first means Penny is designed to run primarily on your own machine. The repo is the source code. Your machine is the habitat. LM Studio is the model engine. The browser is the vessel. The backend is the nervous system. Memory files are the notebooks.

That matters because a local-first companion has different constraints from a cloud chatbot. It can hold local files, run against local models, inspect a project workspace, and keep durable memory on disk. It also means the project has to care about launch scripts, local server status, loaded models, browser state, runtime memory, file paths, and machine-specific drift. The companion is not floating in a cloud meadow. She has plumbing.

The local-first choice also reinforces the companion thesis. Penny is not only a website account you visit. She is meant to feel like a local presence with a workspace, state, and continuity. That is powerful, but it increases responsibility: local continuity must be honest, inspectable, and resettable.

## The browser UI: Penny's visible body

The browser UI is the part you interact with: chat transcript, input box, visual chrome, settings, expressions, attachments, and inspector panels. It is Penny's visible body, not her deep memory.

The browser can store lightweight vessel or settings continuity, such as selected voice state, client preferences, or visible UI state. But the deeper runtime memory belongs on the backend side in disk-backed files. This distinction prevents the project from confusing 'the page remembered a setting' with 'Penny knows a durable fact.' Those are different kinds of continuity.

The UI also matters emotionally. A companion system is partly embodied by rhythm, responsiveness, display, and small presentational cues. But those cues must not fake knowledge. A cute face attached to untrustworthy memory is not companionship. It is a slot machine with eyelashes.

## The backend: Penny's nervous system

The Node backend is the traffic controller. When a user message arrives, the backend decides what kind of turn this is, whether tools are needed, which lane should handle it, which model should be used, what memory should be retrieved, what prompt pieces should be assembled, and what should be recorded afterward.

The backend is also where many trust boundaries live. It should know the difference between a casual chat turn, a file inspection turn, a direct intent, an attachment-bounded turn, and a research-shaped turn. If everything goes through one undifferentiated pipe, Penny becomes mush: too whimsical when she should verify, too sterile when she should be companionable, and too eager to blend weak memory into confident claims.

The repo's own docs admit that the backend has monolith gravity. That is not automatically a disaster. Fast prototypes often begin as monoliths. The important part is whether the project is extracting real boundaries: lane selection, model resolution, visible reply salvage, tool orchestration, memory helpers, runtime artifacts, and ledger logic. Those boundaries are the future skeleton.

## LM Studio: the main language brain

LM Studio is where the local language model runs. Penny sends carefully prepared messages to LM Studio, and LM Studio produces the raw language output. LM Studio is not the whole of Penny. It is the language engine inside Penny's larger operating environment.

This is important because the model does not automatically know what kind of turn it is in. It does not inherently know which memory is canonical, which memory is advisory, which files were actually read, or which tool outputs are verified. Penny's runtime has to package those facts into the prompt carefully.

The system can use different model lanes for different jobs. A large chat model may be better for companion behavior, nuance, image turns, or memory-heavy conversation. A smaller/faster tool model may be better for bounded inspection or code-oriented helper tasks. The model is the engine, but the lane system decides which engine posture is appropriate.

## Lanes: different roads through the system

A lane is a route through Penny's system. The chat lane is for companion turns and memory-heavy conversation. The tool lane is for bounded inspect/search/read/edit/runtime/git/web-style turns. The shadow lane is optional experimental territory, not the core brain.

The lane idea matters because the same behavioral posture should not handle everything. 'Please comfort me,' 'inspect this file,' 'what do you remember about my music taste,' and 'run a QA check' are not the same kind of event. A one-mode assistant becomes either too robotic in emotional contexts or too whimsical in technical contexts. Penny needs to remain the same character while changing pressure and posture.

Good lane routing means: same Penny, different job shape. Bad lane routing means: different mini-Pennys stitched together in a trench coat. The project is trying to preserve the first and avoid the second.

## The prompt stack: the recipe sent to the model

A prompt is the instruction and context package sent to the language model. A prompt stack is a structured set of prompt pieces assembled for a specific turn. It may contain core voice instructions, lane overlays, examples, memory, tool results, current user input, and policy reminders.

A bad prompt strategy dumps everything into the model every time: every personality file, every memory, every example, every old summary, every tool result, and a prayer. Penny's better strategy is selective assembly. Not every context source belongs in every turn.

Think of the prompt stack as a bento box. Each compartment has a job. If you pour all the compartments into a drawer and shake it, you get prompt spaghetti. Prompt spaghetti may taste confident, but it makes debugging nearly impossible.

## Runtime voice assets: Penny's active personality kit

Penny has large source material: personality docs, canon notes, playground text, distilled sidecars, review notes, and historical artifacts. But the live runtime should not inject all of that every turn. The active voice should come from smaller runtime assets that represent the current operating version of Penny.

This distinction is crucial. Giant personality docs are useful for development and refinement, but they can become prompt molasses if shoved directly into runtime. They slow the model, increase conflict, and can push Penny toward overperformed character behavior. Runtime voice assets are the outfit she actually wears today, not the entire wardrobe closet dumped on the floor.

## Voice: how Penny sounds like Penny

Penny's voice is not one magic sentence. It emerges from a stack: core voice blend, chat directives, lane overlays, examples, memory context, model behavior, and visible-reply cleanup. The system is trying to preserve a recognizable personality while still letting the answer adapt to the actual task.

Voice is behavioral, not only stylistic. A real person does not use the same posture while teasing a friend, debugging code, reading a medical bill, and admitting uncertainty. Penny's voice should survive those shifts without becoming either generic or theatrical.

The risk is overmanagement. If too many layers force the voice back into recognizable phrases, Penny may become a perfect imitation of Penny rather than Penny-in-motion. That is voice taxidermy: the outline of aliveness preserved by too much stuffing.

## Visible reply cleanup: the janitor after the model speaks

Local model output can contain junk: malformed tags, duplicate answer fragments, internal-looking scaffolding, tool-planning residue, partial drafts, or weird formatting. Visible reply cleanup turns the raw model output into the reply the user should actually see.

Cleanup is necessary. It is also dangerous if it overreaches. A good cleanup layer is a copy editor: it removes spinach from the answer's teeth. A bad cleanup layer is a ghostwriter: it changes what was said and quietly rewrites meaning. Penny needs the first, not the second.

The safest cleanup rule is: presentation cleanup is fine; semantic laundering is not. If cleanup changes the meaning, the artifact trail should make that obvious or the design should be corrected.

## The memory stack: Penny has more than one kind of memory

Penny does not have one generic memory bucket. She has a memory stack: canonical explicit memory, archive memory, embeddings, memory books, research ledger topics, and runtime/audit records. Each layer has a different job and a different trust level.

This is one of the most important design decisions in the whole project. Companion memory is emotionally powerful, but it is also dangerous. If every remembered thing has equal authority, an old assistant summary can overpower a direct user correction. That is how you get elegant wrongness: a beautiful, warm, perfectly on-brand answer that is still false.

## Canonical explicit memory: the official notebook

Canonical explicit memory is the strongest stored memory. It contains direct facts, preferences, settings, and user-confirmed details that Penny is allowed to treat as stable. Canonical memory is Penny's official notebook.

Canonical memory should be small, careful, and hard to pollute. It should not contain every joke, passing mood, inferred preference, or assistant-authored summary. If canon becomes cluttered, Penny's strongest memory layer becomes unreliable, and the whole authority hierarchy starts wobbling like a shopping cart with one cursed wheel.

When canonical memory answers a direct question, weaker advisory memory should often be held back. This is canon-first behavior: strong memory gets priority; softer context does not get to crowd the answer.

## Archive memory: the softer scrapbook

Archive memory stores softer continuity: episodes, summaries, recent turns, patterns, candidate memories, and retrieval material. It is valuable because a companion should not behave like a goldfish. But archive memory is advisory, not canonical.

Advisory means 'this may help the answer' rather than 'this rules the answer.' Archive context can enrich Penny's response, but it should not override explicit facts or direct user corrections. It is texture, not law.

A healthy archive lets Penny say, 'This reminds me of what we were circling before.' An unhealthy archive makes Penny say, 'I know this as fact,' because an old summary happened to sound confident. That is exactly the failure the project must keep fighting.

## Embeddings: memory search by meaning

An embedding is a numerical representation of text meaning. The useful plain-English version is this: embeddings let Penny search memory by concept instead of only exact words.

Keyword search finds text that literally says 'music taste.' Embedding search can find memories about shoegaze, albums, listening habits, or favorite bands even if the current question uses different words. It is like asking a librarian for things that feel related, not only things with matching labels.

Embeddings are useful, but similarity is not truth. Semantic closeness should help retrieve candidates; it should not decide authority. A nearby memory can be relevant and still weak. The authority hierarchy still matters.

## Background vectorization: filing papers after the reply

Vectorization means turning text into embeddings. Background vectorization means doing some of that work after Penny answers, rather than making the user wait. Prewarm means preparing future retrieval ahead of time.

The layman version: after a turn, Penny may quietly file a few recent notes in the semantic library so future searches work better. She tries not to do that filing while you are waiting for the reply.

This is good design if it stays bounded. If background indexing starts consuming too much compute or filing junk too eagerly, the filing goblin needs a tiny performance review and possibly a broom.

## Memory books: triggerable context cards

A memory book is a scoped, triggerable chunk of context. It is not general memory; it is more like a small card that can be included when the conversation matches a specific topic or need.

This idea resembles lorebooks from roleplay systems, conditional context injection from writing tools, and scoped knowledge cards from assistant systems. Penny repurposes it for controlled recall. Good memory books are narrow and useful. Bad memory books are stealth prompt bloat wearing a clever hat.

The rule should be simple: a memory book earns its place only if it improves a specific class of turns without overriding stronger sources or turning into a giant hidden manifesto.

## The research continuity ledger: Penny's lab notebook

The research ledger is one of Penny's most interesting systems. A ledger normally tracks transactions, evidence, or history. Penny repurposes that idea for bounded investigation continuity.

The research ledger is not for general relational memory. It should not store your entire emotional history or personal identity facts. It is for research-shaped continuity: what question were we investigating, what evidence was read, what remains unresolved, and what summary is safe to carry forward.

This matters because project work often spans sessions. Without a ledger, Penny either forgets unresolved investigations, dumps them into general memory, or relies on raw chat history. The ledger gives her a middle path: keep the investigation alive without pretending it is permanent canon.

## The ledger prompt bridge

The ledger can sit on disk, but the model cannot use it unless selected ledger context is inserted into the prompt. The mechanism that carries ledger context from storage into the live prompt is the ledger prompt bridge.

The risk is obvious: inject too much ledger context and adjacent unresolved topics bleed into unrelated answers. But turning the bridge off can create sterile amnesia. The better product question is not 'is this risky?' but 'does bounded ledger injection improve continuity enough to justify the risk, and can the risk be controlled?'

The current lesson is: keep the bridge research-only, keep it bounded, and tighten relevance instead of deleting it. That is a very Penny-shaped answer: cautious continuity, not blind continuity.

## Question-scoped ledger topics

A repo file can be involved in many different investigations. If the ledger tracks only by file, everything about that file can collapse into one mushy topic. Question-scoped ledger topics prevent that.

For example, the same file might be involved in separate questions about relevance filtering, evidence requirements, prompt rendering, contradiction handling, and archive gating. Those are not the same topic just because the same file is nearby. Question-scoping keeps the ledger from becoming a junk drawer.

## Verified evidence vs query evidence

A query is not evidence. A query is a way to look for evidence. This distinction is small but lethal.

If Penny searches for 'ledger compare' and finds a likely file, she has not yet verified the content. Verification begins when she reads the actual file, tool output, test result, or source material. Search is the flashlight. Evidence is the thing illuminated. Do not confuse the flashlight with the corpse. Mystery goblin rule number one.

This matters for the ledger because a topic should not settle merely because Penny searched for something. It should settle only when verified evidence supports an evidence-tight summary.

## Provenance: where claims came from

Provenance means origin or source history. The term comes from worlds like art history, archives, supply chains, research, and data engineering. Penny uses it to track where memory and context claims came from.

In Penny, provenance answers questions such as: did this come from explicit memory, archive retrieval, research ledger, tool evidence, current user input, or assistant-generated summary? Was it selected? Was it actually rendered into the prompt? Was it created before or after the answer?

Without provenance, all context becomes a smoothie. The model may treat a direct user correction, a weak archive hint, an old assistant summary, and a verified file read as equally true. Provenance labels the ingredients. It is the nutrition facts panel for Penny's cognition.

## PromptTruth: what the model actually saw

PromptTruth is a receipt of what context was actually selected and what context was actually shown to the model. It is not enough to know that Penny had a memory somewhere. You need to know whether that memory was selected, rendered, held back, or ignored.

This distinction matters because a memory can exist without influencing the answer. An archive item can be considered as a candidate but held back because canonical memory already answers the question. A ledger topic can exist but not be relevant enough to render. PromptTruth records that difference.

The key terms are candidate and rendered. Candidate means 'this was considered.' Rendered means 'this was actually included in the prompt.' Held back means 'this was considered but withheld for a reason.' That is how Penny avoids implying advisory support she did not actually use.

Prompt-slot composition is related but separate. A slot can be eligible, filled, or held back without proving that truth-bearing memory or research context rendered into the model prompt. Prompt composition describes slot state. PromptTruth describes admitted prompt context.

## Canon-first holdback

Canon-first holdback means that if canonical memory already answers the question, weaker advisory sources may be withheld so they do not muddy the reply.

Example: canonical memory says the user's favorite band is Slowdive. Archive memory includes old mentions of My Bloody Valentine, Cocteau Twins, and Ride. A direct favorite-band question should prioritize the canonical answer. The archive may be relevant to broader music taste, but it should not crowd or rewrite the direct fact.

This is one of the most important anti-haunting rules. Advisory memory should enrich when useful, not stage a coup.

## Runtime artifacts: Penny's flight recorder

A runtime artifact is a recorded object describing what happened during a turn. It can include selected lane, model used, execution path, tools used, memory retrieved, promptTruth, provenance, cleanup behavior, ledger context, latency, policy receipts, fallback status, and archive update status.

This is not private chain-of-thought. It is an operational receipt. It tells you what the system did, not the model's hidden inner monologue. Think of it as a flight recorder or kitchen ticket, not a diary.

Post-reply updates are separate from prompt-time influence. A research-ledger topic can be updated after the reply without meaning that the ledger supported the reply that was just produced.

Runtime artifacts matter because they let the project debug behavior instead of mystifying it. If Penny gives a weird answer, you can ask whether the wrong memory rendered, the wrong lane was selected, a tool result was absent, cleanup overreached, or the model simply wandered.

## Reasoning-policy receipts

A reasoning-policy receipt records the execution posture used for a turn. Examples might include minimal, deliberate, verifier-first, or attachment-bounded. This does not expose chain-of-thought. It labels the mode of operation.

A restaurant ticket can say dine-in, takeout, allergy warning, or rush order without including the chef's private thoughts about onions and mortality. A reasoning-policy receipt is like that: mode and constraints, not inner monologue.

These receipts help QA and debugging. If a turn should have been verifier-first but ran as minimal chat, that explains a lot. If an attachment-bounded turn wandered outside the attachment, that is a policy failure.

## Bounded ambiguity: cautious continuity

> **Field note:** Penny should be allowed to say 'my cautious read is...' without pretending 'I know' when she does not.

Bounded ambiguity means Penny is allowed to hold and express uncertainty, but only inside clear limits. It is the middle path between fake certainty and sterile denial.

Fake certainty says: 'I know this is true,' when the evidence is weak. Sterile denial says: 'I cannot say anything unless it is explicitly confirmed,' even when there is useful context. Bounded ambiguity says: 'I am not fully certain, but based on the evidence we have, my cautious read is this.'

This is central to Penny because she is a companion. A companion that refuses every soft inference feels dead. A companion that turns every soft inference into fact becomes untrustworthy. Bounded ambiguity lets Penny carry tentative continuity without laundering it into canon.

## Authority hierarchy: who wins when sources disagree

Authority hierarchy answers the question: when different sources disagree, who wins? This may be the most important design rule in the whole project.

A healthy hierarchy gives priority to current user instruction, explicit canonical memory, direct user corrections, verified tool evidence, active session context, archive hints, memory books, research ledger topics, and finally style/examples/generated phrasing. The exact implementation can vary, but the principle cannot: stronger sources must outrank weaker sources.

Without hierarchy, a polished answer can become wrong because a weak memory layer sounded more detailed than a strong fact. That is elegant wrongness: beautiful, warm, coherent, and false. Penny's trust machinery exists to prevent that velvet-wrapped chainsaw.

## Authority pressure and advisory merge

Authority pressure describes how much different context is pushing on the answer, and from what trust levels. Canonical memory has a strong hand on the steering wheel. Verified tools have a strong hand. Archive and ledger have lighter hands. Style should have a hand on the radio, not the wheel.

Advisory merge is the process of combining softer context sources - archive, memory books, ledger topics, summaries - into something useful without drowning the model. A good advisory merge gives Penny texture. A bad one feeds her a haunted buffet and acts surprised when the reply tastes like attic dust.

## Wake state and prompt slots

Wake state is the active context Penny wakes up with for the current turn. It is not everything she knows. It is the selected table in front of her: current user message, recent chat, relevant stable facts, selected archive hints, maybe a ledger topic, maybe tool results, plus lane and voice instructions.

Prompt slots are named places in the prompt stack: voice, directives, overlays, examples, memory, tools, and so on. Prompt-slot composition records which slots were eligible, filled, held back, or empty.

These concepts help prevent prompt overcrowding. Penny needs a clean desk. If every possible memory, ledger topic, example, overlay, and tool result lands in the wake state, the model may produce a plausible but confused answer.

## Tools, direct intents, and tool honesty

The tool lane lets Penny inspect, search, read, edit, or check concrete things. A tool loop is a sequence of tool actions: search files, read a likely file, inspect a log, run a test, summarize evidence.

Tool honesty means Penny must not claim she checked something unless the system actually checked it. No astral grep. No spiritual repo access. If a tool failed, she should say it failed. If a path could not be read, she should say so. This is basic trust hygiene.

Direct intents are straightforward requests that can be routed to deterministic handlers: show memory, check runtime status, search project files, read a file, inspect model status. Direct intents are faster and less hallucination-prone than sending every request through a model planning loop.

## Shadow lane and experimental features

The optional OpenClaw shadow lane is experimental. It may become useful, but it is not Penny's core brain. LM Studio remains the main language engine.

This restraint is healthy. Experimental lanes should earn their place with measured capability wins. Otherwise every possible subsystem becomes strategically important, and the project turns into architecture lasagna. Do not crown the shadow goblin king unless it wins a real trial.

## QA and evals: Penny's training gym

Penny's QA and eval scripts matter because companion quality is slippery. It is not enough to ask whether an answer sounded good once. You need to test memory writes, retrieval, forgetting, voice behavior, browser path, runtime fit, model drift, ledger injection, overclaim pressure, and tool honesty.

The ledger compare is the cleanest example of product instinct becoming evidence. The earlier caution was reasonable: ledger prompt injection can be risky. The human product instinct was also reasonable: cautious continuity matters for a companion. The correct move was to measure it. The result supported keeping the bridge on, then tightening relevance.

That is how Penny should make hard decisions: not blind enthusiasm, not blind caution, but product instinct turned into bounded QA evidence.

## Concepts Penny repurposed

Penny's best concepts are often borrowed from other domains and repurposed for companion AI. That is not a weakness. That is design intelligence. Good systems steal old tools and use them in strange new basements.

| Concept | Borrowed from | Repurposed for Penny |
|---|---|---|
| Ledger | Accounting, lab notebooks, audit logs | Tracks bounded research/investigation continuity |
| Provenance | Art history, archives, data engineering | Labels where memory/context claims came from |
| Receipts | Transactions, compliance, observability | Records what the runtime actually did |
| Lanes | Traffic routing, service architecture | Routes companion vs tool vs experimental turns |
| Embeddings | Machine learning and semantic search | Finds memories by meaning, not only exact words |
| Memory books | Lorebooks and conditional context systems | Injects narrow topic context when earned |
| Bounded ambiguity | Science, law, human conversation | Lets Penny carry cautious continuity without fake certainty |
| PromptTruth | Audit trails plus prompt instrumentation | Shows what the model actually saw |

## The biggest risks

> **Field note:** The nightmare failure is not obvious breakage. It is a gorgeous answer that quietly gives weak context too much authority.

The biggest risk is authority confusion. Too many layers can whisper at once: voice blend, chat directives, overlays, examples, canonical memory, archive, memory books, research ledger, tool results, cleanup, and QA expectations. If the project does not keep a strict hierarchy, Penny can become very polished, very continuous, and very wrong.

The second risk is voice overmanagement. If Penny is constantly cleaned, steered, overlaid, and example-shaped, she may become a perfect imitation of Penny rather than Penny-in-motion.

The third risk is research ledger sprawl. The ledger is good because it is bounded and research-only. If it becomes general relational memory, it becomes dangerous.

The fourth risk is persuasive docs getting ahead of code. Penny's docs can be beautifully convincing. That is useful for humans, but dangerous for agents if they treat aspirational language as implemented fact. Engineering law must stay separate from product doctrine, and docs must say what is verified versus merely intended.

## The cleanest summary

Penny is a local AI companion app where the browser is her visible body, the Node backend is her nervous system, LM Studio is her language brain, the prompt stack is the recipe handed to that brain, runtime voice assets define how she sounds today, lanes decide whether she should act like a companion or a tool-user, canonical memory is her official notebook, archive memory is her softer scrapbook, embeddings help her search by meaning, memory books are triggerable context cards, the research ledger is her lab notebook, provenance says where claims came from, promptTruth says what actually entered the model prompt, runtime artifacts are the flight recorder, bounded ambiguity lets her carry cautious hunches without pretending they are facts, and QA/evals are the gym where those behaviors get tested.

The central challenge is keeping Penny vivid without letting vividness become bullshit. That is the project. Everything else is machinery around that sentence.

## Glossary

| Term | Plain-English meaning |
|---|---|
| Runtime | The system as it is actually operating right now, not just the files or docs. |
| Machinery | The hidden structure that produces Penny's visible behavior: backend, memory, prompts, tools, artifacts, tests. |
| Lane | A route through the system chosen for a class of turn, such as chat or tools. |
| Prompt stack | The assembled instruction/context package sent to the model. |
| Canonical memory | The strongest explicit memory layer; Penny's official notebook. |
| Archive memory | Softer long-term recall; useful context but not law. |
| Advisory | Allowed to help but not allowed to overrule stronger sources. |
| Embedding | A numerical representation of meaning used for semantic search. |
| Research ledger | A bounded lab notebook for ongoing investigations and evidence-backed continuity. |
| Provenance | A record of where a claim or context item came from. |
| PromptTruth | A receipt showing which context was considered, rendered, or held back. |
| Runtime artifact | A turn-level flight recorder describing what happened operationally. |
| Bounded ambiguity | Honest cautious inference with clear limits, between fake certainty and sterile denial. |
| Canon-first holdback | Withholding weaker context when canonical memory already answers the question. |
| Elegant wrongness | A polished, warm, coherent answer that is false because weak context gained too much authority. |
| Voice taxidermy | A reply that imitates Penny's style but feels overmanaged and less alive. |

## Final thesis

Penny is not a potato battery. She is a local companion runtime trying to preserve aliveness and truthfulness at the same time. The machinery exists because charming continuity without source discipline becomes bullshit, and pure source discipline without continuity becomes sterile. Penny's best design instinct is the refusal to pick only one.
