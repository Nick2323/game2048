// Multiplayer client for 2048
var Multiplayer = (function() {
  var ws = null;
  var connected = false;
  var authenticated = false;
  var inGame = false;
  var gameManager = null;
  var opponentScore = 0;
  var opponentMaxTile = 0;

  function getWebSocketUrl() {
    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return protocol + '//' + window.location.host + '/ws';
  }

  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise(function(resolve, reject) {
      ws = new WebSocket(getWebSocketUrl());

      ws.onopen = function() {
        connected = true;
        console.log('WebSocket connected');

        // Authenticate with token
        var token = localStorage.getItem('game2048_token');
        if (token) {
          ws.send(JSON.stringify({ type: 'auth', token: token }));
        }
        resolve();
      };

      ws.onmessage = function(event) {
        handleMessage(JSON.parse(event.data));
      };

      ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        reject(error);
      };

      ws.onclose = function() {
        connected = false;
        authenticated = false;
        console.log('WebSocket disconnected');
        updateUI();
      };
    });
  }

  function handleMessage(data) {
    console.log('WS message:', data);

    switch (data.type) {
      case 'auth_success':
        authenticated = true;
        updateUI();
        break;

      case 'error':
        showStatus(data.message, 'error');
        break;

      case 'waiting_for_opponent':
        showStatus('Waiting for opponent...', 'waiting');
        break;

      case 'game_found':
        showStatus('Opponent found: ' + data.players.map(function(p) { return p.name; }).join(' vs '), 'found');
        prepareMultiplayerGame(data.gridSize);
        break;

      case 'game_start':
        startMultiplayerGame(data.duration);
        break;

      case 'opponent_score':
        updateOpponentScore(data.score, data.maxTile);
        break;

      case 'opponent_finished':
        showStatus('Opponent finished with score: ' + data.score, 'info');
        break;

      case 'opponent_left':
        showStatus('Opponent left the game', 'error');
        endMultiplayerGame();
        break;

      case 'time_update':
        updateMultiplayerTimer(data.timeLeft);
        break;

      case 'game_end':
        showGameResults(data);
        break;
    }
  }

  function findGame() {
    // Connect first if not connected
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showStatus('Connecting...', 'searching');
      showMultiplayerPanel();
      connect().then(function() {
        // Wait for authentication
        setTimeout(function() {
          if (authenticated) {
            var gridSize = typeof getStoredGridSize === 'function' ? getStoredGridSize() : 4;
            ws.send(JSON.stringify({ type: 'find_game', gridSize: gridSize }));
            showStatus('Finding game...', 'searching');
          } else {
            showStatus('Authentication failed. Please refresh and try again.', 'error');
          }
        }, 500);
      }).catch(function(err) {
        showStatus('Connection failed: ' + err, 'error');
      });
      return;
    }

    if (!authenticated) {
      showStatus('Please wait, authenticating...', 'waiting');
      return;
    }

    var gridSize = typeof getStoredGridSize === 'function' ? getStoredGridSize() : 4;
    ws.send(JSON.stringify({ type: 'find_game', gridSize: gridSize }));
    showStatus('Finding game...', 'searching');
    showMultiplayerPanel();
  }

  function leaveGame() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'leave_room' }));
    }
    inGame = false;
    hideMultiplayerPanel();
    updateUI();
  }

  function prepareMultiplayerGame(gridSize) {
    inGame = true;
    opponentScore = 0;
    opponentMaxTile = 0;

    // Change grid size if different
    if (typeof changeGridSize === 'function' && gridSize) {
      changeGridSize(gridSize);
    }

    // Send ready signal
    ws.send(JSON.stringify({ type: 'player_ready' }));
    showStatus('Both players connected! Starting...', 'ready');
  }

  function startMultiplayerGame(duration) {
    // Restart the game
    if (typeof gameManager !== 'undefined' && window.gameManager) {
      window.gameManager.restart();
    }

    showStatus('Game started!', 'playing');
    updateOpponentDisplay();
  }

  function sendScoreUpdate(score, maxTile) {
    if (ws && ws.readyState === WebSocket.OPEN && inGame) {
      ws.send(JSON.stringify({
        type: 'score_update',
        score: score,
        maxTile: maxTile
      }));
    }
  }

  function sendGameOver(score, maxTile) {
    if (ws && ws.readyState === WebSocket.OPEN && inGame) {
      ws.send(JSON.stringify({
        type: 'game_over',
        score: score,
        maxTile: maxTile
      }));
    }
  }

  function updateOpponentScore(score, maxTile) {
    opponentScore = score;
    opponentMaxTile = maxTile || 0;
    updateOpponentDisplay();
  }

  function updateOpponentDisplay() {
    var scoreEl = document.getElementById('opponent-score');
    var tileEl = document.getElementById('opponent-max-tile');

    if (scoreEl) scoreEl.textContent = opponentScore;
    if (tileEl) tileEl.textContent = opponentMaxTile;
  }

  function updateMultiplayerTimer(timeLeft) {
    var timerEl = document.getElementById('mp-timer');
    if (timerEl) {
      var minutes = Math.floor(timeLeft / 60);
      var seconds = timeLeft % 60;
      timerEl.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    }
  }

  function showGameResults(data) {
    inGame = false;
    var resultHtml = '<h4>Game Over!</h4>';

    if (data.isDraw) {
      resultHtml += '<p class="mp-draw">Draw!</p>';
    } else {
      resultHtml += '<p class="mp-winner">Winner: ' + data.winner + '</p>';
    }

    resultHtml += '<div class="mp-results">';
    data.results.forEach(function(r) {
      resultHtml += '<div class="mp-result-row' + (r.isWinner ? ' winner' : '') + '">';
      resultHtml += '<span class="mp-result-name">' + r.name + '</span>';
      resultHtml += '<span class="mp-result-score">' + r.score + '</span>';
      resultHtml += '</div>';
    });
    resultHtml += '</div>';
    resultHtml += '<button onclick="Multiplayer.findGame()" class="mp-btn">Play Again</button>';
    resultHtml += '<button onclick="Multiplayer.leaveGame()" class="mp-btn secondary">Leave</button>';

    var statusEl = document.getElementById('mp-status');
    if (statusEl) {
      statusEl.innerHTML = resultHtml;
    }
  }

  function showStatus(message, type) {
    var statusEl = document.getElementById('mp-status');
    if (statusEl) {
      statusEl.innerHTML = '<p class="mp-status-' + type + '">' + message + '</p>';
    }
  }

  function showMultiplayerPanel() {
    var panel = document.getElementById('multiplayer-panel');
    if (panel) panel.style.display = 'block';
  }

  function hideMultiplayerPanel() {
    var panel = document.getElementById('multiplayer-panel');
    if (panel) panel.style.display = 'none';
  }

  function endMultiplayerGame() {
    inGame = false;
    setTimeout(function() {
      hideMultiplayerPanel();
    }, 3000);
  }

  function updateUI() {
    var findBtn = document.getElementById('find-game-btn');
    if (findBtn) {
      findBtn.disabled = !authenticated;
      findBtn.style.display = GameAPI.isLoggedIn() ? 'block' : 'none';
    }
  }

  function isInGame() {
    return inGame;
  }

  // Auto-connect when logged in
  function init() {
    if (GameAPI.isLoggedIn()) {
      connect().then(function() {
        updateUI();
      }).catch(function(err) {
        console.error('Failed to connect:', err);
      });
    }

    // Update UI initially
    updateUI();
  }

  // Initialize after page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  return {
    connect: connect,
    findGame: findGame,
    leaveGame: leaveGame,
    sendScoreUpdate: sendScoreUpdate,
    sendGameOver: sendGameOver,
    isInGame: isInGame,
    init: init
  };
})();
