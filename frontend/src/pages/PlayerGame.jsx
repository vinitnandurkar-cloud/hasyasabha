import { useState, useEffect, useMemo } from "react";
import { getSocket } from "../socket.js";
import Timer from "../components/Timer.jsx";
import WinnerModal from "../components/WinnerModal.jsx";

// ── Client-side profanity check (mirrors backend list) ────────
const ENGLISH_BAD_WORDS = [
  "fuck","shit","bitch","bastard","asshole","ass","cunt","dick","cock","pussy",
  "whore","slut","nigger","nigga","faggot","fag","retard","idiot","motherfucker",
  "fucker","bullshit","damn","hell","crap","piss","wank","wanker","twat","prick",
  "arse","bollocks","shithead","fuckhead","dumbass","jackass","douchebag","wtf",
  "stfu","gtfo","kys","rape","rapist","kill yourself","die","moron","imbecile",
];
const MARATHI_BAD_WORDS = [
  "madar","madarchod","bhenchod","behenchod","bhen","bhencho","bhenki",
  "gaand","gaandu","gandu","lauda","lavda","lavde","lund","lundfakir",
  "randi","rand","randya","randichi","jhavto","jhav","jhavla","jhavli",
  "chodu","chodun","chod","chodtoy","chodtoes","gharchi rand",
  "kutri","kutarya","kutarichi","sala","salya","saala","saali",
  "harami","haramkhor","haramzada","haramzadi",
  "kamina","kamine","kaminya","bevda","bevde","maderchod",
  "aaicha gho","aaicha bo","aaizhavya","aaicha zhavla",
  "chakka","hijra","hijda","hijaada","napunsak",
  "chutiya","chutiye","chut","chutiyap","mc","bc","bhk",
  "मादरचोद","भेनचोद","गांड","गांडू","लवडा","रांड","चोदू","साला","हरामी","चुत","चुतिया",
];
function hasProfanity(text) {
  const lower = text.toLowerCase().replace(/[^a-z\u0900-\u097f\s]/g, " ");
  for (const w of ENGLISH_BAD_WORDS) { if (lower.includes(w)) return true; }
  for (const w of MARATHI_BAD_WORDS) { if (lower.includes(w.toLowerCase())) return true; }
  return false;
}

// Sub-states: "lobby" | "answering" | "submitted" | "winner"

export default function PlayerGame({ playerName }) {
  const [subState, setSubState] = useState("lobby");
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [answerText, setAnswerText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState("");
  const [translatedAnswer, setTranslatedAnswer] = useState("");
  const [translating, setTranslating] = useState(false);

  const isProfane = useMemo(() => hasProfanity(answerText), [answerText]);

  useEffect(() => {
    const socket = getSocket();

    socket.on("question-active", ({ question, timerDuration }) => {
      setActiveQuestion(question);
      setSecondsLeft(timerDuration);
      setAnswerText("");
      setAnonymous(false);
      setError("");
      setWinner(null);
      setTranslatedAnswer("");
      setSubState("answering");
    });

    socket.on("timer-update", ({ secondsLeft }) => {
      setSecondsLeft(secondsLeft);
    });

    socket.on("timer-expired", () => {
      // After timer, just wait for admin to pick winner
      setSubState((prev) => (prev === "answering" ? "submitted" : prev));
    });

    socket.on("answer-submitted", () => {
      setSubState("submitted");
    });

    socket.on("answer-error", ({ message }) => {
      setError(message);
    });

    socket.on("winner-selected", (data) => {
      setWinner(data);
      setSubState("winner");
    });

    socket.on("game-state", ({ activeQuestion, lastWinner }) => {
      if (lastWinner && !activeQuestion) {
        setWinner(lastWinner);
        setSubState("winner");
      } else if (activeQuestion) {
        setActiveQuestion(activeQuestion);
        setSubState("answering");
      }
    });

    // On reconnect, re-register with the server
    socket.on("connect", () => {
      socket.emit("rejoin-game", { playerName });
    });

    return () => {
      socket.off("question-active");
      socket.off("timer-update");
      socket.off("timer-expired");
      socket.off("answer-submitted");
      socket.off("answer-error");
      socket.off("winner-selected");
      socket.off("game-state");
      socket.off("connect");
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
    }, 700);
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

  // ── Answering ─────────────────────────────────────────────
  if (subState === "answering") {
    return (
      <div style={styles.scrollPage}>
        <div style={styles.stickyHeader}>
          <div style={{ ...styles.stickyTop, marginBottom: 0 }}>
            <div>
              <p style={styles.voteHeading}>🎭 उत्तर द्या</p>
              <p style={styles.voteSubheading}>Answer the question!</p>
            </div>
          </div>
        </div>

        <div style={styles.answerList}>
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
              maxLength={150}
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
            {isProfane && (
              <div style={styles.profanityWarning}>
                🚫 अयोग्य शब्द आढळले — कृपया योग्य भाषा वापरा!<br/>
                <span style={styles.profanityWarningSub}>Inappropriate language detected. Please keep it clean! 🙏</span>
              </div>
            )}
            {error && <p style={styles.error}>{error}</p>}
            <button
              style={{ ...styles.submitBtn, ...(isProfane ? styles.submitBtnDisabled : {}) }}
              onClick={submitAnswer}
              disabled={isProfane}
            >
              🚀 उत्तर पाठवा | Submit Answer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Submitted — waiting for admin to pick winner ──────────
  if (subState === "submitted") {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <div style={styles.bigEmoji}>⏳</div>
          <h2 style={styles.title}>उत्तर पाठवले!</h2>
          <p style={styles.waiting}>Answer submitted!</p>
          <p style={styles.waitingSub}>
            Waiting for the admin to read all answers and pick a winner...
          </p>
          <div style={styles.pulseGroup}>
            <div style={{ ...styles.pulseDot, animationDelay: "0s" }} />
            <div style={{ ...styles.pulseDot, animationDelay: "0.3s" }} />
            <div style={{ ...styles.pulseDot, animationDelay: "0.6s" }} />
          </div>
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
  answerList: {
    padding: "14px 14px 0",
    display: "flex", flexDirection: "column", gap: "12px",
    maxWidth: "560px", margin: "0 auto",
  },
  inputCard: {
    background: "rgba(255,255,255,0.97)", borderRadius: "16px",
    padding: "18px", border: "3px solid #FFB300",
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
  submitBtnDisabled: {
    background: "#ccc", color: "#888", cursor: "not-allowed",
  },
  profanityWarning: {
    background: "#FFEBEE", border: "2px solid #EF9A9A",
    borderRadius: "10px", padding: "10px 14px",
    fontSize: "14px", color: "#B71C1C", fontWeight: "600",
    marginBottom: "8px", lineHeight: "1.6",
  },
  profanityWarningSub: {
    fontWeight: "400", fontSize: "13px", color: "#C62828",
  },
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
  translatingDot: { color: "#AB47BC", fontWeight: "400" },
  translationText: {
    fontSize: "15px",
    color: "#4A148C",
    margin: 0,
    lineHeight: "1.5",
    fontStyle: "italic",
  },
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
