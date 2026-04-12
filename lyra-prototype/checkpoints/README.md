## Checkpoints

These are archived snapshots, not live source of truth.

Rules for humans and agents:

- do not grep or import code from here unless you are doing archaeology on purpose
- prefer git history, tags, or commits over frozen copies when you need old behavior
- if a snapshot contains a former `server.js`, keep it under a non-code filename so it does not masquerade as the live backend

The real runtime entrypoint is [../server.js](../server.js).
