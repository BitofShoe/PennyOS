# OpenCode Operator Sidecar

OpenCode is the second coding/operator candidate. It should connect to a local OpenAI-compatible endpoint only after config/schema review.

```bash
npm run penny:opencode:check
npm run penny:opencode:template
npm run penny:opencode:trial -- --repo tmp/sidecars/opencode-disposable-trial --model qwen-local-coding --endpoint-artifact output/local-endpoint-compatibility-2026-05-11.json --dry-run
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command '$cmd = Get-Command opencode -ErrorAction SilentlyContinue; [pscustomobject]@{ opencode_present=($null -ne $cmd); source=($cmd.Source) } | ConvertTo-Json'
```

The template is [opencode-local-provider.example.json](../../configs/sidecars/opencode-local-provider.example.json). Keep Penny memory and private runtime artifacts out of context, and score edits/tests/failure honesty before pattern mining.

If `npm run penny:opencode:check -- --json` reports `status: "blocked_missing_command"`, stop there. That is a clean blocked state: OpenCode is absent, install permission is required, and the next safe steps are command install/config review, template review, endpoint/model verification, then a disposable repo dry-run. Do not install OpenCode or write config from this roadmap without explicit operator approval.
