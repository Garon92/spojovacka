/**
 * Game loop helper: requestAnimationFrame with clamped delta time, optional fixed-step update,
 * automatic stop while the tab is hidden or a kit dialog (help / settings / confirm) is open —
 * no catch-up burst afterwards, so timers built on `dt` freeze too.
 *
 *   const loop = createLoop({
 *     update: (dt) => world.step(dt),        // dt in seconds (clamped to maxDt)
 *     render: () => draw(ctx),
 *   });
 *   loop.start(); loop.stop(); loop.running;
 */
export interface LoopOptions {
  update: (dt: number, time: number) => void;
  render?: (alpha: number, time: number) => void;
  /** seconds; when set, update() runs at this fixed step and render() gets the interpolation alpha */
  fixedStep?: number;
  /** clamp for dt in seconds (default 0.1) */
  maxDt?: number;
  /** freeze while a kit dialog is open (g92-dialog-open/close); default true */
  pauseOnDialog?: boolean;
}

export interface Loop {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

export function createLoop(o: LoopOptions): Loop {
  const maxDt = o.maxDt ?? 0.1;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let running = false;

  const frame = (now: number) => {
    if (!running) return;
    const t = now / 1000;
    const dt = last ? Math.min(maxDt, Math.max(0, t - last)) : 0;
    last = t;
    if (o.fixedStep) {
      acc += dt;
      let steps = 0;
      while (acc >= o.fixedStep && steps < 8) {
        o.update(o.fixedStep, t);
        acc -= o.fixedStep;
        steps++;
      }
      if (steps === 8) acc = 0;
      o.render?.(acc / o.fixedStep, t);
    } else {
      o.update(dt, t);
      o.render?.(1, t);
    }
    raf = requestAnimationFrame(frame);
  };

  let dialogs = 0;
  const halted = () => document.visibilityState === 'hidden' || dialogs > 0;
  const sync = () => {
    if (halted()) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (running && !raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  const onVisibility = () => sync();
  const onDialogOpen = () => {
    dialogs++;
    sync();
  };
  const onDialogClose = (e: Event) => {
    const open = (e as CustomEvent<{ open?: number }>).detail?.open;
    dialogs = typeof open === 'number' ? open : Math.max(0, dialogs - 1);
    sync();
  };
  const useDialog = o.pauseOnDialog ?? true;

  return {
    start() {
      if (running) return;
      running = true;
      last = 0;
      acc = 0;
      document.addEventListener('visibilitychange', onVisibility);
      if (useDialog) {
        document.addEventListener('g92-dialog-open', onDialogOpen);
        document.addEventListener('g92-dialog-close', onDialogClose);
      }
      if (!halted()) raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
      dialogs = 0;
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('g92-dialog-open', onDialogOpen);
      document.removeEventListener('g92-dialog-close', onDialogClose);
    },
    get running() {
      return running;
    },
  };
}
