const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'game2048.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS game_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    max_tile INTEGER DEFAULT 0,
    moves INTEGER DEFAULT 0,
    won BOOLEAN DEFAULT 0,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_game_results_user_id ON game_results(user_id);
  CREATE INDEX IF NOT EXISTS idx_game_results_played_at ON game_results(played_at);
  CREATE INDEX IF NOT EXISTS idx_game_results_score ON game_results(score DESC);
`);

module.exports = db;
