# Contributing

PennyOS is an MIT-licensed, single-user local companion prototype. The owner decides whether and how to accept changes. Contributions should preserve the local companion shape.

## Before Opening A Pull Request

- Read [README.md](./README.md), [CODEBASE.md](./CODEBASE.md), [ARCHITECTURE.md](./ARCHITECTURE.md), and [docs/README.md](./docs/README.md).
- Keep changes bounded to the smallest useful slice.
- Do not turn Penny into a generic assistant platform.
- Do not commit live memory, local logs, generated QA artifacts, private notes, or secrets.
- Prefer extracted owners in `lib/` and `public/js/` before growing `server.js` or the browser orchestration shell.

## Verification

Run the relevant checks before asking for review:

```powershell
npm run check
git diff --check
```

For release-facing changes, also run:

```powershell
npm pack --dry-run --ignore-scripts --json
```

If a check is not run, say that directly in the pull request.
