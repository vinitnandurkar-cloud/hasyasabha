import { useState } from "react";

export default function AnswerCard({ answer, onSelectWinner, aiReason }) {
  const [hovered, setHovered] = useState(false);
  const voteCount = answer.voteCount ?? 0;

  return (
    <div
      style={{
        ...styles.card,
        background: hovered ? "#FFF8E1" : "rgba(255,255,255,0.96)",
        transform: hovered ? "scale(1.005)" : "scale(1)",
        borderColor: voteCount > 0 ? "#FF6B00" : "#FFB300",
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
    borderRadius: "14px",
    padding: "14px 16px",
    border: "2px solid",
    transition: "all 0.15s ease",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
    gap: "8px",
  },
  name: { fontSize: "13px", fontWeight: "700", color: "#E65100", flexShrink: 0 },
  realNameHint: { fontSize: "11px", color: "#888", fontWeight: "400" },
  voteBadge: {
    fontSize: "12px",
    padding: "3px 10px",
    borderRadius: "12px",
    fontWeight: "700",
    whiteSpace: "nowrap",
    transition: "all 0.2s",
  },
  answerText: {
    fontSize: "16px",
    color: "#333",
    margin: "0 0 12px 0",
    lineHeight: "1.5",
  },
  aiReason: {
    fontSize: "12px",
    color: "#7B1FA2",
    fontStyle: "italic",
    margin: "0 0 10px 0",
    background: "#F3E5F5",
    borderRadius: "6px",
    padding: "5px 10px",
    lineHeight: "1.5",
  },
  winnerBtn: {
    background: "#FF6B00",
    color: "white",
    border: "none",
    padding: "9px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "700",
    width: "100%",
  },
};
