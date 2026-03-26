import { useState, useEffect } from "react";
import { connectSocket } from "../socket.js";

export default function PlayerJoin({ navigate }) {
  const [gameCode, setGameCode] = useState("WMMGUDIPADWA");
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const socket = connectSocket();

    socket.on("join-success", ({ playerName, gameState }) => {
      navigate("player-game", { playerName, gameState });
    });

    socket.on("join-error", ({ message }) => {
      setError(message);
      setLoading(false);
    });

    return () => {
      socket.off("join-success");
      socket.off("join-error");
    };
  }, []);

  const handleJoin = () => {
    if (!playerName.trim()) return setError("Please enter your name.");
    if (!gameCode.trim()) return setError("Please enter the game code.");
    setError("");
    setLoading(true);
    const socket = connectSocket();
    socket.emit("join-game", {
      gameCode: gameCode.trim().toUpperCase(),
      playerName: playerName.trim(),
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button style={styles.back} onClick={() => navigate("landing")}>
          ← मागे / Back
        </button>
        <div style={styles.emoji}>🎮</div>
        <h2 style={styles.title}>खेळात सामील व्हा</h2>
        <p style={styles.subtitle}>Join the Game</p>

        <div style={styles.field}>
          <label style={styles.label}>Game Code</label>
          <input
            style={styles.input}
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            placeholder="WMMGUDIPADWA"
            maxLength={20}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>तुमचे काल्पनिक मजेदार नाव / Your Imaginary Funny Name</label>
          <input
            style={styles.input}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="e.g. ChaosCaptain, LaughingLion"
            maxLength={30}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
          <p style={styles.hint}>💡 Use a creative funny name, not your real name!</p>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button
          style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
          onClick={handleJoin}
          disabled={loading}
        >
          {loading ? "Joining..." : "🎭 खेळात सामील व्हा | Join"}
        </button>
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
  },
  card: {
    background: "rgba(255,255,255,0.97)",
    borderRadius: "22px",
    padding: "36px 28px",
    maxWidth: "420px",
    width: "100%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    animation: "fadeIn 0.3s ease",
  },
  back: {
    background: "none",
    border: "none",
    color: "#FF6B00",
    cursor: "pointer",
    fontSize: "14px",
    padding: "0 0 16px 0",
    display: "block",
    fontWeight: "600",
  },
  emoji: { fontSize: "48px", textAlign: "center", marginBottom: "10px" },
  title: { fontSize: "28px", color: "#E65100", margin: "0 0 4px 0", textAlign: "center" },
  subtitle: { fontSize: "14px", color: "#888", textAlign: "center", marginBottom: "26px" },
  field: { marginBottom: "16px" },
  hint: {
    fontSize: "12px",
    color: "#FF6B00",
    marginTop: "6px",
    marginBottom: "0",
    fontWeight: "500",
    fontStyle: "italic",
  },
  label: {
    display: "block",
    fontSize: "13px",
    color: "#555",
    marginBottom: "6px",
    fontWeight: "600",
  },
  input: {
    width: "100%",
    padding: "13px 14px",
    border: "2px solid #FFB300",
    borderRadius: "10px",
    fontSize: "16px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  error: {
    color: "#c62828",
    background: "#ffebee",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "14px",
    marginBottom: "12px",
  },
  button: {
    width: "100%",
    padding: "15px",
    background: "#FF6B00",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "17px",
    fontWeight: "700",
    cursor: "pointer",
    marginTop: "4px",
  },
};
