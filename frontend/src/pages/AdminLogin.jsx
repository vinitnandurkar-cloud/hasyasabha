import { useState, useEffect } from "react";
import { connectSocket } from "../socket.js";

export default function AdminLogin({ navigate }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const socket = connectSocket();

    socket.on("admin-auth-success", ({ gameState }) => {
      navigate("admin-panel", { gameState, adminPassword: password.trim() });
    });

    socket.on("admin-auth-error", ({ message }) => {
      setError(message);
      setLoading(false);
    });

    return () => {
      socket.off("admin-auth-success");
      socket.off("admin-auth-error");
    };
  }, [password]);

  const handleLogin = () => {
    if (!password.trim()) return setError("Please enter the admin password.");
    setError("");
    setLoading(true);
    const socket = connectSocket();
    socket.emit("admin-auth", { password: password.trim() });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button style={styles.back} onClick={() => navigate("landing")}>
          ← मागे / Back
        </button>
        <div style={styles.emoji}>⚙️</div>
        <h2 style={styles.title}>संचालक प्रवेश</h2>
        <p style={styles.subtitle}>Admin Login</p>

        <input
          type="password"
          style={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin Password"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button
          style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Verifying..." : "🔐 प्रवेश करा | Enter"}
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
    maxWidth: "380px",
    width: "100%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    textAlign: "center",
    animation: "fadeIn 0.3s ease",
  },
  back: {
    background: "none",
    border: "none",
    color: "#388E3C",
    cursor: "pointer",
    fontSize: "14px",
    padding: "0 0 16px 0",
    display: "block",
    fontWeight: "600",
    textAlign: "left",
  },
  emoji: { fontSize: "52px", marginBottom: "12px" },
  title: { fontSize: "26px", color: "#2E7D32", margin: "0 0 4px 0" },
  subtitle: { fontSize: "14px", color: "#888", marginBottom: "26px" },
  input: {
    width: "100%",
    padding: "13px 14px",
    border: "2px solid #66BB6A",
    borderRadius: "10px",
    fontSize: "16px",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: "12px",
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
    background: "#388E3C",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "17px",
    fontWeight: "700",
    cursor: "pointer",
  },
};
