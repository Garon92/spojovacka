/**
 * Crisp, auto-resizing canvas: backing store = CSS size × devicePixelRatio (capped),
 * 2D context pre-scaled so you draw in CSS pixels.
 *
 *   const view = fitCanvas(canvas, { maxDpr: 2, onResize: ({ width, height }) => layout(width, height) });
 *   view.ctx.fillRect(0, 0, view.width, view.height);   // CSS px
 *   view.destroy();
 */
export interface CanvasView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** CSS pixels */
  width: number;
  height: number;
  dpr: number;
  /** force a re-measure */
  resize(): void;
  destroy(): void;
}

export interface FitCanvasOptions {
  maxDpr?: number;
  /** alpha: false is faster for opaque games */
  alpha?: boolean;
  onResize?: (view: CanvasView) => void;
}

export function fitCanvas(canvas: HTMLCanvasElement, o: FitCanvasOptions = {}): CanvasView {
  const ctx = canvas.getContext('2d', { alpha: o.alpha ?? true }) as CanvasRenderingContext2D;
  const view: CanvasView = {
    canvas,
    ctx,
    width: 0,
    height: 0,
    dpr: 1,
    resize,
    destroy() {
      ro.disconnect();
      window.removeEventListener('resize', resize);
    },
  };
  function resize(): void {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(o.maxDpr ?? 2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (w === view.width && h === view.height && dpr === view.dpr) return;
    view.width = w;
    view.height = h;
    view.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    o.onResize?.(view);
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  window.addEventListener('resize', resize); // DPR changes (zoom, monitor switch)
  resize();
  return view;
}
