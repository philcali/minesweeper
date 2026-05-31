// Minesweeper Game Logic

const DIFFICULTIES = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

const NUMBER_SYMBOLS = ['', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];

let board = [];
let rows, cols, totalMines;
let mineCount;
let revealedCount;
let flagCount;
let gameOver;
let gameStarted;
let firstClick;
let timerInterval;
let elapsed;
let currentDifficulty = 'beginner';
let flagMode = false;
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;
let touchEnded = false;
let timerFired = false;

// DOM refs
const boardEl = document.getElementById('board');
const boardWrapper = document.getElementById('board-wrapper');
const mineCountEl = document.getElementById('mine-count');
const timerEl = document.getElementById('timer');
const resetBtn = document.getElementById('reset-btn');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlay-text');
const overlayStats = document.getElementById('overlay-stats');
const overlayBtn = document.getElementById('overlay-btn');
const flagIndicator = document.getElementById('flag-indicator');
const flagToggleBtn = document.getElementById('flag-toggle');
const diffBtns = document.querySelectorAll('.difficulty-btn');

// --- Init ---

function init(difficulty) {
  currentDifficulty = difficulty;
  const cfg = DIFFICULTIES[difficulty];
  rows = cfg.rows;
  cols = cfg.cols;
  totalMines = cfg.mines;

  board = [];
  mineCount = totalMines;
  revealedCount = 0;
  flagCount = 0;
  gameOver = false;
  gameStarted = false;
  firstClick = true;
  elapsed = 0;
  flagMode = false;
  flagToggleBtn.classList.remove('active');
  clearInterval(timerInterval);

  boardEl.style.setProperty('--rows', rows);
  boardEl.style.setProperty('--cols', cols);

  renderBoard();
  updateUI();
  hideOverlay();
  updateDiffButtons();
}

function renderBoard() {
  boardEl.innerHTML = '';
  board = [];

  for (let r = 0; r < rows; r++) {
    board[r] = [];
    for (let c = 0; c < cols; c++) {
      board[r][c] = {
        mine: false,
        revealed: false,
        flagged: false,
        adjacentMines: 0,
      };

      const cell = document.createElement('div');
      cell.className = 'cell hidden';
      cell.dataset.row = r;
      cell.dataset.col = c;

      // Mouse events
      cell.addEventListener('mousedown', onMouseDown);
      cell.addEventListener('mouseup', onMouseUp);
      cell.addEventListener('mouseleave', onMouseLeave);
      cell.addEventListener('contextmenu', (e) => e.preventDefault());

      // Touch events on individual cells
      cell.addEventListener('touchstart', onTouchStart);
      cell.addEventListener('touchmove', onTouchMove);
      cell.addEventListener('touchend', onTouchEnd);
      cell.addEventListener('touchcancel', onTouchCancel);

      boardEl.appendChild(cell);
    }
  }
}

function getCell(r, c) {
  return boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

// --- Mine placement (after first click) ---

function placeMines(safeRow, safeCol) {
  const safeCells = getNeighbors(safeRow, safeCol);
  safeCells.push({ r: safeRow, c: safeCol });

  let placed = 0;
  while (placed < totalMines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);

    // Don't place on safe cells or existing mines
    const isSafe = safeCells.some((n) => n.r === r && n.c === c);
    if (!isSafe && !board[r][c].mine) {
      board[r][c].mine = true;
      placed++;
    }
  }

  // Calculate adjacent mine counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!board[r][c].mine) {
        board[r][c].adjacentMines = countAdjacentMines(r, c);
      }
    }
  }
}

function getNeighbors(r, c) {
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        neighbors.push({ r: nr, c: nc });
      }
    }
  }
  return neighbors;
}

function countAdjacentMines(r, c) {
  return getNeighbors(r, c).filter((n) => board[n.r][n.c].mine).length;
}

// --- Input handling ---

function onMouseDown(e) {
  if (gameOver) return;
  e.preventDefault();

  const r = parseInt(this.dataset.row);
  const c = parseInt(this.dataset.col);

  // Right click = flag
  if (e.button === 2) {
    toggleFlag(r, c);
    return;
  }

  // Left click = reveal (or flag if flag mode is on)
  if (flagMode) {
    toggleFlag(r, c);
  } else {
    handleCellTap(r, c);
  }
}

function onMouseUp(e) {
  // No-op, handled in onMouseDown
}

function onMouseLeave() {
  // No-op
}

function onTouchStart(e) {
  if (gameOver) return;

  const r = parseInt(this.dataset.row);
  const c = parseInt(this.dataset.col);

  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchMoved = false;
  timerFired = false;
  longPressTarget = { r, c };

  longPressTimer = setTimeout(() => {
    if (!flagMode) {
      timerFired = true;
      toggleFlag(r, c);
      if (navigator.vibrate) navigator.vibrate(30);
    }
  }, 300);
}

function onTouchMove(e) {
  if (!touchMoved) {
    const dx = Math.abs(e.touches[0].clientX - touchStartX);
    const dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (dx > 10 || dy > 10) {
      touchMoved = true;
      clearTimeout(longPressTimer);
    }
  }
}

function onTouchEnd(e) {
  if (gameOver) return;
  clearTimeout(longPressTimer);

  e.preventDefault();
  const r = parseInt(this.dataset.row);
  const c = parseInt(this.dataset.col);
  if (flagMode) {
    toggleFlag(r, c);
  } else {
    handleCellTap(r, c);
  }
}

function onTouchCancel() {
  clearTimeout(longPressTimer);
  touchMoved = false;
  timerFired = false;
}

function handleCellTap(r, c) {
  const cell = board[r][c];

  if (cell.flagged) return;

  // If already revealed, try chord (auto-reveal neighbors)
  if (cell.revealed) {
    chordReveal(r, c);
    return;
  }

  // First click? Place mines
  if (firstClick) {
    firstClick = false;
    placeMines(r, c);
    startTimer();
    gameStarted = true;
  }

  revealCell(r, c);
}

// --- Chord (tap revealed number to auto-reveal) ---

function chordReveal(r, c) {
  const cell = board[r][c];
  if (!cell.revealed || cell.adjacentMines === 0) return;

  const neighbors = getNeighbors(r, c);
  const flaggedCount = neighbors.filter((n) => board[n.r][n.c].flagged).length;

  if (flaggedCount === cell.adjacentMines) {
    let hitMine = false;
    const toReveal = [];

    neighbors.forEach((n) => {
      const neighbor = board[n.r][n.c];
      if (!neighbor.revealed && !neighbor.flagged) {
        if (neighbor.mine) {
          hitMine = true;
        } else {
          toReveal.push(n);
        }
      }
    });

    if (hitMine) {
      // Reveal the mine
      const mineNeighbor = neighbors.find(
        (n) => board[n.r][n.c].mine && !board[n.r][n.c].flagged
      );
      if (mineNeighbor) {
        revealCell(mineNeighbor.r, mineNeighbor.c);
      }
    } else {
      // Safe to reveal all
      toReveal.forEach((n) => revealCell(n.r, n.c));
    }
  }
}

// --- Reveal logic ---

function revealCell(r, c) {
  const cell = board[r][c];
  if (cell.revealed || cell.flagged || gameOver) return;

  cell.revealed = true;
  revealedCount++;

  const cellEl = getCell(r, c);
  cellEl.className = 'cell revealed';

  if (cell.mine) {
    cellEl.textContent = '💣';
    cellEl.classList.add('mine-hit');
    endGame(false);
    return;
  }

  if (cell.adjacentMines > 0) {
    cellEl.textContent = NUMBER_SYMBOLS[cell.adjacentMines] || cell.adjacentMines;
    cellEl.dataset.number = cell.adjacentMines;
  }

  // Flood fill for empty cells
  if (cell.adjacentMines === 0) {
    floodReveal(r, c);
  }

  // Check win
  if (revealedCount === rows * cols - totalMines) {
    endGame(true);
  }
}

function floodReveal(startR, startC) {
  const queue = [{ r: startR, c: startC }];
  const revealed = new Set();
  revealed.add(`${startR},${startC}`);

  while (queue.length > 0) {
    const { r, c } = queue.shift();
    const neighbors = getNeighbors(r, c);

    neighbors.forEach((n) => {
      const key = `${n.r},${n.c}`;
      if (revealed.has(key)) return;

      const neighbor = board[n.r][n.c];
      if (neighbor.revealed || neighbor.flagged) return;

      neighbor.revealed = true;
      revealed.add(key);
      revealedCount++;

      const cellEl = getCell(n.r, n.c);
      cellEl.className = 'cell revealed cascade';
      cellEl.style.animationDelay = `${revealed.size * 8}ms`;

      if (neighbor.adjacentMines > 0) {
        cellEl.textContent = NUMBER_SYMBOLS[neighbor.adjacentMines] || neighbor.adjacentMines;
        cellEl.dataset.number = neighbor.adjacentMines;
      }

      if (neighbor.adjacentMines === 0) {
        queue.push(n);
      }

      if (revealedCount === rows * cols - totalMines) {
        endGame(true);
      }
    });
  }
}

// --- Flag ---

function toggleFlag(r, c) {
  const cell = board[r][c];
  if (cell.revealed || gameOver) return;

  cell.flagged = !cell.flagged;
  flagCount += cell.flagged ? 1 : -1;

  const cellEl = getCell(r, c);
  if (cell.flagged) {
    cellEl.className = 'cell flagged';
  } else {
    cellEl.className = 'cell hidden';
  }

  updateUI();
}

// --- Timer ---

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    elapsed++;
    if (elapsed > 999) elapsed = 999;
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  timerEl.textContent = `⏱ ${String(elapsed).padStart(3, '0')}`;
}

// --- UI ---

function updateUI() {
  mineCountEl.textContent = `💣 ${mineCount - flagCount}`;
  updateTimerDisplay();
}

function updateDiffButtons() {
  diffBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.diff === currentDifficulty);
  });
}

function showFlagIndicator(r, c, x, y) {
  const cellEl = getCell(r, c);
  const rect = cellEl.getBoundingClientRect();
  flagIndicator.style.left = `${rect.left + rect.width / 2}px`;
  flagIndicator.style.top = `${rect.top + rect.height / 2}px`;
  flagIndicator.classList.add('visible');
}

function hideFlagIndicator() {
  flagIndicator.classList.remove('visible');
}

// --- End game ---

function endGame(won) {
  gameOver = true;
  clearInterval(timerInterval);

  resetBtn.textContent = won ? '😎' : '😵';

  if (!won) {
    // Reveal all mines
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        const cellEl = getCell(r, c);

        if (cell.mine && !cell.flagged) {
          cellEl.className = 'cell mine-revealed';
          cellEl.textContent = '💣';
        } else if (!cell.mine && cell.flagged) {
          cellEl.className = 'cell mine-wrong';
          cellEl.textContent = '';
        }
      }
    }

    overlayText.className = 'overlay-text lose';
    overlayText.textContent = 'GAME OVER';
    overlayStats.textContent = `Mines: ${totalMines} | Time: ${elapsed}s`;
  } else {
    // Mark remaining mines with flags
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        if (cell.mine && !cell.flagged) {
          cell.flagged = true;
          const cellEl = getCell(r, c);
          cellEl.className = 'cell flagged';
        }
      }
    }
    flagCount = totalMines;
    mineCountEl.textContent = `💣 0`;

    // Win animation
    const cells = boardEl.querySelectorAll('.cell.revealed');
    cells.forEach((cellEl, i) => {
      cellEl.classList.add('win-cell');
      cellEl.style.animationDelay = `${i * 15}ms`;
    });

    overlayText.className = 'overlay-text win';
    overlayText.textContent = 'YOU WIN!';
    overlayStats.textContent = `Difficulty: ${currentDifficulty} | Time: ${elapsed}s`;
  }

  setTimeout(() => {
    overlay.classList.add('visible');
  }, won ? 500 : 300);
}

function hideOverlay() {
  overlay.classList.remove('visible');
  resetBtn.textContent = '😊';
}

// --- Event listeners ---

diffBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.diff !== currentDifficulty) {
      init(btn.dataset.diff);
    }
  });
});

resetBtn.addEventListener('click', () => init(currentDifficulty));
overlayBtn.addEventListener('click', () => init(currentDifficulty));

// Flag toggle button
flagToggleBtn.addEventListener('click', () => {
  flagMode = !flagMode;
  flagToggleBtn.classList.toggle('active', flagMode);
});

// Prevent context menu on board
boardEl.addEventListener('contextmenu', (e) => e.preventDefault());

// Start game
init('beginner');

// --- PWA: Service Worker Registration ---

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => {
        console.log('SW registered:', reg.scope);
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('New SW version available');
            }
          });
        });
      })
      .catch((err) => console.error('SW registration failed:', err));
  });
}
