# Open WebUI Lab Cockpit

Open WebUI is an isolated lab cockpit, not a Penny replacement. Use it for model/prompt/RAG/tool experiments with non-sensitive prompts and toy docs.

```bash
npm run penny:lab-cockpit -- --template OpenWebUI
npm run penny:apps -- --bucket local_lab_cockpit
```

Do not import Penny memory, upload private runtime artifacts, add browser history, or make Open WebUI the default interface. Useful patterns to inspect: model picker ergonomics, tool/RAG visibility, artifact panels, and per-chat/provider config.
