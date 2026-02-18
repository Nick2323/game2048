function HTMLActuator() {
  this.tileContainer    = document.querySelector(".tile-container");
  this.scoreContainer   = document.querySelector(".score-container");
  this.bestContainer    = document.querySelector(".best-container");
  this.messageContainer = document.querySelector(".game-message");
  this.gridContainer    = document.querySelector(".grid-container");

  this.score = 0;
  this.gridSize = 4;
  this.containerSize = 470; // usable size inside game-container
  this.gapSize = 15;
  this.cellSize = 106.25;
  this.positionStep = 121;
  this.tileSize = 80;
}

// Set grid size and rebuild grid
HTMLActuator.prototype.setGridSize = function (size) {
  this.gridSize = size;
  this.cellSize = (this.containerSize - (size - 1) * this.gapSize) / size;
  this.positionStep = this.cellSize + this.gapSize;
  // Tile is slightly smaller than cell
  this.tileSize = this.cellSize - 26;
  if (this.tileSize < 40) this.tileSize = 40;
  this.buildGrid();
};

// Build grid cells dynamically
HTMLActuator.prototype.buildGrid = function () {
  this.clearContainer(this.gridContainer);

  for (var y = 0; y < this.gridSize; y++) {
    var row = document.createElement("div");
    row.classList.add("grid-row");

    for (var x = 0; x < this.gridSize; x++) {
      var cell = document.createElement("div");
      cell.classList.add("grid-cell");
      cell.style.width = this.cellSize + "px";
      cell.style.height = this.cellSize + "px";
      row.appendChild(cell);
    }

    this.gridContainer.appendChild(row);
  }
};

HTMLActuator.prototype.actuate = function (grid, metadata) {
  var self = this;

  window.requestAnimationFrame(function () {
    self.clearContainer(self.tileContainer);

    grid.cells.forEach(function (column) {
      column.forEach(function (cell) {
        if (cell) {
          self.addTile(cell);
        }
      });
    });

    self.updateScore(metadata.score);
    self.updateBestScore(metadata.bestScore);

    if (metadata.terminated) {
      if (metadata.over) {
        self.message(false); // You lose
      } else if (metadata.won) {
        self.message(true); // You win!
      }
    }

  });
};

// Continues the game (both restart and keep playing)
HTMLActuator.prototype.continueGame = function () {
  this.clearMessage();
};

HTMLActuator.prototype.clearContainer = function (container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
};

// Calculate tile position in pixels
HTMLActuator.prototype.calculatePosition = function (position) {
  return {
    x: position.x * this.positionStep,
    y: position.y * this.positionStep
  };
};

HTMLActuator.prototype.addTile = function (tile) {
  var self = this;

  var wrapper   = document.createElement("div");
  var inner     = document.createElement("div");
  var position  = tile.previousPosition || { x: tile.x, y: tile.y };
  var pixelPos  = this.calculatePosition(position);

  // Set tile size based on grid
  wrapper.style.width = this.tileSize + "px";
  wrapper.style.height = this.tileSize + "px";
  inner.style.width = this.tileSize + "px";
  inner.style.height = this.tileSize + "px";
  inner.style.lineHeight = this.tileSize + "px";

  // Adjust font size for smaller tiles
  var fontSize = this.tileSize * 0.55;
  if (tile.value >= 100) fontSize = this.tileSize * 0.45;
  if (tile.value >= 1000) fontSize = this.tileSize * 0.35;
  inner.style.fontSize = fontSize + "px";

  // Set position using transform
  wrapper.style.transform = "translate(" + pixelPos.x + "px, " + pixelPos.y + "px)";

  var classes = ["tile", "tile-" + tile.value];
  if (tile.value > 2048) classes.push("tile-super");

  this.applyClasses(wrapper, classes);

  inner.classList.add("tile-inner");
  inner.textContent = tile.value;

  if (tile.previousPosition) {
    // Make sure that the tile gets rendered in the previous position first
    window.requestAnimationFrame(function () {
      var newPixelPos = self.calculatePosition({ x: tile.x, y: tile.y });
      wrapper.style.transform = "translate(" + newPixelPos.x + "px, " + newPixelPos.y + "px)";
    });
  } else if (tile.mergedFrom) {
    classes.push("tile-merged");
    this.applyClasses(wrapper, classes);

    // Render the tiles that merged
    tile.mergedFrom.forEach(function (merged) {
      self.addTile(merged);
    });
  } else {
    classes.push("tile-new");
    this.applyClasses(wrapper, classes);
  }

  // Add the inner part of the tile to the wrapper
  wrapper.appendChild(inner);

  // Put the tile on the board
  this.tileContainer.appendChild(wrapper);
};

HTMLActuator.prototype.applyClasses = function (element, classes) {
  element.setAttribute("class", classes.join(" "));
};

HTMLActuator.prototype.normalizePosition = function (position) {
  return { x: position.x + 1, y: position.y + 1 };
};

HTMLActuator.prototype.positionClass = function (position) {
  position = this.normalizePosition(position);
  return "tile-position-" + position.x + "-" + position.y;
};

HTMLActuator.prototype.updateScore = function (score) {
  this.clearContainer(this.scoreContainer);

  var difference = score - this.score;
  this.score = score;

  this.scoreContainer.textContent = this.score;

  if (difference > 0) {
    var addition = document.createElement("div");
    addition.classList.add("score-addition");
    addition.textContent = "+" + difference;

    this.scoreContainer.appendChild(addition);
  }
};

HTMLActuator.prototype.updateBestScore = function (bestScore) {
  this.bestContainer.textContent = bestScore;
};

HTMLActuator.prototype.message = function (won) {
  var type    = won ? "game-won" : "game-over";
  var message = won ? "You win!" : "Game over!";

  this.messageContainer.classList.add(type);
  this.messageContainer.getElementsByTagName("p")[0].textContent = message;
};

HTMLActuator.prototype.clearMessage = function () {
  // IE only takes one value to remove at a time.
  this.messageContainer.classList.remove("game-won");
  this.messageContainer.classList.remove("game-over");
};
