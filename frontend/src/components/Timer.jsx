export default function Timer({ secondsLeft, compact = false }) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeStr = `${minutes}:${String(seconds).padStart(2, "0")}`;
  const isUrgent = secondsLeft <= 30;
  const pct = Math.max(0, Math.min(1, secondsLeft / 120));

  if (compact) {
    return (
      <span
        style={{
          background: isUrgent ? "#c62828" : "#FF6B00",
          color: "white",
          padding: "6px 14px",
          borderRadius: "20px",
          fontWeight: "800",
          fontSize: "15px",
          fontFamily: "monospace",
          letterSpacing: "1px",
        }}
      >
        ⏱ {timeStr}
      </span>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div
        style={{
          ...styles.circle,
          borderColor: isUrgent ? "#c62828" : "#FF6B00",
          color: isUrgent ? "#c62828" : "#E65100",
          animation: isUrgent ? "urgentPulse 0.6s ease-in-out infinite" : "none",
        }}
      >
        <span style={styles.timeText}>{timeStr}</span>
        <span style={styles.timeLabel}>वेळ शिल्लक</span>
      </div>

      <div style={styles.barBg}>
        <div
          style={{
            ...styles.barFill,
            width: `${pct * 100}%`,
            background: isUrgent
              ? "linear-gradient(90deg, #c62828, #f44336)"
              : "linear-gradient(90deg, #FF6B00, #FFB300)",
          }}
        />
      </div>
    </div>
  );
}

const styles = {
  wrapper: { textAlign: "center", marginBottom: "18px" },
  circle: {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "96px",
    height: "96px",
    borderRadius: "50%",
    border: "5px solid",
    margin: "0 auto 12px",
    transition: "border-color 0.5s",
  },
  timeText: {
    fontSize: "28px",
    fontWeight: "800",
    fontFamily: "monospace",
    lineHeight: "1",
  },
  timeLabel: { fontSize: "10px", color: "#888", marginTop: "3px", letterSpacing: "0.5px" },
  barBg: {
    height: "7px",
    background: "#eee",
    borderRadius: "4px",
    overflow: "hidden",
    margin: "0 10px",
  },
  barFill: {
    height: "100%",
    borderRadius: "4px",
    transition: "width 1s linear, background 0.5s",
  },
};
