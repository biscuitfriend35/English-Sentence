import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "eng_sentence_cards_v1";

const SYSTEM_PROMPT = `You are an English expression coach for Korean speakers. 
When given a Korean sentence the user wanted to say in English, respond ONLY with a JSON object (no markdown, no backticks) like this:
{
  "english": "The natural English sentence",
  "explanation": "한국어로 2-3문장: 왜 이 표현을 쓰는지, 어떤 상황에 적합한지",
  "alternatives": ["similar expression 1", "similar expression 2"],
  "level": "casual|neutral|formal"
}
Make the English natural and conversational, not overly literal.`;

async function translateWithClaude(koreanText) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: koreanText }],
    }),
  });
  const data = await res.json();
  const raw = data.content?.find((b) => b.type === "text")?.text || "{}";
  return JSON.parse(raw);
}

const LEVEL_META = {
  casual:  { label: "캐주얼",  color: "#f59e0b", bg: "#fffbeb" },
  neutral: { label: "일반",    color: "#3b82f6", bg: "#eff6ff" },
  formal:  { label: "격식",    color: "#8b5cf6", bg: "#f5f3ff" },
};

// ── Card component ─────────────────────────────────────────────
function Card({ card, onDelete }) {
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState("ko2en"); // ko2en | en2ko
  const lm = LEVEL_META[card.level] || LEVEL_META.neutral;

  return (
    <div style={{ marginBottom: 16 }}>
      {/* mode toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
        <button
          onClick={() => { setMode("ko2en"); setFlipped(false); }}
          style={{
            fontSize: "0.65rem", padding: "2px 8px", borderRadius: 20, border: "1px solid #ddd",
            background: mode === "ko2en" ? "#111" : "#fff",
            color: mode === "ko2en" ? "#fff" : "#888", cursor: "pointer",
          }}
        >한→영</button>
        <button
          onClick={() => { setMode("en2ko"); setFlipped(false); }}
          style={{
            fontSize: "0.65rem", padding: "2px 8px", borderRadius: 20, border: "1px solid #ddd",
            background: mode === "en2ko" ? "#111" : "#fff",
            color: mode === "en2ko" ? "#fff" : "#888", cursor: "pointer",
          }}
        >영→한</button>
        <span style={{
          marginLeft: "auto", fontSize: "0.6rem", padding: "2px 8px",
          borderRadius: 20, background: lm.bg, color: lm.color, border: `1px solid ${lm.color}44`,
        }}>{lm.label}</span>
        <button
          onClick={() => onDelete(card.id)}
          style={{ background: "none", border: "none", color: "#ddd", cursor: "pointer", fontSize: "0.8rem", padding: "0 2px" }}
          title="삭제"
        >✕</button>
      </div>

      {/* flip card */}
      <div
        onClick={() => setFlipped(!flipped)}
        style={{
          background: flipped ? "#f8fffe" : "#fff",
          border: `1.5px solid ${flipped ? "#a7f3d0" : "#e5e7eb"}`,
          borderRadius: 12, padding: "20px 22px", cursor: "pointer",
          transition: "all 0.18s ease", minHeight: 90,
          boxShadow: flipped ? "0 4px 20px #10b98115" : "0 1px 4px #0001",
        }}
      >
        {/* FRONT */}
        {!flipped && (
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "#111", lineHeight: 1.5 }}>
              {mode === "ko2en" ? card.korean : card.english}
            </div>
            <div style={{ marginTop: 8, fontSize: "0.7rem", color: "#bbb" }}>
              탭해서 {mode === "ko2en" ? "영어" : "한국어"} 확인 →
            </div>
          </div>
        )}

        {/* BACK */}
        {flipped && (
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#059669", lineHeight: 1.5 }}>
              {mode === "ko2en" ? card.english : card.korean}
            </div>
            {card.explanation && (
              <div style={{
                marginTop: 12, padding: "10px 14px", background: "#f0fdf4",
                borderRadius: 8, fontSize: "0.78rem", color: "#374151", lineHeight: 1.65,
              }}>
                {card.explanation}
              </div>
            )}
            {card.alternatives?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginBottom: 4 }}>비슷한 표현</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {card.alternatives.map((a, i) => (
                    <span key={i} style={{
                      fontSize: "0.78rem", padding: "3px 10px",
                      background: "#ecfdf5", color: "#065f46",
                      border: "1px solid #a7f3d0", borderRadius: 20,
                    }}>{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Study mode ──────────────────────────────────────────────────
function StudyMode({ cards, onExit }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState("ko2en");
  const [scores, setScores] = useState({ know: 0, unsure: 0 });

  if (!cards.length) return (
    <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
      저장된 카드가 없어요.<br />
      <button onClick={onExit} style={btnStyle("#111", "#fff")}>← 돌아가기</button>
    </div>
  );

  const card = cards[idx];
  const lm = LEVEL_META[card.level] || LEVEL_META.neutral;
  const progress = ((idx) / cards.length) * 100;

  const handleScore = (know) => {
    setScores(s => ({ ...s, [know ? "know" : "unsure"]: s[know ? "know" : "unsure"] + 1 }));
    if (idx + 1 < cards.length) { setIdx(i => i + 1); setFlipped(false); }
    else setIdx(cards.length); // done
  };

  if (idx >= cards.length) return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🎉</div>
      <div style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>학습 완료!</div>
      <div style={{ color: "#6b7280", marginBottom: 24, fontSize: "0.9rem" }}>
        알겠어요 {scores.know}개 · 헷갈려요 {scores.unsure}개
      </div>
      <button onClick={onExit} style={btnStyle("#111", "#fff")}>← 목록으로</button>
    </div>
  );

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 4px" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20, gap: 12 }}>
        <button onClick={onExit} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "1rem" }}>←</button>
        <div style={{ flex: 1, height: 6, background: "#f3f4f6", borderRadius: 99 }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "#10b981", borderRadius: 99, transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: "0.75rem", color: "#9ca3af", whiteSpace: "nowrap" }}>{idx + 1} / {cards.length}</div>
      </div>

      {/* mode */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["ko2en", "en2ko"].map(m => (
          <button key={m} onClick={() => { setStudyMode(m); setFlipped(false); }} style={{
            fontSize: "0.7rem", padding: "4px 12px", borderRadius: 20, border: "1px solid #ddd",
            background: studyMode === m ? "#111" : "#fff",
            color: studyMode === m ? "#fff" : "#888", cursor: "pointer",
          }}>{m === "ko2en" ? "한→영" : "영→한"}</button>
        ))}
        <span style={{
          marginLeft: "auto", fontSize: "0.65rem", padding: "4px 10px",
          borderRadius: 20, background: lm.bg, color: lm.color, border: `1px solid ${lm.color}44`,
        }}>{lm.label}</span>
      </div>

      {/* card */}
      <div
        onClick={() => setFlipped(true)}
        style={{
          background: flipped ? "#f0fdf4" : "#fff",
          border: `2px solid ${flipped ? "#6ee7b7" : "#e5e7eb"}`,
          borderRadius: 20, padding: "36px 28px",
          minHeight: 200, cursor: flipped ? "default" : "pointer",
          display: "flex", flexDirection: "column", justifyContent: "center",
          boxShadow: "0 4px 24px #0001", transition: "all 0.2s",
        }}
      >
        {!flipped ? (
          <>
            <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: 12 }}>
              {studyMode === "ko2en" ? "이 문장을 영어로 말하면?" : "이 영어 문장의 뜻은?"}
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 600, color: "#111", lineHeight: 1.6 }}>
              {studyMode === "ko2en" ? card.korean : card.english}
            </div>
            <div style={{ marginTop: 20, fontSize: "0.72rem", color: "#d1d5db" }}>탭해서 정답 확인</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: "0.7rem", color: "#059669", marginBottom: 12 }}>정답</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#065f46", lineHeight: 1.6 }}>
              {studyMode === "ko2en" ? card.english : card.korean}
            </div>
            {card.explanation && (
              <div style={{ marginTop: 16, fontSize: "0.78rem", color: "#374151", lineHeight: 1.65, borderTop: "1px solid #d1fae5", paddingTop: 14 }}>
                {card.explanation}
              </div>
            )}
            {card.alternatives?.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {card.alternatives.map((a, i) => (
                  <span key={i} style={{ fontSize: "0.75rem", padding: "3px 10px", background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", borderRadius: 20 }}>{a}</span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* score buttons */}
      {flipped && (
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button onClick={() => handleScore(false)} style={btnStyle("#fee2e2", "#dc2626", "1px solid #fca5a5")}>
            🤔 헷갈려요
          </button>
          <button onClick={() => handleScore(true)} style={btnStyle("#d1fae5", "#059669", "1px solid #6ee7b7")}>
            ✓ 알겠어요
          </button>
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 20, fontSize: "0.75rem", color: "#9ca3af" }}>
        <span>알겠어요 {scores.know}</span>
        <span>헷갈려요 {scores.unsure}</span>
      </div>
    </div>
  );
}

function btnStyle(bg, color, border = "none") {
  return {
    flex: 1, padding: "12px 0", borderRadius: 12, border, background: bg, color,
    fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", transition: "opacity 0.15s",
  };
}

// ── Main App ────────────────────────────────────────────────────
export default function App() {
  const [cards, setCards] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("list"); // list | study
  const [filter, setFilter] = useState("all");
  const inputRef = useRef(null);

  // Load persisted cards
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        if (r?.value) setCards(JSON.parse(r.value));
      } catch {}
    })();
  }, []);

  // Persist on change
  useEffect(() => {
    if (!cards.length) return;
    window.storage.set(STORAGE_KEY, JSON.stringify(cards)).catch(() => {});
  }, [cards]);

  const handleAdd = async () => {
    const text = input.trim();
    if (!text) return;
    setLoading(true);
    setError("");
    try {
      const result = await translateWithClaude(text);
      const newCard = {
        id: Date.now(),
        korean: text,
        english: result.english || "",
        explanation: result.explanation || "",
        alternatives: result.alternatives || [],
        level: result.level || "neutral",
        createdAt: new Date().toISOString(),
      };
      setCards(prev => [newCard, ...prev]);
      setInput("");
      inputRef.current?.focus();
    } catch (e) {
      setError("번역 중 오류가 발생했어요. 다시 시도해주세요.");
    }
    setLoading(false);
  };

  const handleDelete = (id) => {
    setCards(prev => {
      const next = prev.filter(c => c.id !== id);
      window.storage.set(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const filteredCards = filter === "all" ? cards
    : cards.filter(c => c.level === filter);

  if (view === "study") return (
    <div style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", padding: "24px 16px", minHeight: "100vh", background: "#fafafa" }}>
      <StudyMode cards={filteredCards} onExit={() => setView("list")} />
    </div>
  );

  return (
    <div style={{
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
      minHeight: "100vh", background: "#fafafa", padding: "0 0 80px",
    }}>
      {/* Header */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #f0f0f0",
        padding: "20px 20px 16px", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#111" }}>💬 영어 문장 카드</div>
            <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>{cards.length}개</div>
          </div>

          {/* Input */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && handleAdd()}
              placeholder="말하고 싶었던 한국어 문장을 입력하세요"
              disabled={loading}
              style={{
                flex: 1, padding: "12px 16px", borderRadius: 12,
                border: "1.5px solid #e5e7eb", fontSize: "0.92rem",
                outline: "none", background: loading ? "#fafafa" : "#fff",
                transition: "border-color 0.15s",
              }}
              onFocus={e => e.target.style.borderColor = "#10b981"}
              onBlur={e => e.target.style.borderColor = "#e5e7eb"}
            />
            <button
              onClick={handleAdd}
              disabled={loading || !input.trim()}
              style={{
                padding: "12px 18px", borderRadius: 12, border: "none",
                background: loading || !input.trim() ? "#e5e7eb" : "#111",
                color: loading || !input.trim() ? "#9ca3af" : "#fff",
                fontWeight: 700, fontSize: "0.9rem", cursor: loading ? "wait" : "pointer",
                transition: "all 0.15s", whiteSpace: "nowrap",
              }}
            >
              {loading ? "번역 중…" : "추가"}
            </button>
          </div>

          {error && <div style={{ marginTop: 8, fontSize: "0.78rem", color: "#ef4444" }}>{error}</div>}
        </div>
      </div>

      {/* Controls */}
      <div style={{ maxWidth: 520, margin: "16px auto 0", padding: "0 16px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* filter */}
          {["all", "casual", "neutral", "formal"].map(f => {
            const lm = f === "all" ? { label: "전체", color: "#374151", bg: "#f3f4f6" } : LEVEL_META[f];
            const active = filter === f;
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                fontSize: "0.7rem", padding: "4px 12px", borderRadius: 20, cursor: "pointer",
                border: active ? `1.5px solid ${lm.color}` : "1px solid #e5e7eb",
                background: active ? lm.bg : "#fff",
                color: active ? lm.color : "#9ca3af",
                fontWeight: active ? 700 : 400,
              }}>{lm.label} {f === "all" ? cards.length : cards.filter(c => c.level === f).length}</button>
            );
          })}
          {filteredCards.length > 0 && (
            <button onClick={() => setView("study")} style={{
              marginLeft: "auto", fontSize: "0.78rem", padding: "6px 14px", borderRadius: 20,
              border: "none", background: "#111", color: "#fff", cursor: "pointer", fontWeight: 600,
            }}>학습 시작 →</button>
          )}
        </div>
      </div>

      {/* Card list */}
      <div style={{ maxWidth: 520, margin: "16px auto 0", padding: "0 16px" }}>
        {filteredCards.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#d1d5db" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: "0.9rem" }}>말하고 싶었던 문장을 입력해보세요</div>
          </div>
        ) : (
          filteredCards.map(card => (
            <Card key={card.id} card={card} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}
