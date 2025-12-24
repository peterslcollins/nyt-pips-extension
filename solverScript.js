function main() {
  const puzzleInfo = extractPuzzleInfo();
  console.log(puzzleInfo)
  const solution = solvePuzzle(puzzleInfo);

  return {
    puzzleInfo,
    solution
  };
}

// Extract the board DOM element
function extractPuzzleInfo() {
  console.log("Extracting Board Info...");
  const board = document.querySelector("[class*='boardContainer']");

  const puzzleInfo = {
    boardFound: !!board,
    rows: 0,
    cols: 0,
    dominoes: [],
    playableCells: [],
    regions: [],
  };

  // get board size
  const boardSize = getBoardSize(board);
  puzzleInfo.rows = boardSize.rows;
  puzzleInfo.cols = boardSize.cols;

  // get droppable cells
  const playableCells = getPlayableCells(board, puzzleInfo.cols);
  puzzleInfo.playableCells = playableCells.playableCells

  // get regions
  puzzleInfo.regions = getRegions(board, playableCells.droppableMap, puzzleInfo.cols);

  // get dominoes
  puzzleInfo.dominoes = getDominoes();

  return puzzleInfo;
}

function getBoardSize(board) {
  console.log("Getting board size...");
  const style = getComputedStyle(board);
  const rows = parseInt(style.getPropertyValue("--rows"));
  const cols = parseInt(style.getPropertyValue("--cols"));
  return {rows: rows, cols: cols};
}

function getDominoes() {
  console.log("Getting dominoes...");
  const dominoes = [];
  const dominoNodes = document.querySelectorAll("[class*='Domino'][class*='domino']");
  dominoNodes.forEach(domino => {
    const halves = [...domino.querySelectorAll("[class*='halfDomino']")];
    const pair = halves.map(h => h.querySelectorAll("[class*='dot']").length - 1);
    dominoes.push(pair);
  });
  return dominoes;
}

function getPlayableCells(board, cols) {
  const dropWrapper = board.querySelector("[class*='droppableWrapper'], [class*='eWrapper']");
  const droppable = dropWrapper
    ? [...dropWrapper.querySelectorAll("[class*='droppableCell']")]
    : [];
  const droppableMap = droppable.map((cell, index) => ({
    index: index,
    playable: !cell.classList.contains("Board-module_hidden__DkSxz") && 
              ![...cell.classList].some(c => c.includes('hidden'))
  }));
  return {playableCells: droppableMap
    .filter(cell => cell.playable)
    .map(cell => {
      const i = cell.index;
      const row = Math.floor(i / cols) + 1;
      const col = (i % cols) + 1;
      return [row, col];
    }), 
  droppableMap: droppableMap};
}

function extractColorName(classList) {
  // Look for color-related class names
  const colorPatterns = [
    /teal/i, /orange/i, /pink/i, /blue/i, /green/i, 
    /yellow/i, /purple/i, /red/i, /cyan/i, /lime/i
  ];
  
  for (const cls of classList) {
    for (const pattern of colorPatterns) {
      if (pattern.test(cls)) {
        const match = cls.match(pattern);
        return match[0].toLowerCase();
      }
    }
  }
  return null;
}

function getRuleFromDiv(outerCell) {
  const labelText = outerCell.querySelector("[class*='regionLabelText']");
  if (!labelText) return null;

  const raw = labelText.textContent.trim();

  if (/^\d+$/.test(raw)) {
    return { type: "sum", value: Number(raw) };
  }

  const symbol = labelText.querySelector("[class*='regionLabelSymbol']");
  if (symbol) {
    const classList = [...symbol.classList];

    if (classList.some(c => c.includes("notEqual") || c.includes("not-equal"))) {
      return { type: "notEqual" };
    }
    if (classList.some(c => c.includes("equal"))) {
      return { type: "equal" };
    }
    return { type: "unknownSymbol" };
  }
 
  const opMatch = raw.match(/^([<>=])(\d+)$/);
  if (opMatch) {
    const operator = opMatch[1];
    const value = Number(opMatch[2]);
    return { type: "comparison", operator, value };
  }

  return null;
}

function buildRegionsWithConnectivity(cells) {
  const lookup = new Map();
  for (const cell of cells) {
    if (!cell.colour) continue;
    lookup.set(`${cell.cell[0]},${cell.cell[1]}`, cell);
  }

  const visited = new Set();
  const regions = [];

  function getNeighbors([r, c]) {
    return [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ];
  }

  for (const cell of cells) {
    if (!cell.colour) continue;

    const key = `${cell.cell[0]},${cell.cell[1]}`;
    if (visited.has(key)) continue;

    const colour = cell.colour;
    const stack = [cell];
    const regionCells = [];
    let regionRule = null;

    visited.add(key);

    while (stack.length > 0) {
      const current = stack.pop();
      regionCells.push(current.cell);

      if (current.rule) {
        regionRule = current.rule;
      }

      for (const [nr, nc] of getNeighbors(current.cell)) {
        const nKey = `${nr},${nc}`;
        if (visited.has(nKey)) continue;
        const neighbor = lookup.get(nKey);
        if (!neighbor) continue;
        if (neighbor.colour !== colour) continue;

        visited.add(nKey);
        stack.push(neighbor);
      }
    }

    regions.push({
      colour,
      cells: regionCells,
      rule: regionRule
    });
  }

  return regions;
}

function getRegions(board, droppableMap, cols) {
  const regionWrapper = board.querySelector("[class*='regionWrapper']");
  const regionNodes = regionWrapper
    ? [...regionWrapper.querySelectorAll("[class*='regionCell']")]
    : [];

  let index = 0;
  let cellIndex = 0;
  let cellInfo = [];

  for (const div of regionNodes) {
    const playable = droppableMap[index]?.playable;

    if (!playable) {
      index++;
      continue;
    }

    if (!cellInfo[cellIndex]) {
      cellInfo[cellIndex] = {
        cellIndex,
        cell: [Math.floor(index / cols) + 1, (index % cols) + 1],
        colour: null,
        rule: null
      };
    }

    const cell = cellInfo[cellIndex];
    
    const ruleSpans = div.querySelectorAll("span");
    if (ruleSpans.length > 0) {
      const rule = getRuleFromDiv(div);
      cell.rule = rule;
      continue;
    }

    const classList = [...div.classList];
    const isInner = classList.some(c => c.includes("regionCellInner"));
    if (isInner) {
      const colour = extractColorName(classList);
      cell.colour = colour;
      index++;
      cellIndex++;
      continue;
    }
    
    const isHidden = classList.some(c => c.includes("hidden"));
    if (isHidden) { 
      index++; 
      cellIndex++;
      continue; 
    }
  }

  const regions = buildRegionsWithConnectivity(cellInfo);

  return regions;
}

function createInitialSolution(puzzleInfo) {
  return {
    dominoes: puzzleInfo.dominoes.map((values, id) => ({
      id,
      values,
      placed: false,
      cells: null
    })),

    cellOccupancy: {},
    rows: puzzleInfo.rows,
    cols: puzzleInfo.cols
  };
}

function isPuzzleFull(solution) {
  return solution.dominoes.every(d => d.placed);
}

/* ---------------- REGIONS ---------------- */

function getRegionState(region, solution) {
  let sum = 0;
  let filled = 0;
  const values = [];

  for (const [r, c] of region.cells) {
    const entry = solution.cellOccupancy[`${r},${c}`];
    if (entry) {
      sum += entry.value;
      values.push(entry.value);
      filled++;
    }
  }

  return {
    sum,
    filled,
    size: region.cells.length,
    values
  };
}

function areRegionsSatisfied(solution, puzzleInfo) {
  for (const region of puzzleInfo.regions) {
    const { sum, filled, size, values } = getRegionState(region, solution);
    const rule = region.rule;
    if (!rule) continue;

    if (filled !== size) return false;

    if (rule.type === "sum") {
      if (sum !== rule.value) return false;
    }

    if (rule.type === "equal") {
      if (values.length > 1) {
        const first = values[0];
        if (!values.every(v => v === first)) return false;
      }
    }

    if (rule.type === "notEqual") {
      const uniqueValues = new Set(values);
      if (uniqueValues.size !== values.length) return false;
    }

    if (rule.type === "comparison") {
      // For comparison, check the sum against the rule
      if (rule.operator === "<" && !(sum < rule.value)) return false;
      if (rule.operator === ">" && !(sum > rule.value)) return false;
      if (rule.operator === "=" && sum !== rule.value) return false;
    }
  }

  return true;
}

/* Used during search (partial pruning) */
function violatesConstraints(solution, puzzleInfo) {
  for (const region of puzzleInfo.regions) {
    const { sum, filled, size, values } = getRegionState(region, solution);
    const rule = region.rule;
    if (!rule) continue;

    if (rule.type === "sum") {
      // Sum already too large
      if (sum > rule.value) return true;
      
      // Region is complete but sum is wrong
      if (filled === size && sum !== rule.value) return true;
      
      // Prune if even max possible values can't reach target
      const remaining = size - filled;
      const maxPossible = sum + remaining * 6;
      if (maxPossible < rule.value) return true;
    }

    if (rule.type === "equal") {
      // If we have multiple values, they must all be equal
      if (values.length > 1) {
        const first = values[0];
        if (!values.every(v => v === first)) return true;
      }
    }

    if (rule.type === "notEqual") {
      // Check for duplicates
      const uniqueValues = new Set(values);
      if (uniqueValues.size !== values.length) return true;
    }

    if (rule.type === "comparison") {
      // For comparison regions, check partial sums
      if (rule.operator === "<") {
        // If sum is already >= value, it's invalid
        if (sum >= rule.value) return true;
      }
      if (rule.operator === ">") {
        // If region is complete and sum is not > value, it's invalid
        if (filled === size && !(sum > rule.value)) return true;
        // If even with max remaining values we can't exceed, prune
        const remaining = size - filled;
        const maxPossible = sum + remaining * 6;
        if (maxPossible <= rule.value) return true;
      }
      if (rule.operator === "=") {
        // Sum already too large
        if (sum > rule.value) return true;
        // Region is complete but sum is wrong
        if (filled === size && sum !== rule.value) return true;
        // Can't reach target even with max values
        const remaining = size - filled;
        const maxPossible = sum + remaining * 6;
        if (maxPossible < rule.value) return true;
      }
    }
  }

  return false;
}

/* ---------------- SEARCH HELPERS ---------------- */

function chooseNextCell(solution, puzzleInfo) {
  return puzzleInfo.playableCells.find(
    ([r, c]) => solution.cellOccupancy[`${r},${c}`] === undefined
  );
}

function getUnplacedDominoes(solution) {
  return solution.dominoes.filter(d => !d.placed);
}

function findAdjacentCells([r, c], solution, puzzleInfo) {
  const deltas = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ];

  return deltas
    .map(([dr, dc]) => [r + dr, c + dc])
    .filter(([nr, nc]) =>
      nr >= 1 &&
      nr <= puzzleInfo.rows &&
      nc >= 1 &&
      nc <= puzzleInfo.cols &&
      puzzleInfo.playableCells.some(([pr, pc]) => pr === nr && pc === nc) &&
      solution.cellOccupancy[`${nr},${nc}`] === undefined
    );
}

/* ---------------- PLACEMENT ---------------- */

function placeDomino(solution, dominoId, cells) {
  for (const [r, c] of cells) {
    if (solution.cellOccupancy[`${r},${c}`]) return false;
  }

  const domino = solution.dominoes[dominoId];
  const [a, b] = domino.values;

  domino.placed = true;
  domino.cells = cells;

  solution.cellOccupancy[`${cells[0][0]},${cells[0][1]}`] = {
    dominoId,
    value: a
  };

  solution.cellOccupancy[`${cells[1][0]},${cells[1][1]}`] = {
    dominoId,
    value: b
  };

  return true;
}

function removeDomino(solution, dominoId) {
  const domino = solution.dominoes[dominoId];
  if (!domino.cells) return;

  for (const [r, c] of domino.cells) {
    delete solution.cellOccupancy[`${r},${c}`];
  }

  domino.placed = false;
  domino.cells = null;
}

function backtrack(solution, puzzleInfo) {
  // Base case
  if (isPuzzleFull(solution)) {
    return areRegionsSatisfied(solution, puzzleInfo)
      ? solution
      : false;
  }

  const cell = chooseNextCell(solution, puzzleInfo);
  if (!cell) return false;

  for (const domino of getUnplacedDominoes(solution)) {
    const adjacentCells = findAdjacentCells(cell, solution, puzzleInfo);

    for (const adj of adjacentCells) {
      // Try both orientations
      const orientations = [
        [cell, adj],
        [adj, cell],
      ];

      for (const cells of orientations) {
        // Place
        placeDomino(solution, domino.id, cells);

        if (!violatesConstraints(solution, puzzleInfo)) {
          const result = backtrack(solution, puzzleInfo);
          if (result) {
            return result;
          }
        }

        // Undo
        removeDomino(solution, domino.id);
      }
    }
  }

  return false;
}

function solvePuzzle(puzzleInfo) {
  console.log("Solving puzzle...");
  const solution = createInitialSolution(puzzleInfo);
  console.log("Finished Solving")
  return backtrack(solution, puzzleInfo);
}

window.__nytSolverOutput = main();