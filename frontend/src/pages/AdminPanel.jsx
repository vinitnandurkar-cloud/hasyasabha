import { useState, useEffect } from "react";
import { getSocket } from "../socket.js";
import QuestionManager from "../components/QuestionManager.jsx";
import AnswerCard from "../components/AnswerCard.jsx";
import Timer from "../components/Timer.jsx";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export default function AdminPanel({ adminPassword }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [players, setPlayers] = useState([]);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [lastWinner, setLastWinner] = useState(null);

  // AI ranking state
  const [aiRankings, setAiRankings] = useState([]);   // [{ rank, index, name, answer, score, reason }]
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    const socket = getSocket();

    socket.on("admin-auth-success", ({ gameState }) => {
      setQuestions(gameState.questions || []);
      setAnswers(gameState.answers || []);
      setActiveQuestion(gameState.activeQuestion || null);
      setPlayers(gameState.players || []);
      setLastWinner(gameState.lastWinner || null);
    });

    socket.on("questions-updated", ({ questions }) => setQuestions(questions));

    socket.on("new-answer", (answer) => {
      setAnswers((prev) => [...prev, answer]);
    });

    socket.on("players-updated", ({ players }) => setPlayers(players));

    socket.on("timer-update", ({ secondsLeft }) => setSecondsLeft(secondsLeft));
    socket.on("timer-expired", () => setSecondsLeft(0));

    socket.on("winner-selected", (data) => {
      setLastWinner(data);
      setActiveQuestion(null);
      setAnswers([]);
      setAiRankings([]);
    });

    socket.on("question-active", ({ question, timerDuration }) => {
      setActiveQuestion(question);
      setSecondsLeft(timerDuration);
      setAnswers([]);
      setAiRankings([]);
      setAiError("");
    });

    socket.on("connect", () => {
      if (adminPassword) socket.emit("admin-auth", { password: adminPassword });
    });

    return () => {
      socket.off("admin-auth-success");
      socket.off("questions-updated");
      socket.off("new-answer");
      socket.off("players-updated");
      socket.off("timer-update");
      socket.off("timer-expired");
      socket.off("winner-selected");
      socket.off("question-active");
      socket.off("connect");
    };
  }, [adminPassword]);

  const addQuestion = () => {
    if (!newQuestionText.trim()) return;
    getSocket().emit("add-question", { text: newQuestionText.trim() });
    setNewQuestionText("");
  };

  const activateQuestion = (id) => getSocket().emit("activate-question", { id });
  const deleteQuestion = (id) => getSocket().emit("delete-question", { id });
  const editQuestion = (id, text) => getSocket().emit("edit-question", { id, text });

  const selectWinner = (answerIndex) => {
    if (!window.confirm("Select this as the winning answer?")) return;
    getSocket().emit("select-winner", { answerIndex });
  };

  const currentAnswers = answers.filter((a) =>
    activeQuestion ? a.questionId === activeQuestion.id : true
  );

  // ── AI: rank top 3 answers ─────────────────────────────────
  const rankAnswers = async () => {
    if (currentAnswers.length === 0) return;
    setAiLoading(true);
    setAiError("");
    setAiRankings([]);
    try {
      const res = await fetch(`${BACKEND_URL}/api/rank-answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: currentAnswers,
          question: activeQuestion?.text || "Unknown question",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiRankings(data.rankings || []);
    } catch (e) {
      setAiError("AI ranking failed: " + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  // ── CSV export ─────────────────────────────────────────────
  const exportCSV = () => {
    window.open(`${BACKEND_URL}/api/export-csv`, "_blank");
  };

  // Map answerIndex → AI rank (1/2/3) for highlighting
  const aiRankMap = {};
  for (const r of aiRankings) {
    // r.index is 1-based position in currentAnswers
    const ans = currentAnswers[r.index - 1];
    if (ans) aiRankMap[ans.answerIndex] = r;
  }

  const leaderboard = players.filter((p) => p.wins > 0);
  const overallLeader = leaderboard[0] || null;

  const rankColors = {
    1: { border: "#FFD700", bg: "#FFFDE7", badge: "#F9A825", label: "🥇 #1 Funniest" },
    2: { border: "#9E9E9E", bg: "#FAFAFA", badge: "#757575", label: "🥈 #2 Witty"    },
    3: { border: "#CD7F32", bg: "#FFF3E0", badge: "#E65100", label: "🥉 #3 Clever"   },
  };

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>🎭 HasyaSabha</h1>
          <p style={styles.headerSub}>Admin Panel</p>
        </div>
        <div style={styles.stats}>
          <div style={styles.statBadge}>👥 {players.length} players</div>
          {activeQuestion && <Timer secondsLeft={secondsLeft} compact />}
          <button style={styles.csvBtn} onClick={exportCSV} title="Download all answers as CSV">
            📥 Export CSV
          </button>
        </div>
      </div>

      <div style={styles.columns}>
        {/* Left: Questions + Players */}
        <div style={styles.leftCol}>
          <h2 style={styles.sectionTitle}>📋 प्रश्न | Questions</h2>

          <div style={styles.addBox}>
            <textarea
              style={styles.addInput}
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              placeholder="नवीन प्रश्न लिहा... / Type a new question..."
              rows={2}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), addQuestion())}
            />
            <button style={styles.addBtn} onClick={addQuestion}>+ Add Question</button>
          </div>

          <QuestionManager
            questions={questions}
            activeQuestionId={activeQuestion?.id}
            onActivate={activateQuestion}
            onDelete={deleteQuestion}
            onEdit={editQuestion}
          />

          {/* Players & Leaderboard */}
          <div style={styles.playersSection}>
            {overallLeader && (
              <div style={styles.leaderBanner}>
                <span style={styles.leaderCrown}>👑</span>
                <div>
                  <p style={styles.leaderLabel}>सध्याचे आघाडीचे | Current Leader</p>
                  <p style={styles.leaderName}>{overallLeader.name}</p>
                  <p style={styles.leaderWins}>{overallLeader.wins} win{overallLeader.wins !== 1 ? "s" : ""}</p>
                </div>
              </div>
            )}
            <h3 style={styles.playerListTitle}>
              🟢 Online Players
              <span style={styles.playerCountBadge}>{players.length}</span>
            </h3>
            {players.length === 0 ? (
              <p style={styles.noPlayers}>Waiting for players to join...</p>
            ) : (
              <div style={styles.playerList}>
                {players.map((p, i) => (
                  <div key={p.name} style={styles.playerRow}>
                    <span style={styles.playerRank}>
                      {p.wins > 0 ? (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏅") : "•"}
                    </span>
                    <span style={styles.playerName}>{p.name}</span>
                    {p.wins > 0 && <span style={styles.winBadge}>🏆 {p.wins}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Answers */}
        <div style={styles.rightCol}>
          <div style={styles.answersHeader}>
            <h2 style={styles.sectionTitle}>
              💬 उत्तरे | Answers
              {currentAnswers.length > 0 && (
                <span style={styles.answerCount}>{currentAnswers.length}</span>
              )}
            </h2>

            {/* AI Rank button */}
            {currentAnswers.length >= 2 && (
              <button
                style={{ ...styles.aiBtn, ...(aiLoading ? styles.aiBtnLoading : {}) }}
                onClick={rankAnswers}
                disabled={aiLoading}
              >
                {aiLoading ? "🤖 Thinking..." : "🤖 AI Top 3"}
              </button>
            )}
          </div>

          {activeQuestion && (
            <div style={styles.activeQBox}>
              <p style={styles.activeQLabel}>Active Question</p>
              <p style={styles.activeQText}>{activeQuestion.text}</p>
              {activeQuestion.textMr && (
                <p style={styles.activeQTextMr}>{activeQuestion.textMr}</p>
              )}
            </div>
          )}

          {/* AI error */}
          {aiError && <div style={styles.aiError}>{aiError}</div>}

          {/* AI Top 3 summary strip */}
          {aiRankings.length > 0 && (
            <div style={styles.aiSummary}>
              <p style={styles.aiSummaryTitle}>🤖 AI Rankings</p>
              {aiRankings.map((r) => (
                <div key={r.rank} style={{ ...styles.aiSummaryRow, borderLeft: `4px solid ${rankColors[r.rank]?.border || "#ccc"}` }}>
                  <span style={styles.aiSummaryRank}>{rankColors[r.rank]?.label}</span>
                  <span style={styles.aiSummaryName}>{r.name}</span>
                  <span style={styles.aiSummaryScore}>⭐ {r.score}/10</span>
                  <p style={styles.aiSummaryReason}>"{r.reason}"</p>
                </div>
              ))}
            </div>
          )}

          {!activeQuestion && !lastWinner && (
            <div style={styles.emptyState}>
              <p style={styles.emptyIcon}>🎯</p>
              <p>Activate a question to see answers stream in here.</p>
            </div>
          )}

          {lastWinner && !activeQuestion && (
            <div style={styles.lastWinnerBox}>
              <p style={styles.lwLabel}>🏆 Last Winner</p>
              <p style={styles.lwName}>{lastWinner.realWinnerName || lastWinner.winnerName}</p>
              <p style={styles.lwAnswer}>"{lastWinner.answerText}"</p>
            </div>
          )}

          <div style={styles.answerList}>
            {currentAnswers.map((answer, i) => {
              const aiRank = aiRankMap[answer.answerIndex];
              const rc = aiRank ? rankColors[aiRank.rank] : null;
              return (
                <div key={`${answer.answerIndex ?? i}-${answer.text}`}>
                  {/* AI rank badge above card */}
                  {aiRank && (
                    <div style={{ ...styles.rankBadge, background: rc.badge }}>
                      {rc.label} &nbsp;·&nbsp; ⭐ {aiRank.score}/10
                    </div>
                  )}
                  <div style={aiRank ? { border: `3px solid ${rc.border}`, borderRadius: "14px", background: rc.bg } : {}}>
                    <AnswerCard
                      answer={answer}
                      onSelectWinner={() => selectWinner(answer.answerIndex ?? i)}
                      aiReason={aiRank?.reason}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  panel: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #1B5E20 0%, #2E7D32 60%, #1B5E20 100%)",
    color: "white",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "16px 24px",
    background: "rgba(0,0,0,0.35)",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  headerTitle: { margin: 0, fontSize: "22px", fontWeight: "800" },
  headerSub: { margin: "2px 0 0 0", fontSize: "12px", opacity: 0.6, letterSpacing: "2px", textTransform: "uppercase" },
  stats: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  statBadge: {
    background: "rgba(255,255,255,0.2)", padding: "7px 14px",
    borderRadius: "20px", fontSize: "14px", fontWeight: "600",
  },
  csvBtn: {
    background: "rgba(255,255,255,0.15)", color: "white",
    border: "1px solid rgba(255,255,255,0.3)",
    padding: "7px 14px", borderRadius: "20px",
    fontSize: "13px", fontWeight: "600", cursor: "pointer",
  },
  columns: {
    display: "flex", gap: "20px", padding: "24px",
    flexWrap: "wrap", alignItems: "flex-start",
  },
  leftCol: { flex: "1", minWidth: "300px" },
  rightCol: { flex: "1", minWidth: "300px" },
  sectionTitle: {
    fontSize: "17px", margin: "0 0 16px 0",
    display: "flex", alignItems: "center", gap: "8px", fontWeight: "700",
  },
  answerCount: {
    background: "#FF6B00", borderRadius: "12px",
    padding: "2px 10px", fontSize: "13px", fontWeight: "700",
  },
  addBox: { marginBottom: "16px" },
  addInput: {
    width: "100%", padding: "10px 12px", borderRadius: "10px",
    border: "none", fontSize: "14px", fontFamily: "inherit",
    boxSizing: "border-box", resize: "vertical", marginBottom: "8px", outline: "none",
  },
  addBtn: {
    background: "#FF6B00", color: "white", border: "none",
    padding: "10px 20px", borderRadius: "8px",
    cursor: "pointer", fontSize: "14px", fontWeight: "700",
  },

  // Players
  playersSection: { marginTop: "28px" },
  leaderBanner: {
    display: "flex", alignItems: "center", gap: "14px",
    background: "rgba(255,215,0,0.15)", border: "2px solid rgba(255,215,0,0.5)",
    borderRadius: "14px", padding: "14px 18px", marginBottom: "16px",
  },
  leaderCrown: { fontSize: "36px", flexShrink: 0 },
  leaderLabel: { margin: "0 0 2px 0", fontSize: "10px", color: "rgba(255,215,0,0.7)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" },
  leaderName: { margin: "0 0 2px 0", fontSize: "20px", fontWeight: "800", color: "#FFD700" },
  leaderWins: { margin: 0, fontSize: "13px", color: "rgba(255,215,0,0.8)" },
  playerListTitle: { fontSize: "14px", fontWeight: "700", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "8px", opacity: 0.85 },
  playerCountBadge: { background: "rgba(255,255,255,0.2)", borderRadius: "10px", padding: "1px 8px", fontSize: "12px" },
  noPlayers: { fontSize: "13px", color: "rgba(255,255,255,0.4)", fontStyle: "italic", margin: 0 },
  playerList: { display: "flex", flexDirection: "column", gap: "6px" },
  playerRow: { display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.08)", borderRadius: "8px", padding: "8px 12px" },
  playerRank: { fontSize: "16px", width: "20px", textAlign: "center", flexShrink: 0 },
  playerName: { fontSize: "14px", fontWeight: "600", flex: 1 },
  winBadge: { background: "rgba(255,215,0,0.2)", color: "#FFD700", fontSize: "12px", fontWeight: "700", padding: "2px 8px", borderRadius: "10px", flexShrink: 0 },

  // Answers header row
  answersHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0px" },

  // AI button
  aiBtn: {
    background: "linear-gradient(135deg, #6A1B9A, #AB47BC)",
    color: "white", border: "none",
    padding: "9px 18px", borderRadius: "20px",
    fontSize: "14px", fontWeight: "700", cursor: "pointer",
    boxShadow: "0 4px 14px rgba(106,27,154,0.4)",
    whiteSpace: "nowrap",
  },
  aiBtnLoading: { opacity: 0.7, cursor: "not-allowed" },
  aiError: {
    background: "#FFEBEE", color: "#B71C1C",
    borderRadius: "10px", padding: "10px 14px",
    fontSize: "13px", marginBottom: "12px",
  },

  // AI summary strip
  aiSummary: {
    background: "rgba(106,27,154,0.2)", border: "2px solid rgba(171,71,188,0.5)",
    borderRadius: "12px", padding: "14px 16px", marginBottom: "16px",
  },
  aiSummaryTitle: { margin: "0 0 10px 0", fontSize: "13px", fontWeight: "700", color: "#CE93D8", textTransform: "uppercase", letterSpacing: "1px" },
  aiSummaryRow: {
    padding: "8px 10px", marginBottom: "8px",
    background: "rgba(255,255,255,0.06)", borderRadius: "8px",
    paddingLeft: "12px",
  },
  aiSummaryRank: { fontSize: "13px", fontWeight: "700", color: "#FFD700", display: "block" },
  aiSummaryName: { fontSize: "13px", color: "white", fontWeight: "600" },
  aiSummaryScore: { fontSize: "12px", color: "#CE93D8", marginLeft: "8px" },
  aiSummaryReason: { margin: "4px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.65)", fontStyle: "italic" },

  // Answer rank badge
  rankBadge: {
    color: "white", fontSize: "12px", fontWeight: "700",
    padding: "5px 14px", borderRadius: "8px 8px 0 0",
    display: "inline-block",
  },

  activeQBox: {
    background: "rgba(255,179,0,0.15)", border: "2px solid #FFB300",
    borderRadius: "12px", padding: "14px", marginBottom: "16px",
  },
  activeQLabel: { margin: "0 0 6px 0", fontSize: "11px", color: "#FFB300", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" },
  activeQText: { margin: "0 0 6px 0", fontSize: "15px", fontWeight: "600" },
  activeQTextMr: { margin: 0, fontSize: "13px", color: "#FFD180", fontStyle: "italic", borderTop: "1px dashed rgba(255,179,0,0.4)", paddingTop: "6px" },
  emptyState: { color: "rgba(255,255,255,0.45)", fontSize: "14px", textAlign: "center", marginTop: "50px", lineHeight: "1.6" },
  emptyIcon: { fontSize: "40px", marginBottom: "8px" },
  lastWinnerBox: {
    background: "rgba(255,215,0,0.12)", border: "2px solid rgba(255,215,0,0.5)",
    borderRadius: "12px", padding: "16px", marginBottom: "16px",
  },
  lwLabel: { margin: "0 0 6px 0", fontSize: "12px", color: "gold", textTransform: "uppercase", fontWeight: "700" },
  lwName: { margin: "0 0 6px 0", fontSize: "18px", fontWeight: "700", color: "gold" },
  lwAnswer: { margin: 0, fontSize: "15px", fontStyle: "italic", color: "rgba(255,255,255,0.8)" },
  answerList: { display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px" },
};
