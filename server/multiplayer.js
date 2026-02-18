const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./routes/auth');
const { prepare } = require('./db');

// Store active rooms and players
const rooms = new Map();
const playerSockets = new Map();

// Game settings
const GAME_DURATION = 60; // seconds

function setupMultiplayer(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    let playerId = null;
    let playerName = null;
    let currentRoom = null;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.type) {
          case 'auth':
            // Authenticate player
            try {
              const decoded = jwt.verify(data.token, JWT_SECRET);
              const user = prepare('SELECT id, username FROM users WHERE id = ?').get(decoded.userId);
              if (user) {
                playerId = user.id;
                playerName = user.username;
                playerSockets.set(playerId, ws);
                ws.send(JSON.stringify({ type: 'auth_success', username: playerName }));
              } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid user' }));
              }
            } catch (e) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
            }
            break;

          case 'find_game':
            // Find or create a game room
            if (!playerId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
              return;
            }

            // Look for a waiting room
            let foundRoom = null;
            for (const [roomId, room] of rooms) {
              if (room.status === 'waiting' && room.players.length === 1) {
                foundRoom = room;
                break;
              }
            }

            if (foundRoom) {
              // Join existing room
              currentRoom = foundRoom.id;
              foundRoom.players.push({ id: playerId, name: playerName, ws, score: 0, ready: false });

              // Notify both players
              foundRoom.players.forEach(p => {
                p.ws.send(JSON.stringify({
                  type: 'game_found',
                  roomId: foundRoom.id,
                  players: foundRoom.players.map(pl => ({ name: pl.name, score: pl.score })),
                  gridSize: foundRoom.gridSize
                }));
              });

              foundRoom.status = 'ready';
            } else {
              // Create new room
              const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
              const gridSize = data.gridSize || 4;
              const room = {
                id: roomId,
                players: [{ id: playerId, name: playerName, ws, score: 0, ready: false }],
                status: 'waiting',
                gridSize: gridSize,
                timeLeft: GAME_DURATION,
                timer: null
              };
              rooms.set(roomId, room);
              currentRoom = roomId;

              ws.send(JSON.stringify({
                type: 'waiting_for_opponent',
                roomId: roomId,
                gridSize: gridSize
              }));
            }
            break;

          case 'player_ready':
            // Player is ready to start
            if (!currentRoom) return;
            const readyRoom = rooms.get(currentRoom);
            if (!readyRoom) return;

            const player = readyRoom.players.find(p => p.id === playerId);
            if (player) {
              player.ready = true;
            }

            // Check if all players are ready
            if (readyRoom.players.length === 2 && readyRoom.players.every(p => p.ready)) {
              startGame(readyRoom);
            }
            break;

          case 'score_update':
            // Update player score
            if (!currentRoom) return;
            const scoreRoom = rooms.get(currentRoom);
            if (!scoreRoom || scoreRoom.status !== 'playing') return;

            const scorePlayer = scoreRoom.players.find(p => p.id === playerId);
            if (scorePlayer) {
              scorePlayer.score = data.score;
              scorePlayer.maxTile = data.maxTile || 0;

              // Broadcast score update to opponent
              scoreRoom.players.forEach(p => {
                if (p.id !== playerId) {
                  p.ws.send(JSON.stringify({
                    type: 'opponent_score',
                    score: data.score,
                    maxTile: data.maxTile
                  }));
                }
              });

              // Check for win condition (reached 2048)
              if (data.maxTile >= 2048 && !scoreRoom.winner) {
                scoreRoom.winner = playerId;
                endGame(scoreRoom, playerId);
              }
            }
            break;

          case 'game_over':
            // Player's game ended (no moves left)
            if (!currentRoom) return;
            const overRoom = rooms.get(currentRoom);
            if (!overRoom) return;

            const overPlayer = overRoom.players.find(p => p.id === playerId);
            if (overPlayer) {
              overPlayer.gameOver = true;
              overPlayer.score = data.score;
              overPlayer.maxTile = data.maxTile || 0;

              // Notify opponent
              overRoom.players.forEach(p => {
                if (p.id !== playerId) {
                  p.ws.send(JSON.stringify({
                    type: 'opponent_finished',
                    score: data.score
                  }));
                }
              });

              // Check if both players are done
              if (overRoom.players.every(p => p.gameOver)) {
                endGame(overRoom);
              }
            }
            break;

          case 'leave_room':
            leaveRoom(ws, currentRoom, playerId);
            currentRoom = null;
            break;
        }
      } catch (e) {
        console.error('WebSocket message error:', e);
      }
    });

    ws.on('close', () => {
      if (playerId) {
        playerSockets.delete(playerId);
      }
      if (currentRoom) {
        leaveRoom(ws, currentRoom, playerId);
      }
    });
  });

  return wss;
}

function startGame(room) {
  room.status = 'playing';
  room.timeLeft = GAME_DURATION;

  // Notify all players that game is starting
  room.players.forEach(p => {
    p.ws.send(JSON.stringify({
      type: 'game_start',
      duration: GAME_DURATION
    }));
  });

  // Start countdown timer
  room.timer = setInterval(() => {
    room.timeLeft--;

    // Send time update
    room.players.forEach(p => {
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(JSON.stringify({
          type: 'time_update',
          timeLeft: room.timeLeft
        }));
      }
    });

    if (room.timeLeft <= 0) {
      endGame(room);
    }
  }, 1000);
}

function endGame(room, winnerId = null) {
  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }

  room.status = 'ended';

  // Determine winner if not already set
  if (!winnerId) {
    const scores = room.players.map(p => ({ id: p.id, score: p.score, name: p.name }));
    scores.sort((a, b) => b.score - a.score);

    if (scores[0].score !== scores[1].score) {
      winnerId = scores[0].id;
    }
  }

  const winner = room.players.find(p => p.id === winnerId);
  const results = room.players.map(p => ({
    name: p.name,
    score: p.score,
    maxTile: p.maxTile || 0,
    isWinner: p.id === winnerId
  }));

  // Send game end to all players
  room.players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify({
        type: 'game_end',
        results: results,
        winner: winner ? winner.name : null,
        isDraw: !winnerId
      }));
    }
  });

  // Clean up room after a delay
  setTimeout(() => {
    rooms.delete(room.id);
  }, 5000);
}

function leaveRoom(ws, roomId, playerId) {
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  // Remove player from room
  room.players = room.players.filter(p => p.id !== playerId);

  // Notify remaining players
  if (room.players.length > 0) {
    room.players.forEach(p => {
      p.ws.send(JSON.stringify({
        type: 'opponent_left'
      }));
    });

    // End the game if it was in progress
    if (room.status === 'playing') {
      endGame(room, room.players[0].id);
    }
  }

  // Remove empty rooms
  if (room.players.length === 0) {
    if (room.timer) {
      clearInterval(room.timer);
    }
    rooms.delete(roomId);
  }
}

module.exports = { setupMultiplayer };
