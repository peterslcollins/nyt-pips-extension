const REGION_COLORS = {
  orange: '#FFB366',
  blue: '#66B3FF',
  green: '#66FF99',
  purple: '#CC99FF',
  pink: '#FF99CC',
  yellow: '#FFFF99',
  teal: '#66FFCC',
  red: '#FF6666',
  gray: '#CCCCCC'
};

document.getElementById("solveBtn").addEventListener("click", async () => {
  showStatus("Solving puzzle...", "info");
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["solverScript.js"]
  });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: () => window.__nytSolverOutput
  }, (results) => {
    const output = results?.[0]?.result;
    console.log("Output from page:", output);

    if (!output || !output.solution) {
      showStatus("No solution found!", "error");
      return;
    }

    if (output.solution === false) {
      showStatus("Puzzle has no solution!", "error");
      return;
    }

    showStatus("Solution found!", "success");
    renderSolution(output);
  });
});

function showStatus(message, type) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = type;
  status.style.display = "block";
}

function renderSolution(output) {
  const { puzzleInfo, solution } = output;
  const { rows, cols, regions, playableCells } = puzzleInfo;
  
  const container = document.getElementById("boardContainer");
  container.innerHTML = "";
  
  const board = document.createElement("div");
  board.id = "board";
  board.style.gridTemplateColumns = `repeat(${cols}, 50px)`;
  board.style.gridTemplateRows = `repeat(${rows}, 50px)`;
  
  // Create a map of playable cells
  const playableSet = new Set(playableCells.map(([r, c]) => `${r},${c}`));
  
  // Create a map of cells to regions
  const cellToRegion = new Map();
  for (const region of regions) {
    for (const [r, c] of region.cells) {
      cellToRegion.set(`${r},${c}`, region);
    }
  }
  
  // Create all cells
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = r;
      cell.dataset.col = c;
      
      const key = `${r},${c}`;
      
      if (!playableSet.has(key)) {
        cell.classList.add("hidden");
      } else {
        // Set region color
        const region = cellToRegion.get(key);
        if (region) {
          cell.style.backgroundColor = REGION_COLORS[region.colour] || '#eee';
        } else {
          cell.style.backgroundColor = '#f5f5f5';
        }
        
        // Add dots for the value
        const occupancy = solution.cellOccupancy[key];
        if (occupancy) {
          const dots = createDots(occupancy.value);
          cell.appendChild(dots);
        }
      }
      
      board.appendChild(cell);
    }
  }
  
  container.appendChild(board);
  
  // Add domino overlays
  for (const domino of solution.dominoes) {
    if (!domino.placed) continue;
    
    const [[r1, c1], [r2, c2]] = domino.cells;
    const isHorizontal = r1 === r2;
    
    const overlay = document.createElement("div");
    overlay.className = `domino-overlay ${isHorizontal ? 'domino-horizontal' : 'domino-vertical'}`;
    
    // Position the overlay with a small gap from cell borders
    const minRow = Math.min(r1, r2);
    const minCol = Math.min(c1, c2);

    const CELL = 50;
    const GAP = 4;
    const OFFSET = 5;

    const top = (minRow - 1) * (CELL + GAP) + OFFSET;
    const left = (minCol - 1) * (CELL + GAP) + OFFSET;

    
    overlay.style.position = 'absolute';
    overlay.style.top = `${top}px`;
    overlay.style.left = `${left}px`;
    
    // Add the two halves
    let firstValue, secondValue;

    if (isHorizontal) {
      // Left → Right
      if (c1 < c2) {
        firstValue = domino.values[0];
        secondValue = domino.values[1];
      } else {
        firstValue = domino.values[1];
        secondValue = domino.values[0];
      }
    } else {
      // Top → Bottom
      if (r1 < r2) {
        firstValue = domino.values[0];
        secondValue = domino.values[1];
      } else {
        firstValue = domino.values[1];
        secondValue = domino.values[0];
      }
    }

    // Add the two halves
    const half1 = document.createElement("div");
    half1.className = "domino-half";
    half1.appendChild(createDots(firstValue));

    const half2 = document.createElement("div");
    half2.className = "domino-half";
    half2.appendChild(createDots(secondValue));

    
    const divider = document.createElement("div");
    divider.className = "domino-divider";
    
    overlay.appendChild(half1);
    overlay.appendChild(divider);
    overlay.appendChild(half2);
    
    board.appendChild(overlay);
  }
}

function createDots(value) {
  const container = document.createElement("div");
  container.className = "dots";
  container.style.display = "grid";
  container.style.gridTemplateColumns = "repeat(3, 1fr)";
  container.style.gridTemplateRows = "repeat(3, 1fr)";
  container.style.gap = "0";
  container.style.padding = "4px";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.boxSizing = "border-box";
  
  // Domino dot patterns (standard die patterns)
  const patterns = {
    0: [],
    1: [4], // center
    2: [0, 8], // diagonal
    3: [0, 4, 8], // diagonal + center
    4: [0, 2, 6, 8], // corners
    5: [0, 2, 4, 6, 8], // corners + center
    6: [0, 2, 3, 5, 6, 8] // two columns
  };
  
  const positions = patterns[value] || [];
  
  for (let i = 0; i < 9; i++) {
    const dotSpace = document.createElement("div");
    dotSpace.style.display = "flex";
    dotSpace.style.alignItems = "center";
    dotSpace.style.justifyContent = "center";
    
    if (positions.includes(i)) {
      const dot = document.createElement("div");
      dot.className = "dot";
      dotSpace.appendChild(dot);
    }
    container.appendChild(dotSpace);
  }
  
  return container;
}