import { useState } from "react";
import Landing from "./pages/Landing.jsx";
import PlayerJoin from "./pages/PlayerJoin.jsx";
import PlayerGame from "./pages/PlayerGame.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";

// Page state machine:
// "landing" -> "player-join" -> "player-game"
// "landing" -> "admin-login" -> "admin-panel"

export default function App() {
  const [page, setPage] = useState("landing");
  const [playerName, setPlayerName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const navigate = (target, data = {}) => {
    if (data.playerName) setPlayerName(data.playerName);
    if (data.adminPassword) setAdminPassword(data.adminPassword);
    setPage(target);
  };

  return (
    <div style={styles.appWrapper}>
      {page === "landing"      && <Landing navigate={navigate} />}
      {page === "player-join"  && <PlayerJoin navigate={navigate} />}
      {page === "player-game"  && <PlayerGame navigate={navigate} playerName={playerName} />}
      {page === "admin-login"  && <AdminLogin navigate={navigate} />}
      {page === "admin-panel"  && <AdminPanel navigate={navigate} adminPassword={adminPassword} />}
    </div>
  );
}

const styles = {
  appWrapper: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #FF6B00 0%, #FFB300 50%, #FF6B00 100%)",
    fontFamily: "'Segoe UI', Arial, sans-serif",
  },
};
