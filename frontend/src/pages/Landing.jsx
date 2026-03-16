export default function Landing({ navigate }) {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.emoji}>🎭</div>
        <h1 style={styles.title}>हास्यसभा</h1>
        <p style={styles.subtitle}>HasyaSabha</p>
        <p style={styles.tagline}>विनोदाचा महोत्सव</p>
        <p style={styles.taglineSub}>The Comedy Assembly</p>

        <div style={styles.buttonGroup}>
          <button
            style={{ ...styles.button, ...styles.playerButton }}
            onClick={() => navigate("player-join")}
          >
            🎮 मी खेळाडू आहे
            <span style={styles.buttonSub}>I am a Player</span>
          </button>

          <button
            style={{ ...styles.button, ...styles.adminButton }}
            onClick={() => navigate("admin-login")}
          >
            ⚙️ मी संचालक आहे
            <span style={styles.buttonSub}>I am the Admin</span>
          </button>
        </div>

        <p style={styles.footer}>✨ WMM Gudi Padwa 2025 ✨</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    padding: "20px",
    animation: "fadeIn 0.4s ease",
  },
  card: {
    background: "rgba(255,255,255,0.97)",
    borderRadius: "24px",
    padding: "44px 32px",
    maxWidth: "420px",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
  },
  emoji: { fontSize: "72px", marginBottom: "12px" },
  title: {
    fontSize: "52px",
    color: "#E65100",
    margin: "0 0 4px 0",
    fontWeight: "800",
    lineHeight: "1",
  },
  subtitle: {
    fontSize: "16px",
    color: "#FF6B00",
    margin: "0 0 8px 0",
    letterSpacing: "5px",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  tagline: { fontSize: "15px", color: "#555", margin: "0 0 2px 0" },
  taglineSub: { fontSize: "13px", color: "#888", margin: "0 0 32px 0", fontStyle: "italic" },
  buttonGroup: { display: "flex", flexDirection: "column", gap: "14px" },
  button: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "18px 24px",
    border: "none",
    borderRadius: "14px",
    fontSize: "19px",
    fontWeight: "700",
    cursor: "pointer",
    gap: "4px",
    transition: "opacity 0.15s, transform 0.1s",
  },
  playerButton: { background: "#FF6B00", color: "white" },
  adminButton: { background: "#388E3C", color: "white" },
  buttonSub: { fontSize: "12px", opacity: 0.85, fontWeight: "400" },
  footer: { marginTop: "32px", fontSize: "13px", color: "#aaa" },
};
