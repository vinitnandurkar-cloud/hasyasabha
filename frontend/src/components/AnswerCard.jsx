import { useState } from "react";

export default function AnswerCard({ answer, onSelectWinner, aiReason }) {
  const [hovered, setHovered] = useState(false);
  const voteCount = answer.voteCount ?? 0;

  return (
    <div
      style={{
        ...styles.card,
        background: hovered ? "#FFF8E1" : "rgba(255,255,255,0.97)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        borderColor: voteCount > 0 ? "#FF6B00" : "rgba(255,179,0,0.6)",
        boxShadow: hovered
          ? "0 8px 28px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,107,0,0.1)"
          : "0 2px 12px rgba(0,0,0,0.08)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.top}>
        <span style={styles.name}>
          {answer.anonymous
            ? "🎭 Anonymous"
            : `👤 ${answer.realName || answer.displayName || answer.playerName}`}
          {answer.anonymous && answer.realName && (
            <span style={styles.realNameHint}> ({answer.realName})</span>
          )}
        </span>
        <span style={{
          ...styles.voteBadge,
          background: voteCount > 0 ? "#FF6B00" : "#ECEFF1",
          color: voteCount > 0 ? "white" : "#607D8B",
        }}>
          {voteCount > 0 ? "❤️" : "🤍"} {voteCount} vote{voteCount !== 1 ? "s" : ""}
        </span>
      </div>

      <p style={styles.answerText}>{answer.text}</p>

      {aiReason && (
        <p style={styles.aiReason}>🤖 "{aiReason}"</p>
      )}

      <button style={styles.winnerBtn} onClick={onSelectWinner}>
        🏆 विजेता म्हणून निवडा | Pick as Winner
      </button>
    </div>
  );
}

const styles = {
  card: {
    borderRadius: "16px",
    padding: "18px 20px",
    border: "2px solid",
    transition: "all 0.2s ease",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    paddingBottom: "10px",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    gap: "8px",
  },
  name: { fontSize: "14px", fontWeight: "700", color: "#E65100", flexShrink: 0 },
  realNameHint: { fontSize: "11px", color: "#888", fontWeight: "400" },
  voteBadge: {
    fontSize: "12px",
    padding: "4px 12px",
    borderRadius: "14px",
    fontWeight: "700",
    whiteSpace: "nowrap",
    transition: "all 0.2s",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  answerText: {
    fontSize: "17px",
    color: "#2D2D2D",
    margin: "0 0 14px 0",
    lineHeight: "1.55",
    fontWeight: "500",
  },
  aiReason: {
    fontSize: "12px",
    color: "#7B1FA2",
    fontStyle: "italic",
    margin: "0 0 12px 0",
    background: "#F3E5F5",
    borderRadius: "10px",
    padding: "8px 12px",
    lineHeight: "1.5",
    border: "1px solid #E1BEE7",
  },
  winnerBtn: {
    background: "linear-gradient(135deg, #FF6B00, #FF8F00)",
    color: "white",
    border: "none",
    padding: "11px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "700",
    width: "100%",
    boxShadow: "0 4px 14px rgba(255,107,0,0.3)",
    transition: "all 0.2s ease",
    letterSpacing: "0.3px",
  },
};
