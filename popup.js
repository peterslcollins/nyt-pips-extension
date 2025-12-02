document.getElementById("solveBtn").addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      function: extractBoardInfo
    },
    (results) => {
      const data = results[0].result;
      document.getElementById("output").textContent = JSON.stringify(data, null, 2);
    }
  );
});


function extractBoardInfo() {
  const board = document.querySelector(".Board-module_boardContainer__vvItv");

  const info = {
    boardFound: !!board,
    rows: 0,
    cols: 0,
    dominoes: [],
    regions: [],
  };

  if (!board) return info;

  // 1️⃣ ROWS + COLS
  const style = getComputedStyle(board);
  info.rows = parseInt(style.getPropertyValue("--rows"));
  info.cols = parseInt(style.getPropertyValue("--cols"));

  // 2️⃣ DOMINOES
  const dominoNodes = document.querySelectorAll(".Domino-module_domino__yiFAO");
  dominoNodes.forEach(domino => {
    const halves = [...domino.querySelectorAll(".Domino-module_halfDomino__cvxyV")];
    const pair = halves.map(h => h.querySelectorAll(".Domino-module_dot__QVHhw").length);
    info.dominoes.push(pair);
  });

  // 3️⃣ DROPPABLE CELLS
  const dropWrapper = board.querySelector(".Board-module_droppableWrapper__iaurT");
  const droppable = dropWrapper
    ? [...dropWrapper.querySelectorAll("div[class*='droppableCell']")]
    : [];

  const droppableMap = droppable.map((cell, index) => ({
    index: index + 1,
    playable: !cell.classList.contains("Board-module_hidden__kZj8y")
  }));


  // Helper: extract color class (purple, teal, pink, orange,...)
  function getRegionColorClass(inner) {
    return [...inner.classList].find(c =>
      c.startsWith("RegionCell-module_") &&
      !c.includes("regionCellInner") &&
      !c.includes("remove") &&
      !c.includes("moveBordersInset") &&
      !c.includes("borderImagesLoaded")
    ) || null;
  }

  function extractColorName(className) {
    if (!className) return null;
    const m = className.match(/^RegionCell-module_([a-zA-Z]+)__/);
    return m ? m[1] : null;
  }


  // 4️⃣ REGION CELLS
  const regionWrapper = board.querySelector(".Board-module_regionWrapper__I4HgR");
  const regionNodes = regionWrapper
    ? [...regionWrapper.querySelectorAll("div[class*='regionCell']")]
    : [];

  const regionCells = regionNodes.map((outer, i) => {
    const index = i + 1;
    const inner = outer.querySelector("div[class*='regionCellInner']");

    // Hidden cell → occupies grid but not part of any region
    if (!inner) {
      return {
        index,
        row: Math.floor(i / info.cols),
        col: i % info.cols,
        empty: true,
        color: null,
        colorClass: null,
        connections: { top: false, bottom: false, left: false, right: false },
        rule: null
      };
    }

    const classes = [...inner.classList];

    const colorClass = getRegionColorClass(inner);
    const color = extractColorName(colorClass);

    const top    = classes.some(c => c.includes("removeTopBorder"));
    const bottom = classes.some(c => c.includes("removeBottomBorder"));
    const left   = classes.some(c => c.includes("removeLeftBorder"));
    const right  = classes.some(c => c.includes("removeRightBorder"));

    const textLabel = outer.querySelector("span[class*='regionLabelText']");
    const symbolLabel = outer.querySelector("span[class*='RegionCell-module_regionLabelSymbol']");

    const rule =
      textLabel?.textContent?.trim() ||
      symbolLabel?.getAttribute("aria-label") ||
      null;

    return {
      index,
      row: Math.floor(i / info.cols),
      col: i % info.cols,
      empty: false,
      colorClass,
      color,
      connections: { top, bottom, left, right },
      rule
    };
  });


  // 5️⃣ ADJACENCY / REGION GROUPING
  const visited = new Set();
  const regions = [];

  function dfs(startIndex, region) {
    const start = regionCells[startIndex];
    if (!start) return;

    // Hidden cells block adjacency.
    if (start.empty) return;

    // Color must match — prevents leaking into another region with same borders
    if (!start.color) return;

    if (visited.has(start.index)) return;
    visited.add(start.index);

    region.cells.push(start.index);
    if (!region.color) region.color = start.color;
    if (start.rule && !region.rule) region.rule = start.rule;

    const { row, col, connections } = start;

    function tryConnect(neighborIndex) {
      const neighbor = regionCells[neighborIndex];
      if (!neighbor) return;
      if (neighbor.empty) return;       // ❗ cannot cross hidden
      if (neighbor.color !== start.color) return;  // ❗ must match color
      dfs(neighborIndex, region);
    }

    if (connections.top && row > 0) tryConnect(startIndex - info.cols);
    if (connections.bottom && row < info.rows - 1) tryConnect(startIndex + info.cols);
    if (connections.left && col > 0) tryConnect(startIndex - 1);
    if (connections.right && col < info.cols - 1) tryConnect(startIndex + 1);
  }

  regionCells.forEach((cell, i) => {
    if (cell.empty) return;
    if (!visited.has(cell.index)) {
      const region = { cells: [], rule: null, color: null };
      dfs(i, region);
      if (region.cells.length > 0) regions.push(region);
    }
  });

  // 6️⃣ RETURN FINAL
  info.regions = regions;
  info.droppableCells = droppableMap;

  return info;
}
