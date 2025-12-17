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

  // Animation + juice
  const ANIM = {
    swapMs: 130,
    clearMs: 170,
    popMs: 160,
    minFallMs: 110,
    fallPerCellMs: 55,
  };

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
  /** @type {GainNode | null} */
  let masterGain = null;
  /** @type {DynamicsCompressorNode | null} */
  let masterComp = null;

  function ensureAudio() {
    if (!persisted.soundEnabled) return null;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      if (!audioCtx) audioCtx = new Ctor();
      if (audioCtx && (!masterGain || !masterComp)) {
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.62;

        masterComp = audioCtx.createDynamicsCompressor();
        masterComp.threshold.value = -18;
        masterComp.knee.value = 24;
        masterComp.ratio.value = 3.0;
        masterComp.attack.value = 0.003;
        masterComp.release.value = 0.22;

        masterGain.connect(masterComp);
        masterComp.connect(audioCtx.destination);
      }
      return audioCtx;
    } catch {
      return null;
    }
  }

  function connectToMaster(node) {
    const ctx = ensureAudio();
    if (!ctx || !masterGain) return;
    try {
      node.connect(masterGain);
    } catch {
      // ignore
    }
  }

  function makeNoise(ctx, durSeconds) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * durSeconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.9;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  function envExp(gainParam, t0, peak, t1, end) {
    gainParam.setValueAtTime(0.0001, t0);
    gainParam.exponentialRampToValueAtTime(Math.max(0.0002, peak), t1);
    gainParam.exponentialRampToValueAtTime(Math.max(0.0001, end), t1 + 0.001);
  }

  /**
   * @param {"match"|"bad"|"rocket"|"bomb"|"ui"|"swap"} kind
   * @param {number} intensity 0..1
   */
  function playSfx(kind, intensity = 1) {
    if (!persisted.soundEnabled) return;
    const ctx = ensureAudio();
    if (!ctx || !masterGain) return;

    const now = ctx.currentTime;
    const it = clamp(intensity, 0, 1);

    const mkTone = (type, f0, f1, dur, vol, detune = 0) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.detune.value = detune;
      o.frequency.setValueAtTime(f0, now);
      if (f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), now + Math.min(0.02, dur * 0.28));
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g);
      connectToMaster(g);
      o.start(now);
      o.stop(now + dur + 0.02);
    };

    const mkNoise = (dur, vol, filterType = "lowpass", freq = 500, q = 0.8) => {
      const src = makeNoise(ctx, dur);
      const filt = ctx.createBiquadFilter();
      filt.type = filterType;
      filt.frequency.setValueAtTime(freq, now);
      filt.Q.setValueAtTime(q, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), now + Math.min(0.03, dur * 0.35));
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(filt);
      filt.connect(g);
      connectToMaster(g);
      src.start(now);
      src.stop(now + dur + 0.02);
    };

    if (kind === "ui") {
      mkTone("triangle", 760, 520, 0.06, 0.07 * (0.65 + it * 0.6), -6);
      return;
    }

    if (kind === "swap") {
      mkTone("triangle", 420, 520, 0.045, 0.06 * (0.6 + it * 0.6), -8);
      mkTone("sine", 520, 620, 0.04, 0.035 * (0.6 + it * 0.6), 6);
      return;
    }

    if (kind === "bad") {
      mkTone("sine", 220, 130, 0.09, 0.09 * (0.6 + it * 0.7));
      mkNoise(0.08, 0.08 * (0.55 + it * 0.8), "lowpass", 420, 0.9);
      return;
    }

    if (kind === "match") {
      // small arpeggio + sparkle noise
      const base = 360 + it * 220;
      mkTone("triangle", base, base * 1.12, 0.09, 0.09 * (0.65 + it * 0.7), -5);
      mkTone("sine", base * 1.25, base * 1.35, 0.085, 0.055 * (0.6 + it * 0.7), 7);
      mkTone("sine", base * 1.5, base * 1.6, 0.075, 0.045 * (0.55 + it * 0.7), 2);
      mkNoise(0.06, 0.03 * (0.4 + it), "highpass", 1800, 0.7);
      return;
    }

    if (kind === "rocket") {
      // whoosh + snap
      mkNoise(0.16, 0.12 * (0.7 + it * 0.8), "bandpass", 900, 0.9);
      mkTone("sawtooth", 260, 380, 0.14, 0.09 * (0.65 + it * 0.7), -8);
      mkTone("triangle", 720, 520, 0.07, 0.06 * (0.55 + it * 0.7), 4);
      return;
    }

    if (kind === "bomb") {
      // boom + rumble noise
      mkTone("sine", 170, 70, 0.22, 0.13 * (0.7 + it * 0.9));
      mkTone("triangle", 220, 90, 0.20, 0.06 * (0.6 + it * 0.9), -10);
      mkNoise(0.24, 0.14 * (0.65 + it * 0.9), "lowpass", 520, 0.8);
      return;
    }
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function easeOutBack(t) {
    const c1 = 1.55;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
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
        const forbid = new Set();
        // Avoid creating immediate 3-in-a-row at init time
        if (x >= 2) {
          const p1 = row[x - 1];
          const p2 = row[x - 2];
          if (p1 && p2 && p1.color === p2.color) forbid.add(p1.color);
        }
        if (y >= 2) {
          const p1 = b[y - 1]?.[x];
          const p2 = b[y - 2]?.[x];
          if (p1 && p2 && p1.color === p2.color) forbid.add(p1.color);
        }

        let color = randInt(COLORS.length);
        if (forbid.size > 0) {
          let tries = 0;
          while (forbid.has(color) && tries < 12) {
            color = randInt(COLORS.length);
            tries++;
          }
          if (forbid.has(color)) {
            // deterministic fallback
            for (let c = 0; c < COLORS.length; c++) {
              if (!forbid.has(c)) {
                color = c;
                break;
              }
            }
          }
        }

        row.push(makePiece(color, PIECE_KIND.NORMAL));
      }
      b.push(row);
    }
    return b;
  }

  /** @type {(Piece|null)[][]} */
  let board = makeBoard();
  let score = 0;

  let isBusy = false;

  /** @typedef {{x:number,y:number,alpha:number,scale:number}} VisualState */
  /** @type {Map<number, VisualState>} */
  const visuals = new Map();

  /** @type {Map<number, {start:number,dur:number,fromX:number,fromY:number,toX:number,toY:number,ease:(t:number)=>number}>} */
  const moveAnims = new Map();

  /** @type {Map<number, {start:number,dur:number,fromA:number,toA:number,fromS:number,toS:number,ease:(t:number)=>number}>} */
  const styleAnims = new Map();

  /** @type {{x:number,y:number,vx:number,vy:number,life:number,age:number,color:string}[]} */
  const particles = [];

  let boardShake = 0; // px
  let boardShakeT = 0;

  /** input state */
  let pointerIsDown = false;
  let pointerId = null;
  /** @type {"idle"|"swap"|"special"} */
  let mode = "idle";
  /** @type {{x:number,y:number}|null} */
  let dragOrigin = null;
  /** @type {{x:number,y:number}|null} */
  let dragTarget = null;
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

  function bumpScore() {
    elScore.classList.remove("bump");
    // force reflow
    void elScore.offsetWidth;
    elScore.classList.add("bump");
  }

  function addScore(delta) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    setScore(score + delta);
    bumpScore();
  }

  function syncVisualsToBoard() {
    /** @type {Set<number>} */
    const present = new Set();
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const p = board[y][x];
        if (!p) continue;
        present.add(p.id);
        const v = visuals.get(p.id);
        if (!v) {
          visuals.set(p.id, { x, y, alpha: 1, scale: 1 });
        } else {
          // If not currently animating, snap to grid to avoid drift
          if (!moveAnims.has(p.id)) {
            v.x = x;
            v.y = y;
          }
          if (!styleAnims.has(p.id)) {
            v.alpha = 1;
            v.scale = 1;
          }
        }
      }
    }
    // cleanup
    for (const id of Array.from(visuals.keys())) {
      if (!present.has(id) && !moveAnims.has(id) && !styleAnims.has(id)) visuals.delete(id);
    }
  }

  function scheduleMove(id, fromX, fromY, toX, toY, ms, ease = easeOutCubic) {
    const v = visuals.get(id) ?? { x: fromX, y: fromY, alpha: 1, scale: 1 };
    v.x = fromX;
    v.y = fromY;
    visuals.set(id, v);
    moveAnims.set(id, { start: performance.now(), dur: ms, fromX, fromY, toX, toY, ease });
  }

  function scheduleStyle(id, fromA, toA, fromS, toS, ms, ease = easeOutCubic) {
    const v = visuals.get(id) ?? { x: 0, y: 0, alpha: 1, scale: 1 };
    v.alpha = fromA;
    v.scale = fromS;
    visuals.set(id, v);
    styleAnims.set(id, { start: performance.now(), dur: ms, fromA, toA, fromS, toS, ease });
  }

  function hasStepAnimations() {
    return moveAnims.size > 0 || styleAnims.size > 0;
  }

  /** @type {((v:void)=>void)[]} */
  const animWaiters = [];

  function waitForStepAnimations() {
    if (!hasStepAnimations()) return Promise.resolve();
    return new Promise((resolve) => animWaiters.push(resolve));
  }

  function spawnClearParticles(cellX, cellY, colorIdx, count = 5) {
    const cell = getBoardCellSize();
    const px = (cellX + 0.5) * cell;
    const py = (cellY + 0.5) * cell;
    const c = COLORS[colorIdx]?.glow ?? "rgba(255,255,255,0.35)";
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      particles.push({
        x: px,
        y: py,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 0.35 + Math.random() * 0.20,
        age: 0,
        color: c,
      });
    }
    while (particles.length > 260) particles.shift();
  }

  /**
   * @param {number} dtSeconds
   * @param {number} nowMs
   */
  function updateBoardAnimations(dtSeconds, nowMs) {
    // moves
    for (const [id, m] of Array.from(moveAnims.entries())) {
      const t = clamp((nowMs - m.start) / m.dur, 0, 1);
      const e = m.ease(t);
      const v = visuals.get(id) ?? { x: m.fromX, y: m.fromY, alpha: 1, scale: 1 };
      v.x = lerp(m.fromX, m.toX, e);
      v.y = lerp(m.fromY, m.toY, e);
      visuals.set(id, v);
      if (t >= 1) {
        v.x = m.toX;
        v.y = m.toY;
        moveAnims.delete(id);
      }
    }

    // styles
    for (const [id, s] of Array.from(styleAnims.entries())) {
      const t = clamp((nowMs - s.start) / s.dur, 0, 1);
      const e = s.ease(t);
      const v = visuals.get(id) ?? { x: 0, y: 0, alpha: 1, scale: 1 };
      v.alpha = lerp(s.fromA, s.toA, e);
      v.scale = lerp(s.fromS, s.toS, e);
      visuals.set(id, v);
      if (t >= 1) {
        v.alpha = s.toA;
        v.scale = s.toS;
        styleAnims.delete(id);
      }
    }

    // particles (in canvas px)
    if (particles.length > 0) {
      const g = 540; // px/s^2
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dtSeconds;
        if (p.age >= p.life) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += g * dtSeconds;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx * dtSeconds;
        p.y += p.vy * dtSeconds;
      }
    }

    // shake
    boardShakeT += dtSeconds;
    if (boardShake > 0) {
      boardShake = Math.max(0, boardShake - dtSeconds * 28);
    }

    if (!hasStepAnimations() && animWaiters.length > 0) {
      const list = animWaiters.splice(0, animWaiters.length);
      for (const r of list) r();
    }
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
    dragOrigin = null;
    dragTarget = null;
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

  /**
   * @param {{x:number,y:number}} a
   * @param {{x:number,y:number}} b
   */
  function swapCells(a, b) {
    const tmp = board[a.y][a.x];
    board[a.y][a.x] = board[b.y][b.x];
    board[b.y][b.x] = tmp;
  }

  /**
   * Collapse with animated moves (including spawning new pieces from above).
   * Mutates `board` and schedules move animations.
   */
  function collapseAndFillAnimated() {
    /** @type {(Piece|null)[][]} */
    const next = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => null));

    for (let x = 0; x < GRID; x++) {
      let writeY = GRID - 1;

      for (let y = GRID - 1; y >= 0; y--) {
        const p = board[y][x];
        if (!p) continue;
        next[writeY][x] = p;
        if (writeY !== y) {
          const dist = Math.abs(writeY - y);
          const ms = ANIM.minFallMs + dist * ANIM.fallPerCellMs;
          scheduleMove(p.id, x, y, x, writeY, ms, easeOutBack);
        }
        writeY--;
      }

      const nNew = writeY + 1;
      for (let y = writeY; y >= 0; y--) {
        // Random new piece (allow cascades)
        const pNew = makePiece(randInt(COLORS.length), PIECE_KIND.NORMAL);
        next[y][x] = pNew;

        // Start above the board for nicer drop
        const startY = y - nNew - 0.6 - Math.random() * 1.2;
        const dist = Math.abs(y - startY);
        const ms = ANIM.minFallMs + dist * ANIM.fallPerCellMs * 0.55;
        scheduleMove(pNew.id, x, startY, x, y, ms, easeOutCubic);
        scheduleStyle(pNew.id, 0, 1, 0.78, 1, ANIM.popMs, easeOutBack);
      }
    }

    board = next;
    syncVisualsToBoard();
  }

  /**
   * @typedef {{cells:{x:number,y:number}[], color:number, dir:"h"|"v"}} MatchSegment
   * @returns {MatchSegment[]}
   */
  function findMatchSegments() {
    /** @type {MatchSegment[]} */
    const segments = [];

    // Horizontal
    for (let y = 0; y < GRID; y++) {
      /** @type {number|null} */
      let runColor = null;
      let runStart = 0;
      for (let x = 0; x <= GRID; x++) {
        const p = x < GRID ? board[y][x] : null;
        const c = p ? p.color : null;
        if (c !== runColor) {
          if (runColor != null) {
            const len = x - runStart;
            if (len >= 3) {
              /** @type {{x:number,y:number}[]} */
              const cells = [];
              for (let xx = runStart; xx < x; xx++) cells.push({ x: xx, y });
              segments.push({ cells, color: runColor, dir: "h" });
            }
          }
          runColor = c;
          runStart = x;
        }
      }
    }

    // Vertical
    for (let x = 0; x < GRID; x++) {
      /** @type {number|null} */
      let runColor = null;
      let runStart = 0;
      for (let y = 0; y <= GRID; y++) {
        const p = y < GRID ? board[y][x] : null;
        const c = p ? p.color : null;
        if (c !== runColor) {
          if (runColor != null) {
            const len = y - runStart;
            if (len >= 3) {
              /** @type {{x:number,y:number}[]} */
              const cells = [];
              for (let yy = runStart; yy < y; yy++) cells.push({ x, y: yy });
              segments.push({ cells, color: runColor, dir: "v" });
            }
          }
          runColor = c;
          runStart = y;
        }
      }
    }

    return segments;
  }

  /**
   * @param {MatchSegment[]} segments
   * @param {{x:number,y:number}[]|null} preferredSwapCells
   * @returns {Map<string, {x:number,y:number,kind:"rocket"|"bomb",color:number}>}
   */
  function computeSpecialCreations(segments, preferredSwapCells) {
    /** @type {Map<string, {x:number,y:number,kind:"rocket"|"bomb",color:number}>} */
    const out = new Map();

    const prefer = preferredSwapCells ? [preferredSwapCells[1], preferredSwapCells[0]] : [];

    for (const seg of segments) {
      const len = seg.cells.length;
      if (len < 4) continue;

      const kind = len >= 5 ? PIECE_KIND.BOMB : PIECE_KIND.ROCKET;

      /** @type {{x:number,y:number}|null} */
      let target = null;

      // Prefer swapped cell(s) if they are inside the segment (and ideally not already a special)
      for (const pc of prefer) {
        if (!pc) continue;
        if (!seg.cells.some((c) => c.x === pc.x && c.y === pc.y)) continue;
        const p = board[pc.y]?.[pc.x];
        if (p && p.kind === PIECE_KIND.NORMAL) {
          target = pc;
          break;
        }
      }
      if (!target) {
        for (const pc of prefer) {
          if (!pc) continue;
          if (seg.cells.some((c) => c.x === pc.x && c.y === pc.y)) {
            target = pc;
            break;
          }
        }
      }

      // Otherwise pick a normal piece near the middle
      if (!target) {
        const mid = Math.floor(len / 2);
        target = seg.cells[mid] ?? seg.cells[0];
        for (let i = 0; i < len; i++) {
          const idx = (mid + i) % len;
          const c = seg.cells[idx];
          const p = board[c.y]?.[c.x];
          if (p && p.kind === PIECE_KIND.NORMAL) {
            target = c;
            break;
          }
        }
      }

      if (!target) continue;

      const k = cellKey(target.x, target.y);
      const existing = out.get(k);
      if (!existing) {
        out.set(k, { x: target.x, y: target.y, kind, color: seg.color });
      } else if (existing.kind === PIECE_KIND.ROCKET && kind === PIECE_KIND.BOMB) {
        out.set(k, { x: target.x, y: target.y, kind, color: seg.color });
      }
    }

    return out;
  }

  /**
   * Chain-reaction: if a special piece is cleared, it also explodes.
   * @param {Set<string>} clearKeys
   * @param {Set<string>} protectedKeys
   */
  function expandWithSpecialExplosions(clearKeys, protectedKeys) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const k of Array.from(clearKeys)) {
        if (protectedKeys.has(k)) continue;
        const [xs, ys] = k.split(",");
        const x = Number(xs);
        const y = Number(ys);
        if (!isInBounds(x, y)) continue;
        const p = board[y]?.[x];
        if (!p) continue;
        if (p.kind !== PIECE_KIND.ROCKET && p.kind !== PIECE_KIND.BOMB) continue;

        const area = p.kind === PIECE_KIND.ROCKET ? rocketArea({ x, y }) : bombArea({ x, y });
        for (const c of area) {
          if (!isInBounds(c.x, c.y)) continue;
          const kk = cellKey(c.x, c.y);
          if (protectedKeys.has(kk)) continue;
          if (!clearKeys.has(kk)) {
            clearKeys.add(kk);
            changed = true;
          }
        }
      }
    }
  }

  /**
   * Resolve all matches on the board (cascades) and create specials for 4/5+.
   * Animated: clear (fade/scale) + falling.
   * @param {{x:number,y:number}[]|null} preferredSwapCells
   */
  async function resolveMatchesAnimated(preferredSwapCells = null) {
    let cascade = 0;

    while (true) {
      const segments = findMatchSegments();
      if (segments.length === 0) break;

      cascade++;
      const creations = computeSpecialCreations(segments, preferredSwapCells);
      const protectedKeys = new Set(creations.keys());

      /** @type {Set<string>} */
      const clearKeys = new Set();
      for (const seg of segments) {
        for (const c of seg.cells) {
          const k = cellKey(c.x, c.y);
          if (!protectedKeys.has(k)) clearKeys.add(k);
        }
      }

      expandWithSpecialExplosions(clearKeys, protectedKeys);

      /** @type {{x:number,y:number,id:number,color:number}[]} */
      const willClear = [];
      for (const k of clearKeys) {
        const [xs, ys] = k.split(",");
        const x = Number(xs);
        const y = Number(ys);
        if (!isInBounds(x, y)) continue;
        const p = board[y]?.[x];
        if (!p) continue;
        willClear.push({ x, y, id: p.id, color: p.color });
      }

      if (willClear.length === 0) {
        preferredSwapCells = null;
        break;
      }

      // Animate clear
      for (const c of willClear) {
        scheduleStyle(c.id, 1, 0, 1, 0.35, ANIM.clearMs, easeOutCubic);
        spawnClearParticles(c.x, c.y, c.color, 4);
      }

      // Small shake on bigger clears / combos
      boardShake = Math.max(boardShake, 1.2 + Math.min(6, willClear.length * 0.08) + cascade * 0.5);
      playSfx("match", clamp(willClear.length / 14, 0.6, 1));

      await waitForStepAnimations();

      // Apply clear (and cleanup visuals)
      for (const c of willClear) {
        if (isInBounds(c.x, c.y)) board[c.y][c.x] = null;
        visuals.delete(c.id);
        moveAnims.delete(c.id);
        styleAnims.delete(c.id);
      }
      addScore(willClear.length);

      // Create specials (pop)
      for (const cr of creations.values()) {
        if (!isInBounds(cr.x, cr.y)) continue;
        const prev = board[cr.y][cr.x];
        if (prev) visuals.delete(prev.id);
        const np = makePiece(cr.color, cr.kind);
        board[cr.y][cr.x] = np;
        visuals.set(np.id, { x: cr.x, y: cr.y, alpha: 0, scale: 0.65 });
        scheduleStyle(np.id, 0, 1, 0.65, 1.05, ANIM.popMs, easeOutBack);
      }

      collapseAndFillAnimated();
      await waitForStepAnimations();

      preferredSwapCells = null; // only prefer on the first resolve pass
    }
  }

  /**
   * Swap two adjacent cells. If no match is created, revert the swap.
   * @param {{x:number,y:number}} origin
   * @param {{x:number,y:number}} target
   */
  async function attemptSwap(origin, target) {
    if (isBusy) return;
    if (!isInBounds(origin.x, origin.y) || !isInBounds(target.x, target.y)) return;
    if (manhattan(origin, target) !== 1) return;

    const a = board[origin.y][origin.x];
    const b = board[target.y][target.x];
    if (!a || !b) return;

    isBusy = true;

    swapCells(origin, target);
    // Animate swap
    scheduleMove(a.id, origin.x, origin.y, target.x, target.y, ANIM.swapMs, easeInOutQuad);
    scheduleMove(b.id, target.x, target.y, origin.x, origin.y, ANIM.swapMs, easeInOutQuad);
    syncVisualsToBoard();
    playSfx("swap", 0.6);
    await waitForStepAnimations();

    const segments = findMatchSegments();
    if (segments.length === 0) {
      swapCells(origin, target);
      // Animate swap back
      scheduleMove(a.id, target.x, target.y, origin.x, origin.y, ANIM.swapMs, easeInOutQuad);
      scheduleMove(b.id, origin.x, origin.y, target.x, target.y, ANIM.swapMs, easeInOutQuad);
      syncVisualsToBoard();
      playSfx("bad", 0.85);
      setHint("Nic nespojilo — tah se vrací 🙂");
      await waitForStepAnimations();
      isBusy = false;
      return;
    }

    setHint("Good! 🙂");
    await resolveMatchesAnimated([origin, target]);
    isBusy = false;
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
    if (isBusy) return;
    if (!specialOrigin) return;
    const p = board[specialOrigin.y]?.[specialOrigin.x];
    if (!p) return;
    if (p.kind !== PIECE_KIND.ROCKET && p.kind !== PIECE_KIND.BOMB) return;
    isBusy = true;

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

    // Animate explosion clears
    /** @type {{x:number,y:number,id:number,color:number}[]} */
    const willClear = [];
    for (const c of area) {
      if (!isInBounds(c.x, c.y)) continue;
      const pp = board[c.y]?.[c.x];
      if (!pp) continue;
      willClear.push({ x: c.x, y: c.y, id: pp.id, color: pp.color });
    }

    for (const c of willClear) {
      scheduleStyle(c.id, 1, 0, 1, 0.25, ANIM.clearMs, easeOutCubic);
      spawnClearParticles(c.x, c.y, c.color, 6);
    }
    boardShake = Math.max(boardShake, p.kind === PIECE_KIND.BOMB ? 10 : 7);
    playSfx(p.kind === PIECE_KIND.ROCKET ? "rocket" : "bomb", 1);
    setHint(p.kind === PIECE_KIND.ROCKET ? "BOOM! 🚀 (+)" : "KABOOM! 💣");

    waitForStepAnimations().then(async () => {
      for (const c of willClear) {
        if (isInBounds(c.x, c.y)) board[c.y][c.x] = null;
        visuals.delete(c.id);
        moveAnims.delete(c.id);
        styleAnims.delete(c.id);
      }
      if (willClear.length > 0) addScore(willClear.length);
      collapseAndFillAnimated();
      await waitForStepAnimations();
      await resolveMatchesAnimated(null);
      isBusy = false;
    });
  }

  function renderBoard() {
    resizeCanvasToDisplaySize(boardCanvas);
    const w = boardCanvas.width;
    const h = boardCanvas.height;
    const cell = getBoardCellSize();

    syncVisualsToBoard();

    boardCtx.clearRect(0, 0, w, h);

    // camera shake
    let shx = 0;
    let shy = 0;
    if (boardShake > 0.01) {
      shx = Math.sin(boardShakeT * 60) * boardShake;
      shy = Math.cos(boardShakeT * 55) * boardShake;
    }
    boardCtx.save();
    boardCtx.translate(shx, shy);

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

    /** @type {{p:Piece, vx:number, vy:number, alpha:number, scale:number}[]} */
    const drawList = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const p = board[y][x];
        if (!p) continue;
        const v = visuals.get(p.id) ?? { x, y, alpha: 1, scale: 1 };
        drawList.push({ p, vx: v.x, vy: v.y, alpha: v.alpha ?? 1, scale: v.scale ?? 1 });
      }
    }
    drawList.sort((a, b) => a.vy - b.vy);

    for (const it of drawList) {
      const cx = (it.vx + 0.5) * cell;
      const cy = (it.vy + 0.5) * cell;
      drawPiece(boardCtx, it.p, cx, cy, cell, it.scale, it.alpha);
    }

    // drag highlight (swap)
    if (mode === "swap" && dragOrigin) {
      const originPiece = board[dragOrigin.y]?.[dragOrigin.x];
      const c = originPiece ? COLORS[originPiece.color] : COLORS[0];

      /** @param {{x:number,y:number}} pos */
      const strokeCell = (pos) => {
        const pad = cell * 0.10;
        boardCtx.strokeRect(pos.x * cell + pad, pos.y * cell + pad, cell - pad * 2, cell - pad * 2);
      };

      boardCtx.save();
      boardCtx.lineCap = "round";
      boardCtx.lineJoin = "round";
      boardCtx.lineWidth = Math.max(2, Math.round(cell * 0.06));
      boardCtx.strokeStyle = "rgba(255,255,255,0.62)";
      boardCtx.shadowColor = c.glow;
      boardCtx.shadowBlur = cell * 0.25;

      strokeCell(dragOrigin);
      if (dragTarget) {
        strokeCell(dragTarget);
        boardCtx.beginPath();
        boardCtx.moveTo((dragOrigin.x + 0.5) * cell, (dragOrigin.y + 0.5) * cell);
        boardCtx.lineTo((dragTarget.x + 0.5) * cell, (dragTarget.y + 0.5) * cell);
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

    // particles (juice)
    if (particles.length > 0) {
      boardCtx.save();
      boardCtx.globalCompositeOperation = "lighter";
      for (const prt of particles) {
        const t = clamp(prt.age / prt.life, 0, 1);
        const a = 1 - t;
        boardCtx.globalAlpha = a * 0.9;
        boardCtx.fillStyle = prt.color;
        boardCtx.shadowColor = prt.color;
        boardCtx.shadowBlur = cell * 0.25;
        boardCtx.beginPath();
        boardCtx.arc(prt.x, prt.y, cell * 0.06 + a * cell * 0.04, 0, Math.PI * 2);
        boardCtx.fill();
      }
      boardCtx.restore();
    }

    boardCtx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {Piece} p
   * @param {number} cx
   * @param {number} cy
   * @param {number} cell
   */
  function drawPiece(ctx, p, cx, cy, cell, scale = 1, alpha = 1) {
    const theme = persisted.pieceTheme;
    const c = COLORS[p.color];
    const r = cell * 0.34;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.globalAlpha *= alpha;

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
   * Simple side-view "runner" sprites drawn in canvas (no emojis).
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} skinId
   * @param {number} x
   * @param {number} y
   * @param {number} sizePx roughly the height of the animal
   * @param {number} phase animation phase (radians)
   */
  function drawRunnerAnimal(ctx, skinId, x, y, sizePx, phase) {
    const cfg =
      skinId === "rat"
        ? {
            body: "#8b93a6",
            belly: "#c7ceda",
            outline: "rgba(255,255,255,0.16)",
            tail: "#b7bfcc",
            ear: "#d6b3c2",
            snout: 1.05,
            tailLen: 1.25,
          }
        : skinId === "dog"
          ? {
              body: "#b48a62",
              belly: "#e7d3b7",
              outline: "rgba(255,255,255,0.14)",
              tail: "#caa27b",
              ear: "#8e6846",
              snout: 1.18,
              tailLen: 0.70,
            }
          : skinId === "dino"
            ? {
                body: "#35d07f",
                belly: "#bdf7db",
                outline: "rgba(255,255,255,0.14)",
                tail: "#2bb56c",
                ear: "#2bb56c",
                snout: 1.10,
                tailLen: 1.15,
              }
            : {
                body: "#aab3c2",
                belly: "#dbe2ee",
                outline: "rgba(255,255,255,0.16)",
                tail: "#c8cfdb",
                ear: "#e1a7b7",
                snout: 1.00,
                tailLen: 1.05,
              };

    const u = sizePx / 10; // unit size
    const run = Math.sin(phase);
    const run2 = Math.sin(phase + Math.PI);
    const bob = Math.sin(phase * 0.5) * (u * 0.25);

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // subtle shadow on the "tread"
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.ellipse(0, u * 2.2, u * 4.0, u * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Tail (behind body)
    ctx.save();
    ctx.strokeStyle = cfg.tail;
    ctx.lineWidth = u * 0.55;
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = u * 0.4;
    const tailSwing = (skinId === "dog" ? 0.35 : 0.55) * run;
    ctx.beginPath();
    ctx.moveTo(-u * 3.2, u * 0.2);
    ctx.quadraticCurveTo(
      -u * 5.2,
      -u * 0.4 + tailSwing * u,
      -u * (6.6 * cfg.tailLen),
      u * 0.6 + tailSwing * u
    );
    ctx.stroke();
    ctx.restore();

    // Legs (behind body)
    ctx.save();
    ctx.strokeStyle = "rgba(10,12,18,0.55)";
    ctx.lineWidth = u * 0.65;
    const legLift = u * 0.55;
    const legFwd = u * 0.85;

    // back leg
    ctx.beginPath();
    ctx.moveTo(-u * 1.7, u * 1.5);
    ctx.lineTo(-u * 1.7 + run2 * legFwd, u * (2.7 - Math.max(0, run2) * legLift));
    ctx.stroke();

    // front leg
    ctx.beginPath();
    ctx.moveTo(u * 1.4, u * 1.5);
    ctx.lineTo(u * 1.4 + run * legFwd, u * (2.7 - Math.max(0, run) * legLift));
    ctx.stroke();
    ctx.restore();

    // Body
    ctx.save();
    ctx.fillStyle = cfg.body;
    ctx.strokeStyle = cfg.outline;
    ctx.lineWidth = u * 0.25;
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 3.3, u * 2.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Belly highlight
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = cfg.belly;
    ctx.beginPath();
    ctx.ellipse(u * 0.6, u * 0.6, u * 2.0, u * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Head + snout
    ctx.save();
    ctx.translate(u * 3.1, -u * 0.6);
    ctx.fillStyle = cfg.body;
    ctx.strokeStyle = cfg.outline;
    ctx.lineWidth = u * 0.22;
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 1.7, u * 1.3, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Snout / nose bump
    ctx.beginPath();
    ctx.ellipse(u * 1.2 * cfg.snout, u * 0.25, u * 0.75, u * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = cfg.body;
    ctx.fill();
    ctx.stroke();

    // Eye
    ctx.fillStyle = "rgba(10,12,18,0.75)";
    ctx.beginPath();
    ctx.arc(u * 0.35, -u * 0.25, u * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Ear
    ctx.fillStyle = cfg.ear;
    if (skinId === "dog") {
      // floppy ear
      ctx.beginPath();
      ctx.ellipse(-u * 0.55, -u * 0.75, u * 0.55, u * 0.85, -0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(-u * 0.45, -u * 0.95, u * 0.55, u * 0.65, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    // Whiskers for mouse/rat
    if (skinId === "mouse" || skinId === "rat") {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = u * 0.10;
      ctx.beginPath();
      ctx.moveTo(u * 1.35, u * 0.15);
      ctx.lineTo(u * 2.55, -u * 0.05);
      ctx.moveTo(u * 1.35, u * 0.35);
      ctx.lineTo(u * 2.55, u * 0.35);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // Legs (front layer)
    ctx.save();
    ctx.strokeStyle = "rgba(20,22,30,0.55)";
    ctx.lineWidth = u * 0.65;
    const legLift2 = u * 0.55;
    const legFwd2 = u * 0.85;

    // back leg (front layer)
    ctx.beginPath();
    ctx.moveTo(-u * 1.2, u * 1.5);
    ctx.lineTo(-u * 1.2 + run * legFwd2, u * (2.7 - Math.max(0, run) * legLift2));
    ctx.stroke();

    // front leg (front layer)
    ctx.beginPath();
    ctx.moveTo(u * 1.9, u * 1.5);
    ctx.lineTo(u * 1.9 + run2 * legFwd2, u * (2.7 - Math.max(0, run2) * legLift2));
    ctx.stroke();
    ctx.restore();

    // Dino spikes (quick silhouette cue)
    if (skinId === "dino") {
      ctx.save();
      ctx.translate(-u * 0.8, -u * 2.0);
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = u * 0.25;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(u * 0.6, -u * 0.5);
      ctx.lineTo(u * 1.2, 0);
      ctx.lineTo(u * 1.8, -u * 0.5);
      ctx.lineTo(u * 2.4, 0);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

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

    // runner (profile sprite) – stays near the bottom like a hamster wheel
    const skin = SKINS.find((s) => s.id === persisted.activeSkin) ?? SKINS[0];
    const px = cx;
    const py = cy + trackR * 0.60;
    const runPhase = runnerT * (10 + speedN * 12);
    const tilt = Math.sin(runPhase) * 0.05;

    runnerCtx.save();
    runnerCtx.translate(px, py);
    runnerCtx.rotate(tilt);
    runnerCtx.shadowColor = "rgba(0,0,0,0.35)";
    runnerCtx.shadowBlur = size * 0.02;
    drawRunnerAnimal(runnerCtx, skin.id, 0, 0, size * 0.17, runPhase);
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
    isBusy = false;
    visuals.clear();
    moveAnims.clear();
    styleAnims.clear();
    particles.splice(0, particles.length);
    boardShake = 0;
    boardShakeT = 0;
    clearSelection();
    setHint("Nová hra. Přetáhni dílek na sousední a prohoď je (min 3 v řadě).");
    syncVisualsToBoard();
    renderBoard();
  }

  // Unified interactions (pointer + fallback for older browsers)
  /**
   * @param {{x:number,y:number}} at
   */
  function handleDownAt(at) {
    if (isBusy) return;
    ensureAudio();
    const p = board[at.y][at.x];
    if (!p) return;

    pointerIsDown = true;

    dragOrigin = { x: at.x, y: at.y };
    dragTarget = null;

    if (p.kind === PIECE_KIND.ROCKET) {
      mode = "special";
      specialOrigin = { x: at.x, y: at.y };
      specialTarget = null;
      setHint("🚀 Raketa: klikni nebo potáhni o 1 vedle.");
      renderBoard();
      return;
    }

    // Bomb: click detonates, drag swaps like a normal piece (match-3 feel)
    mode = "swap";
    setHint("Přetáhni na sousední a pusť (prohodí se).");
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

    if (mode !== "swap" || !dragOrigin) return;

    const cand = { x: at.x, y: at.y };
    if (cand.x === dragOrigin.x && cand.y === dragOrigin.y) {
      if (dragTarget) {
        dragTarget = null;
        renderBoard();
      }
      return;
    }

    if (manhattan(cand, dragOrigin) === 1) {
      if (!dragTarget || dragTarget.x !== cand.x || dragTarget.y !== cand.y) {
        dragTarget = cand;
        renderBoard();
      }
      return;
    }

    if (dragTarget) {
      dragTarget = null;
      renderBoard();
    }
  }

  function finishPointer() {
    if (!pointerIsDown) return;
    pointerIsDown = false;
    pointerId = null;

    if (mode === "special") {
      detonateSpecial();
      clearSelection();
      renderBoard();
      return;
    }

    if (mode === "swap" && dragOrigin) {
      const origin = dragOrigin;
      const target = dragTarget;
      const originPiece = board[origin.y]?.[origin.x];

      // Click on bomb detonates it.
      if (!target && originPiece && originPiece.kind === PIECE_KIND.BOMB) {
        specialOrigin = origin;
        specialTarget = null;
        detonateSpecial();
        clearSelection();
        renderBoard();
        return;
      }

      if (target) {
        attemptSwap(origin, target);
      }
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
      if (isBusy) return;
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
      if (isBusy) return;
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
        if (isBusy) return;
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
    updateBoardAnimations(dt, ts);
    renderBoard();
    renderRunner(dt);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();


