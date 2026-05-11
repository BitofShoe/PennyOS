# Pi Operator Sidecar

Pi is a coding/operator sidecar, not Penny runtime. Use it first only inside a disposable repo or throwaway worktree.

```bash
npm run penny:pi:check
npm run penny:pi:template
npm run penny:pi:validate-template
npm run penny:pi:models-json -- --model-id <resolved-qwen-model-id> --out output/pi-models.local.json
npm run penny:pi:models-json -- --resolve-from-endpoint output/local-endpoint-compatibility-2026-05-11.json --out output/pi-models.local.json
npm run penny:pi:copy-plan -- --generated-models-json output/pi-models.local.json
npm run penny:pi:trial-fixture -- --repo tmp/sidecars/pi-disposable-trial --endpoint-artifact output/local-endpoint-compatibility-2026-05-11.json --json
npm run penny:pi:trial -- --repo tmp/sidecars/pi-disposable-trial --model qwen-local-coding --endpoint-artifact output/local-endpoint-compatibility-2026-05-11.json --dry-run
cmd.exe /c "cd /d C:\Users\malac\.openclaw\workspace-main\lyra-prototype && node scripts\penny-operator-sidecar.js --app Pi --models-json --resolve-from-endpoint output\local-endpoint-compatibility-2026-05-11-router-qwen-model-call.json --out output\pi-models.local-2026-05-11-router-qwen.json --json"
cmd.exe /c "cd /d C:\Users\malac\.openclaw\workspace-main\lyra-prototype && node scripts\penny-operator-sidecar.js --app Pi --copy-plan --generated-models-json output\pi-models.local-2026-05-11-router-qwen.json --out output\pi-copy-plan-2026-05-11-router-qwen.json --json"
```

The template is [pi-local-models.example.json](../../configs/sidecars/pi-local-models.example.json). It matches the locally installed Pi 0.74.0 `models.json` shape: provider-level `baseUrl`, `api: "openai-completions"`, `apiKey`, optional provider `compat`, and a `models[]` list with positive `contextWindow` / `maxTokens` values when present.

`penny:pi:models-json` emits a raw Pi `models.json` candidate rather than the wrapper report. Use `--model-id` when you already know the endpoint model id, or `--resolve-from-endpoint` after a successful endpoint probe artifact. `penny:pi:copy-plan` prints the operator-reviewed copy steps for `~/.pi/agent/models.json` but does not write live Pi config.

`penny:pi:trial-fixture` creates a tiny disposable Node repo only at the explicit `--repo` path and returns a dry-run receipt. It does not execute Pi, does not write `~/.pi/agent/models.json`, and does not read Penny memory. When the endpoint artifact is available, the receipt shows whether the repo, command, and resolved model are ready enough for the operator to run the previewed Pi command.

For a WSL Pi dry-run against a Windows-only router, keep Pi config inside the disposable repo and use a temporary WSL-adapter bridge only for the trial. Do not write `~/.pi/agent/models.json`.

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command '$node="C:\Program Files\nodejs\node.exe"; $script="C:\Users\malac\.openclaw\tools\llama.cpp\b9025\penny-router-wsl-bridge.mjs"; $pidFile="C:\Users\malac\.openclaw\tools\llama.cpp\b9025\penny-router-wsl-bridge-18081.pid"; $p=Start-Process -FilePath $node -ArgumentList @($script,"--listen-host","172.29.64.1","--listen-port","18081","--target-host","127.0.0.1","--target-port","18080") -PassThru -WindowStyle Hidden; Set-Content -LiteralPath $pidFile -Value $p.Id; $p.Id'
mkdir -p tmp/sidecars/pi-disposable-trial/.pi-agent
node scripts/penny-operator-sidecar.js --app Pi --models-json --model-id unsloth/qwen3.6-35b-a3b@ud-q4_k_xl --endpoint http://172.29.64.1:18081/v1 --out output/pi-models.local-2026-05-11-wsl-bridge-qwen.json --json
cp output/pi-models.local-2026-05-11-wsl-bridge-qwen.json tmp/sidecars/pi-disposable-trial/.pi-agent/models.json
cd tmp/sidecars/pi-disposable-trial
PI_CODING_AGENT_DIR="$PWD/.pi-agent" PI_OFFLINE=1 pi --list-models --offline
PI_CODING_AGENT_DIR="$PWD/.pi-agent" PI_OFFLINE=1 pi --provider lmstudio-local --model unsloth/qwen3.6-35b-a3b@ud-q4_k_xl --no-session --no-context-files --tools read,grep,find,ls -p "Read package.json and src/todo.js only. Do not edit files. Report the npm test command and what summarizeTodo returns for { title: 'write receipt', priority: 'high' }."
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command '$pidFile="C:\Users\malac\.openclaw\tools\llama.cpp\b9025\penny-router-wsl-bridge-18081.pid"; if (Test-Path -LiteralPath $pidFile) { Stop-Process -Id ([int](Get-Content -LiteralPath $pidFile)) -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $pidFile -Force }'
```

Forbidden by default: Penny memory, private runtime artifacts, secrets, home directory scanning, browser history, email, camera/home data, production runtime config edits, default model swaps, and durable memory writes.
