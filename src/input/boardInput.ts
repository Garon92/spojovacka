import { isAdjacent } from '../core/board';
import type { Pos } from '../core/types';
import type { BoardView } from '../render/boardView';

export interface InputHandlers {
  /** may the player act right now? */
  enabled(): boolean;
  isMovable(p: Pos): boolean;
  isSpecial(p: Pos): boolean;
  swap(a: Pos, b: Pos): void;
  tap(a: Pos): void;
  /** any interaction (resets the idle hint timer) */
  activity(): void;
  /** a tile got selected (for a sound) */
  selected?(p: Pos): void;
  /** keyboard-driven status text for screen readers */
  announce?(text: string): void;
}

const DRAG_THRESHOLD = 0.3; // in cells

/**
 * Board input: drag a tile onto a neighbour, or click/tap two neighbours one after another,
 * tap a special to fire it; keyboard: arrows move the cursor, Enter/Space selects,
 * arrow with a selected tile swaps in that direction.
 */
export class BoardInput {
  private pressed: { cell: Pos; x: number; y: number; id: number; moved: boolean } | null = null;
  private selected: Pos | null = null;
  private cursor: Pos | null = null;
  private keyboardMode = false;
  private disposers: (() => void)[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private view: BoardView,
    private h: InputHandlers,
    private size: () => { w: number; h: number },
  ) {
    const on = <K extends keyof HTMLElementEventMap>(t: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => t.removeEventListener(type, fn as EventListener, opts));
    };
    on(canvas, 'pointerdown', (e) => this.down(e));
    on(canvas, 'pointermove', (e) => this.move(e));
    on(canvas, 'pointerup', (e) => this.up(e));
    on(canvas, 'pointercancel', () => this.cancel());
    on(canvas, 'lostpointercapture', () => this.cancelDrag());
    on(canvas, 'contextmenu', (e) => e.preventDefault());
    on(canvas, 'keydown', (e) => this.key(e));
    on(canvas, 'focus', () => {
      if (this.keyboardMode) this.showCursor();
    });
    on(canvas, 'blur', () => {
      this.view.cursor = null;
    });
  }

  destroy() {
    for (const d of this.disposers) d();
    this.disposers = [];
  }

  clearSelection() {
    this.selected = null;
    this.view.selected = null;
    this.pressed = null;
    this.view.drag = null;
  }

  private select(p: Pos | null) {
    this.selected = p;
    this.view.selected = p;
    if (p) this.h.selected?.(p);
  }

  private down(e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.keyboardMode = false;
    this.view.cursor = null;
    this.h.activity();
    if (!this.h.enabled()) return;
    const cell = this.view.cellAt(e.clientX, e.clientY);
    if (!cell) {
      this.select(null);
      return;
    }
    e.preventDefault();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.pressed = { cell, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
  }

  private move(e: PointerEvent) {
    const p = this.pressed;
    if (!p || e.pointerId !== p.id) return;
    if (!this.h.enabled()) {
      this.cancelDrag();
      return;
    }
    const cs = this.view.cellCss();
    const dx = (e.clientX - p.x) / cs;
    const dy = (e.clientY - p.y) / cs;
    const dist = Math.hypot(dx, dy);
    if (!this.h.isMovable(p.cell)) return;
    if (dist > 0.08) p.moved = true;
    const horiz = Math.abs(dx) >= Math.abs(dy);
    if (dist >= DRAG_THRESHOLD) {
      const target = horiz ? { x: p.cell.x + Math.sign(dx), y: p.cell.y } : { x: p.cell.x, y: p.cell.y + Math.sign(dy) };
      const { w, h } = this.size();
      this.pressed = null;
      this.view.drag = null;
      if (target.x < 0 || target.y < 0 || target.x >= w || target.y >= h || !this.h.isMovable(target)) {
        this.view.nudge(p.cell);
        return;
      }
      this.select(null);
      this.h.swap(p.cell, target);
      return;
    }
    // tile follows the finger a little along the dominant axis
    const k = Math.min(DRAG_THRESHOLD, dist) * 0.9;
    this.view.drag = { pos: p.cell, dx: horiz ? Math.sign(dx) * k : 0, dy: horiz ? 0 : Math.sign(dy) * k };
  }

  private up(e: PointerEvent) {
    const p = this.pressed;
    this.view.drag = null;
    if (!p || e.pointerId !== p.id) return;
    this.pressed = null;
    if (!this.h.enabled()) return;
    const cell = this.view.cellAt(e.clientX, e.clientY) ?? p.cell;
    if (cell.x !== p.cell.x || cell.y !== p.cell.y) {
      // released over another cell without passing the threshold (fast flick) → treat as swap
      if (isAdjacent(p.cell, cell) && this.h.isMovable(p.cell) && this.h.isMovable(cell)) {
        this.select(null);
        this.h.swap(p.cell, cell);
      }
      return;
    }
    this.tapCell(cell);
  }

  private tapCell(cell: Pos) {
    const sel = this.selected;
    if (sel) {
      if (sel.x === cell.x && sel.y === cell.y) {
        if (this.h.isSpecial(cell)) {
          this.select(null);
          this.h.tap(cell);
        } else this.select(null);
        return;
      }
      if (isAdjacent(sel, cell) && this.h.isMovable(cell)) {
        this.select(null);
        this.h.swap(sel, cell);
        return;
      }
    }
    if (this.h.isSpecial(cell)) {
      this.select(null);
      this.h.tap(cell);
      return;
    }
    if (this.h.isMovable(cell)) this.select(cell);
    else {
      this.select(null);
      this.view.nudge(cell);
    }
  }

  private cancelDrag() {
    this.view.drag = null;
  }

  private cancel() {
    this.pressed = null;
    this.view.drag = null;
  }

  private showCursor() {
    const { w, h } = this.size();
    if (!this.cursor) this.cursor = { x: Math.floor(w / 2), y: Math.floor(h / 2) };
    this.view.cursor = this.cursor;
  }

  private key(e: KeyboardEvent) {
    const dirs: Record<string, Pos> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const d = dirs[e.key];
    const isAction = e.key === 'Enter' || e.key === ' ';
    if (!d && !isAction && e.key !== 'Escape') return;
    this.h.activity();
    if (e.key === 'Escape') {
      if (this.selected) {
        e.preventDefault();
        e.stopPropagation();
        this.select(null);
      }
      return;
    }
    e.preventDefault();
    this.keyboardMode = true;
    this.showCursor();
    const { w, h } = this.size();
    const cur = this.cursor!;
    if (d) {
      const n = { x: cur.x + d.x, y: cur.y + d.y };
      if (n.x < 0 || n.y < 0 || n.x >= w || n.y >= h) return;
      if (this.selected && this.h.enabled()) {
        const a = this.selected;
        this.select(null);
        if (this.h.isMovable(n)) {
          this.cursor = n;
          this.view.cursor = n;
          this.h.swap(a, n);
        } else this.view.nudge(a);
        return;
      }
      this.cursor = n;
      this.view.cursor = n;
      this.h.announce?.(`Sloupec ${n.x + 1}, řádek ${n.y + 1}`);
      return;
    }
    if (isAction && this.h.enabled()) this.tapCell(cur);
  }
}
