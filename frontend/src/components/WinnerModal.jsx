export default function WinnerModal({ winner, playerName }) {
  // Only compare against realWinnerName (server always sends this as the actual player name)
  // Never compare against winnerName as it can be "Anonymous" which would match incorrectly
  const isWinner = playerName && winner.realWinnerName === playerName;

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.confetti}>🎉 🎊 🎭 🏆 🎊 🎉</div>

        <div style={{ ...styles.trophy, animation: "winnerEntrance 0.6s cubic-bezier(.34,1.56,.64,1)" }}>
          🏆
        </div>

        {isWinner ? (
          <>
            <h1 style={styles.yourWin}>अरे व्वा! तुम्ही जिंकलात!</h1>
            <p style={styles.yourWinSub}>You won this round! 🌟</p>
          </>
        ) : (
          <>
            <h1 style={styles.winTitle}>विजेता!</h1>
            <p style={styles.winSub}>Round Winner!</p>
          </>
        )}

        <div style={styles.winnerBox}>
          <p style={styles.winnerName}>
            {winner.winnerName === "Anonymous"
              ? "🎭 Anonymous"
              : `👤 ${winner.winnerName}`}
          </p>
          <p style={styles.winnerAnswer}>"{winner.answerText}"</p>
        </div>

        {winner.questionText && (
          <div style={styles.questionRef}>
            <p style={styles.questionRefLabel}>For the question</p>
            <p style={styles.questionRefText}>{winner.questionText}</p>
            {winner.questionTextMr && (
              <p style={styles.questionRefTextMr}>{winner.questionTextMr}</p>
            )}
          </div>
        )}

        <div style={styles.waitNext}>
          <p style={styles.waitText}>पुढील प्रश्नाची प्रतीक्षा करत आहे...</p>
          <p style={styles.waitTextSub}>Waiting for the next question...</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "rgba(0,0,0,0.88)",
    zIndex: 999,
    padding: "20px",
  },
  card: {
    background: "linear-gradient(145deg, #0d1b2a, #1a2a3a)",
    border: "3px solid gold",
    borderRadius: "28px",
    padding: "36px 28px",
    maxWidth: "500px",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 0 80px rgba(255,215,0,0.35), 0 24px 64px rgba(0,0,0,0.6)",
  },
  confetti: { fontSize: "28px", letterSpacing: "4px", marginBottom: "8px" },
  trophy: { fontSize: "80px", margin: "0 0 14px 0", display: "inline-block" },
  yourWin: {
    fontSize: "30px",
    color: "#FFD700",
    margin: "0 0 6px 0",
    fontWeight: "800",
    lineHeight: "1.2",
  },
  yourWinSub: { fontSize: "16px", color: "#FFA500", margin: "0 0 22px 0" },
  winTitle: {
    fontSize: "42px",
    color: "#FFD700",
    margin: "0 0 4px 0",
    fontWeight: "800",
  },
  winSub: { fontSize: "16px", color: "#FFA500", margin: "0 0 22px 0" },
  winnerBox: {
    background: "rgba(255,215,0,0.1)",
    border: "2px solid rgba(255,215,0,0.5)",
    borderRadius: "18px",
    padding: "20px 22px",
    margin: "0 0 18px 0",
  },
  winnerName: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#FFD700",
    margin: "0 0 12px 0",
  },
  winnerAnswer: {
    fontSize: "19px",
    color: "white",
    margin: 0,
    fontStyle: "italic",
    lineHeight: "1.5",
  },
  questionRef: { margin: "0 0 20px 0" },
  questionRefLabel: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: "1px",
    margin: "0 0 4px 0",
  },
  questionRefText: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.65)",
    margin: "0 0 4px 0",
    lineHeight: "1.4",
  },
  questionRefTextMr: {
    fontSize: "13px",
    color: "rgba(255,210,120,0.7)",
    margin: 0,
    lineHeight: "1.4",
    fontStyle: "italic",
  },
  waitNext: { borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "16px" },
  waitText: { fontSize: "14px", color: "rgba(255,255,255,0.55)", margin: "0 0 4px 0" },
  waitTextSub: { fontSize: "13px", color: "rgba(255,255,255,0.35)", margin: 0 },
};
