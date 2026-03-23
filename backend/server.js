import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

// ── Config ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const DEFAULT_GAME_CODE = process.env.GAME_CODE || "WMMGUDIPADWA";
const TIMER_DURATION = 120; // seconds
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5174";

// ── Profanity Filter ──────────────────────────────────────────
// Common English abusive words (partial list — covers major slurs/swear words)
const ENGLISH_BAD_WORDS = [
  "fuck","shit","bitch","bastard","asshole","ass","cunt","dick","cock","pussy",
  "whore","slut","nigger","nigga","faggot","fag","retard","idiot","motherfucker",
  "fucker","bullshit","damn","hell","crap","piss","wank","wanker","twat","prick",
  "arse","bollocks","shithead","fuckhead","dumbass","jackass","douchebag","wtf",
  "stfu","gtfo","kys","rape","rapist","kill yourself","die","moron","imbecile",
];

// Common Marathi / Hindi abusive words (transliterated)
const MARATHI_BAD_WORDS = [
  // Marathi gaalis
  "madar","madarchod","bhenchod","behenchod","bhen","bhencho","bhenki",
  "gaand","gaandu","gandu","lauda","lavda","lavde","lund","lundfakir",
  "randi","rand","randya","randichi","jhavto","jhav","jhavla","jhavli",
  "chodu","chodun","chod","chodtoy","chodtoes","gharchi rand",
  "kutri","kutarya","kutarichi","sala","salya","saala","saali",
  "harami","haramkhor","haramzada","haramzadi","haramkhor",
  "kamina","kamine","kaminya","bevda","bevde","maderchod",
  "aai","aaicha","aaicha gho","aaicha bo","aaizhavya","aaicho","aaicha zhavla",
  "baaila","bailed","nanachi","nanachya","nana","nanavati",
  "chakka","hijra","hijda","hijaada","napunsak",
  "chutiya","chutiye","chut","chutiyap","mc","bc","bhk",
  // Devanagari script common abuses
  "मादरचोद","भेनचोद","गांड","गांडू","लवडा","रांड","चोदू","साला","हरामी","चुत","चुतिया",
];

function containsProfanity(text) {
  const lower = text.toLowerCase().replace(/[^a-z\u0900-\u097f\s]/g, " ");
  const words = lower.split(/\s+/);
  for (const bad of ENGLISH_BAD_WORDS) {
    if (lower.includes(bad)) return true;
  }
  for (const bad of MARATHI_BAD_WORDS) {
    if (lower.includes(bad.toLowerCase())) return true;
  }
  return false;
}

// ── Translation helper (MyMemory free API) ────────────────────
async function translateToMarathi(text) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|mr`;
    const res = await fetch(url);
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (translated && translated !== text) return translated;
    return "";
  } catch (e) {
    console.warn("[translate] failed:", e.message);
    return "";
  }
}

// ── In-Memory State ───────────────────────────────────────────
// answers shape: { questionId, playerName, text, anonymous, submittedAt, votes: Set<playerName>, answerIndex }
const gameState = {
  code: DEFAULT_GAME_CODE,
  isActive: true,
  players: new Map(),       // socketId -> { name, socketId }
  questions: [],            // [{ id, text, textMr, status }]
  activeQuestion: null,     // { id, text, textMr, startedAt, timerId }
  answers: [],              // [{ questionId, playerName, text, anonymous, submittedAt, votes }]
  lastWinner: null,
  adminSocketId: null,
  winCounts: new Map(),     // playerName -> number of wins (persists across rounds)
};

// ── Express + Socket.io setup ─────────────────────────────────
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: FRONTEND_URL, methods: ["GET", "POST"] },
});

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

app.get("/health", (_req, res) =>
  res.json({ status: "ok", players: gameState.players.size, code: gameState.code })
);

// ── Helpers ───────────────────────────────────────────────────
// Serialize answers for broadcast (convert Set to count + visible name)
function serializeAnswers(answers, forAdmin = false) {
  return answers.map((a) => ({
    answerIndex: gameState.answers.indexOf(a),  // global index, not local
    questionId: a.questionId,
    displayName: a.anonymous ? "Anonymous" : a.playerName,
    realName: a.playerName,         // admin always sees real name
    text: a.text,
    anonymous: a.anonymous,
    voteCount: a.votes.size,
    // players see display names of who voted; admin sees real names
    voters: forAdmin
      ? Array.from(a.votes)
      : Array.from(a.votes),        // voter list not shown in UI but available
  }));
}

function getPublicAnswers(questionId) {
  return gameState.answers
    .filter((a) => a.questionId === questionId)
    .map((a, i) => ({
      answerIndex: gameState.answers.indexOf(a),
      questionId: a.questionId,
      displayName: a.anonymous ? "Anonymous" : a.playerName,
      text: a.text,
      anonymous: a.anonymous,
      voteCount: a.votes.size,
    }));
}

function getPublicGameState() {
  return {
    code: gameState.code,
    questions: gameState.questions,
    activeQuestion: gameState.activeQuestion
      ? { id: gameState.activeQuestion.id, text: gameState.activeQuestion.text, textMr: gameState.activeQuestion.textMr || "" }
      : null,
    playerCount: gameState.players.size,
    lastWinner: gameState.lastWinner,
    answers: gameState.activeQuestion
      ? getPublicAnswers(gameState.activeQuestion.id)
      : [],
  };
}

// Returns connected players enriched with win counts, sorted by wins desc
function getPlayerList() {
  return Array.from(gameState.players.values())
    .map((p) => ({ name: p.name, wins: gameState.winCounts.get(p.name) || 0 }))
    .sort((a, b) => b.wins - a.wins);
}

function getAdminGameState() {
  const activeAnswers = gameState.activeQuestion
    ? gameState.answers.filter((a) => a.questionId === gameState.activeQuestion.id)
    : [];
  return {
    ...getPublicGameState(),
    answers: serializeAnswers(activeAnswers, true),
    players: getPlayerList(),
  };
}

function emitPlayersUpdated() {
  if (gameState.adminSocketId) {
    io.to(gameState.adminSocketId).emit("players-updated", { players: getPlayerList() });
  }
}

function stopActiveTimer() {
  if (gameState.activeQuestion?.timerId) {
    clearInterval(gameState.activeQuestion.timerId);
    gameState.activeQuestion.timerId = null;
  }
}

function announceWinner(answerIndex) {
  const answer = gameState.answers[answerIndex];
  if (!answer) return;

  const foundQ = gameState.questions.find((q) => q.id === answer.questionId);
  const questionText = foundQ?.text || "";
  const questionTextMr = foundQ?.textMr || "";

  if (gameState.activeQuestion) {
    const q = gameState.questions.find((q) => q.id === gameState.activeQuestion.id);
    if (q) q.status = "done";
    gameState.activeQuestion = null;
  }

  const winnerPayload = {
    winnerName: answer.anonymous ? "Anonymous" : answer.playerName,
    realWinnerName: answer.playerName,
    answerText: answer.text,
    questionText,
    questionTextMr,
    voteCount: answer.votes.size,
  };

  // Increment win count for the winner
  const prevWins = gameState.winCounts.get(answer.playerName) || 0;
  gameState.winCounts.set(answer.playerName, prevWins + 1);

  gameState.lastWinner = winnerPayload;
  io.emit("winner-selected", winnerPayload);

  // Update admin: question list + player leaderboard
  if (gameState.adminSocketId) {
    io.to(gameState.adminSocketId).emit("questions-updated", { questions: gameState.questions });
    emitPlayersUpdated();
  }

  console.log(`[winner] ${answer.playerName} with ${answer.votes.size} votes: "${answer.text}"`);
}

function startQuestionTimer() {
  let secondsLeft = TIMER_DURATION;

  const timerId = setInterval(() => {
    secondsLeft--;
    io.emit("timer-update", { secondsLeft });

    if (secondsLeft <= 0) {
      clearInterval(timerId);
      if (gameState.activeQuestion) {
        gameState.activeQuestion.timerId = null;
      }
      io.emit("timer-expired", {});

      // Timer expired — admin reads answers aloud and picks winner manually
      // Just notify admin so they can see all answers and select
      if (gameState.adminSocketId) {
        io.to(gameState.adminSocketId).emit("timer-expired-admin", {});
      }
    }
  }, 1000);

  return timerId;
}

// ── Socket.io Events ──────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Player: join-game ──────────────────────────────────────
  socket.on("join-game", ({ gameCode, playerName }) => {
    if (!playerName?.trim()) {
      return socket.emit("join-error", { message: "Please enter your name." });
    }
    if (containsProfanity(playerName.trim())) {
      return socket.emit("join-error", { message: "⚠️ कृपया योग्य नाव वापरा. (Please use an appropriate name! 🙏)" });
    }
    if (gameCode?.trim().toUpperCase() !== gameState.code.toUpperCase()) {
      return socket.emit("join-error", { message: "Invalid game code. Check with the admin." });
    }

    const existingNames = Array.from(gameState.players.values()).map((p) =>
      p.name.toLowerCase()
    );
    if (existingNames.includes(playerName.trim().toLowerCase())) {
      return socket.emit("join-error", {
        message: `"${playerName}" is already in the game. Try a different name.`,
      });
    }

    gameState.players.set(socket.id, { name: playerName.trim(), socketId: socket.id });
    socket.join("players");

    socket.emit("join-success", {
      playerName: playerName.trim(),
      gameState: getPublicGameState(),
    });

    emitPlayersUpdated();
    console.log(`[join] ${playerName} (${socket.id}) - total: ${gameState.players.size}`);
  });

  // ── Player: rejoin (reconnect with new socket ID) ──────────
  socket.on("rejoin-game", ({ playerName }) => {
    if (!playerName?.trim()) return;

    // Remove stale entry with the same name (from old socket ID before reconnect)
    for (const [sid, player] of gameState.players.entries()) {
      if (player.name.toLowerCase() === playerName.trim().toLowerCase()) {
        gameState.players.delete(sid);
        break;
      }
    }

    gameState.players.set(socket.id, { name: playerName.trim(), socketId: socket.id });
    socket.join("players");

    // Send current game state so they can resume where they left off
    socket.emit("game-state", getPublicGameState());
    emitPlayersUpdated();
    console.log(`[rejoin] ${playerName} (${socket.id}) - total: ${gameState.players.size}`);
  });

  // ── Admin: authenticate ────────────────────────────────────
  socket.on("admin-auth", ({ password }) => {
    if (password !== ADMIN_PASSWORD) {
      return socket.emit("admin-auth-error", { message: "Incorrect password." });
    }
    gameState.adminSocketId = socket.id;
    socket.join("admin");
    socket.emit("admin-auth-success", { gameState: getAdminGameState() });
    console.log(`[admin] authenticated: ${socket.id}`);
  });

  // ── Admin: add question ────────────────────────────────────
  socket.on("add-question", async ({ text }) => {
    if (socket.id !== gameState.adminSocketId) return;
    if (!text?.trim()) return;

    const textMr = await translateToMarathi(text.trim());
    const question = { id: uuidv4(), text: text.trim(), textMr, status: "pending" };
    gameState.questions.push(question);
    socket.emit("questions-updated", { questions: gameState.questions });
  });

  // ── Admin: edit question ───────────────────────────────────
  socket.on("edit-question", async ({ id, text }) => {
    if (socket.id !== gameState.adminSocketId) return;
    const q = gameState.questions.find((q) => q.id === id);
    if (q && text?.trim()) {
      q.text = text.trim();
      q.textMr = await translateToMarathi(text.trim());
      socket.emit("questions-updated", { questions: gameState.questions });
    }
  });

  // ── Admin: delete question ─────────────────────────────────
  socket.on("delete-question", ({ id }) => {
    if (socket.id !== gameState.adminSocketId) return;
    gameState.questions = gameState.questions.filter((q) => q.id !== id);
    socket.emit("questions-updated", { questions: gameState.questions });
  });

  // ── Admin: activate question ───────────────────────────────
  socket.on("activate-question", ({ id }) => {
    if (socket.id !== gameState.adminSocketId) return;

    const question = gameState.questions.find((q) => q.id === id);
    if (!question) return;

    stopActiveTimer();

    gameState.questions.forEach((q) => {
      if (q.status === "active") q.status = "done";
    });

    question.status = "active";
    gameState.answers = gameState.answers.filter((a) => a.questionId !== id);

    const timerId = startQuestionTimer();

    gameState.activeQuestion = {
      id: question.id,
      text: question.text,
      textMr: question.textMr || "",
      startedAt: Date.now(),
      timerId,
    };

    // Broadcast to everyone — players and admin both need to update their activeQuestion state
    io.emit("question-active", {
      question: { id: question.id, text: question.text, textMr: question.textMr || "" },
      timerDuration: TIMER_DURATION,
    });

    socket.emit("questions-updated", { questions: gameState.questions });
    console.log(`[question] activated: "${question.text}"`);
  });

  // ── Player: submit answer ──────────────────────────────────
  socket.on("submit-answer", ({ questionId, text, anonymous }) => {
    const player = gameState.players.get(socket.id);
    if (!player) {
      return socket.emit("answer-error", { message: "You are not in the game." });
    }
    if (!gameState.activeQuestion || gameState.activeQuestion.id !== questionId) {
      return socket.emit("answer-error", { message: "This question is no longer active." });
    }
    if (!text?.trim()) {
      return socket.emit("answer-error", { message: "Answer cannot be empty." });
    }
    if (containsProfanity(text.trim())) {
      return socket.emit("answer-error", { message: "⚠️ तुमचे उत्तर अयोग्य शब्द आहेत. कृपया योग्य भाषा वापरा. (Your answer contains inappropriate language. Please keep it clean! 🙏)" });
    }
    const alreadyAnswered = gameState.answers.some(
      (a) => a.questionId === questionId && a.playerName === player.name
    );
    if (alreadyAnswered) {
      return socket.emit("answer-error", { message: "You already submitted an answer." });
    }

    const answer = {
      questionId,
      playerName: player.name,
      text: text.trim(),
      anonymous: Boolean(anonymous),
      submittedAt: Date.now(),
      votes: new Set(),              // Set of playerNames who voted for this
    };
    gameState.answers.push(answer);
    const answerIndex = gameState.answers.length - 1;

    // Ack submitter
    socket.emit("answer-submitted", {});

    // Notify admin only — players don't see each other's answers
    if (gameState.adminSocketId) {
      io.to(gameState.adminSocketId).emit("new-answer", {
        questionId,
        displayName: anonymous ? "Anonymous" : player.name,
        realName: player.name,
        text: text.trim(),
        anonymous: Boolean(anonymous),
        answerIndex,
        voteCount: 0,
      });
    }

    console.log(`[answer] ${player.name} (anon: ${anonymous}): "${text.trim()}"`);
  });

  // cast-vote removed — admin picks winner directly

  // ── Admin: manually select winner (override) ───────────────
  socket.on("select-winner", ({ answerIndex }) => {
    if (socket.id !== gameState.adminSocketId) return;
    const answer = gameState.answers[answerIndex];
    if (!answer) return;
    stopActiveTimer();
    announceWinner(answerIndex);
  });

  // ── Reconnect: request full state ─────────────────────────
  socket.on("request-game-state", () => {
    const isAdmin = socket.id === gameState.adminSocketId;
    socket.emit("game-state", isAdmin ? getAdminGameState() : getPublicGameState());
  });

  // ── Disconnect ─────────────────────────────────────────────
  socket.on("disconnect", () => {
    const player = gameState.players.get(socket.id);
    if (player) {
      gameState.players.delete(socket.id);
      console.log(`[disconnect] ${player.name} - remaining: ${gameState.players.size}`);
      emitPlayersUpdated();
    }
    if (socket.id === gameState.adminSocketId) {
      gameState.adminSocketId = null;
      console.log(`[disconnect] admin disconnected`);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n🎭 HasyaSabha backend running on port ${PORT}`);
  console.log(`   Game code : ${DEFAULT_GAME_CODE}`);
  console.log(`   Admin pwd : ${ADMIN_PASSWORD}`);
  console.log(`   CORS      : ${FRONTEND_URL}\n`);
});
