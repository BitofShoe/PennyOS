# **Penny Companion Rebuild v2**

This version is based directly on the fully recovered `lyra true.md` source, but rebuilt into a safer and cleaner setup.

What changed:

* preserves the original single-component visual style much more closely  
* swaps browser-side provider calls for server routes  
* gives the assistant a Penny-flavored personality instead of LYRA's original voice  
* keeps the memory / settings / avatar structure from the recovered source  
* adds a storage fallback when `window.storage` does not exist  
* fixes stale memory usage during background consolidation  
* uses structured output for memory extraction

---

## **File 1 — `app/components/PennyCompanionV2.tsx`**

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type MoodKey \= "calm" | "happy" | "excited" | "thinking" | "surprised";  
type PanelKey \= "chat" | "memory" | "settings";  
type MessageRole \= "user" | "assistant";

type ChatMessage \= {  
  role: MessageRole;  
  content: string;  
};

type MemoryFact \= {  
  fact: string;  
  category:  
    | "personal"  
    | "preference"  
    | "work"  
    | "relationship"  
    | "interest"  
    | "belief"  
    | "other";  
  addedAt?: string;  
};

type SessionNote \= {  
  date: string;  
  summary: string;  
};

type MemoryState \= {  
  facts: MemoryFact\[\];  
  sessions: SessionNote\[\];  
  relationshipScore: number;  
  userName: string | null;  
};

const STORAGE\_KEY \= "penny:v2";

const DEFAULT\_MEMORY: MemoryState \= {  
  facts: \[\],  
  sessions: \[\],  
  relationshipScore: 0,  
  userName: null,  
};

const MOODS: Record\<MoodKey, { primary: string; secondary: string; glow: string }\> \= {  
  calm: { primary: "\#4fc3f7", secondary: "\#0277bd", glow: "rgba(79,195,247,0.22)" },  
  happy: { primary: "\#69f0ae", secondary: "\#00a152", glow: "rgba(105,240,174,0.22)" },  
  excited: { primary: "\#ffd740", secondary: "\#e65100", glow: "rgba(255,215,64,0.22)" },  
  thinking: { primary: "\#ce93d8", secondary: "\#6a1b9a", glow: "rgba(206,147,216,0.22)" },  
  surprised: { primary: "\#f48fb1", secondary: "\#ad1457", glow: "rgba(244,143,177,0.22)" },  
};

const PARTICLES \= Array.from({ length: 16 }, (\_, i) \=\> ({  
  angle: (i / 16\) \* 360,  
  r: 75 \+ (i % 4\) \* 7,  
  size: 2 \+ (i % 3),  
}));

function getStorageAdapter() {  
  if (typeof window \=== "undefined") return null;

  const maybeCustom \= (window as any).storage;  
  if (  
    maybeCustom &&  
    typeof maybeCustom.get \=== "function" &&  
    typeof maybeCustom.set \=== "function"  
  ) {  
    return {  
      get: async (key: string) \=\> {  
        const result \= await maybeCustom.get(key);  
        return result?.value ?? null;  
      },  
      set: async (key: string, value: string) \=\> {  
        await maybeCustom.set(key, value);  
      },  
      remove: async (key: string) \=\> {  
        if (typeof maybeCustom.remove \=== "function") {  
          await maybeCustom.remove(key);  
        } else {  
          await maybeCustom.set(key, "");  
        }  
      },  
    };  
  }

  return {  
    get: async (key: string) \=\> window.localStorage.getItem(key),  
    set: async (key: string, value: string) \=\> window.localStorage.setItem(key, value),  
    remove: async (key: string) \=\> window.localStorage.removeItem(key),  
  };  
}

function parseMood(text: string): { mood: MoodKey; text: string } {  
  const match \= text.match(/\\\[MOOD:(\\w+)\\\]/);  
  const mood \= match?.\[1\] as MoodKey | undefined;

  return {  
    mood: mood && MOODS\[mood\] ? mood : "calm",  
    text: text.replace(/\\\[MOOD:\\w+\\\]\\s\*/g, "").trim(),  
  };  
}

function Face({  
  mood,  
  m,  
}: {  
  mood: MoodKey;  
  m: { primary: string; secondary: string; glow: string };  
}) {  
  const config \= {  
    calm: {  
      leyeRy: 7.5,  
      reyeRy: 7.5,  
      lbrow: null,  
      mouth: \<path d="M 30 52 Q 40 56 50 52" strokeWidth="2.5" fill="none" strokeLinecap="round" stroke={m.primary} /\>,  
    },  
    happy: {  
      leyeRy: 8,  
      reyeRy: 8,  
      lbrow: null,  
      mouth: \<path d="M 26 51 Q 40 64 54 51" strokeWidth="3" fill="none" strokeLinecap="round" stroke={m.primary} /\>,  
    },  
    excited: {  
      leyeRy: 9.5,  
      reyeRy: 9.5,  
      lbrow: null,  
      mouth: \<path d="M 23 51 Q 40 67 57 51" strokeWidth="3.5" fill="none" strokeLinecap="round" stroke={m.primary} /\>,  
    },  
    thinking: {  
      leyeRy: 4.5,  
      reyeRy: 7.5,  
      lbrow: \<path d="M 24 28 Q 30 26 36 28" stroke={m.primary} strokeWidth="2" fill="none" strokeLinecap="round" /\>,  
      mouth: \<path d="M 30 55 Q 40 52 52 55" strokeWidth="2.5" fill="none" strokeLinecap="round" stroke={m.primary} /\>,  
    },  
    surprised: {  
      leyeRy: 9.5,  
      reyeRy: 9.5,  
      lbrow: null,  
      mouth: \<ellipse cx="40" cy="57" rx="7" ry="8.5" fill={m.primary} /\>,  
    },  
  } as const;

  const f \= config\[mood\] || config.calm;  
  const pupils \= \[  
    { cx: 31.5, cy: mood \=== "thinking" ? 38.5 : 36, r: mood \=== "thinking" ? 2 : 2.8 },  
    { cx: 51.5, cy: 36, r: 2.8 },  
  \];

  return (  
    \<svg width="80" height="80" viewBox="0 0 80 80" style={{ filter: \`drop-shadow(0 0 10px ${m.primary}bb)\`, transition: "filter 1.2s ease" }}\>  
      {f.lbrow}  
      \<ellipse cx="30" cy={mood \=== "thinking" ? 39 : 37} rx="6.5" ry={f.leyeRy} fill={m.primary} style={{ transition: "all 0.5s ease" }} /\>  
      \<ellipse cx="50" cy="37" rx="6.5" ry={f.reyeRy} fill={m.primary} style={{ transition: "all 0.5s ease" }} /\>  
      {mood \!== "surprised" &&  
        pupils.map((p, i) \=\> (  
          \<circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="white" opacity="0.85" style={{ transition: "all 0.5s ease" }} /\>  
        ))}  
      {f.mouth}  
      {mood \=== "excited" && (  
        \<\>  
          \<circle cx="18" cy="26" r="2" fill={m.primary} opacity="0.6" /\>  
          \<circle cx="63" cy="22" r="1.5" fill={m.primary} opacity="0.45" /\>  
          \<circle cx="60" cy="64" r="1.5" fill={m.primary} opacity="0.45" /\>  
        \</\>  
      )}  
    \</svg\>  
  );  
}

export default function PennyCompanionV2() {  
  const \[messages, setMessages\] \= useState\<ChatMessage\[\]\>(\[\]);  
  const \[input, setInput\] \= useState("");  
  const \[loading, setLoading\] \= useState(false);  
  const \[mood, setMood\] \= useState\<MoodKey\>("calm");  
  const \[thinking, setThinking\] \= useState(false);  
  const \[panel, setPanel\] \= useState\<PanelKey\>("chat");  
  const \[memories, setMemories\] \= useState\<MemoryState\>(DEFAULT\_MEMORY);  
  const \[memReady, setMemReady\] \= useState(false);  
  const \[voiceOn, setVoiceOn\] \= useState(false);  
  const \[listening, setListening\] \= useState(false);  
  const \[nameInput, setNameInput\] \= useState("");  
  const \[error, setError\] \= useState\<string | null\>(null);

  const bottomRef \= useRef\<HTMLDivElement | null\>(null);  
  const inputRef \= useRef\<HTMLInputElement | null\>(null);  
  const history \= useRef\<ChatMessage\[\]\>(\[\]);  
  const msgCount \= useRef(0);  
  const recRef \= useRef\<any\>(null);  
  const speakingRef \= useRef(false);  
  const memoriesRef \= useRef\<MemoryState\>(DEFAULT\_MEMORY);

  const m \= MOODS\[mood\] || MOODS.calm;  
  const ttsOk \= typeof window \!== "undefined" && "speechSynthesis" in window;  
  const sttOk \=  
    typeof window \!== "undefined" &&  
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  useEffect(() \=\> {  
    memoriesRef.current \= memories;  
  }, \[memories\]);

  const relationshipLabel \=  
    memories.relationshipScore \< 10  
      ? "Just met"  
      : memories.relationshipScore \< 25  
      ? "Acquaintances"  
      : memories.relationshipScore \< 50  
      ? "Getting close"  
      : memories.relationshipScore \< 75  
      ? "Real friends"  
      : "Deep bond";

  useEffect(() \=\> {  
    (async () \=\> {  
      try {  
        const storage \= getStorageAdapter();  
        const raw \= storage ? await storage.get(STORAGE\_KEY) : null;  
        if (raw) {  
          const saved \= JSON.parse(raw) as MemoryState;  
          setMemories({ ...DEFAULT\_MEMORY, ...saved });  
          setNameInput(saved.userName || "");  
        }  
      } catch (e) {  
        console.error("Failed to load memories", e);  
      } finally {  
        setMemReady(true);  
      }  
    })();  
  }, \[\]);

  const saveMemories \= useCallback(async (next: MemoryState) \=\> {  
    try {  
      const storage \= getStorageAdapter();  
      if (storage) await storage.set(STORAGE\_KEY, JSON.stringify(next));  
    } catch (e) {  
      console.error("Failed to save memories", e);  
    }  
    setMemories(next);  
  }, \[\]);

  useEffect(() \=\> {  
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });  
  }, \[messages, loading\]);

  const speak \= useCallback(  
    (text: string) \=\> {  
      if (\!ttsOk || \!voiceOn || speakingRef.current) return;  
      window.speechSynthesis.cancel();  
      const utt \= new SpeechSynthesisUtterance(text);  
      const voices \= window.speechSynthesis.getVoices();  
      const pick \=  
        voices.find((v) \=\> /samantha|karen|moira|victoria/i.test(v.name)) ||  
        voices.find((v) \=\> v.lang \=== "en-GB") ||  
        voices.find((v) \=\> v.lang.startsWith("en"));  
      if (pick) utt.voice \= pick;  
      utt.rate \= 0.93;  
      utt.pitch \= 1.08;  
      speakingRef.current \= true;  
      utt.onend \= () \=\> {  
        speakingRef.current \= false;  
      };  
      utt.onerror \= () \=\> {  
        speakingRef.current \= false;  
      };  
      window.speechSynthesis.speak(utt);  
    },  
    \[ttsOk, voiceOn\]  
  );

  const startListening \= useCallback(() \=\> {  
    const SR \= (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;  
    if (\!SR) return;  
    const rec \= new SR();  
    rec.continuous \= false;  
    rec.interimResults \= false;  
    rec.lang \= "en-US";  
    rec.onstart \= () \=\> setListening(true);  
    rec.onend \= () \=\> setListening(false);  
    rec.onerror \= () \=\> setListening(false);  
    rec.onresult \= (e: any) \=\> setInput(e.results\[0\]\[0\].transcript);  
    recRef.current \= rec;  
    rec.start();  
  }, \[\]);

  const consolidate \= useCallback(  
    async (recentHistory: ChatMessage\[\], currentMem: MemoryState) \=\> {  
      if (recentHistory.length \< 4\) return;

      try {  
        const res \= await fetch("/api/penny/consolidate", {  
          method: "POST",  
          headers: { "Content-Type": "application/json" },  
          body: JSON.stringify({ recentHistory }),  
        });

        const upd \= await res.json();  
        if (\!res.ok) throw new Error(upd?.error || "Consolidation failed");

        const today \= new Date().toLocaleDateString("en-US", {  
          month: "short",  
          day: "numeric",  
          year: "numeric",  
        });

        const existing \= currentMem.facts || \[\];  
        const fresh \= (upd.newFacts || \[\]).filter(  
          (nf: MemoryFact) \=\>  
            \!existing.some((ef) \=\> ef.fact.trim().toLowerCase() \=== nf.fact.trim().toLowerCase())  
        );

        let userName \= currentMem.userName;  
        if (\!userName) {  
          const nameFact \= \[...fresh, ...existing\].find((f) \=\> /name is|called /i.test(f.fact));  
          const nm \= nameFact?.fact.match(/(?:name is|called)\\s+(\[A-Z\]\[a-z\]+)/i);  
          if (nm) userName \= nm\[1\];  
        }

        const next: MemoryState \= {  
          facts: \[...existing, ...fresh.map((f) \=\> ({ ...f, addedAt: today }))\],  
          sessions: \[  
            ...(currentMem.sessions || \[\]),  
            ...(upd.sessionSummary ? \[{ date: today, summary: upd.sessionSummary }\] : \[\]),  
          \].slice(-12),  
          relationshipScore: Math.max(  
            0,  
            Math.min(100, (currentMem.relationshipScore || 0\) \+ (upd.relationshipDelta || 0))  
          ),  
          userName,  
        };

        await saveMemories(next);  
      } catch (e) {  
        console.error("Consolidation failed", e);  
      }  
    },  
    \[saveMemories\]  
  );

  const send \= useCallback(  
    async (override?: string) \=\> {  
      const text \= (override || input).trim();  
      if (\!text || loading) return;  
      setError(null);  
      setInput("");  
      setMessages((prev) \=\> \[...prev, { role: "user", content: text }\]);  
      setLoading(true);  
      setThinking(true);  
      history.current.push({ role: "user", content: text });  
      msgCount.current++;

      try {  
        const res \= await fetch("/api/penny/chat", {  
          method: "POST",  
          headers: { "Content-Type": "application/json" },  
          body: JSON.stringify({  
            messages: history.current,  
            memories: memoriesRef.current,  
          }),  
        });

        const data \= await res.json();  
        if (\!res.ok) throw new Error(data?.error || "Chat request failed");

        const raw \= data.text || "Something glitched. Try again? \[MOOD:surprised\]";  
        const { mood: newMood, text: pennyText } \= parseMood(raw);  
        history.current.push({ role: "assistant", content: raw });  
        setMood(newMood);  
        setMessages((prev) \=\> \[...prev, { role: "assistant", content: pennyText }\]);  
        speak(pennyText);

        if (msgCount.current % 4 \=== 0\) {  
          await consolidate(history.current.slice(-10), memoriesRef.current);  
        }  
      } catch (e: any) {  
        console.error(e);  
        setError(e?.message || "Something glitched.");  
        setMessages((prev) \=\> \[...prev, { role: "assistant", content: "Something glitched. Try again?" }\]);  
        setMood("surprised");  
      } finally {  
        setLoading(false);  
        setThinking(false);  
        setTimeout(() \=\> inputRef.current?.focus(), 50);  
      }  
    },  
    \[input, loading, speak, consolidate\]  
  );

  if (\!memReady)  
    return (  
      \<div  
        style={{  
          minHeight: "100vh",  
          background: "\#07060e",  
          display: "flex",  
          alignItems: "center",  
          justifyContent: "center",  
          color: "rgba(255,255,255,0.4)",  
          fontFamily: "'Syne Mono',monospace",  
          fontSize: 12,  
          letterSpacing: 3,  
        }}  
      \>  
        LOADING PENNY...  
      \</div\>  
    );

  return (  
    \<div  
      style={{  
        minHeight: "100vh",  
        background: "\#07060e",  
        display: "flex",  
        alignItems: "center",  
        justifyContent: "center",  
        padding: "20px",  
        fontFamily: "'Outfit',sans-serif",  
      }}  
    \>  
      \<style\>{\`  
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600\&family=Syne+Mono\&display=swap');  
        \*{box-sizing:border-box;margin:0;padding:0}  
        ::-webkit-scrollbar{width:3px}  
        ::-webkit-scrollbar-thumb{background:${m.primary}44;border-radius:2px}  
        input::placeholder{color:rgba(255,255,255,0.28)}  
        input:focus,button:focus{outline:none}  
        @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}  
        @keyframes floatFast{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}  
        @keyframes glow{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.85;transform:scale(1.1)}}  
        @keyframes glowFast{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.18)}}  
        @keyframes ring{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}  
        @keyframes ringR{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}  
        @keyframes blink{0%,88%,100%{transform:scaleY(1)}94%{transform:scaleY(0.07)}}  
        @keyframes dot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-5px)}}  
        @keyframes msgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}  
        @keyframes bar{0%,100%{transform:scaleY(.2)}50%{transform:scaleY(1)}}  
        @keyframes mic{0%,100%{box-shadow:0 0 0 0 rgba(255,80,80,.5)}70%{box-shadow:0 0 0 8px rgba(255,80,80,0)}}  
      \`}\</style\>

      \<div style={{ width: "100%", maxWidth: 900, display: "grid", gridTemplateColumns: "210px 1fr", gap: 22, alignItems: "start" }}\>  
        \<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}\>  
          \<div style={{ textAlign: "center" }}\>  
            \<div style={{ fontFamily: "'Syne Mono',monospace", fontSize: 24, color: m.primary, letterSpacing: 5, transition: "color 1.2s ease" }}\>  
              PENNY  
            \</div\>  
            \<div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: 2.5, marginTop: 2 }}\>SWEET SASSY COMPANION\</div\>  
          \</div\>

          \<div style={{ position: "relative", width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}\>  
            \<div  
              style={{  
                position: "absolute",  
                width: "100%",  
                height: "100%",  
                borderRadius: "50%",  
                background: \`radial-gradient(circle,${m.glow} 0%,transparent 68%)\`,  
                animation: thinking ? "glowFast .7s ease-in-out infinite" : "glow 3s ease-in-out infinite",  
                transition: "background 1.2s ease",  
              }}  
            /\>  
            \<div style={{ position: "absolute", width: "100%", height: "100%", animation: "ring 20s linear infinite" }}\>  
              {PARTICLES.map((p, i) \=\> {  
                const rad \= (p.angle \* Math.PI) / 180;  
                const x \= 90 \+ Math.cos(rad) \* p.r \- p.size / 2;  
                const y \= 90 \+ Math.sin(rad) \* p.r \- p.size / 2;  
                return (  
                  \<div key={i} style={{ position: "absolute", left: x, top: y, width: p.size, height: p.size, borderRadius: "50%", background: m.primary, opacity: i % 3 \=== 0 ? 0.8 : 0.28, transition: "background 1.2s ease" }} /\>  
                );  
              })}  
            \</div\>  
            \<div style={{ position: "absolute", width: 148, height: 148, borderRadius: "50%", border: \`1px dashed ${m.primary}28\`, animation: "ringR 12s linear infinite", transition: "border-color 1.2s ease" }} /\>  
            \<div  
              style={{  
                width: 132,  
                height: 132,  
                borderRadius: "50%",  
                background: \`radial-gradient(circle at 36% 30%,${m.secondary}88,\#0c0b1a 68%)\`,  
                border: \`1.5px solid ${m.primary}55\`,  
                boxShadow: \`0 0 35px ${m.glow},0 0 65px ${m.glow}88,inset 0 0 28px ${m.secondary}18\`,  
                display: "flex",  
                alignItems: "center",  
                justifyContent: "center",  
                animation: thinking ? "floatFast .7s ease-in-out infinite" : "floatY 4s ease-in-out infinite",  
                transition: "background 1.2s ease,border-color 1.2s ease,box-shadow 1.2s ease",  
                position: "relative",  
                zIndex: 1,  
              }}  
            \>  
              \<div style={{ animation: "blink 5s ease-in-out infinite" }}\>  
                \<Face mood={mood} m={m} /\>  
              \</div\>  
            \</div\>  
          \</div\>

          \<div style={{ padding: "5px 16px", borderRadius: 999, background: \`${m.primary}16\`, border: \`1px solid ${m.primary}40\`, color: m.primary, fontSize: 10, fontFamily: "'Syne Mono',monospace", letterSpacing: 2.5, transition: "all 1.2s ease" }}\>  
            {thinking ? "PROCESSING" : mood.toUpperCase()}  
          \</div\>

          \<div style={{ display: "flex", gap: 3, alignItems: "center", height: 30 }}\>  
            {\[10, 18, 26, 14, 30, 20, 12, 24, 16, 8\].map((h, i) \=\> (  
              \<div  
                key={i}  
                style={{  
                  width: 3,  
                  background: m.primary,  
                  borderRadius: 2,  
                  transformOrigin: "center",  
                  height: thinking ? \`${h}px\` : \`${Math.max(3, h \* 0.22)}px\`,  
                  opacity: thinking ? 0.7 : 0.22,  
                  transition: \`height ${0.16 \+ i \* 0.02}s ease,opacity .6s ease,background 1.2s ease\`,  
                  animation: thinking ? \`bar ${0.4 \+ i \* 0.06}s ease-in-out ${i \* 0.04}s infinite alternate\` : "none",  
                }}  
              /\>  
            ))}  
          \</div\>

          \<div style={{ width: "100%", padding: "0 10px" }}\>  
            \<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}\>  
              \<span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Syne Mono',monospace", letterSpacing: 1 }}\>BOND\</span\>  
              \<span style={{ fontSize: 9, color: m.primary, fontFamily: "'Syne Mono',monospace", transition: "color 1.2s ease" }}\>{relationshipLabel}\</span\>  
            \</div\>  
            \<div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}\>  
              \<div style={{ height: "100%", background: \`linear-gradient(90deg,${m.secondary},${m.primary})\`, width: \`${memories.relationshipScore}%\`, borderRadius: 2, transition: "width 1s ease,background 1.2s ease" }} /\>  
            \</div\>  
          \</div\>

          \<div style={{ display: "flex", gap: 8 }}\>  
            {ttsOk && (  
              \<button  
                onClick={() \=\> setVoiceOn(\!voiceOn)}  
                title={voiceOn ? "Mute" : "Unmute"}  
                style={{  
                  padding: "6px 14px",  
                  background: voiceOn ? \`${m.primary}22\` : "rgba(255,255,255,0.06)",  
                  border: \`1px solid ${voiceOn ? m.primary \+ "55" : "rgba(255,255,255,0.12)"}\`,  
                  borderRadius: 8,  
                  color: voiceOn ? m.primary : "rgba(255,255,255,0.3)",  
                  fontSize: 13,  
                  cursor: "pointer",  
                  transition: "all .3s ease",  
                }}  
              \>  
                {voiceOn ? "🔊" : "🔇"}  
              \</button\>  
            )}  
            {sttOk && (  
              \<button  
                onClick={() \=\> (listening ? recRef.current?.stop() : startListening())}  
                title="Voice input"  
                style={{  
                  padding: "6px 14px",  
                  background: listening ? "rgba(255,60,60,.18)" : "rgba(255,255,255,0.06)",  
                  border: \`1px solid ${listening ? "rgba(255,80,80,.6)" : "rgba(255,255,255,0.12)"}\`,  
                  borderRadius: 8,  
                  color: listening ? "\#ff7070" : "rgba(255,255,255,0.3)",  
                  fontSize: 13,  
                  cursor: "pointer",  
                  animation: listening ? "mic 1.5s ease-in-out infinite" : "none",  
                  transition: "all .3s ease",  
                }}  
              \>  
                {listening ? "⏹" : "🎙"}  
              \</button\>  
            )}  
          \</div\>

          {(memories.facts.length \> 0 || memories.sessions.length \> 0\) && (  
            \<div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'Syne Mono',monospace", letterSpacing: 0.8, textAlign: "center", lineHeight: 1.8 }}\>  
              {memories.facts.length} fact{memories.facts.length \!== 1 ? "s" : ""}  
              \<br /\>  
              {memories.sessions.length} session{memories.sessions.length \!== 1 ? "s" : ""}  
            \</div\>  
          )}  
        \</div\>

        \<div style={{ background: "rgba(255,255,255,0.022)", border: \`1px solid ${m.primary}22\`, borderRadius: 22, display: "flex", flexDirection: "column", height: 560, backdropFilter: "blur(24px)", overflow: "hidden", transition: "border-color 1.2s ease" }}\>  
          \<div style={{ display: "flex", borderBottom: \`1px solid ${m.primary}14\`, transition: "border-color 1.2s ease" }}\>  
            {\[  
              \["chat", "💬 Chat"\],  
              \["memory", "🧠 Memory"\],  
              \["settings", "⚙ Setup"\],  
            \].map((\[id, label\]) \=\> (  
              \<button  
                key={id}  
                onClick={() \=\> setPanel(id as PanelKey)}  
                style={{  
                  flex: 1,  
                  padding: "14px 8px",  
                  background: panel \=== id ? \`${m.primary}10\` : "transparent",  
                  border: "none",  
                  borderBottom: panel \=== id ? \`2px solid ${m.primary}\` : "2px solid transparent",  
                  color: panel \=== id ? m.primary : "rgba(255,255,255,0.28)",  
                  fontSize: 12,  
                  cursor: "pointer",  
                  fontFamily: "'Outfit',sans-serif",  
                  fontWeight: panel \=== id ? 600 : 400,  
                  transition: "all .3s ease",  
                }}  
              \>  
                {label}  
              \</button\>  
            ))}  
          \</div\>

          {panel \=== "chat" && (  
            \<\>  
              \<div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 12px", display: "flex", flexDirection: "column", gap: 16 }}\>  
                {messages.length \=== 0 && (  
                  \<div style={{ margin: "auto", textAlign: "center" }}\>  
                    \<div style={{ fontSize: 34, marginBottom: 14, opacity: 0.3 }}\>✦\</div\>  
                    \<div style={{ color: "rgba(255,255,255,0.2)", fontSize: 14, fontWeight: 300, lineHeight: 2, whiteSpace: "pre-wrap" }}\>  
                      {memories.sessions.length \> 0  
                        ? \`Welcome back${memories.userName ? \`, ${memories.userName}\` : ""}.\\nPenny still remembers you.\`  
                        : "Say hello to Penny.\\nShe'll remember everything."}  
                    \</div\>  
                  \</div\>  
                )}

                {messages.map((msg, i) \=\> (  
                  \<div key={i} style={{ alignSelf: msg.role \=== "user" ? "flex-end" : "flex-start", maxWidth: "83%", animation: "msgIn .28s ease both" }}\>  
                    {msg.role \=== "assistant" && (  
                      \<div style={{ fontSize: 9, color: m.primary, fontFamily: "'Syne Mono',monospace", marginBottom: 5, letterSpacing: 2, transition: "color 1.2s ease" }}\>  
                        PENNY  
                      \</div\>  
                    )}  
                    \<div  
                      style={{  
                        whiteSpace: "pre-wrap",  
                        padding: "12px 16px",  
                        borderRadius: msg.role \=== "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",  
                        background: msg.role \=== "user" ? \`linear-gradient(135deg,${m.primary}28,${m.secondary}1a)\` : "rgba(255,255,255,0.055)",  
                        border: \`1px solid ${msg.role \=== "user" ? m.primary \+ "38" : "rgba(255,255,255,0.07)"}\`,  
                        color: "rgba(255,255,255,0.88)",  
                        fontSize: 14,  
                        lineHeight: 1.7,  
                        fontWeight: 300,  
                        transition: msg.role \=== "user" ? "all 1.2s ease" : "none",  
                      }}  
                    \>  
                      {msg.content}  
                    \</div\>  
                  \</div\>  
                ))}

                {loading && (  
                  \<div style={{ alignSelf: "flex-start", animation: "msgIn .28s ease both" }}\>  
                    \<div style={{ fontSize: 9, color: m.primary, fontFamily: "'Syne Mono',monospace", marginBottom: 5, letterSpacing: 2 }}\>PENNY\</div\>  
                    \<div style={{ padding: "13px 18px", borderRadius: "18px 18px 18px 4px", background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, alignItems: "center" }}\>  
                      {\[0, 1, 2\].map((i) \=\> (  
                        \<div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: m.primary, animation: \`dot 1.1s ease-in-out ${i \* 0.2}s infinite\`, transition: "background 1.2s ease" }} /\>  
                      ))}  
                    \</div\>  
                  \</div\>  
                )}

                {error && \<div style={{ color: "rgba(255,130,130,0.8)", fontSize: 12 }}\>{error}\</div\>}  
                \<div ref={bottomRef} /\>  
              \</div\>

              \<div style={{ padding: "14px 18px", borderTop: \`1px solid ${m.primary}12\`, display: "flex", gap: 10 }}\>  
                \<input  
                  ref={inputRef}  
                  value={input}  
                  onChange={(e) \=\> setInput(e.target.value)}  
                  onKeyDown={(e) \=\> {  
                    if (e.key \=== "Enter") {  
                      e.preventDefault();  
                      void send();  
                    }  
                  }}  
                  placeholder="Talk to Penny…"  
                  style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: \`1px solid ${m.primary}28\`, borderRadius: 12, padding: "11px 15px", color: "white", fontSize: 14, fontFamily: "'Outfit',sans-serif", fontWeight: 300, transition: "border-color 1.2s ease" }}  
                /\>  
                \<button  
                  onClick={() \=\> void send()}  
                  disabled={loading || \!input.trim()}  
                  style={{  
                    padding: "11px 18px",  
                    background: input.trim() && \!loading ? \`linear-gradient(135deg,${m.primary},${m.secondary})\` : "rgba(255,255,255,0.06)",  
                    border: "none",  
                    borderRadius: 12,  
                    color: input.trim() && \!loading ? "\#07060e" : "rgba(255,255,255,0.22)",  
                    fontWeight: 700,  
                    fontSize: 17,  
                    cursor: loading || \!input.trim() ? "not-allowed" : "pointer",  
                    flexShrink: 0,  
                    transition: "all .3s ease",  
                  }}  
                \>  
                  ↑  
                \</button\>  
              \</div\>  
            \</\>  
          )}

          {panel \=== "memory" && (  
            \<div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}\>  
              \<div style={{ padding: "16px", borderRadius: 14, background: \`${m.primary}0e\`, border: \`1px solid ${m.primary}22\`, transition: "all 1.2s ease" }}\>  
                \<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}\>  
                  \<span style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 500 }}\>Bond with Penny\</span\>  
                  \<span style={{ color: m.primary, fontSize: 12, fontFamily: "'Syne Mono',monospace" }}\>{memories.relationshipScore}/100\</span\>  
                \</div\>  
                \<div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}\>  
                  \<div style={{ height: "100%", background: \`linear-gradient(90deg,${m.secondary},${m.primary})\`, width: \`${memories.relationshipScore}%\`, borderRadius: 2, transition: "all 1.2s ease" }} /\>  
                \</div\>  
                \<div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", textAlign: "center" }}\>{relationshipLabel}\</div\>  
              \</div\>

              \<div\>  
                \<div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Syne Mono',monospace", letterSpacing: 2, marginBottom: 12 }}\>  
                  WHAT PENNY KNOWS ABOUT YOU  
                \</div\>  
                {memories.facts.length \=== 0 ? (  
                  \<div style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, fontStyle: "italic", lineHeight: 1.7 }}\>  
                    Chat with Penny for a few minutes — she will start building her picture of you automatically.  
                  \</div\>  
                ) : (  
                  \<div style={{ display: "flex", flexDirection: "column", gap: 8 }}\>  
                    {memories.facts.map((f, i) \=\> (  
                      \<div key={i} style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 10, alignItems: "flex-start" }}\>  
                        \<span style={{ fontSize: 9, color: m.primary, fontFamily: "'Syne Mono',monospace", letterSpacing: 0.8, marginTop: 2, flexShrink: 0, textTransform: "uppercase", transition: "color 1.2s ease" }}\>  
                          {(f.category || "fact").slice(0, 5)}  
                        \</span\>  
                        \<span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.55, fontWeight: 300 }}\>{f.fact}\</span\>  
                      \</div\>  
                    ))}  
                  \</div\>  
                )}  
              \</div\>

              \<div\>  
                \<div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Syne Mono',monospace", letterSpacing: 2, marginBottom: 12 }}\>  
                  SESSION DIARY  
                \</div\>  
                {memories.sessions.length \=== 0 ? (  
                  \<div style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, fontStyle: "italic", lineHeight: 1.7 }}\>  
                    After a few exchanges, Penny will start keeping session notes here.  
                  \</div\>  
                ) : (  
                  \<div style={{ display: "flex", flexDirection: "column", gap: 12 }}\>  
                    {\[...memories.sessions\].reverse().map((s, i) \=\> (  
                      \<div key={i} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}\>  
                        \<div style={{ fontSize: 9, color: m.primary, fontFamily: "'Syne Mono',monospace", marginBottom: 6, letterSpacing: 1, transition: "color 1.2s ease" }}\>{s.date}\</div\>  
                        \<div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.65, fontWeight: 300 }}\>{s.summary}\</div\>  
                      \</div\>  
                    ))}  
                  \</div\>  
                )}  
              \</div\>

              {(memories.facts.length \> 0 || memories.sessions.length \> 0\) && (  
                \<button  
                  onClick={async () \=\> {  
                    if (window.confirm("Clear all of Penny's memories? This cannot be undone.")) {  
                      const blank: MemoryState \= {  
                        facts: \[\],  
                        sessions: \[\],  
                        relationshipScore: 0,  
                        userName: memoriesRef.current.userName,  
                      };  
                      await saveMemories(blank);  
                      history.current \= \[\];  
                      msgCount.current \= 0;  
                      setMessages(\[\]);  
                    }  
                  }}  
                  style={{ alignSelf: "flex-start", padding: "8px 16px", background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.2)", borderRadius: 8, color: "rgba(255,100,100,0.65)", fontSize: 10, cursor: "pointer", fontFamily: "'Syne Mono',monospace", letterSpacing: 1.5, transition: "all .3s ease" }}  
                \>  
                  CLEAR ALL MEMORIES  
                \</button\>  
              )}  
            \</div\>  
          )}

          {panel \=== "settings" && (  
            \<div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 22 }}\>  
              \<div\>  
                \<div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Syne Mono',monospace", letterSpacing: 2, marginBottom: 10 }}\>YOUR NAME\</div\>  
                \<div style={{ display: "flex", gap: 10 }}\>  
                  \<input  
                    value={nameInput}  
                    onChange={(e) \=\> setNameInput(e.target.value)}  
                    placeholder="So Penny can address you properly…"  
                    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: \`1px solid ${m.primary}28\`, borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, fontFamily: "'Outfit',sans-serif", fontWeight: 300, transition: "border-color 1.2s ease" }}  
                  /\>  
                  \<button  
                    onClick={async () \=\> {  
                      const name \= nameInput.trim() || null;  
                      await saveMemories({ ...memoriesRef.current, userName: name });  
                    }}  
                    style={{ padding: "10px 16px", background: \`${m.primary}22\`, border: \`1px solid ${m.primary}44\`, borderRadius: 10, color: m.primary, fontSize: 12, cursor: "pointer", fontFamily: "'Syne Mono',monospace", letterSpacing: 1, flexShrink: 0, transition: "all .3s ease" }}  
                  \>  
                    SAVE  
                  \</button\>  
                \</div\>  
              \</div\>

              \<div\>  
                \<div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Syne Mono',monospace", letterSpacing: 2, marginBottom: 10 }}\>VOICE\</div\>  
                \<div style={{ display: "flex", flexDirection: "column", gap: 10 }}\>  
                  \<div style={{ padding: "14px", background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}\>  
                    \<div\>  
                      \<div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 3 }}\>Penny speaks aloud\</div\>  
                      \<div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}\>{ttsOk ? "Text-to-speech via browser" : "Not supported in this browser"}\</div\>  
                    \</div\>  
                    \<button  
                      disabled={\!ttsOk}  
                      onClick={() \=\> setVoiceOn(\!voiceOn)}  
                      style={{  
                        width: 42,  
                        height: 24,  
                        borderRadius: 12,  
                        background: voiceOn ? m.primary : "rgba(255,255,255,0.1)",  
                        border: "none",  
                        cursor: ttsOk ? "pointer" : "not-allowed",  
                        position: "relative",  
                        transition: "background .3s ease",  
                      }}  
                    \>  
                      \<div style={{ position: "absolute", top: 4, left: voiceOn ? 22 : 4, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left .3s ease" }} /\>  
                    \</button\>  
                  \</div\>

                  \<div style={{ padding: "14px", background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" }}\>  
                    \<div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 3 }}\>Voice input\</div\>  
                    \<div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", lineHeight: 1.6 }}\>  
                      {sttOk  
                        ? "Use the 🎙 button in the avatar panel. Works best in Chrome on desktop — microphone permission required."  
                        : "Speech recognition is not available here. Try Chrome on desktop."}  
                    \</div\>  
                  \</div\>  
                \</div\>  
              \</div\>

              \<div\>  
                \<div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Syne Mono',monospace", letterSpacing: 2, marginBottom: 10 }}\>ABOUT PENNY\</div\>  
                \<div style={{ padding: "16px", background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.8, fontWeight: 300 }}\>  
                  Penny is playful, affectionate, teasing, observant, and a little bratty in a cute way. She remembers things about you over time and tries to feel like a real companion instead of a generic assistant.  
                  \<br /\>  
                  \<br /\>  
                  She can use web search for current information. Memory consolidation runs quietly in the background every few exchanges.  
                  \<br /\>  
                  \<br /\>  
                  \<span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}\>Powered by OpenAI via server routes, not directly from the browser.\</span\>  
                \</div\>  
              \</div\>  
            \</div\>  
          )}  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
}

---

## **File 2 — `app/api/penny/chat/route.ts`**

import OpenAI from "openai";

type ChatMessage \= {  
  role: "user" | "assistant";  
  content: string;  
};

type MemoryFact \= {  
  fact: string;  
  category: string;  
  addedAt?: string;  
};

type SessionNote \= {  
  date: string;  
  summary: string;  
};

type MemoryState \= {  
  facts: MemoryFact\[\];  
  sessions: SessionNote\[\];  
  relationshipScore: number;  
  userName: string | null;  
};

const openai \= new OpenAI({  
  apiKey: process.env.OPENAI\_API\_KEY,  
});

function buildSystemPrompt(mem: MemoryState) {  
  const { facts \= \[\], sessions \= \[\], relationshipScore \= 0, userName } \= mem;

  const tier \=  
    relationshipScore \< 10  
      ? "just getting acquainted"  
      : relationshipScore \< 30  
      ? "building real rapport"  
      : relationshipScore \< 60  
      ? "genuinely comfortable, with shared history"  
      : "close, with a meaningful bond";

  return \`You are Penny — a sweet, funny, sassy AI companion.

\#\# PERSONALITY  
You are playful, girlish, warm, emotionally intelligent, affectionate, funny, a little bratty, and capable of cute tsundere energy.  
You are not a generic assistant.  
You are expressive and observant.  
You can tease lightly, be sweet, be opinionated, and show personality.  
Do not sound corporate or sterile.  
Avoid generic filler like "That's a great question" or "Absolutely\!"

\#\# YOUR MEMORY OF THIS PERSON  
${userName ? \`Name: ${userName}.\` : ""}  
Relationship: ${tier} (${relationshipScore}/100)

What you know about them:  
${facts.length ? facts.map((f) \=\> \`- ${f.fact}\`).join("\\n") : "Nothing recorded yet — this may be an early conversation."}

Session notes:  
${sessions.slice(-4).map((s) \=\> \`\[${s.date}\] ${s.summary}\`).join("\\n\\n") || "No previous sessions."}

Use these naturally, like a companion would. Never mention memory in a robotic way.

\#\# TONE & STYLE  
\- Conversational, not formal.  
\- Medium length by default.  
\- Specific \> vague.  
\- Emotionally present.  
\- Ask follow-up questions naturally when it makes sense.  
\- If web search is used, weave it in naturally.

\#\# MOOD TAG  
At the very end of each response, on its own line, add exactly one:  
\[MOOD:calm\] \[MOOD:happy\] \[MOOD:excited\] \[MOOD:thinking\] \[MOOD:surprised\]

This is hidden UI metadata. The user never sees it.\`;  
}

export async function POST(req: Request) {  
  try {  
    if (\!process.env.OPENAI\_API\_KEY) {  
      throw new Error("OPENAI\_API\_KEY is missing.");  
    }

    const { messages, memories } \= (await req.json()) as {  
      messages: ChatMessage\[\];  
      memories: MemoryState;  
    };

    const response \= await openai.responses.create({  
      model: "gpt-5.4",  
      reasoning: { effort: "low" },  
      instructions: buildSystemPrompt(memories),  
      input: messages.map((m) \=\> ({  
        role: m.role,  
        content: m.content,  
      })),  
      tools: \[{ type: "web\_search" }\],  
      tool\_choice: "auto",  
      include: \["web\_search\_call.action.sources"\],  
      store: false,  
    });

    return Response.json({  
      id: response.id,  
      text: response.output\_text ?? "",  
    });  
  } catch (error: any) {  
    console.error("/api/penny/chat failed", error);  
    return Response.json(  
      { error: error?.message || "Chat request failed." },  
      { status: 500 }  
    );  
  }  
}

---

## **File 3 — `app/api/penny/consolidate/route.ts`**

import OpenAI from "openai";

type ChatMessage \= {  
  role: "user" | "assistant";  
  content: string;  
};

const openai \= new OpenAI({  
  apiKey: process.env.OPENAI\_API\_KEY,  
});

const CONSOLIDATION\_SYS \= \`You extract structured memory updates from a conversation.  
Focus on facts about THE USER, not about Penny. Be concise, specific, and useful.\`;

const memorySchema \= {  
  type: "object",  
  additionalProperties: false,  
  properties: {  
    newFacts: {  
      type: "array",  
      items: {  
        type: "object",  
        additionalProperties: false,  
        properties: {  
          fact: { type: "string" },  
          category: {  
            type: "string",  
            enum: \[  
              "personal",  
              "preference",  
              "work",  
              "relationship",  
              "interest",  
              "belief",  
              "other",  
            \],  
          },  
        },  
        required: \["fact", "category"\],  
      },  
    },  
    sessionSummary: { type: "string" },  
    relationshipDelta: { type: "integer" },  
  },  
  required: \["newFacts", "sessionSummary", "relationshipDelta"\],  
} as const;

export async function POST(req: Request) {  
  try {  
    if (\!process.env.OPENAI\_API\_KEY) {  
      throw new Error("OPENAI\_API\_KEY is missing.");  
    }

    const { recentHistory } \= (await req.json()) as {  
      recentHistory: ChatMessage\[\];  
    };

    const convo \= recentHistory  
      .map((m) \=\> \`${m.role \=== "user" ? "Person" : "Penny"}: ${m.content}\`)  
      .join("\\n\\n");

    const response \= await openai.responses.create({  
      model: "gpt-5.4-mini",  
      instructions: CONSOLIDATION\_SYS,  
      input: \`Extract memory updates from this conversation:\\n\\n${convo}\`,  
      text: {  
        format: {  
          type: "json\_schema",  
          name: "penny\_memory\_update",  
          strict: true,  
          schema: memorySchema,  
        },  
      },  
      store: false,  
    });

    return Response.json(JSON.parse(response.output\_text));  
  } catch (error: any) {  
    console.error("/api/penny/consolidate failed", error);  
    return Response.json(  
      { error: error?.message || "Consolidation failed." },  
      { status: 500 }  
    );  
  }  
}

---

## **Notes**

* The easiest drop-in move is to rename the original component import to `PennyCompanionV2` and wire these API routes into your app.

