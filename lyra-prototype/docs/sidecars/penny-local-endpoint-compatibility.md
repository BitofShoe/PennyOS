# Local Endpoint Compatibility

Use this before trusting a local OpenAI-compatible endpoint for sidecar work.

```bash
npm run penny:endpoint:probe
npm run penny:endpoint:probe -- --endpoint http://127.0.0.1:1234/v1
npm run penny:endpoint:probe -- --endpoint http://127.0.0.1:18080/v1 --model-id unsloth/qwen3.6-35b-a3b@ud-q4_k_xl --probe-model-call --timeout-ms 300000
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command 'Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "llama-server.exe" }; Invoke-RestMethod http://127.0.0.1:18080/v1/models'
cmd.exe /c "cd /d C:\Users\malac\.openclaw\workspace-main\lyra-prototype && node scripts\penny-local-endpoint-compatibility.js --probe-model-call --endpoint http://127.0.0.1:18080/v1 --model-id unsloth/qwen3.6-35b-a3b@ud-q4_k_xl --timeout-ms 300000 --out output\local-endpoint-compatibility-2026-05-11-router-qwen-model-call.json --markdown-out output\local-endpoint-compatibility-2026-05-11-router-qwen-model-call.md --json"
```

Default mode probes `/v1/models` only. `--probe-model-call` sends tiny non-private compatibility checks for chat completions, streaming, tool-call payload acceptance, structured-output payload acceptance, developer role, reasoning effort, and responses support.

Use the PowerShell/Windows form when the model server is Windows-owned. A WSL `127.0.0.1` failure is not final endpoint truth; preserve loaded model state and verify from Windows before calling the endpoint down. If the PowerShell `npm.ps1` shim misbehaves, run the repo script through `cmd.exe` as shown above while keeping the runtime checks in PowerShell.

The probe does not change Penny runtime routes, memory, default models, context limits, thinking settings, or prompts.
