# 🎨 SketchUp

A high-performance, real-time collaborative multiplayer drawing and guessing game built with a modern full-stack TypeScript ecosystem. Players can create private game rooms, customize match parameters, paint on an optimized vector canvas, and guess words in an interactive chat feed featuring an automated speed-based scoring matrix.

🌐 **Live Demo:** https://sketchup-frontend.vercel.app  
🛰️ **Backend API:** https://sketchup-backend-ukat.onrender.com

---

# 🚀 Core Features

- ⚡ **Real-Time Multiplayer Canvas**
  - Low-latency drawing synchronization using Socket.io.
  - Smooth vector-based strokes with interpolation.
  - Brush size selector, color palette, and eraser tool.

- 🏎️ **Speed-Based Scoring**
  - Guessers receive more points the faster they answer.
  - Artists earn points whenever someone correctly guesses their drawing.
  - Automatic leaderboard updates after every round.

- 💬 **Live Chat & Guess Detection**
  - Real-time chat between players.
  - Automatic interception of correct guesses.
  - Prevents the answer from appearing in chat.
  - Ends the round early if every guesser answers correctly.

- 💾 **Cloud State Management**
  - Game rooms stored in Upstash Redis.
  - Automatic room expiration using TTL.
  - Atomic room state updates.

- 🛡️ **Disconnect Recovery**
  - Detects disconnected players.
  - Transfers host if necessary.
  - Prevents games from getting stuck if the current artist leaves.

---

# 🛠️ Tech Stack

## Frontend (`sketchup-fe`)

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Socket.io Client
- HTML5 Canvas

## Backend (`sketchup-be`)

- Node.js
- TypeScript
- Express
- Socket.io
- Redis
- Upstash Redis

---

# 📁 Repository Structure

```text
sketchup/
├── sketchup-be/          # Backend (Express + Socket.io + Redis)
└── sketchup-fe/          # Frontend (React + Vite + Tailwind)
```

---

# ⚙️ Local Development

## 1. Clone the Repository

```bash
git clone https://github.com/AbhinavKr0110/sketchup
cd sketchup
```

---

## 2. Backend Setup

Navigate into the backend:

```bash
cd sketchup-be
```

Create a `.env` file:

```env
PORT=5000
REDIS_URL=your_upstash_redis_connection_url
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

---

## 3. Frontend Setup

Open another terminal.

Navigate into the frontend:

```bash
cd sketchup-fe
```

Install dependencies:

```bash
npm install
```

Start Vite:

```bash
npm run dev
```

Open:

```
http://localhost:5173
```

Open multiple browser tabs or windows to simulate multiplayer games.

---



