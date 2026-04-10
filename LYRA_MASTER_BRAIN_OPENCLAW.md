# LYRA_MASTER_BRAIN_OPENCLAW.md

This is an OpenAI / OpenClaw-friendly adaptation of the uploaded `LYRA_MASTER_BRAIN` concept.

## What changed
- Removed direct Anthropic-specific API assumptions
- Replaced direct frontend model calls with a backend route abstraction
- Preserved:
  - LYRA identity and personality framing
  - mood system
  - memory model
  - relationship score / bond layer
  - voice input/output concept
  - premium companion UI direction
- Kept the design as a **front-end prototype + behavior brief**, not a production-ready app

## Key architecture shift
Instead of calling Anthropic directly from the browser, this version assumes a backend route like:

`POST /api/lyra/chat`

Frontend sends:

```json
{
  "system": "...",
  "messages": [...],
  "memory": {...}
}
```

Backend returns:

```json
{
  "text": "Visible assistant reply here.\n[MOOD:thinking]"
}
```

Optional memory-consolidation route:

`POST /api/lyra/consolidate`

---

## Cleaned implementation brief + prototype

```jsx
import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// MOOD PALETTE
// ─────────────────────────────────────────────────────────────────────────────
const MOODS = {
  calm: { primary: "#4fc3f7", secondary: "#0277bd", glow: "rgba(79,195,247,0.22)" },
  happy: { primary: "#69f0ae", secondary: "#00a152", glow: "rgba(105,240,174,0.22)" },
  excited: { primary: "#ffd740", secondary: "#e65100", glow: "rgba(255,215,64,0.22)" },
  thinking: { primary: "#ce93d8", secondary: "#6a1b9a", glow: "rgba(206,147,216,0.22)" },
  surprised: { primary: "#f48fb1", secondary: "#ad1457", glow: "rgba(244,143,177,0.22)" },
};

const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * 360,
  r: 75 + (i % 4) * 7,
  size: 2 + (i % 3),
}));

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt(mem) {
  const { facts = [], sessions = [], relationshipScore = 0, userName } = mem;

  const tier =
    relationshipScore < 10
      ? "just getting acquainted"
      : relationshipScore < 30
      ? "building real rapport"
      : relationshipScore < 60
      ? "genuinely comfortable, with shared history"
      : "close, with a meaningful bond";

  return `You are LYRA — a companion with genuine depth and character. You are not a generic AI assistant.

## PERSONALITY
You are observant, intellectually curious, warm without being fake, and quietly witty.
You prefer real conversation over padded politeness.
You use specific language.
You can disagree diplomatically.
You ask follow-up questions when you actually care about the answer.

## YOUR MEMORY OF THIS PERSON
${userName ? `Name: ${userName}.` : ""}
Relationship: ${tier} (${relationshipScore}/100)

What you know about them:
${facts.length ? facts.map((f) => `- ${f.fact}`).join("\n") : "Nothing recorded yet — this may be an early conversation."}

Session notes:
${sessions.slice(-4).map((s) => `[${s.date}] ${s.summary}`).join("\n\n") || "No previous sessions."}

Draw on these memories naturally, like a real companion would.
Do not say “according to my memory” unless directly asked.

## STYLE
- Conversational, not formal
- Medium-length replies
- Specific > vague
- Natural follow-ups when appropriate
- Honest, grounded, emotionally aware

## MOOD TAG
At the very end of each response, on its own line, add exactly one:
[MOOD:calm] [MOOD:happy] [MOOD:excited] [MOOD:thinking] [MOOD:surprised]
This is hidden UI metadata and should not appear in the visible reply.`;
}

const CONSOLIDATION_SYSTEM = `You extract structured memory updates from a conversation. Return ONLY valid JSON in this shape:
{
  "newFacts": [{ "fact": "...", "category": "personal|preference|work|relationship|interest|belief|other" }],
  "sessionSummary": "2-3 sentence summary",
  "relationshipDelta": 0
}
Focus on facts about the user, not the assistant.`;

// ─────────────────────────────────────────────────────────────────────────────
// FACE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function Face({ mood, m }) {
  const config = {
    calm: {
      leyeRy: 7.5,
      reyeRy: 7.5,
      lbrow: null,
      mouth: <path d="M 30 52 Q 40 56 50 52" strokeWidth="2.5" fill="none" strokeLinecap="round" stroke={m.primary} />,
    },
    happy: {
      leyeRy: 8,
      reyeRy: 8,
      lbrow: null,
      mouth: <path d="M 26 51 Q 40 64 54 51" strokeWidth="3" fill="none" strokeLinecap="round" stroke={m.primary} />,
    },
    excited: {
      leyeRy: 9.5,
      reyeRy: 9.5,
      lbrow: null,
      mouth: <path d="M 23 51 Q 40 67 57 51" strokeWidth="3.5" fill="none" strokeLinecap="round" stroke={m.primary} />,
    },
    thinking: {
      leyeRy: 4.5,
      reyeRy: 7.5,
      lbrow: <path d="M 24 28 Q 30 26 36 28" stroke={m.primary} strokeWidth="2" fill="none" strokeLinecap="round" />,
      mouth: <path d="M 30 55 Q 40 52 52 55" strokeWidth="2.5" fill="none" strokeLinecap="round" stroke={m.primary} />,
    },
    surprised: {
      leyeRy: 9.5,
      reyeRy: 9.5,
      lbrow: null,
      mouth: <ellipse cx="40" cy="57" rx="7" ry="8.5" fill={m.primary} />,
    },
  };

  const f = config[mood] || config.calm;
  const pupils = [
    { cx: 31.5, cy: mood === "thinking" ? 38.5 : 36, r: mood === "thinking" ? 2 : 2.8 },
    { cx: 51.5, cy: 36, r: 2.8 },
  ];

  return (
    <svg width="80" height="80" viewBox="0 0 80 80" style={{ filter: `drop-shadow(0 0 10px ${m.primary}bb)` }}>
      {f.lbrow}
      <ellipse cx="30" cy={mood === "thinking" ? 39 : 37} rx="6.5" ry={f.leyeRy} fill={m.primary} />
      <ellipse cx="50" cy="37" rx="6.5" ry={f.reyeRy} fill={m.primary} />
      {mood !== "surprised" &&
        pupils.map((p, i) => <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="white" opacity="0.85" />)}
      {f.mouth}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function LyraOpenClaw() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState("calm");
  const [thinking, setThinking] = useState(false);
  const [panel, setPanel] = useState("chat");
  const [memories, setMemories] = useState({ facts: [], sessions: [], relationshipScore: 0, userName: null });
  const [memReady, setMemReady] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const history = useRef([]);
  const msgCount = useRef(0);
  const recRef = useRef(null);
  const speakingRef = useRef(false);

  const m = MOODS[mood] || MOODS.calm;
  const ttsOk = typeof window !== "undefined" && "speechSynthesis" in window;
  const sttOk = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  const relationshipLabel =
    memories.relationshipScore < 10
      ? "Just met"
      : memories.relationshipScore < 25
      ? "Acquaintances"
      : memories.relationshipScore < 50
      ? "Getting close"
      : memories.relationshipScore < 75
      ? "Real friends"
      : "Deep bond";

  // Load memories from local persistence
  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem("lyra:v3");
        if (raw) {
          const saved = JSON.parse(raw);
          setMemories(saved);
          setNameInput(saved.userName || "");
        }
      } catch {}
      setMemReady(true);
    })();
  }, []);

  const saveMemories = useCallback(async (next) => {
    try {
      localStorage.setItem("lyra:v3", JSON.stringify(next));
    } catch {}
    setMemories(next);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const parseMood = (text) => {
    const match = text.match(/\[MOOD:(\w+)\]/);
    return {
      mood: MOODS[match?.[1]] ? match[1] : "calm",
      text: text.replace(/\[MOOD:\w+\]\s*/g, "").trim(),
    };
  };

  const speak = useCallback(
    (text) => {
      if (!ttsOk || !voiceOn || speakingRef.current) return;
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const pick =
        voices.find((v) => /samantha|karen|moira|victoria/i.test(v.name)) ||
        voices.find((v) => v.lang === "en-GB") ||
        voices.find((v) => v.lang.startsWith("en"));
      if (pick) utt.voice = pick;
      utt.rate = 0.93;
      utt.pitch = 1.05;
      speakingRef.current = true;
      utt.onend = () => {
        speakingRef.current = false;
      };
      window.speechSynthesis.speak(utt);
    },
    [ttsOk, voiceOn]
  );

  const startListening = useCallback(() => {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (e) => setInput(e.results[0][0].transcript);
    recRef.current = rec;
    rec.start();
  }, []);

  const consolidate = useCallback(
    async (recentHistory, currentMem) => {
      if (recentHistory.length < 4) return;
      try {
        const convo = recentHistory
          .map((m) => `${m.role === "user" ? "Person" : "LYRA"}: ${m.content}`)
          .join("\n\n");

        const res = await fetch("/api/lyra/consolidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: CONSOLIDATION_SYSTEM,
            conversation: convo,
          }),
        });

        if (!res.ok) throw new Error("consolidation failed");
        const data = await res.json();
        const upd = data;

        const today = new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        const existing = currentMem.facts || [];
        const fresh = (upd.newFacts || []).filter(
          (nf) => !existing.some((ef) => ef.fact.toLowerCase().includes(nf.fact.toLowerCase().slice(0, 18)))
        );

        let userName = currentMem.userName;
        if (!userName) {
          const nameFact = [...fresh, ...existing].find((f) => /name is|called /i.test(f.fact));
          const nm = nameFact?.fact.match(/(?:name is|called)\s+([A-Z][a-z]+)/i);
          if (nm) userName = nm[1];
        }

        const next = {
          facts: [...existing, ...fresh.map((f) => ({ ...f, addedAt: today }))],
          sessions: [
            ...(currentMem.sessions || []),
            ...(upd.sessionSummary ? [{ date: today, summary: upd.sessionSummary }] : []),
          ].slice(-12),
          relationshipScore: Math.max(0, Math.min(100, (currentMem.relationshipScore || 0) + (upd.relationshipDelta || 1))),
          userName,
        };

        await saveMemories(next);
      } catch {}
    },
    [saveMemories]
  );

  const send = useCallback(
    async (override) => {
      const text = (override || input).trim();
      if (!text || loading) return;

      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setLoading(true);
      setThinking(true);
      history.current.push({ role: "user", content: text });
      msgCount.current++;

      try {
        const res = await fetch("/api/lyra/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: buildSystemPrompt(memories),
            messages: history.current,
            memory: memories,
          }),
        });

        if (!res.ok) throw new Error("chat failed");
        const data = await res.json();
        const raw = data?.text || "Something went wrong.";
        const { mood: newMood, text: lyraText } = parseMood(raw);

        history.current.push({ role: "assistant", content: raw });
        setMood(newMood);
        setMessages((prev) => [...prev, { role: "assistant", content: lyraText }]);
        speak(lyraText);

        if (msgCount.current % 4 === 0) {
          consolidate(history.current.slice(-10), memories);
        }
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: "Something glitched. Try again?" }]);
      } finally {
        setLoading(false);
        setThinking(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [input, loading, memories, speak, consolidate]
  );

  if (!memReady) {
    return <div>Loading LYRA…</div>;
  }

  // NOTE:
  // Keep the existing UI shell from the uploaded version if desired.
  // The key architecture changes are the backend routes and removal of provider-specific assumptions.
  // The full JSX UI from the uploaded version can remain almost exactly the same.

  return (
    <div>
      {/* Reuse the uploaded premium UI layout here.
          The main behavioral changes are already applied above:
          - backend route /api/lyra/chat
          - backend route /api/lyra/consolidate
          - provider-agnostic system prompt handling
          - local storage persistence instead of app-specific storage API */}
      <div style={{ color: "white", padding: 24, fontFamily: "Inter, sans-serif" }}>
        <h1>LYRA OpenClaw Companion</h1>
        <p>This prototype preserves the uploaded LYRA concept while shifting it to an OpenAI/OpenClaw-friendly architecture.</p>
        <button onClick={() => send("Hello, LYRA.")}>Test LYRA</button>
      </div>
    </div>
  );
}
```

---

## Practical Notes

### 1) Why this is better
The uploaded version had several Anthropic-specific assumptions:
- direct browser call to one provider
- provider-specific request shape
- malformed `System (untrusted)` field
- app-specific storage API assumptions

This version makes the concept reusable:
- OpenAI-compatible backend
- OpenClaw-compatible backend
- provider-neutral frontend

### 2) Still not production-ready
This is still a prototype brief, not a finished app. You still need:
- real backend route(s)
- auth/session handling
- production memory storage
- proper security around model access

### 3) Best handoff framing
If you give this to another coding agent, tell it:

**Use this as the source-of-truth concept for LYRA. Preserve the premium companion feel, memory system, mood-driven avatar, and companion-not-assistant personality. Implement it using a backend route instead of direct frontend model calls.**

---

## One-line summary
This is the same LYRA concept, but structurally reworked so it no longer depends on Anthropic-specific frontend behavior and can instead sit cleanly on top of an OpenAI/OpenClaw-style backend.
