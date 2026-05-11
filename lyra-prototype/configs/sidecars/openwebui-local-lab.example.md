# Open WebUI Local Lab Example

Open WebUI is a lab cockpit, not Penny's replacement UI.

- Endpoint: `http://127.0.0.1:1234/v1` or a reviewed llama.cpp `/v1` endpoint
- Inputs: non-sensitive prompts and toy documents only
- Forbidden: Penny memory import, private runtime artifacts, browser history, auto-ingest
- Output: model/RAG/tool visibility notes and pattern proposals for review
- Cleanup: delete toy knowledge bases after the trial if they are not useful
