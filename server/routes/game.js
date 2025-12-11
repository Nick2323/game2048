const express = require('express');
const jwt = require('jsonwebtoken');
const { prepare } = require('../db');
const { JWT_SECRET } = require('./auth');

const router = express.Router();

// Middleware to verify token
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Save game result
router.post('/results', authMiddleware, (req, res) => {
  try {
    const { score, maxTile, moves, won } = req.body;

    if (score === undefined) {
      return res.status(400).json({ error: 'Score is required' });
    }

    const result = prepare(`
      INSERT INTO game_results (user_id, score, max_tile, moves, won)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.userId, score, maxTile || 0, moves || 0, won ? 1 : 0);

    res.status(201).json({
      message: 'Result saved',
      resultId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Save result error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's game history
router.get('/my-results', authMiddleware, (req, res) => {
  try {
    const results = prepare(`
      SELECT id, score, max_tile, moves, won, played_at
      FROM game_results
      WHERE user_id = ?
      ORDER BY played_at DESC
      LIMIT 50
    `).all(req.userId);

    const stats = prepare(`
      SELECT
        COUNT(*) as total_games,
        MAX(score) as best_score,
        AVG(score) as avg_score,
        SUM(won) as wins
      FROM game_results
      WHERE user_id = ?
    `).get(req.userId);

    res.json({ results, stats });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get global leaderboard (all-time best scores)
router.get('/leaderboard', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);

    const leaderboard = prepare(`
      SELECT
        u.username,
        gr.score,
        gr.max_tile,
        gr.played_at
      FROM game_results gr
      JOIN users u ON gr.user_id = u.id
      ORDER BY gr.score DESC
      LIMIT ?
    `).all(limit);

    res.json({ leaderboard });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get today's best scores
router.get('/daily-best', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const dailyBest = prepare(`
      SELECT
        u.username,
        gr.score,
        gr.max_tile,
        gr.played_at
      FROM game_results gr
      JOIN users u ON gr.user_id = u.id
      WHERE date(gr.played_at) = date(?)
      ORDER BY gr.score DESC
      LIMIT 10
    `).all(today);

    // Get the winner (best score of the day)
    const winner = dailyBest.length > 0 ? dailyBest[0] : null;

    res.json({
      date: today,
      winner,
      topScores: dailyBest
    });
  } catch (error) {
    console.error('Daily best error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get statistics by date range
router.get('/stats', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;

    const dailyStats = prepare(`
      SELECT
        date(played_at) as date,
        COUNT(*) as games_played,
        MAX(score) as best_score,
        AVG(score) as avg_score,
        COUNT(DISTINCT user_id) as unique_players
      FROM game_results
      WHERE played_at >= datetime('now', ?)
      GROUP BY date(played_at)
      ORDER BY date DESC
    `).all(`-${days} days`);

    res.json({ dailyStats });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
