# 🎭 हास्यसभा — HasyaSabha

**The Comedy Assembly** — A real-time social party game for WMM Gudi Padwa get-togethers.

Admin posts funny questions, participants answer on their phones, admin picks the funniest answer each round.

---

## Local Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env       # edit if needed
npm run dev                # starts on http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local # set VITE_BACKEND_URL=http://localhost:3001
npm run dev                # starts on http://localhost:5173
```

---

## How to Play

### Players
1. Open the game URL on their phone
2. Tap **"मी खेळाडू आहे | I am a Player"**
3. Enter game code (default: `WMMGUDIPADWA`) and their name
4. Wait in lobby — when admin activates a question, a 2-minute countdown begins
5. Type a funny answer; optionally toggle "Anonymous"
6. Submit — wait for admin to pick the winner
7. Winner is announced full-screen to everyone

### Admin
1. Open the game URL
2. Tap **"मी संचालक आहे | I am the Admin"**
3. Enter admin password (default: `hasyasabha2024`)
4. Add questions in the left panel
5. Click **"▶ Activate"** on any question — 2-minute timer starts for all players
6. Watch answers stream in on the right in real-time
7. Click **"🏆 Pick as Winner"** on the funniest answer
8. Everyone sees the winner announcement — repeat for next question

---

## Deployment

### Backend → Railway

Railway supports WebSockets natively — the `railway.toml` in `backend/` handles the config.

1. Push repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. When prompted, set **Root Directory** to `backend`
4. Set these environment variables in the Railway dashboard:
   ```
   ADMIN_PASSWORD=YourSecurePassword
   GAME_CODE=WMMGUDIPADWA
   FRONTEND_URL=https://your-vercel-app.vercel.app
   ```
   (Railway injects `PORT` automatically — do not set it manually)
5. Note your Railway public URL (e.g., `https://hasyasabha-backend.up.railway.app`)

### Frontend → Vercel

1. Import repo to Vercel
2. Set root directory to `frontend`
3. Set environment variable:
   ```
   VITE_BACKEND_URL=https://hasyasabha-backend.up.railway.app
   ```
4. Deploy — share the Vercel URL with guests via a QR code

After Vercel deploy, update `FRONTEND_URL` on Railway with the Vercel URL and redeploy to fix CORS.

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_PASSWORD` | `hasyasabha2024` | Admin panel password |
| `GAME_CODE` | `WMMGUDIPADWA` | Code players use to join |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |
| `PORT` | `3001` | Backend port |

---

## Tech Stack

- **Frontend:** React 18 + Vite (deployed to Vercel)
- **Backend:** Node.js + Express + Socket.io (deployed to Railway)
- **Real-time:** WebSockets via Socket.io
- **State:** In-memory (no database needed for a one-time event)
