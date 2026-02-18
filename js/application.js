// Global game manager reference
var gameManager = null;

// Get stored grid size or default to 4
function getStoredGridSize() {
  var stored = localStorage.getItem('game2048_gridSize');
  if (stored) {
    var size = parseInt(stored);
    if ([3, 4, 5, 6].indexOf(size) !== -1) {
      return size;
    }
  }
  return 4;
}

// Store grid size preference
function setStoredGridSize(size) {
  localStorage.setItem('game2048_gridSize', size);
}

// Change grid size
function changeGridSize(newSize) {
  if (gameManager && [3, 4, 5, 6].indexOf(newSize) !== -1) {
    setStoredGridSize(newSize);
    gameManager.changeSize(newSize);
    updateGridSizeButtons(newSize);
  }
}

// Update grid size button states
function updateGridSizeButtons(activeSize) {
  document.querySelectorAll('.grid-size-btn').forEach(function(btn) {
    var size = parseInt(btn.getAttribute('data-size'));
    if (size === activeSize) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function () {
  var initialSize = getStoredGridSize();
  gameManager = new GameManager(initialSize, KeyboardInputManager, HTMLActuator, LocalStorageManager);
  updateGridSizeButtons(initialSize);
});
