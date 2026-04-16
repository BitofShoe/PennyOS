# Penny Document Chunking Notes

> Canonical note: the master research entrypoint is [docs/penny-research-master-synthesis-2026-04-16.md](./penny-research-master-synthesis-2026-04-16.md). Keep this note as cited source material for chunking and chapter-fallback design.

## The short version

If accuracy matters more than speed, the first move usually is not "buy a bigger GPU."

The first move is to stop making the model wrestle with ugly source material.

Raw PDFs are great for humans to look at and kind of obnoxious for an LLM to reason over. A cleaner pipeline usually beats brute-force context stuffing:

1. Convert the source into cleaner text.
2. Break it into meaningful sections.
3. Build a compact index of what lives where.
4. Only load the relevant parts when the question actually calls for them.

That is the core idea both the Reddit comment and my own take agree on.

## What the Reddit comment was really saying

The useful parts of that comment were:

- Accuracy and efficiency are not really separate from methodology. If the workflow is sloppy, more horsepower just lets you do the sloppy thing faster and more expensively.
- PDF is a bad primary knowledge format for model work. It is a presentation format, not a reasoning format.
- VRAM requirements depend on the actual model, quantization, and prompt/context strategy, not just the raw page count.
- If you want reliable retrieval, curate the data first, then give the model an index or map so it knows what to read.
- A good system often looks like: normalized files -> sliced chapters/items -> one index file -> targeted reads.

The example from the comment was basically:

- Take a big PDF.
- Convert it into markdown or another cleaner text representation.
- Split it by chapter, item, or other meaningful boundaries.
- Create a higher-level index that describes those pieces.
- Let the model use that index to choose which chunk to read instead of dumping everything at once.

That is a much better accuracy story than "shove the whole bastard into context and pray."

## Where I agree

- Strongly agree that raw PDF should not be the long-term source format if precision matters.
- Strongly agree that structure beats brute force more often than people want to admit.
- Strongly agree that retrieval quality is a bigger lever than just context-window flexing.
- Strongly agree that source references matter. The model should know what file or section a fact came from.

## Where I would not copy the comment blindly

- "Accuracy > Efficiency doesn't make sense" is a dumb way to phrase it. It absolutely makes sense as a product priority. In high-stakes workflows, slower is fine if the result is more trustworthy.
- "Rarely go below Q8 for production" is too absolute for my taste. Sometimes that is right. Sometimes architecture, prompting, and retrieval discipline matter more than squeezing every last bit out of quant precision.
- Fine-tuning is not the first move. Data cleanup, retrieval design, evaluation, and citation discipline should come first.

## The useful mental model

Think of it like this:

- Big ugly blob input = the model is searching a hoarder's garage
- Clean chapters + index = the model is using labeled drawers

If the model has labeled drawers, it has a much better chance of pulling the right thing without mangling the answer.

## What this means for Penny

This is very relevant to Penny.

If we ever want Penny to work with large documents, notes, folders, or a more serious memory/research layer, we should not just keep handing her giant files and hoping context solves it.

The smarter Penny pattern is:

1. Ingest the source.
2. Normalize it into markdown or other clean text.
3. Split it into manageable chapters or sections.
4. Create a compact index that describes the parts.
5. Let Penny retrieve the right section on demand.
6. Keep source references attached so she can say where a fact came from.

That fits really well with the direction Penny is already heading:

- semantic-core first
- targeted retrieval
- bounded tool use
- verified context before the final voiced reply

## Concrete ideas we can use later

- For large docs, create one master index file plus chapter files.
- For project folders, maintain lightweight manifest files that describe what each area contains.
- For memory-heavy workflows, store distilled semantic notes plus references back to source files.
- For future agentic work, prefer "find the right chapter, then read it" over "read the entire document every time."
- For anything high stakes, make Penny cite the file/chapter/section she used.

## One-line takeaway

Do not feed Penny a giant cursed blob if you can feed her a clean map and the exact drawer she needs.
