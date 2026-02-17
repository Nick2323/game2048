const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prepare } = require('../db');
const { JWT_SECRET } = require('./auth');

const router = express.Router();

// Admin auth middleware
const adminMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(decoded.userId);

    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.userId = user.id;
    req.username = user.username;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/admin/stats - overall stats
router.get('/stats', adminMiddleware, (req, res) => {
  try {
    const users     = prepare('SELECT COUNT(*) as count FROM users').get();
    const games     = prepare('SELECT COUNT(*) as count FROM game_results').get();
    const topScore  = prepare('SELECT MAX(score) as top FROM game_results').get();
    const todayGames = prepare("SELECT COUNT(*) as count FROM game_results WHERE date(played_at) = date('now')").get();

    res.json({ users: users.count, games: games.count, topScore: topScore.top || 0, todayGames: todayGames.count });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/users - list all users
router.get('/users', adminMiddleware, (req, res) => {
  try {
    const users = prepare(`
      SELECT u.id, u.username, u.email, u.is_admin, u.created_at,
             COUNT(g.id) as total_games,
             MAX(g.score) as best_score
      FROM users u
      LEFT JOIN game_results g ON u.id = g.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all();
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/users/:id - delete user
router.delete('/users/:id', adminMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.userId) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    prepare('DELETE FROM game_results WHERE user_id = ?').run(id);
    prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ message: 'User deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/admin/users/:id/toggle-admin - toggle admin status
router.patch('/users/:id/toggle-admin', adminMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const user = prepare('SELECT is_admin FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(user.is_admin ? 0 : 1, id);
    res.json({ message: 'Updated', is_admin: !user.is_admin });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/results - all game results
router.get('/results', adminMiddleware, (req, res) => {
  try {
    const results = prepare(`
      SELECT g.id, u.username, g.score, g.max_tile, g.moves, g.won, g.played_at
      FROM game_results g
      JOIN users u ON g.user_id = u.id
      ORDER BY g.played_at DESC
      LIMIT 100
    `).all();
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/results/:id - delete a result
router.delete('/results/:id', adminMiddleware, (req, res) => {
  try {
    prepare('DELETE FROM game_results WHERE id = ?').run(req.params.id);
    res.json({ message: 'Result deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
