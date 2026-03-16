import { useState, useEffect } from "react";
import { getSocket } from "../socket.js";
import Timer from "../components/Timer.jsx";
import WinnerModal from "../components/WinnerModal.jsx";

// Sub-states: "lobby" | "answering" | "voting" | "winner"

export default function PlayerGame({ playerName }) {
  const [subState, setSubState] = useState("lobby");
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [answerText, setAnswerText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState([]);       // live answer list for voting
  const [myVote, setMyVote] = useState(null);        // answerIndex I voted for
  const [voteError, setVoteError] = useState("");
  const [translatedAnswer, setTranslatedAnswer] = useState("");
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    socket.on("question-active", ({ question, timerDuration }) => {
      setActiveQuestion(question);
      setSecondsLeft(timerDuration);
      setAnswerText("");
      setAnonymous(false);
      setError("");
      setWinner(null);
      setAnswers([]);
      setMyVote(null);
      setVoteError("");
      setTranslatedAnswer("");
      setSubState("answering");
    });

    socket.on("timer-update", ({ secondsLeft }) => {
      setSecondsLeft(secondsLeft);
    });

    socket.on("timer-expired", () => {
      setSubState((prev) => (prev === "answering" ? "voting" : prev));
    });

    socket.on("answer-submitted", () => {
      setSubState("voting");
    });

    socket.on("answer-error", ({ message }) => {
      setError(message);
    });

    socket.on("answers-updated", ({ answers }) => {
      setAnswers(answers);
    });

    socket.on("vote-error", ({ message }) => {
      setVoteError(message);
      setTimeout(() => setVoteError(""), 3000);
    });

    socket.on("winner-selected", (data) => {
      setWinner(data);
      setSubState("winner");
    });

    socket.on("game-state", ({ activeQuestion, lastWinner, answers }) => {
      if (lastWinner && !activeQuestion) {
        setWinner(lastWinner);
        setSubState("winner");
      } else if (activeQuestion) {
        setActiveQuestion(activeQuestion);
        if (answers) setAnswers(answers);
        setSubState("answering");
      }
    });

    // On reconnect (new socket ID), re-register with the server using stored playerName
    socket.on("connect", () => {
      socket.emit("rejoin-game", { playerName });
    });

    return () => {
      socket.off("question-active");
      socket.off("timer-update");
      socket.off("timer-expired");
      socket.off("answer-submitted");
      socket.off("answer-error");
      socket.off("answers-updated");
      socket.off("vote-error");
      socket.off("winner-selected");
      socket.off("game-state");
      socket.off("connect");
      socket.off("rejoin-success");
    };
  }, [playerName]);

  // Debounced live translation: English → Marathi as player types
  useEffect(() => {
    if (!answerText.trim()) {
      setTranslatedAnswer("");
      return;
    }
    setTranslating(true);
    const timer = setTimeout(async () => {
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(answerText.trim())}&langpair=en|mr`;
        const res = await fetch(url);
        const data = await res.json();
        const t = data?.responseData?.translatedText;
        setTranslatedAnswer(t && t !== answerText.trim() ? t : "");
      } catch {
        setTranslatedAnswer("");
      } finally {
        setTranslating(false);
      }
    }, 700); // wait 700ms after user stops typing
    return () => clearTimeout(timer);
  }, [answerText]);

  const submitAnswer = () => {
    if (!answerText.trim()) return setError("Please write an answer first!");
    setError("");
    getSocket().emit("submit-answer", {
      questionId: activeQuestion.id,
      text: answerText.trim(),
      anonymous,
    });
  };

  const castVote = (answerIndex) => {
    setMyVote((prev) => (prev === answerIndex ? null : answerIndex));
    getSocket().emit("cast-vote", { answerIndex });
  };

  // ── Lobby ─────────────────────────────────────────────────
  if (subState === "lobby") {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <div style={styles.bigEmoji}>🎭</div>
          <h2 style={styles.title}>नमस्कार, {playerName}!</h2>
          <p style={styles.waiting}>प्रश्नाची प्रतीक्षा...</p>
          <p style={styles.waitingSub}>Waiting for the admin to start a question</p>
          <div style={styles.pulseGroup}>
            <div style={{ ...styles.pulseDot, animationDelay: "0s" }} />
            <div style={{ ...styles.pulseDot, animationDelay: "0.3s" }} />
            <div style={{ ...styles.pulseDot, animationDelay: "0.6s" }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Answering (with live answer list below) ───────────────
  if (subState === "answering") {
    const sortedAnswers = [...answers].sort((a, b) => b.voteCount - a.voteCount);
    const leadingIndex = sortedAnswers.length > 0 && sortedAnswers[0].voteCount > 0
      ? sortedAnswers[0].answerIndex : null;

    return (
      <div style={styles.scrollPage}>
        {/* Sticky header — just the label */}
        <div style={styles.stickyHeader}>
          <div style={{ ...styles.stickyTop, marginBottom: 0 }}>
            <div>
              <p style={styles.voteHeading}>🎭 उत्तर द्या</p>
              <p style={styles.voteSubheading}>Answer the question!</p>
            </div>
          </div>
        </div>

        <div style={styles.answerList}>
          {/* Answer input box — timer first, then question, then textarea */}
          <div style={styles.inputCard}>
            <Timer secondsLeft={secondsLeft} />
            <div style={styles.questionInCard}>
              <p style={styles.questionInCardLabel}>❓ प्रश्न | Question</p>
              <p style={styles.questionInCardText}>{activeQuestion?.text}</p>
              {activeQuestion?.textMr && (
                <p style={styles.questionInCardTextMr}>{activeQuestion.textMr}</p>
              )}
            </div>
            <textarea
              style={styles.textarea}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="तुमचे विनोदी उत्तर इथे लिहा... / Write your funny answer here..."
              maxLength={500}
              rows={3}
              autoFocus
            />
            {/* Live Marathi translation preview */}
            {(translatedAnswer || translating) && (
              <div style={styles.translationBox}>
                <p style={styles.translationLabel}>
                  🔤 मराठी अनुवाद | Marathi Translation
                  {translating && <span style={styles.translatingDot}> ...</span>}
                </p>
                <p style={styles.translationText}>
                  {translating ? "अनुवाद होत आहे..." : translatedAnswer}
                </p>
              </div>
            )}
            <div style={styles.anonRow}>
              <label style={styles.anonLabel}>
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  style={{ marginRight: "8px", width: "16px", height: "16px" }}
                />
                गुप्त नावाने पाठवा (Answer as Anonymous)
              </label>
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.submitBtn} onClick={submitAnswer}>
              🚀 उत्तर पाठवा | Submit Answer
            </button>
          </div>

          {/* Live answers — visible and voteable immediately */}
          {sortedAnswers.length > 0 && (
            <>
              <div style={styles.liveHeader}>
                <span style={styles.liveHeaderText}>
                  👀 Live Answers ({sortedAnswers.length}) — Vote for your favourite!
                </span>
                {myVote !== null && <span style={styles.votedBadge}>✅ Voted!</span>}
              </div>
              {voteError && <p style={styles.voteError}>{voteError}</p>}

              {sortedAnswers.map((answer) => {
                const isMyAnswer = !answer.anonymous && answer.displayName === playerName;
                const isVoted = myVote === answer.answerIndex;
                const isLeading = answer.answerIndex === leadingIndex;

                return (
                  <div
                    key={answer.answerIndex}
                    style={{
                      ...styles.answerCard,
                      ...(isVoted ? styles.answerCardVoted : {}),
                      ...(isLeading ? styles.answerCardLeading : {}),
                      ...(isMyAnswer ? styles.answerCardMine : {}),
                    }}
                  >
                    <div style={styles.answerTop}>
                      <span style={styles.answerAuthor}>
                        {answer.anonymous ? "🎭 Anonymous" : `👤 ${answer.displayName}`}
                        {isMyAnswer && <span style={styles.myTag}> (You)</span>}
                      </span>
                      <span style={{
                        ...styles.voteCount,
                        ...(isLeading ? styles.voteCountLeading : {}),
                      }}>
                        {isLeading && answer.voteCount > 0 ? "👑 " : "❤️ "}{answer.voteCount}
                      </span>
                    </div>
                    <p style={styles.answerText}>{answer.text}</p>
                    {!isMyAnswer ? (
                      <button
                        style={{ ...styles.voteBtn, ...(isVoted ? styles.voteBtnActive : {}) }}
                        onClick={() => castVote(answer.answerIndex)}
                      >
                        {isVoted ? "💛 Voted! (tap to remove)" : "🤍 Mark as Favourite"}
                      </button>
                    ) : (
                      <p style={styles.ownAnswerNote}>Your answer — can't vote for yourself 😄</p>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {sortedAnswers.length === 0 && (
            <div style={styles.noAnswers}>
              <p>⏳ Be the first to answer!</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Voting ─────────────────────────────────────────────────
  if (subState === "voting") {
    const sortedAnswers = [...answers].sort((a, b) => b.voteCount - a.voteCount);
    const leadingIndex = sortedAnswers.length > 0 && sortedAnswers[0].voteCount > 0
      ? sortedAnswers[0].answerIndex
      : null;

    return (
      <div style={styles.scrollPage}>
        <div style={styles.stickyHeader}>
          <div style={styles.stickyTop}>
            <div>
              <p style={styles.voteHeading}>👍 आवडते उत्तर निवडा</p>
              <p style={styles.voteSubheading}>Pick your favourite answer!</p>
            </div>
            <Timer secondsLeft={secondsLeft} compact />
          </div>

          <div style={styles.questionPill}>
            <span style={styles.questionPillText}>{activeQuestion?.text}</span>
            {activeQuestion?.textMr && (
              <span style={styles.questionPillTextMr}> · {activeQuestion.textMr}</span>
            )}
          </div>

          {myVote !== null && (
            <p style={styles.votedBadge}>✅ Vote recorded! Tap another to change.</p>
          )}
          {voteError && <p style={styles.voteError}>{voteError}</p>}
        </div>

        <div style={styles.answerList}>
          {sortedAnswers.length === 0 && (
            <div style={styles.noAnswers}>
              <p>⏳ Waiting for answers to appear...</p>
            </div>
          )}

          {sortedAnswers.map((answer) => {
            const isMyAnswer = !answer.anonymous && answer.displayName === playerName;
            const isVoted = myVote === answer.answerIndex;
            const isLeading = answer.answerIndex === leadingIndex;

            return (
              <div
                key={answer.answerIndex}
                style={{
                  ...styles.answerCard,
                  ...(isVoted ? styles.answerCardVoted : {}),
                  ...(isLeading ? styles.answerCardLeading : {}),
                  ...(isMyAnswer ? styles.answerCardMine : {}),
                }}
              >
                <div style={styles.answerTop}>
                  <span style={styles.answerAuthor}>
                    {answer.anonymous ? "🎭 Anonymous" : `👤 ${answer.displayName}`}
                    {isMyAnswer && <span style={styles.myTag}> (You)</span>}
                  </span>
                  <span style={{
                    ...styles.voteCount,
                    ...(isLeading ? styles.voteCountLeading : {}),
                  }}>
                    {isLeading && answer.voteCount > 0 ? "👑 " : "❤️ "}
                    {answer.voteCount}
                  </span>
                </div>

                <p style={styles.answerText}>{answer.text}</p>

                {!isMyAnswer ? (
                  <button
                    style={{
                      ...styles.voteBtn,
                      ...(isVoted ? styles.voteBtnActive : {}),
                    }}
                    onClick={() => castVote(answer.answerIndex)}
                  >
                    {isVoted ? "💛 Voted! (tap to remove)" : "🤍 Mark as Favourite"}
                  </button>
                ) : (
                  <p style={styles.ownAnswerNote}>Your answer — can't vote for yourself 😄</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Winner ─────────────────────────────────────────────────
  if (subState === "winner" && winner) {
    return <WinnerModal winner={winner} playerName={playerName} />;
  }

  return null;
}

const styles = {
  center: {
    display: "flex", justifyContent: "center", alignItems: "center",
    minHeight: "100vh", padding: "20px",
  },
  card: {
    background: "rgba(255,255,255,0.97)", borderRadius: "22px",
    padding: "30px 24px", maxWidth: "500px", width: "100%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)", textAlign: "center",
    animation: "fadeIn 0.3s ease",
  },
  bigEmoji: { fontSize: "68px", marginBottom: "16px" },
  title: { fontSize: "26px", color: "#E65100", margin: "0 0 10px 0" },
  waiting: { fontSize: "20px", color: "#FF6B00", margin: "8px 0 4px 0", fontWeight: "700" },
  waitingSub: { fontSize: "14px", color: "#888", margin: "4px 0" },
  pulseGroup: { display: "flex", justifyContent: "center", gap: "8px", marginTop: "24px" },
  pulseDot: {
    width: "12px", height: "12px", borderRadius: "50%",
    background: "#FF6B00", animation: "pulse 1.4s ease-in-out infinite",
  },
  questionBox: {
    background: "#FFF8E1", border: "2px solid #FFB300",
    borderRadius: "14px", padding: "16px", margin: "0 0 16px 0", textAlign: "left",
  },
  questionLabel: {
    fontSize: "11px", color: "#FF6B00", textTransform: "uppercase",
    letterSpacing: "1px", margin: "0 0 8px 0", fontWeight: "700",
  },
  questionText: { fontSize: "19px", color: "#333", margin: "0 0 8px 0", lineHeight: "1.5", fontWeight: "600" },
  questionTextMr: {
    fontSize: "16px", color: "#E65100", margin: 0, lineHeight: "1.5",
    fontWeight: "500", fontStyle: "italic", borderTop: "1px dashed #FFD180", paddingTop: "8px",
  },
  textarea: {
    width: "100%", padding: "13px", border: "2px solid #FFB300",
    borderRadius: "12px", fontSize: "15px", resize: "vertical",
    fontFamily: "inherit", boxSizing: "border-box", outline: "none", lineHeight: "1.5",
  },
  anonRow: { margin: "12px 0", textAlign: "left" },
  anonLabel: { fontSize: "14px", color: "#555", cursor: "pointer", display: "flex", alignItems: "center" },
  error: {
    color: "#c62828", background: "#ffebee", padding: "10px 14px",
    borderRadius: "8px", fontSize: "14px", marginBottom: "10px",
  },
  submitBtn: {
    width: "100%", padding: "15px", background: "#FF6B00", color: "white",
    border: "none", borderRadius: "12px", fontSize: "17px", fontWeight: "700",
    cursor: "pointer", marginTop: "4px",
  },
  inputCard: {
    background: "rgba(255,255,255,0.97)", borderRadius: "16px",
    padding: "18px", border: "3px solid #FFB300",
  },
  liveHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 4px 4px",
  },
  liveHeaderText: { fontSize: "14px", color: "white", fontWeight: "700" },

  // ── Voting ──────────────────────────────────────────────────
  scrollPage: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #BF360C 0%, #E65100 40%, #FF6B00 100%)",
    paddingBottom: "30px",
  },
  stickyHeader: {
    position: "sticky", top: 0, zIndex: 10,
    background: "rgba(191,54,12,0.97)",
    padding: "14px 18px 12px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
  },
  stickyTop: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: "8px",
  },
  voteHeading: { fontSize: "18px", color: "white", fontWeight: "800", margin: 0 },
  voteSubheading: { fontSize: "12px", color: "rgba(255,255,255,0.75)", margin: "2px 0 0 0" },
  questionPill: {
    background: "rgba(255,255,255,0.12)", borderRadius: "8px",
    padding: "8px 12px", marginBottom: "6px",
  },
  questionPillText: { fontSize: "13px", color: "white", fontWeight: "600" },
  questionPillTextMr: { fontSize: "12px", color: "rgba(255,255,255,0.7)", fontStyle: "italic" },
  votedBadge: { fontSize: "13px", color: "#FFF9C4", margin: "4px 0 0 0", fontWeight: "600" },
  voteError: { fontSize: "13px", color: "#FFCDD2", margin: "4px 0 0 0" },

  answerList: {
    padding: "14px 14px 0",
    display: "flex", flexDirection: "column", gap: "12px",
    maxWidth: "560px", margin: "0 auto",
  },
  noAnswers: {
    textAlign: "center", color: "rgba(255,255,255,0.7)",
    fontSize: "15px", padding: "40px 20px",
  },
  answerCard: {
    background: "rgba(255,255,255,0.97)", borderRadius: "16px",
    padding: "16px 18px", border: "3px solid transparent",
    transition: "all 0.2s", animation: "fadeIn 0.3s ease",
  },
  answerCardVoted: { border: "3px solid #FF6B00", background: "#FFF8E1" },
  answerCardLeading: {
    border: "3px solid #FFD700",
    boxShadow: "0 4px 20px rgba(255,215,0,0.4)",
  },
  answerCardMine: { opacity: 0.8 },
  answerTop: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: "8px",
  },
  answerAuthor: { fontSize: "13px", fontWeight: "700", color: "#E65100" },
  myTag: { color: "#aaa", fontWeight: "400", fontSize: "12px" },
  voteCount: {
    fontSize: "15px", fontWeight: "800", color: "#E65100",
    background: "#FFF3E0", borderRadius: "20px", padding: "3px 12px",
  },
  voteCountLeading: { background: "#FFF9C4", color: "#E65100" },
  answerText: { fontSize: "17px", color: "#222", margin: "0 0 12px 0", lineHeight: "1.5" },
  voteBtn: {
    width: "100%", padding: "11px", border: "2px solid #FFB300",
    borderRadius: "10px", fontSize: "15px", fontWeight: "700",
    cursor: "pointer", background: "white", color: "#E65100",
    transition: "all 0.15s",
  },
  voteBtnActive: { background: "#FF6B00", color: "white", border: "2px solid #FF6B00" },
  ownAnswerNote: { fontSize: "12px", color: "#bbb", margin: 0, textAlign: "center", fontStyle: "italic" },

  // Live Marathi translation box
  translationBox: {
    background: "#F3E5F5",
    border: "2px solid #CE93D8",
    borderRadius: "10px",
    padding: "10px 13px",
    margin: "8px 0 0 0",
  },
  translationLabel: {
    fontSize: "10px",
    color: "#7B1FA2",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "1px",
    margin: "0 0 5px 0",
  },
  translatingDot: {
    color: "#AB47BC",
    fontWeight: "400",
  },
  translationText: {
    fontSize: "15px",
    color: "#4A148C",
    margin: 0,
    lineHeight: "1.5",
    fontStyle: "italic",
  },

  // Question displayed inside the inputCard, below the timer
  questionInCard: {
    background: "#FFF8E1",
    border: "2px solid #FFB300",
    borderRadius: "12px",
    padding: "12px 14px",
    margin: "12px 0",
  },
  questionInCardLabel: {
    fontSize: "10px",
    color: "#FF6B00",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "1px",
    margin: "0 0 6px 0",
  },
  questionInCardText: {
    fontSize: "17px",
    color: "#333",
    fontWeight: "700",
    margin: "0 0 6px 0",
    lineHeight: "1.4",
  },
  questionInCardTextMr: {
    fontSize: "14px",
    color: "#E65100",
    fontStyle: "italic",
    margin: 0,
    lineHeight: "1.4",
    borderTop: "1px dashed #FFD180",
    paddingTop: "6px",
  },
};
