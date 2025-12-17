(() => {
  "use strict";

  /** @type {HTMLCanvasElement | null} */
  const boardCanvas = document.getElementById("board");
  /** @type {HTMLCanvasElement | null} */
  const runnerCanvas = document.getElementById("runner");
  const elScore = document.getElementById("score");
  const elHint = document.getElementById("hint");
  const elSkinList = document.getElementById("skin-list");
  const elRunnerSubtitle = document.getElementById("runner-subtitle");
  const btnNew = document.getElementById("btn-new");
  const toggleSound = document.getElementById("toggle-sound");

  if (!boardCanvas || !runnerCanvas || !elScore || !elHint || !elSkinList || !btnNew || !toggleSound) {
    // eslint-disable-next-line no-console
    console.error("Missing required DOM elements.");
    return;
  }

  /** @type {CanvasRenderingContext2D} */
  const boardCtx = boardCanvas.getContext("2d", { alpha: true });
  /** @type {CanvasRenderingContext2D} */
  const runnerCtx = runnerCanvas.getContext("2d", { alpha: true });

  if (!boardCtx || !runnerCtx) {
    // eslint-disable-next-line no-console
    console.error("Canvas 2D context not available.");
    return;
  }

  const GRID = 8;
  const STORAGE_KEY = "spojovacka:v1";

  // High-contrast palette (more distinguishable hues on dark background)
  const COLORS = [
    { name: "Cyan", base: "#22d3ee", hi: "#cffafe", glow: "rgba(34, 211, 238, 0.55)" },
    { name: "Lime", base: "#4ade80", hi: "#d1fae5", glow: "rgba(74, 222, 128, 0.52)" },
    { name: "Yellow", base: "#fbbf24", hi: "#fef3c7", glow: "rgba(251, 191, 36, 0.52)" },
    { name: "Orange", base: "#f97316", hi: "#ffedd5", glow: "rgba(249, 115, 22, 0.52)" },
    { name: "Red", base: "#ef4444", hi: "#fee2e2", glow: "rgba(239, 68, 68, 0.52)" },
    { name: "Magenta", base: "#d946ef", hi: "#fae8ff", glow: "rgba(217, 70, 239, 0.52)" },
  ];

  const PIECE_THEME = /** @type {const} */ ({
    BALLS: "balls",
    DINOS: "dinos",
    DIAMONDS: "diamonds",
  });

  const PIECE_KIND = /** @type {const} */ ({
    NORMAL: "normal",
    ROCKET: "rocket",
    BOMB: "bomb",
  });

  const SKINS = [
    { id: "mouse", name: "Myš", emoji: "🐭", cost: 0 },
    { id: "rat", name: "Potkan", emoji: "🐀", cost: 120 },
    { id: "dog", name: "Pes", emoji: "🐶", cost: 280 },
    { id: "dino", name: "Dinosaurus", emoji: "🦖", cost: 520 },
  ];

  /**
   * @typedef {Object} PersistedState
   * @property {boolean} soundEnabled
   * @property {"balls"|"dinos"|"diamonds"} pieceTheme
   * @property {string} activeSkin
   * @property {string[]} ownedSkins
   */

  /** @returns {PersistedState} */
  function loadPersistedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          soundEnabled: true,
          pieceTheme: PIECE_THEME.BALLS,
          activeSkin: "mouse",
          ownedSkins: ["mouse"],
        };
      }
      const parsed = /** @type {Partial<PersistedState>} */ (JSON.parse(raw));
      const owned = Array.isArray(parsed.ownedSkins) ? parsed.ownedSkins.filter(Boolean) : ["mouse"];
      if (!owned.includes("mouse")) owned.push("mouse");
      const active = typeof parsed.activeSkin === "string" ? parsed.activeSkin : "mouse";
      return {
        soundEnabled: typeof parsed.soundEnabled === "boolean" ? parsed.soundEnabled : true,
        pieceTheme:
          parsed.pieceTheme === PIECE_THEME.DINOS || parsed.pieceTheme === PIECE_THEME.DIAMONDS
            ? parsed.pieceTheme
            : PIECE_THEME.BALLS,
        activeSkin: owned.includes(active) ? active : "mouse",
        ownedSkins: owned,
      };
    } catch {
      return {
        soundEnabled: true,
        pieceTheme: PIECE_THEME.BALLS,
        activeSkin: "mouse",
        ownedSkins: ["mouse"],
      };
    }
  }

  /** @param {PersistedState} s */
  function savePersistedState(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  let persisted = loadPersistedState();

  /** @type {AudioContext | null} */
  let audioCtx = null;

  function ensureAudio() {
    if (!persisted.soundEnabled) return null;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      if (!audioCtx) audioCtx = new Ctor();
      return audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * @param {"match"|"bad"|"rocket"|"bomb"|"ui"} kind
   * @param {number} intensity 0..1
   */
  function playSfx(kind, intensity = 1) {
    if (!persisted.soundEnabled) return;
    const ctx = ensureAudio();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    let type = "sine";
    let freq = 440;
    let dur = 0.12;
    let vol = 0.16 * intensity;

    if (kind === "match") {
      type = "triangle";
      freq = 520;
      dur = 0.11;
      vol = 0.16 * intensity;
    } else if (kind === "rocket") {
      type = "sawtooth";
      freq = 240;
      dur = 0.18;
      vol = 0.18 * intensity;
    } else if (kind === "bomb") {
      type = "square";
      freq = 120;
      dur = 0.22;
      vol = 0.20 * intensity;
    } else if (kind === "bad") {
      type = "sine";
      freq = 180;
      dur = 0.08;
      vol = 0.11 * intensity;
    } else if (kind === "ui") {
      type = "sine";
      freq = 680;
      dur = 0.06;
      vol = 0.12 * intensity;
    }

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function randInt(n) {
    return Math.floor(Math.random() * n);
  }

  function cellKey(x, y) {
    return `${x},${y}`;
  }

  let nextId = 1;

  /**
   * @typedef {Object} Piece
   * @property {number} id
   * @property {number} color 0..COLORS.length-1
   * @property {"normal"|"rocket"|"bomb"} kind
   */

  /** @returns {Piece} */
  function makePiece(color, kind = PIECE_KIND.NORMAL) {
    return { id: nextId++, color, kind };
  }

  /** @returns {(Piece|null)[][]} */
  function makeBoard() {
    /** @type {(Piece|null)[][]} */
    const b = [];
    for (let y = 0; y < GRID; y++) {
      const row = [];
      for (let x = 0; x < GRID; x++) {
        row.push(makePiece(randInt(COLORS.length), PIECE_KIND.NORMAL));
      }
      b.push(row);
    }
    return b;
  }

  /** @type {(Piece|null)[][]} */
  let board = makeBoard();
  let score = 0;

  /** selection state */
  let pointerIsDown = false;
  let pointerId = null;
  /** @type {"idle"|"select"|"special"} */
  let mode = "idle";
  /** @type {{x:number,y:number}[]} */
  let selection = [];
  /** @type {Set<string>} */
  let selectionSet = new Set();
  let selectionColor = null;
  /** @type {{x:number,y:number}|null} */
  let specialOrigin = null;
  /** @type {{x:number,y:number}|null} */
  let specialTarget = null;

  /** @param {string} msg */
  function setHint(msg) {
    elHint.textContent = msg;
  }

  function setScore(v) {
    score = Math.max(0, Math.floor(v));
    elScore.textContent = String(score);
  }

  function addScore(delta) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    setScore(score + delta);
  }

  function isInBounds(x, y) {
    return x >= 0 && y >= 0 && x < GRID && y < GRID;
  }

  function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /** @param {HTMLCanvasElement} canvas */
  function resizeCanvasToDisplaySize(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function resizeAll() {
    resizeCanvasToDisplaySize(boardCanvas);
    resizeCanvasToDisplaySize(runnerCanvas);
    renderBoard();
    renderRunner(0);
  }

  function getBoardCellSize() {
    return Math.min(boardCanvas.width, boardCanvas.height) / GRID;
  }

  /**
   * @param {{clientX:number, clientY:number}} pos
   * @returns {{x:number,y:number,cx:number,cy:number}|null}
   */
  function pointToCell(pos) {
    const rect = boardCanvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const px = ((pos.clientX - rect.left) / rect.width) * boardCanvas.width;
    const py = ((pos.clientY - rect.top) / rect.height) * boardCanvas.height;
    const cell = getBoardCellSize();
    const x = Math.floor(px / cell);
    const y = Math.floor(py / cell);
    if (!isInBounds(x, y)) return null;
    return { x, y, cx: (x + 0.5) * cell, cy: (y + 0.5) * cell };
  }

  function clearSelection() {
    selection = [];
    selectionSet.clear();
    selectionColor = null;
    specialOrigin = null;
    specialTarget = null;
    mode = "idle";
  }

  function collapseAndFill() {
    for (let x = 0; x < GRID; x++) {
      /** @type {Piece[]} */
      const col = [];
      for (let y = GRID - 1; y >= 0; y--) {
        const p = board[y][x];
        if (p) col.push(p);
      }

      let writeY = GRID - 1;
      for (const p of col) {
        board[writeY][x] = p;
        writeY--;
      }
      for (let y = writeY; y >= 0; y--) {
        board[y][x] = makePiece(randInt(COLORS.length), PIECE_KIND.NORMAL);
      }
    }
  }

  /**
   * @param {{x:number,y:number}[]} cells
   * @returns {number} destroyed count
   */
  function destroyCells(cells) {
    /** @type {Set<string>} */
    const uniq = new Set();
    for (const c of cells) {
      if (!isInBounds(c.x, c.y)) continue;
      uniq.add(cellKey(c.x, c.y));
    }

    let destroyed = 0;
    for (const k of uniq) {
      const [xs, ys] = k.split(",");
      const x = Number(xs);
      const y = Number(ys);
      if (!isInBounds(x, y)) continue;
      if (board[y][x]) {
        board[y][x] = null;
        destroyed++;
      }
    }
    return destroyed;
  }

  function applyMatch() {
    const len = selection.length;
    if (len < 3) return;

    const last = selection[selection.length - 1];
    const color = selectionColor ?? 0;
    const powerup = len >= 5 ? PIECE_KIND.BOMB : len === 4 ? PIECE_KIND.ROCKET : null;

    const destroyed = destroyCells(selection);
    addScore(destroyed);
    collapseAndFill();

    if (powerup && isInBounds(last.x, last.y)) {
      board[last.y][last.x] = makePiece(color, powerup);
      if (powerup === PIECE_KIND.ROCKET) playSfx("match", clamp(len / 6, 0.6, 1));
      if (powerup === PIECE_KIND.BOMB) playSfx("match", 1);
    } else {
      playSfx("match", clamp(len / 6, 0.6, 1));
    }

    setHint(
      powerup
        ? powerup === PIECE_KIND.ROCKET
          ? "Raketa vytvořena! Klikni na 🚀 (nebo ji potáhni o 1 vedle)."
          : "Bomba vytvořena! Klikni na 💣."
        : "Nice! Spojuj dál 🙂"
    );
  }

  /** @param {{x:number,y:number}} center */
  function rocketArea(center) {
    const out = [];
    out.push({ x: center.x, y: center.y });
    out.push({ x: center.x + 1, y: center.y });
    out.push({ x: center.x - 1, y: center.y });
    out.push({ x: center.x, y: center.y + 1 });
    out.push({ x: center.x, y: center.y - 1 });
    return out;
  }

  /** @param {{x:number,y:number}} center */
  function bombArea(center) {
    const out = [];
    const r = 2;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) out.push({ x: center.x + dx, y: center.y + dy });
      }
    }
    return out;
  }

  function detonateSpecial() {
    if (!specialOrigin) return;
    const p = board[specialOrigin.y]?.[specialOrigin.x];
    if (!p) return;
    if (p.kind !== PIECE_KIND.ROCKET && p.kind !== PIECE_KIND.BOMB) return;

    let center = { x: specialOrigin.x, y: specialOrigin.y };
    if (p.kind === PIECE_KIND.ROCKET && specialTarget) {
      center = { x: specialTarget.x, y: specialTarget.y };
    }

    /** @type {{x:number,y:number}[]} */
    let area = [];
    if (p.kind === PIECE_KIND.ROCKET) area = rocketArea(center);
    if (p.kind === PIECE_KIND.BOMB) area = bombArea(center);

    // Always remove the activated power-up itself as well.
    area.push({ x: specialOrigin.x, y: specialOrigin.y });

    const destroyed = destroyCells(area);
    addScore(destroyed);
    collapseAndFill();

    playSfx(p.kind === PIECE_KIND.ROCKET ? "rocket" : "bomb", clamp(destroyed / 14, 0.65, 1));
    setHint(p.kind === PIECE_KIND.ROCKET ? "BOOM! 🚀 (+)" : "KABOOM! 💣");
  }

  function renderBoard() {
    resizeCanvasToDisplaySize(boardCanvas);
    const w = boardCanvas.width;
    const h = boardCanvas.height;
    const cell = getBoardCellSize();

    boardCtx.clearRect(0, 0, w, h);

    // subtle grid
    boardCtx.save();
    boardCtx.globalAlpha = 0.18;
    boardCtx.strokeStyle = "rgba(255,255,255,0.10)";
    boardCtx.lineWidth = Math.max(1, Math.round(cell * 0.02));
    for (let i = 1; i < GRID; i++) {
      const p = i * cell;
      boardCtx.beginPath();
      boardCtx.moveTo(p, 0);
      boardCtx.lineTo(p, h);
      boardCtx.stroke();

      boardCtx.beginPath();
      boardCtx.moveTo(0, p);
      boardCtx.lineTo(w, p);
      boardCtx.stroke();
    }
    boardCtx.restore();

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const p = board[y][x];
        if (!p) continue;
        const cx = (x + 0.5) * cell;
        const cy = (y + 0.5) * cell;
        drawPiece(boardCtx, p, cx, cy, cell);
      }
    }

    // selection line + highlight
    if (mode === "select" && selection.length > 0) {
      const c = selectionColor == null ? COLORS[0] : COLORS[selectionColor];

      boardCtx.save();
      boardCtx.lineWidth = cell * 0.12;
      boardCtx.lineCap = "round";
      boardCtx.lineJoin = "round";
      boardCtx.strokeStyle = c.glow;
      boardCtx.shadowColor = c.glow;
      boardCtx.shadowBlur = cell * 0.25;

      boardCtx.beginPath();
      for (let i = 0; i < selection.length; i++) {
        const s = selection[i];
        const sx = (s.x + 0.5) * cell;
        const sy = (s.y + 0.5) * cell;
        if (i === 0) boardCtx.moveTo(sx, sy);
        else boardCtx.lineTo(sx, sy);
      }
      boardCtx.stroke();
      boardCtx.restore();

      boardCtx.save();
      boardCtx.lineWidth = Math.max(1, Math.round(cell * 0.04));
      boardCtx.strokeStyle = "rgba(255,255,255,0.55)";
      boardCtx.shadowColor = c.glow;
      boardCtx.shadowBlur = cell * 0.18;
      for (const s of selection) {
        const sx = (s.x + 0.5) * cell;
        const sy = (s.y + 0.5) * cell;
        boardCtx.beginPath();
        boardCtx.arc(sx, sy, cell * 0.36, 0, Math.PI * 2);
        boardCtx.stroke();
      }
      boardCtx.restore();
    }

    // special target hint
    if (mode === "special" && specialOrigin) {
      const originPiece = board[specialOrigin.y]?.[specialOrigin.x];
      if (originPiece && originPiece.kind === PIECE_KIND.ROCKET) {
        const center = specialTarget ?? specialOrigin;
        boardCtx.save();
        const c = COLORS[originPiece.color];
        boardCtx.strokeStyle = c.glow;
        boardCtx.shadowColor = c.glow;
        boardCtx.shadowBlur = cell * 0.22;
        boardCtx.lineWidth = Math.max(2, Math.round(cell * 0.05));
        boardCtx.beginPath();
        boardCtx.arc((center.x + 0.5) * cell, (center.y + 0.5) * cell, cell * 0.42, 0, Math.PI * 2);
        boardCtx.stroke();
        boardCtx.restore();
      }
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {Piece} p
   * @param {number} cx
   * @param {number} cy
   * @param {number} cell
   */
  function drawPiece(ctx, p, cx, cy, cell) {
    const theme = persisted.pieceTheme;
    const c = COLORS[p.color];
    const r = cell * 0.34;

    ctx.save();
    ctx.translate(cx, cy);

    // glow
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = cell * 0.22;
    ctx.globalAlpha = 0.98;

    if (theme === PIECE_THEME.DIAMONDS) {
      // diamond (rotated square)
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();

      const grad = ctx.createLinearGradient(-r, -r, r, r);
      grad.addColorStop(0, c.hi);
      grad.addColorStop(0.45, c.base);
      grad.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1, Math.round(cell * 0.03));
      ctx.strokeStyle = "rgba(255,255,255,0.30)";
      ctx.stroke();
    } else {
      // ball or dino base = circle
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);

      const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.15, 0, 0, r);
      grad.addColorStop(0, "rgba(255,255,255,0.90)");
      grad.addColorStop(0.22, c.hi);
      grad.addColorStop(0.85, c.base);
      grad.addColorStop(1, "rgba(0,0,0,0.28)");
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1, Math.round(cell * 0.03));
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.stroke();

      if (theme === PIECE_THEME.DINOS) {
        // emoji overlay (keeps multiple colors via glow/background)
        ctx.font = `${Math.round(r * 1.25)}px ui-sans-serif, system-ui, Apple Color Emoji, Segoe UI Emoji`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🦖", 0, 1);
      }
    }

    // power-up overlay
    if (p.kind === PIECE_KIND.ROCKET || p.kind === PIECE_KIND.BOMB) {
      const icon = p.kind === PIECE_KIND.ROCKET ? "🚀" : "💣";
      ctx.font = `${Math.round(r * 1.0)}px ui-sans-serif, system-ui, Apple Color Emoji, Segoe UI Emoji`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, 0, 1);

      ctx.beginPath();
      ctx.arc(0, 0, r + cell * 0.06, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(2, Math.round(cell * 0.04));
      ctx.strokeStyle = "rgba(255,255,255,0.50)";
      ctx.shadowColor = c.glow;
      ctx.shadowBlur = cell * 0.18;
      ctx.stroke();
    }

    ctx.restore();
  }

  /** score -> 0..1 (asymptotic, never reaches 1) */
  function speedFromScore(s) {
    // Log-like diminishing returns: 1 - (1 + s/100)^(-0.7)
    const x = Math.max(0, s) / 100;
    return 1 - Math.pow(1 + x, -0.7);
  }

  function runnerRps(speedN) {
    // start slow, accelerate with score; never truly "100%"
    const min = 0.10; // rotations per second at score=0
    const maxAdd = 0.95;
    return min + maxAdd * clamp(speedN, 0, 0.999999);
  }

  let wheelAngle = Math.random() * Math.PI * 2;
  let runnerT = 0;

  /**
   * @param {number} dtSeconds
   */
  function renderRunner(dtSeconds) {
    resizeCanvasToDisplaySize(runnerCanvas);
    const w = runnerCanvas.width;
    const h = runnerCanvas.height;
    const size = Math.min(w, h);

    runnerT += dtSeconds;
    const speedN = speedFromScore(score);
    const rps = runnerRps(speedN);
    wheelAngle = (wheelAngle + dtSeconds * (Math.PI * 2) * rps) % (Math.PI * 2);

    runnerCtx.clearRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.5;
    const trackR = size * 0.34;

    // wheel glow
    runnerCtx.save();
    runnerCtx.translate(cx, cy);

    const grad = runnerCtx.createRadialGradient(0, 0, trackR * 0.70, 0, 0, trackR * 1.30);
    grad.addColorStop(0, "rgba(255,255,255,0.02)");
    grad.addColorStop(0.55, "rgba(110,231,255,0.08)");
    grad.addColorStop(1, "rgba(167,139,250,0.08)");
    runnerCtx.fillStyle = grad;
    runnerCtx.beginPath();
    runnerCtx.arc(0, 0, trackR * 1.18, 0, Math.PI * 2);
    runnerCtx.fill();

    // rotating spokes (so motion is readable)
    runnerCtx.save();
    runnerCtx.rotate(wheelAngle);
    runnerCtx.strokeStyle = "rgba(255,255,255,0.16)";
    runnerCtx.lineWidth = Math.max(2, Math.round(size * 0.012));
    runnerCtx.shadowColor = "rgba(110,231,255,0.18)";
    runnerCtx.shadowBlur = size * 0.06;
    const spokes = 8;
    for (let i = 0; i < spokes; i++) {
      const a = (i * Math.PI * 2) / spokes;
      const x1 = Math.cos(a) * trackR * 0.45;
      const y1 = Math.sin(a) * trackR * 0.45;
      const x2 = Math.cos(a) * trackR * 0.98;
      const y2 = Math.sin(a) * trackR * 0.98;
      runnerCtx.beginPath();
      runnerCtx.moveTo(x1, y1);
      runnerCtx.lineTo(x2, y2);
      runnerCtx.stroke();
    }
    runnerCtx.restore();

    // rim
    runnerCtx.beginPath();
    runnerCtx.arc(0, 0, trackR, 0, Math.PI * 2);
    runnerCtx.strokeStyle = "rgba(255,255,255,0.20)";
    runnerCtx.lineWidth = Math.max(2, Math.round(size * 0.016));
    runnerCtx.shadowColor = "rgba(110,231,255,0.22)";
    runnerCtx.shadowBlur = size * 0.10;
    runnerCtx.stroke();

    // inner rim
    runnerCtx.beginPath();
    runnerCtx.arc(0, 0, trackR * 0.58, 0, Math.PI * 2);
    runnerCtx.strokeStyle = "rgba(255,255,255,0.10)";
    runnerCtx.lineWidth = Math.max(1, Math.round(size * 0.010));
    runnerCtx.shadowBlur = 0;
    runnerCtx.stroke();
    runnerCtx.restore();

    // runner (emoji) – stays near the bottom like a hamster wheel
    const skin = SKINS.find((s) => s.id === persisted.activeSkin) ?? SKINS[0];
    const bob = Math.sin(runnerT * 12) * (size * 0.010);
    const px = cx;
    const py = cy + trackR * 0.62 + bob;
    const tilt = Math.sin(runnerT * 12) * 0.08;

    runnerCtx.save();
    runnerCtx.translate(px, py);
    runnerCtx.rotate(tilt);
    runnerCtx.font = `${Math.round(size * 0.12)}px ui-sans-serif, system-ui, Apple Color Emoji, Segoe UI Emoji`;
    runnerCtx.textAlign = "center";
    runnerCtx.textBaseline = "middle";
    runnerCtx.shadowColor = "rgba(0,0,0,0.45)";
    runnerCtx.shadowBlur = size * 0.04;
    runnerCtx.fillText(skin.emoji, 0, 0);
    runnerCtx.restore();

    if (elRunnerSubtitle) {
      elRunnerSubtitle.textContent = "rychlost roste se skóre";
    }
  }

  function renderSkins() {
    elSkinList.innerHTML = "";
    for (const s of SKINS) {
      const owned = persisted.ownedSkins.includes(s.id);
      const active = persisted.activeSkin === s.id;

      const card = document.createElement("div");
      card.className = `skin${active ? " skin--active" : ""}`;

      const emoji = document.createElement("div");
      emoji.className = "skin__emoji";
      emoji.textContent = s.emoji;

      const name = document.createElement("div");
      name.className = "skin__name";
      name.textContent = s.name;

      const meta = document.createElement("div");
      meta.className = "skin__meta";
      meta.textContent = s.cost === 0 ? "default" : `cena: ${s.cost} skóre`;

      const actions = document.createElement("div");
      actions.className = "skin__actions";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn skin__btn";

      if (active) {
        btn.textContent = "Aktivní";
        btn.disabled = true;
      } else if (owned) {
        btn.textContent = "Použít";
        btn.addEventListener("click", () => {
          playSfx("ui", 0.9);
          persisted.activeSkin = s.id;
          savePersistedState(persisted);
          renderSkins();
          renderRunner(0);
        });
      } else {
        btn.textContent = s.cost === 0 ? "Vzít" : "Koupit";
        btn.addEventListener("click", () => {
          ensureAudio();
          if (score < s.cost) {
            playSfx("bad", 0.8);
            setHint(`Na "${s.name}" potřebuješ aspoň ${s.cost} skóre. (Teď máš ${score}.)`);
            return;
          }

          const ok =
            s.cost === 0 ||
            confirm(`Koupit "${s.name}" za ${s.cost} skóre?\n\nPozor: nákup resetuje skóre na 0.`);
          if (!ok) return;

          playSfx("ui", 1);
          if (!persisted.ownedSkins.includes(s.id)) persisted.ownedSkins.push(s.id);
          persisted.activeSkin = s.id;
          savePersistedState(persisted);
          setScore(0);
          renderSkins();
          setHint(`Skin "${s.name}" koupen! Skóre resetováno.`);
        });
      }

      actions.appendChild(btn);
      card.appendChild(emoji);
      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(actions);
      elSkinList.appendChild(card);
    }
  }

  function initThemeUI() {
    const radios = /** @type {NodeListOf<HTMLInputElement>} */ (
      document.querySelectorAll('input[name="pieceTheme"]')
    );
    for (const r of radios) {
      r.checked = r.value === persisted.pieceTheme;
      r.addEventListener("change", () => {
        ensureAudio();
        if (!r.checked) return;
        if (
          r.value === PIECE_THEME.BALLS ||
          r.value === PIECE_THEME.DINOS ||
          r.value === PIECE_THEME.DIAMONDS
        ) {
          persisted.pieceTheme = r.value;
          savePersistedState(persisted);
          playSfx("ui", 0.8);
          renderBoard();
        }
      });
    }
  }

  function initSoundUI() {
    toggleSound.checked = persisted.soundEnabled;
    toggleSound.addEventListener("change", () => {
      persisted.soundEnabled = toggleSound.checked;
      savePersistedState(persisted);
      if (persisted.soundEnabled) ensureAudio();
      playSfx("ui", 0.7);
    });
  }

  function newGame() {
    board = makeBoard();
    setScore(0);
    clearSelection();
    setHint("Nová hra. Táhni přes stejné barvy (min 3).");
    renderBoard();
  }

  // Unified interactions (pointer + fallback for older browsers)
  /**
   * @param {{x:number,y:number}} at
   */
  function handleDownAt(at) {
    ensureAudio();
    const p = board[at.y][at.x];
    if (!p) return;

    pointerIsDown = true;

    if (p.kind === PIECE_KIND.ROCKET || p.kind === PIECE_KIND.BOMB) {
      mode = "special";
      specialOrigin = { x: at.x, y: at.y };
      specialTarget = null;
      setHint(p.kind === PIECE_KIND.ROCKET ? "Raketa: klikni nebo potáhni o 1 vedle." : "Bomba: klikni.");
      renderBoard();
      return;
    }

    mode = "select";
    selection = [{ x: at.x, y: at.y }];
    selectionSet = new Set([cellKey(at.x, at.y)]);
    selectionColor = p.color;
    setHint("Táhni dál…");
    renderBoard();
  }

  /**
   * @param {{x:number,y:number}} at
   */
  function handleMoveAt(at) {
    if (!pointerIsDown) return;

    if (mode === "special" && specialOrigin) {
      const p = board[specialOrigin.y]?.[specialOrigin.x];
      if (p && p.kind === PIECE_KIND.ROCKET) {
        const cand = { x: at.x, y: at.y };
        if (manhattan(cand, specialOrigin) === 1) specialTarget = cand;
        else specialTarget = null;
        renderBoard();
      }
      return;
    }

    if (mode !== "select") return;
    if (selection.length === 0 || selectionColor == null) return;

    const last = selection[selection.length - 1];
    const cand = { x: at.x, y: at.y };
    if (cand.x === last.x && cand.y === last.y) return;
    if (manhattan(cand, last) !== 1) return;

    // backtrack
    if (selection.length >= 2) {
      const prev = selection[selection.length - 2];
      if (cand.x === prev.x && cand.y === prev.y) {
        const removed = selection.pop();
        if (removed) selectionSet.delete(cellKey(removed.x, removed.y));
        renderBoard();
        return;
      }
    }

    const k = cellKey(cand.x, cand.y);
    if (selectionSet.has(k)) return;

    const p = board[cand.y][cand.x];
    if (!p) return;
    if (p.color !== selectionColor) return;

    selection.push(cand);
    selectionSet.add(k);
    renderBoard();
  }

  function finishPointer() {
    if (!pointerIsDown) return;
    pointerIsDown = false;
    pointerId = null;

    if (mode === "select") {
      if (selection.length >= 3) {
        applyMatch();
      } else {
        if (selection.length > 0) playSfx("bad", 0.7);
        setHint("Minimálně 3 v řadě 🙂");
      }
    }

    if (mode === "special") {
      detonateSpecial();
    }

    clearSelection();
    renderBoard();
  }

  function supportsPointerEvents() {
    return "PointerEvent" in window;
  }

  if (supportsPointerEvents()) {
    // Pointer events path
    boardCanvas.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      const cell = pointToCell(ev);
      if (!cell) return;

      // Only start a drag if there is a piece at the tapped cell.
      if (!board[cell.y]?.[cell.x]) return;

      pointerId = ev.pointerId;
      try {
        boardCanvas.setPointerCapture(pointerId);
      } catch {
        // ignore
      }
      handleDownAt({ x: cell.x, y: cell.y });
    });

    boardCanvas.addEventListener("pointermove", (ev) => {
      if (!pointerIsDown) return;
      if (pointerId != null && ev.pointerId !== pointerId) return;
      ev.preventDefault();
      const cell = pointToCell(ev);
      if (!cell) return;
      handleMoveAt({ x: cell.x, y: cell.y });
    });

    const end = (ev) => {
      if (pointerId != null && ev.pointerId !== pointerId) return;
      ev.preventDefault();
      finishPointer();
    };
    boardCanvas.addEventListener("pointerup", end);
    boardCanvas.addEventListener("pointercancel", end);
  } else {
    // Mouse + touch fallback
    let activeTouchId = null;

    boardCanvas.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      pointerId = null;
      const cell = pointToCell(ev);
      if (!cell) return;
      handleDownAt({ x: cell.x, y: cell.y });
    });

    window.addEventListener("mousemove", (ev) => {
      if (!pointerIsDown) return;
      const cell = pointToCell(ev);
      if (!cell) return;
      handleMoveAt({ x: cell.x, y: cell.y });
    });

    window.addEventListener("mouseup", () => {
      finishPointer();
    });

    boardCanvas.addEventListener(
      "touchstart",
      (ev) => {
        ev.preventDefault();
        if (ev.changedTouches.length === 0) return;
        const t = ev.changedTouches[0];
        activeTouchId = t.identifier;
        const cell = pointToCell({ clientX: t.clientX, clientY: t.clientY });
        if (!cell) return;
        handleDownAt({ x: cell.x, y: cell.y });
      },
      { passive: false }
    );

    boardCanvas.addEventListener(
      "touchmove",
      (ev) => {
        if (!pointerIsDown) return;
        ev.preventDefault();
        const t = Array.from(ev.touches).find((x) => x.identifier === activeTouchId);
        if (!t) return;
        const cell = pointToCell({ clientX: t.clientX, clientY: t.clientY });
        if (!cell) return;
        handleMoveAt({ x: cell.x, y: cell.y });
      },
      { passive: false }
    );

    const touchEnd = (ev) => {
      ev.preventDefault();
      const t = Array.from(ev.changedTouches).find((x) => x.identifier === activeTouchId);
      if (!t) return;
      activeTouchId = null;
      finishPointer();
    };
    boardCanvas.addEventListener("touchend", touchEnd, { passive: false });
    boardCanvas.addEventListener("touchcancel", touchEnd, { passive: false });
  }

  boardCanvas.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
  });

  btnNew.addEventListener("click", () => {
    ensureAudio();
    playSfx("ui", 1);
    newGame();
  });

  window.addEventListener("resize", () => {
    resizeAll();
  });

  // Init UI
  initSoundUI();
  initThemeUI();
  renderSkins();
  resizeAll();
  newGame();

  // runner animation loop
  let lastTs = performance.now();
  function tick(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    renderRunner(dt);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();


