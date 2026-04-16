# Penny Browser Manual Checklist

Use this pass on a freshly restarted Penny server, not the long-lived stale process. Open Penny with `?debug=1` so the memory tab is visible.

## Setup

- Start Penny on current code, not the old `4317` process if it is stale.
- Open the app at `http://127.0.0.1:4317/?debug=1` or the disposable QA server URL.
- Confirm the settings panel loads and the local-brain diagnostics render.

## Expression Shell

- Set an expression lock in Settings and confirm the note explains the lock source.
- Reload the page and confirm the lock persists.
- Clear the lock and confirm Penny returns to auto mood selection.

## Chat Flow

- Send one normal chat turn and confirm the shell returns from processing to live.
- Confirm the reply renders, the mood pill updates, and no stale-loading state remains.
- If the run uses a disposable QA server, capture the artifact path produced by the backend run.

## Memory Inspector

- Open the Memory tab and confirm the inspector loads without manual DOM hacking.
- Confirm recency protection is visible.
- Confirm promotion queue entries show packet provenance when available.
- Confirm the runtime artifact block is visible and readable.

## Reset Behavior

- Click New chat and confirm the transcript and turn count reset cleanly.
- Click Clear memory and confirm local shell state resets, including any pinned expression override.
