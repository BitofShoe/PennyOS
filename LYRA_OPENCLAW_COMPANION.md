# LYRA OpenClaw Companion Prototype

This is a cleaner **Code27-style AI companion prototype** adapted from the original Claude-based concept.

## Goals
- **OpenAI / OpenClaw-compatible architecture**
- **No direct frontend secret/API-key usage**
- Cleaner **premium companion object** vibe
- Reusable as a front-end prototype for later OpenClaw or backend integration

## Key Changes from Original
- Replaced direct Anthropic API call with a backend route: `/api/companion/chat`
- Fixed invalid request payload structure
- Preserved mood-tag parsing system
- Shifted UI from “chat orb toy” to a more premium “contained intelligence / companion core” style
- Added stronger structural separation between:
  - presence / avatar core
  - message stream
  - input surface

---

## Recommended backend contract
Frontend sends:

```json
{
  "messages": [
    { "role": "user", "content": "hello" }
  ],
  "system": "...system prompt..."
}
```

Backend returns:

```json
{
  "text": "Hey. Good to see you again.\n[MOOD:calm]"
}
```

The mood tag is parsed client-side and hidden from the user.

---

## React prototype

```jsx
import { useEffect, useRef, useState } from "react";

const MOODS = {
  calm: {
    primary: "#7dd3fc",
    secondary: "#0ea5e9",
    glow: "rgba(125,211,252,0.22)",
    ring: "rgba(125,211,252,0.14)",
  },
  happy: {
    primary: "#86efac",
    secondary: "#22c55e",
    glow: "rgba(134,239,172,0.22)",
    ring: "rgba(134,239,172,0.14)",
  },
  excited: {
    primary: "#fcd34d",
    secondary: "#f59e0b",
    glow: "rgba(252,211,77,0.22)",
    ring: "rgba(252,211,77,0.14)",
  },
  thinking: {
    primary: "#d8b4fe",
    secondary: "#8b5cf6",
    glow: "rgba(216,180,254,0.22)",
    ring: "rgba(216,180,254,0.14)",
  },
  surprised: {
    primary: "#f9a8d4",
    secondary: "#ec4899",
    glow: "rgba(249,168,212,0.22)",
    ring: "rgba(249,168,212,0.14)",
  },
};

const SYSTEM_PROMPT = `You are LYRA — a warm, sharp, observant AI companion.
You are emotionally intelligent, subtly witty, and conversational without being overly verbose.
Keep replies natural and human-readable. Ask thoughtful follow-up questions when appropriate.
At the very end of your response, on its own line, append exactly one mood tag:
[MOOD:calm] [MOOD:happy] [MOOD:excited] [MOOD:thinking] [MOOD:surprised]
The mood tag is UI metadata and should not appear in the visible reply.`;

function parseMood(text) {
  const match = text.match(/\[MOOD:(\w+)\]/);
  return {
    mood: MOODS[match?.[1]] ? match[1] : "calm",
    text: text.replace(/\[MOOD:\w+\]\s*/g, "").trim(),
  };
}

function CompanionFace({ mood, palette }) {
  const faces = {
    calm: {
      eyes: (
        <>
          <ellipse cx="34" cy="40" rx="6.5" ry="7.5" />
          <ellipse cx="58" cy="40" rx="6.5" ry="7.5" />
          <circle cx="35.8" cy="38.4" r="2.5" fill="white" opacity="0.9" />
          <circle cx="59.8" cy="38.4" r="2.5" fill="white" opacity="0.9" />
        </>
      ),
      mouth: <path d="M 31 58 Q 46 62 61 58" strokeWidth="2.4" fill="none" strokeLinecap="round" />,
    },
    happy: {
      eyes: (
        <>
          <ellipse cx="34" cy="39" rx="6.8" ry="7.8" />
          <ellipse cx="58" cy="39" rx="6.8" ry="7.8" />
          <circle cx="35.8" cy="37.2" r="2.7" fill="white" opacity="0.9" />
          <circle cx="59.8" cy="37.2" r="2.7" fill="white" opacity="0.9" />
        </>
      ),
      mouth: <path d="M 29 56 Q 46 71 63 56" strokeWidth="3" fill="none" strokeLinecap="round" />,
    },
    excited: {
      eyes: (
        <>
          <ellipse cx="34" cy="38" rx="7.8" ry="8.9" />
          <ellipse cx="58" cy="38" rx="7.8" ry="8.9" />
          <circle cx="36.2" cy="36.4" r="3.3" fill="white" opacity="0.9" />
          <circle cx="60.2" cy="36.4" r="3.3" fill="white" opacity="0.9" />
        </>
      ),
      mouth: <path d="M 27 56 Q 46 73 65 56" strokeWidth="3.2" fill="none" strokeLinecap="round" />,
    },
    thinking: {
      eyes: (
        <>
          <ellipse cx="34" cy="41" rx="6.3" ry="4.4" />
          <ellipse cx="58" cy="39" rx="6.6" ry="7.6" />
          <circle cx="35.3" cy="40.1" r="2.0" fill="white" opacity="0.9" />
          <circle cx="59.7" cy="37.6" r="2.6" fill="white" opacity="0.9" />
        </>
      ),
      mouth: <path d="M 33 60 Q 46 55 61 60" strokeWidth="2.4" fill="none" strokeLinecap="round" />,
    },
    surprised: {
      eyes: (
        <>
          <circle cx="34" cy="39" r="8.4" />
          <circle cx="58" cy="39" r="8.4" />
          <circle cx="36.3" cy="36.8" r="3.7" fill="white" opacity="0.9" />
          <circle cx="60.3" cy="36.8" r="3.7" fill="white" opacity="0.9" />
        </>
      ),
      mouth: <ellipse cx="46" cy="60" rx="7" ry="8" />,
    },
  };

  const face = faces[mood] || faces.calm;

  return (
    <svg width="92" height="92" viewBox="0 0 92 92" style={{ filter: `drop-shadow(0 0 14px ${palette.primary}aa)` }}>
      <g fill={palette.primary}>{face.eyes}</g>
      <g stroke={palette.primary}>{face.mouth}</g>
    </svg>
  );
}

export default function LyraCompanion() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState("calm");
  const [presence, setPresence] = useState("idle");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const historyRef = useRef([]);

  const palette = MOODS[mood] || MOODS.calm;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput("");
    setLoading(true);
    setPresence("thinking");

    const userMsg = { role: "user", content: userText };
    historyRef.current.push(userMsg);
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/companion/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: historyRef.current,
        }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data = await res.json();
      const raw = data?.text || "Something went wrong.";
      const parsed = parseMood(raw);

      const assistantMsg = { role: "assistant", content: parsed.text };
      historyRef.current.push({ role: "assistant", content: raw });
      setMessages((prev) => [...prev, assistantMsg]);
      setMood(parsed.mood);
      setPresence("present");
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Hmm. Something glitched on my side. Try me again.",
        },
      ]);
      setMood("thinking");
      setPresence("error");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top, #151726 0%, #090a12 50%, #05060b 100%)",
        color: "white",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        @keyframes floatSlow { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes pulseGlow { 0%,100%{opacity:.45;transform:scale(1)} 50%{opacity:.9;transform:scale(1.05)} }
        @keyframes rotateRing { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes blink { 0%,92%,100%{transform:scaleY(1)} 96%{transform:scaleY(0.08)} }
        @keyframes dots { 0%,80%,100%{opacity:.22;transform:translateY(0)} 40%{opacity:1;transform:translateY(-4px)} }
        @keyframes msgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 999px; }
        input::placeholder { color: rgba(255,255,255,0.34); }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 1120,
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 24,
        }}
      >
        <aside
          style={{
            borderRadius: 28,
            background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
            border: `1px solid ${palette.primary}22`,
            backdropFilter: "blur(22px)",
            padding: 28,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 640,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, letterSpacing: 4, color: palette.primary, textTransform: "uppercase", marginBottom: 8 }}>
              LYRA
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", letterSpacing: 2, textTransform: "uppercase" }}>
              Companion Core
            </div>
          </div>

          <div style={{ position: "relative", width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${palette.glow} 0%, transparent 68%)`,
                animation: "pulseGlow 3.2s ease-in-out infinite",
              }}
            />

            <div
              style={{
                position: "absolute",
                width: 190,
                height: 190,
                borderRadius: "50%",
                border: `1px solid ${palette.primary}26`,
                animation: "rotateRing 18s linear infinite",
              }}
            />

            <div
              style={{
                position: "absolute",
                width: 158,
                height: 158,
                borderRadius: "50%",
                border: `1px dashed ${palette.primary}38`,
                animation: "rotateRing 11s linear infinite reverse",
              }}
            />

            <div
              style={{
                width: 148,
                height: 148,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `radial-gradient(circle at 35% 30%, ${palette.secondary}88 0%, #0b0d17 68%)`,
                border: `1px solid ${palette.primary}55`,
                boxShadow: `0 0 28px ${palette.glow}, 0 0 70px ${palette.ring}, inset 0 0 22px rgba(255,255,255,0.04)`,
                animation: "floatSlow 4s ease-in-out infinite",
              }}
            >
              <div style={{ animation: "blink 5.2s ease-in-out infinite" }}>
                <CompanionFace mood={mood} palette={palette} />
              </div>
            </div>
          </div>

          <div style={{ width: "100%", display: "grid", gap: 14 }}>
            <div
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: `1px solid ${palette.primary}3a`,
                background: `${palette.primary}12`,
                color: palette.primary,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              {loading ? "Thinking" : mood}
            </div>

            <div
              style={{
                borderRadius: 18,
                padding: 16,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: 13,
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.62)",
              }}
            >
              Presence state: <span style={{ color: "white" }}>{presence}</span>
              <br />
              Conversation turns: <span style={{ color: "white" }}>{Math.floor(historyRef.current.length / 2)}</span>
            </div>
          </div>
        </aside>

        <main
          style={{
            minHeight: 640,
            borderRadius: 28,
            background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))",
            border: `1px solid ${palette.primary}18`,
            backdropFilter: "blur(20px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 22px",
              borderBottom: `1px solid ${palette.primary}14`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 15, color: "white", fontWeight: 600 }}>LYRA Session</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", marginTop: 4 }}>
                Warm, observant, memory-shaped companion interface
              </div>
            </div>
            <div style={{ fontSize: 12, color: palette.primary }}>{loading ? "processing" : "live"}</div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", color: "rgba(255,255,255,0.4)", lineHeight: 1.9 }}>
                <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.45 }}>✦</div>
                Begin the session with LYRA.
                <br />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.24)" }}>Designed for OpenClaw / OpenAI-compatible backend wiring.</span>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "82%",
                  animation: "msgIn 0.24s ease both",
                }}
              >
                {msg.role === "assistant" && (
                  <div style={{ fontSize: 11, color: palette.primary, marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase" }}>
                    LYRA
                  </div>
                )}
                <div
                  style={{
                    padding: "13px 16px",
                    borderRadius: msg.role === "user" ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
                    background:
                      msg.role === "user"
                        ? `linear-gradient(135deg, ${palette.primary}22, ${palette.secondary}16)`
                        : "rgba(255,255,255,0.05)",
                    border: `1px solid ${msg.role === "user" ? palette.primary + "33" : "rgba(255,255,255,0.07)"}`,
                    fontSize: 14,
                    lineHeight: 1.75,
                    color: "rgba(255,255,255,0.9)",
                    fontWeight: 300,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ alignSelf: "flex-start", animation: "msgIn 0.24s ease both" }}>
                <div style={{ fontSize: 11, color: palette.primary, marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase" }}>LYRA</div>
                <div
                  style={{
                    padding: "14px 18px",
                    borderRadius: "18px 18px 18px 6px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    display: "flex",
                    gap: 8,
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: palette.primary,
                        animation: `dots 1.1s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div style={{ padding: 18, borderTop: `1px solid ${palette.primary}14`, display: "flex", gap: 10 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Talk to LYRA…"
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.055)",
                border: `1px solid ${palette.primary}24`,
                borderRadius: 14,
                padding: "13px 16px",
                color: "white",
                fontSize: 14,
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                padding: "0 18px",
                border: "none",
                borderRadius: 14,
                background: input.trim() && !loading ? `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})` : "rgba(255,255,255,0.06)",
                color: input.trim() && !loading ? "#05060b" : "rgba(255,255,255,0.3)",
                fontWeight: 700,
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              }}
            >
              ↑
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
```

---

## Notes for OpenClaw / OpenAI adaptation

### If using OpenClaw as the backend brain
You could replace `/api/companion/chat` with a local backend route that:
- forwards messages to OpenClaw or an OpenAI-compatible backend
- keeps `system` as the top-level system instruction
- returns a simple `text` field

### If using OpenAI directly through your own backend
Your backend could:
- call OpenAI Responses/Chat API
- append or transform mood tags
- persist memory however you want

### If using OpenClaw web tooling only
Treat this file as:
- a **front-end concept**
- not a full OpenClaw plugin/app yet

---

## Suggested next improvements
1. Add a real backend route (`/api/companion/chat`)
2. Persist memory to a real store
3. Add voice input/output
4. Add “presence idle” ambient animations
5. Add a more holographic / vessel-like container if you want stronger Code27 energy

---

## One-line summary
This is a cleaner, premium-feeling **AI companion front-end prototype** that is structurally compatible with an **OpenAI/OpenClaw-style backend**, instead of being hardwired to Claude in the browser.
