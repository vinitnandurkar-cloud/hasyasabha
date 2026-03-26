import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";

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

// ── Pre-populated Questions with AI Answers ───────────────────
const PRE_POPULATED_QUESTIONS = [
  { text: "Tumcha nav kay aahe", aiAnswer: "Gabbar" },
  { text: "Ti mala avadate karan...", aiAnswer: "Shopping kami karte" },
  { text: "Mi tila mhatla jara shant bas tar ti mahanli", aiAnswer: "Shant basyach asta tar tuzyashi lagna kashala kela asata" },
  { text: "Mazi bayko nehami mhanate ki ..", aiAnswer: "bhandi padli aahet ghasyala" },
  { text: "Maza gym la jaycha tharatch nahi karan", aiAnswer: "Udya nakki janar asto" },
  { text: "Mala vatla hota ki aaj cha divas changla jael pan...", aiAnswer: "Sasu bai n cha phone ala" },
  { text: "Mazya navryach me kamat busy aahe mhanaje...", aiAnswer: "Timepass karat asto" },
  { text: "Amch bhandan far vel chalat nahi karan...", aiAnswer: "Doghanahi bhook lagte" },
  { text: "Maheri mi relax karayla jate pan...", aiAnswer: "Tumhi sanga" },
  { text: "Lagnachya pahilya varshi amhi roj phiralya baher jaycho", aiAnswer: "Aata aqt wifi band jhalyavar jato" },
  { text: "Amchya ghari shantata aste joparyant....", aiAnswer: "Tumhi sanga" },
  { text: "Mazya bayko cha eka minute ta yete mhanaje", aiAnswer: "Tumhi Sanga" },
  { text: "Mazya bayko chya shopping var me kahi bolat nahi karan...", aiAnswer: "Tumhi Sanga" },
  { text: "Navryach me diet var aahe mhanaje", aiAnswer: "Tumhi Sanga" },
  { text: "Ti mhanali mala tuzyashivay kahi nako pan...", aiAnswer: "Tumhi Sanga" },
  { text: "Hi cha raag evdha loud aahe ki", aiAnswer: "Alexa hi mute madhe jatey" },
  { text: "Tula mahit aahe me aaj evdha late ka zalo", aiAnswer: "Tumhi Sanga" },
];

// Map question text → AI answer for quick lookup
const AI_ANSWERS_MAP = new Map(
  PRE_POPULATED_QUESTIONS.map((q) => [q.text.toLowerCase().trim(), q.aiAnswer])
);

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

// Pre-populate questions on server start
(async () => {
  for (const pq of PRE_POPULATED_QUESTIONS) {
    const textMr = await translateToMarathi(pq.text);
    gameState.questions.push({
      id: uuidv4(),
      text: pq.text,
      textMr,
      status: "pending",
    });
  }
  console.log(`[init] Pre-populated ${PRE_POPULATED_QUESTIONS.length} questions.`);
})();

// ── Express + Socket.io setup ─────────────────────────────────
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: FRONTEND_URL, methods: ["GET", "POST"] },
});

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// OpenAI client (only used for AI ranking)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

app.get("/health", (_req, res) =>
  res.json({ status: "ok", players: gameState.players.size, code: gameState.code })
);

// ── Shared: AI rank answers logic ─────────────────────────────
async function rankAnswersWithAI(answers, question) {
  if (!answers || answers.length === 0) return { rankings: [] };
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set on server.");

  // Exclude the "AI" test answer from ranking
  const filteredAnswers = answers.filter((a) => (a.displayName || a.playerName) !== "AI");
  if (filteredAnswers.length === 0) return { rankings: [] };

  const payload = {
    Question: question,
    Answers: filteredAnswers.map((a) => ({
      user: a.displayName || a.playerName,
      answer: a.text,
    })),
  };

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1024,
    messages: [
      {
        role: "system",
        content: "You are a judge at a Marathi comedy party game called HasyaSabha. You evaluate answers for humor, wordplay, originality, cultural relevance, absurdity, and Marathi humour sensibility.",
      },
      {
        role: "user",
        content: `Here is the question and all player answers:\n${JSON.stringify(payload, null, 2)}\n\nPick the TOP 3 funniest and wittiest answers.\n\nRespond ONLY with valid JSON in this exact format, no extra text:\n{\n  "rankings": [\n    { "rank": 1, "index": <1-based answer number>, "name": "<player name>", "answer": "<answer text>", "score": <score out of 10>, "reason": "<one short funny sentence why>" },\n    { "rank": 2, "index": <1-based answer number>, "name": "<player name>", "answer": "<answer text>", "score": <score out of 10>, "reason": "<one short funny sentence why>" },\n    { "rank": 3, "index": <1-based answer number>, "name": "<player name>", "answer": "<answer text>", "score": <score out of 10>, "reason": "<one short funny sentence why>" }\n  ]\n}`,
      },
    ],
  });

  const raw = completion.choices[0].message.content.trim();
  return JSON.parse(raw);
}

// ── REST: AI rank answers ──────────────────────────────────────
app.post("/api/rank-answers", async (req, res) => {
  try {
    const result = await rankAnswersWithAI(req.body.answers, req.body.question);
    res.json(result);
  } catch (e) {
    console.error("[AI rank] error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── REST: Export answers as CSV ────────────────────────────────
app.get("/api/export-csv", (req, res) => {
  const rows = [["Question", "Player", "Answer", "Anonymous"]];
  for (const a of gameState.answers) {
    const q = gameState.questions.find((q) => q.id === a.questionId);
    rows.push([
      `"${(q?.text || "").replace(/"/g, '""')}"`,
      `"${a.playerName.replace(/"/g, '""')}"`,
      `"${a.text.replace(/"/g, '""')}"`,
      a.anonymous ? "Yes" : "No",
    ]);
  }
  const csv = rows.map((r) => r.join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="hasyasabha-answers.csv"`);
  res.send(csv);
});

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

async function autoPickWinner() {
  if (!gameState.activeQuestion) return;

  const questionId = gameState.activeQuestion.id;
  const questionText = gameState.activeQuestion.text;
  const activeAnswers = gameState.answers.filter((a) => a.questionId === questionId);

  // Need at least one non-AI answer
  const playerAnswers = activeAnswers.filter((a) => a.playerName !== "AI");
  if (playerAnswers.length === 0) {
    console.log("[auto-pick] No player answers to rank.");
    return;
  }

  try {
    console.log(`[auto-pick] Ranking ${playerAnswers.length} answers with AI...`);
    const serialized = playerAnswers.map((a) => ({
      displayName: a.anonymous ? "Anonymous" : a.playerName,
      text: a.text,
    }));

    const result = await rankAnswersWithAI(serialized, questionText);
    const topRanked = result.rankings?.find((r) => r.rank === 1);

    if (topRanked && topRanked.index >= 1 && topRanked.index <= playerAnswers.length) {
      const winningAnswer = playerAnswers[topRanked.index - 1];
      const globalIndex = gameState.answers.indexOf(winningAnswer);
      if (globalIndex >= 0) {
        console.log(`[auto-pick] Winner: ${winningAnswer.playerName} - "${winningAnswer.text}"`);
        announceWinner(globalIndex);
        return;
      }
    }

    // Fallback: if AI ranking didn't work, pick the first player answer
    console.log("[auto-pick] AI ranking fallback — picking first player answer.");
    const fallbackIndex = gameState.answers.indexOf(playerAnswers[0]);
    if (fallbackIndex >= 0) announceWinner(fallbackIndex);
  } catch (e) {
    console.error("[auto-pick] AI ranking failed:", e.message);
    // Fallback: pick the first player answer
    const fallbackIndex = gameState.answers.indexOf(playerAnswers[0]);
    if (fallbackIndex >= 0) {
      console.log("[auto-pick] Fallback — picking first player answer.");
      announceWinner(fallbackIndex);
    }
  }
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

      // Timer expired — auto-pick winner based on AI ranking
      autoPickWinner();
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

    // Auto-add AI answer — use mapped answer if available, otherwise a generic one
    const mappedAiAnswer = AI_ANSWERS_MAP.get(question.text.toLowerCase().trim());
    const aiAnswer = {
      questionId: question.id,
      playerName: "AI",
      text: mappedAiAnswer || "🤖 This is a test answer from AI!",
      anonymous: false,
      submittedAt: Date.now(),
      votes: new Set(),
    };
    gameState.answers.push(aiAnswer);
    const aiAnswerIndex = gameState.answers.length - 1;

    if (gameState.adminSocketId) {
      io.to(gameState.adminSocketId).emit("new-answer", {
        questionId: question.id,
        displayName: "AI",
        realName: "AI",
        text: aiAnswer.text,
        anonymous: false,
        answerIndex: aiAnswerIndex,
        voteCount: 0,
      });
    }

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
