const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized');

    // Load routes after database is ready
    const authRoutes = require('./routes/auth');
    const gameRoutes = require('./routes/game');
    const adminRoutes = require('./routes/admin');

    app.use('/api/auth', authRoutes);
    app.use('/api/game', gameRoutes);
    app.use('/api/admin', adminRoutes);

    app.listen(PORT, () => {
      console.log(`
  ╔═══════════════════════════════════════════╗
  ║       2048 Game Server is running!        ║
  ╠═══════════════════════════════════════════╣
  ║  Local:   http://localhost:${PORT}            ║
  ╚═══════════════════════════════════════════╝

  API Endpoints:
  - POST /api/auth/register  - Register new user
  - POST /api/auth/login     - Login
  - GET  /api/auth/me        - Get current user
  - POST /api/game/results   - Save game result
  - GET  /api/game/my-results - Get user's history
  - GET  /api/game/leaderboard - Global leaderboard
  - GET  /api/game/daily-best  - Today's best scores
  - GET  /api/game/stats       - Statistics
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
