// API Client for 2048 Game
const API_BASE = '/api';

const GameAPI = {
  token: localStorage.getItem('game2048_token'),
  user: JSON.parse(localStorage.getItem('game2048_user') || 'null'),

  // Set authorization header
  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  },

  // Save token and user
  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('game2048_token', token);
    localStorage.setItem('game2048_user', JSON.stringify(user));
    // Clear game state so a new game starts for the new user
    localStorage.removeItem('gameState');
    this.updateUI();
    // Reload page to start a fresh game
    window.location.reload();
  },

  // Clear auth
  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('game2048_token');
    localStorage.removeItem('game2048_user');
    // Clear game state so a new game starts
    localStorage.removeItem('gameState');
    this.updateUI();
    // Reload page to restart game
    window.location.reload();
  },

  // Check if logged in
  isLoggedIn() {
    return !!this.token && !!this.user;
  },

  // Register
  async register(username, email, password) {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    this.setAuth(data.token, data.user);
    return data;
  },

  // Login
  async login(username, password) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    this.setAuth(data.token, data.user);
    return data;
  },

  // Save game result
  async saveResult(score, maxTile, moves, won) {
    if (!this.isLoggedIn()) return null;

    const response = await fetch(`${API_BASE}/game/results`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ score, maxTile, moves, won })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  },

  // Get leaderboard
  async getLeaderboard(limit = 10) {
    const response = await fetch(`${API_BASE}/game/leaderboard?limit=${limit}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data.leaderboard;
  },

  // Get daily best
  async getDailyBest() {
    const response = await fetch(`${API_BASE}/game/daily-best`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  },

  // Get my results
  async getMyResults() {
    if (!this.isLoggedIn()) return null;

    const response = await fetch(`${API_BASE}/game/my-results`, {
      headers: this.getHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  },

  // Update UI based on login state
  updateUI() {
    const authSection = document.getElementById('auth-section');
    const userInfo = document.getElementById('user-info');
    const usernameDisplay = document.getElementById('username-display');
    const loginWarning = document.getElementById('login-warning');

    if (authSection && userInfo) {
      if (this.isLoggedIn()) {
        authSection.style.display = 'none';
        userInfo.style.display = 'flex';
        if (usernameDisplay) usernameDisplay.textContent = this.user.username;
        if (loginWarning) loginWarning.classList.add('hidden');
      } else {
        authSection.style.display = 'block';
        userInfo.style.display = 'none';
        if (loginWarning) loginWarning.classList.remove('hidden');
      }
    }

    // Load leaderboard
    this.loadLeaderboard();
  },

  // Load and display leaderboard
  async loadLeaderboard() {
    const leaderboardEl = document.getElementById('leaderboard-list');
    if (!leaderboardEl) return;

    try {
      const leaderboard = await this.getLeaderboard(10);
      leaderboardEl.innerHTML = leaderboard.map((entry, index) => `
        <div class="leaderboard-entry ${index < 3 ? 'top-' + (index + 1) : ''}">
          <span class="rank">#${index + 1}</span>
          <span class="name">${entry.username}</span>
          <span class="score">${entry.score}</span>
        </div>
      `).join('') || '<div class="no-results">No results yet</div>';
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  },

  // Load daily best
  async loadDailyBest() {
    const dailyEl = document.getElementById('daily-best');
    if (!dailyEl) return;

    try {
      const daily = await this.getDailyBest();
      if (daily.winner) {
        dailyEl.innerHTML = `
          <div class="daily-winner">
            <span class="winner-label">Today's Best:</span>
            <span class="winner-name">${daily.winner.username}</span>
            <span class="winner-score">${daily.winner.score}</span>
          </div>
        `;
      } else {
        dailyEl.innerHTML = '<div class="no-winner">No games played today</div>';
      }
    } catch (error) {
      console.error('Failed to load daily best:', error);
    }
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  GameAPI.updateUI();
  GameAPI.loadDailyBest();
});
