import { chooseMove } from '../core/bot';
import { playBonus, playMove } from '../core/game';
import { LEVELS, WORLDS, dailyLevel, dailySeed, levelById, levelConfig, starsFor, type LevelDef } from '../core/levels';
import { bestHint, findTaps } from '../core/moves';
import { createRng, randomSeed } from '../core/rng';
import { createGame, isLost, isWon, type GameState } from '../core/state';
import { emptyStats, type GameStats, type Goal, type Move, type Pos } from '../core/types';
import { sfx as gameSfx } from '../audio/sfx';
import { BoardInput } from '../input/boardInput';
import {
  DIFFICULTIES_3,
  LABELS,
  LABEL_ICONS,
  UI_ICONS,
  autoPause,
  countdown,
  getSettings,
  h,
  haptic,
  openDialog,
  prefersReducedMotion,
  recordActivity,
  showPause,
  showResults,
  showStart,
  subscribeSettings,
} from '../kit';
import { BoardView, type ViewEvent } from '../render/boardView';
import { Runner, speedFromScore } from '../render/runner';
import {
  MAX_STARS,
  addCoins,
  coinsForScore,
  dailyState,
  dayKey,
  levelRecord,
  recordStats,
  submitDaily,
  store,
  submitLevel,
  totalStars,
  type Difficulty,
} from '../app/save';
import { TIPS, goalIcon, goalLabel } from './content';
import { checkAchievements, type Achievement } from '../app/achievements';
import type { Nav } from './nav';

export type Mode = 'level' | 'relax' | 'timed';

const TIMED_SECONDS = 90;
const DIFF_COLORS: Record<Difficulty, number> = { easy: 4, normal: 5, hard: 6 };
/** score thresholds (2★, 3★ are the last two; 1★ = first) for the timed mode */
export const TIMED_STARS: Record<Difficulty, [number, number, number]> = {
  // from scripts/timed.ts (bot, ~24 moves in 90 s), slightly lowered for humans
  easy: [13000, 33000, 55000],
  normal: [4000, 9500, 15500],
  hard: [2000, 4500, 7200],
};
const EXTRA_MOVES = 5;
const EXTRA_COST = 30;
const CALLOUTS = ['', '', 'Dobře!', 'Super!', 'Skvělé!', 'Úžasné!', 'Fantastické!', 'Neuvěřitelné!'];
/** family difficulty names (kit DIFFICULTIES_3), our flavour – number of colours – in the hint */
const COLOR_HINT: Record<Difficulty, string> = { easy: '4 barvy', normal: '5 barev', hard: '6 barev' };
const DIFFICULTIES = DIFFICULTIES_3.map((d) => ({ ...d, hint: COLOR_HINT[d.id] }));
/** simple folded-map icon for "Mapa" buttons (in-app, not the kit's ⊞ Menu) */
const MAP_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6Z" fill="currentColor" fill-opacity=".15"/><path d="M9 4v14M15 6v14"/></svg>';
const PLAIN8 = ['........', '........', '........', '........', '........', '........', '........', '........'];

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.max(0, Math.floor(s % 60));
  return `${m}:${String(r).padStart(2, '0')}`;
}

const fmt = (n: number) => n.toLocaleString('cs-CZ');

export class GameScreen {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private view: BoardView;
  private input: BoardInput;
  private callouts: HTMLElement;
  private hudMoves: HTMLElement;
  private hudMovesLabel: HTMLElement;
  private hudGoals: HTMLElement;
  private hudInfo: HTMLElement;
  private hudScore: HTMLElement;
  private hudStars: HTMLElement;
  private hudBar: HTMLElement;
  private sideInfo: HTMLElement;
  private stageTitle: HTMLElement;
  private live: HTMLElement;
  private runner: Runner;
  private miniRunner: Runner;
  private hintBtn: HTMLButtonElement;

  private mode: Mode = 'level';
  private level: LevelDef | null = null;
  /** day key when playing the daily challenge */
  private daily: string | null = null;
  private diff: Difficulty = 'normal';
  private state!: GameState;
  private busy = false;
  private _ended = true;
  /** game started and not finished (appbar pause button, leave guard) */
  private get ended() {
    return this._ended;
  }
  private set ended(v: boolean) {
    const was = this._ended;
    this._ended = v;
    if (was !== v) this.onRunningChange?.(!v && this.active);
  }
  onRunningChange?: (running: boolean) => void;
  private paused = false;
  private active = false;
  private pauseOverlay: ReturnType<typeof showPause> | null = null;
  private displayGoals: Goal[] = [];
  private displayScore = 0;
  private shownScore = 0;
  private scoreRaf = 0;
  private idleTimer = 0;
  private timeLeft = 0;
  private timerLast = 0;
  private timerRaf = 0;
  private lastTickSec = -1;
  private extraBought = 0;
  /** bumps on every start/leave so stale async flows (dialogs, countdown) can bail out */
  private session = 0;
  /** stats already written to the store for the current game (commit deltas only) */
  private baseline: GameStats = emptyStats();
  private baseChicks = 0;
  private unsubs: (() => void)[] = [];
  private resizeObs: ResizeObserver;
  private goalEls: { el: HTMLElement; n: HTMLElement }[] = [];

  constructor(private nav: Nav) {
    this.el = h('section', { class: 'screen game', id: 'scr-game', hidden: true });
    this.canvas = h('canvas', {
      class: 'board g92-no-touch-scroll',
      tabindex: '0',
      role: 'application',
      'aria-roledescription': 'hrací deska',
      'aria-label': 'Hrací deska. Šipkami vyber dílek, Enter ho označí, šipka ho prohodí se sousedem.',
    }) as HTMLCanvasElement;
    this.callouts = h('div', { class: 'callouts', 'aria-hidden': 'true' });
    this.live = h('div', { class: 'g92-sr-only', 'aria-live': 'polite' });

    this.hudMovesLabel = h('span', { class: 'hud__label' }, 'Tahy');
    this.hudMoves = h('span', { class: 'hud__big g92-tabular' }, '0');
    this.hudGoals = h('ul', { class: 'hud__goals', 'aria-label': 'Úkoly' });
    this.hudInfo = h('div', { class: 'hud__info' });
    this.hudScore = h('span', { class: 'hud__score-val g92-tabular' }, '0');
    this.hudStars = h('span', { class: 'hud__stars', 'aria-hidden': 'true' });
    this.hudBar = h('span', { class: 'hud__bar' }, h('i'));
    const miniCanvas = h('canvas', { class: 'wheel wheel--mini', 'aria-hidden': 'true' }) as HTMLCanvasElement;
    const sideCanvas = h('canvas', { class: 'wheel', 'aria-hidden': 'true' }) as HTMLCanvasElement;
    this.runner = new Runner(sideCanvas);
    this.miniRunner = new Runner(miniCanvas);
    this.sideInfo = h('div', { class: 'side__info' });
    this.stageTitle = h('div', { class: 'game__title', 'aria-hidden': 'true' });

    this.hintBtn = h('button', { type: 'button', class: 'g92-btn g92-btn--secondary game__btn', 'aria-label': 'Nápověda (H)', title: 'Nápověda (H)' }, h('span', { class: 'game__btn-ico', 'aria-hidden': 'true' }, '💡'), h('span', { class: 'game__btn-txt' }, 'Nápověda')) as HTMLButtonElement;
    this.hintBtn.addEventListener('click', () => this.showHint(true));

    const hud = h(
      'div',
      { class: 'hud' },
      h('div', { class: 'hud__moves' }, this.hudMovesLabel, this.hudMoves),
      this.hudGoals,
      this.hudInfo,
      h('div', { class: 'hud__score' }, h('span', { class: 'hud__label' }, 'Body'), this.hudScore, h('span', { class: 'hud__starline' }, this.hudBar, this.hudStars)),
    );
    const stage = h('div', { class: 'game__stage' }, this.stageTitle, this.canvas, this.callouts);
    // pause lives in the appbar (kit appbarPauseButton, registered in main.ts)
    const bar = h('div', { class: 'game__bar' }, h('div', { class: 'game__mini' }, miniCanvas), this.hintBtn);
    const side = h('aside', { class: 'game__side', 'aria-hidden': 'true' }, h('div', { class: 'side__card' }, sideCanvas, this.sideInfo));
    this.el.append(hud, stage, bar, side, this.live);

    this.view = new BoardView(this.canvas, store.get('pieceTheme'), {
      sfx: (name, opts) => gameSfx.play(name, opts),
      event: (e) => this.onViewEvent(e),
    });
    this.input = new BoardInput(
      this.canvas,
      this.view,
      {
        enabled: () => this.canAct(),
        isMovable: (p) => this.isMovable(p),
        isSpecial: (p) => this.isSpecial(p),
        swap: (a, b) => void this.doMove({ type: 'swap', a, b }),
        tap: (a) => void this.doMove({ type: 'tap', a }),
        activity: () => this.bumpIdle(),
        selected: () => gameSfx.play('select'),
        announce: (t) => (this.live.textContent = t),
      },
      () => ({ w: this.state?.board.w ?? 8, h: this.state?.board.h ?? 8 }),
    );
    this.resizeObs = new ResizeObserver(() => this.view.resize());
    this.resizeObs.observe(stage);
    window.addEventListener('keydown', (e) => this.onKey(e));
    // theme (light/dark) changes → re-read board colors
    subscribeSettings(() => {
      this.view.refreshColors();
      this.applySound();
      this.view.reduced = prefersReducedMotion();
    });
    this.view.reduced = prefersReducedMotion();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.view.refreshColors());
    this.applySound();
    this.exposeDebug();
  }

  /* ---------------- public ---------------- */

  /** a game is in progress and something would be lost by leaving */
  isRunning(): boolean {
    return this.active && !this.ended && !!this.state && this.state.movesMade > 0;
  }

  applySound() {
    const s = getSettings();
    gameSfx.enabled = s.sound;
    gameSfx.volume = s.volume;
  }

  setPieceTheme() {
    this.view.setTheme(store.get('pieceTheme'));
    if (this.state) this.renderGoals();
  }

  setAnimSpeed() {
    this.view.speed = store.get('fastAnim') ? 0.65 : 1;
  }

  async startLevel(id: number) {
    const level = levelById(id);
    if (!level) return this.nav.go('#/mapa');
    const sid = ++this.session;
    this.mode = 'level';
    this.level = level;
    this.daily = null;
    this.extraBought = 0;
    this.setup(createGame(levelConfig(level), randomSeed()));
    const ok = await this.levelIntro(level);
    if (!this.active || sid !== this.session) return;
    if (!ok) return this.nav.go('#/mapa');
    this.begin();
    if (level.id === 1) this.scheduleIdle(1800);
  }

  /** daily challenge: a remixed level, same board for everybody today */
  async startDaily() {
    const sid = ++this.session;
    const day = dayKey();
    const level = dailyLevel(day);
    this.mode = 'level';
    this.level = level;
    this.daily = day;
    this.extraBought = 0;
    this.setup(createGame(levelConfig(level), dailySeed(day)));
    const ok = await this.levelIntro(level);
    if (!this.active || sid !== this.session) return;
    if (!ok) return this.nav.go('#/');
    this.begin();
  }

  private levelTitle(): string {
    if (this.daily) return 'Denní výzva';
    return this.level ? `Úroveň ${this.level.id}` : '';
  }

  async startRelax() {
    const sid = ++this.session;
    this.mode = 'relax';
    this.daily = null;
    this.level = null;
    const prev = store.get('relaxDiff');
    this.diff = prev;
    this.setup(createGame({ layout: PLAIN8, colors: DIFF_COLORS[prev], moves: null, goals: [] }, randomSeed()));
    const res = await showStart({
      appId: 'spojovacka',
      title: 'Pohoda',
      subtitle: 'Bez tahů, bez času, bez prohry. Zvířátko v kolečku běží tím rychleji, čím víc spojíš.',
      icon: '🧸',
      difficulties: DIFFICULTIES,
      difficulty: prev,
      difficultyLabel: 'Obtížnost',
      best: { label: 'Rekord', value: store.get('relaxBest') },
      howTo: [
        { icon: '👆', text: 'Přetáhni dílek na souseda' },
        { icon: '✨', text: 'Tři stejné zmizí' },
        { icon: '🚀', text: 'Čtyři stejné = raketa' },
        { icon: '🐹', text: 'Zvířátko běží rychleji' },
      ],
      container: this.el,
      backdrop: 'blur',
    });
    if (!this.active || sid !== this.session) return;
    const diff = (res.difficulty as Difficulty) ?? 'easy';
    store.set('relaxDiff', diff);
    this.diff = diff;
    if (diff !== prev) this.setup(createGame({ layout: PLAIN8, colors: DIFF_COLORS[diff], moves: null, goals: [] }, randomSeed()));
    this.begin();
  }

  async startTimed(skipIntro = false) {
    const sid = ++this.session;
    this.mode = 'timed';
    this.daily = null;
    this.level = null;
    let diff = store.get('timedDiff');
    this.diff = diff;
    this.setup(createGame({ layout: PLAIN8, colors: DIFF_COLORS[diff], moves: null, goals: [] }, randomSeed()));
    this.timeLeft = TIMED_SECONDS;
    this.renderHud();
    if (!skipIntro) {
      const best = store.get('timedBest');
      const res = await showStart({
        appId: 'spojovacka',
        title: 'Na čas',
        subtitle: `${TIMED_SECONDS} sekund – kolik bodů nasbíráš? Každý odpálený speciál přidá sekundu.`,
        icon: '⏱️',
        difficulties: DIFFICULTIES.map((d) => ({ ...d, hint: `${d.hint} · rekord ${fmt(best[d.id as Difficulty])}` })),
        difficulty: diff,
        difficultyLabel: 'Obtížnost',
        howTo: [
          { icon: '⏱️', text: `Máš ${TIMED_SECONDS} sekund` },
          { icon: '💥', text: 'Řetězy násobí body' },
          { icon: '🚀', text: 'Každý speciál = +1 s' },
        ],
        container: this.el,
        backdrop: 'blur',
      });
      if (!this.active || sid !== this.session) return;
      diff = (res.difficulty as Difficulty) ?? 'normal';
      store.set('timedDiff', diff);
      this.diff = diff;
      this.setup(createGame({ layout: PLAIN8, colors: DIFF_COLORS[diff], moves: null, goals: [] }, randomSeed()));
      this.timeLeft = TIMED_SECONDS;
      this.renderHud();
    }
    await countdown({ container: this.el });
    if (!this.active || sid !== this.session) return;
    this.begin();
    this.startTimer();
  }

  /** called when the screen becomes visible */
  enter() {
    this.active = true;
    this.el.hidden = false;
    this.view.resize(true);
    this.view.start();
    this.runner.start();
    this.miniRunner.start();
    this.setAnimSpeed();
    this.unsubs.push(
      autoPause(() => {
        if (!this.ended && !this.paused && this.active) void this.pause();
      }),
    );
  }

  /** called when leaving the screen */
  leave() {
    if (this.state) this.commitGame(false);
    this.session++;
    this.ended = true;
    this.active = false;
    this.onRunningChange?.(false);
    this.el.hidden = true;
    this.view.stop();
    this.view.flush();
    this.runner.stop();
    this.miniRunner.stop();
    this.stopTimer();
    clearTimeout(this.idleTimer);
    this.pauseOverlay?.close('resume');
    this.pauseOverlay = null;
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.el.querySelectorAll('.g92-overlay, .g92-countdown').forEach((n) => n.remove());
    document.querySelectorAll('dialog.level-intro').forEach((d) => (d as HTMLDialogElement).close());
  }

  /* ---------------- setup & HUD ---------------- */

  private setup(state: GameState) {
    if (this.state && this.state !== state) this.commitGame(false);
    this.state = state;
    this.baseline = emptyStats();
    this.baseChicks = 0;
    this.busy = false;
    this.ended = true;
    this.paused = false;
    this.input.clearSelection();
    this.view.showHint(null);
    this.view.load(state);
    this.displayGoals = state.goals.map((g) => ({ ...g }));
    this.displayScore = state.score;
    this.shownScore = state.score;
    this.view.hintHand = this.mode === 'relax' || (this.mode === 'level' && !this.daily && (this.level?.id ?? 99) <= 3);
    const theme = this.mode === 'level' ? WORLDS[this.level?.world ?? 0].theme : this.mode;
    this.el.dataset.theme = theme;
    this.el.dataset.mode = this.mode;
    this.renderGoals();
    this.renderHud();
    this.runner.skin = store.get('activeSkin');
    this.miniRunner.skin = store.get('activeSkin');
    this.updateRunner();
    this.renderSide();
    this.view.refreshColors();
  }

  private begin() {
    this.ended = false;
    this.busy = false;
    this.canvas.focus({ preventScroll: true });
    this.scheduleIdle();
    recordStats({ games: 1 });
  }

  private renderGoals() {
    this.hudGoals.textContent = '';
    this.goalEls = [];
    const theme = store.get('pieceTheme');
    for (const g of this.displayGoals) {
      const n = h('span', { class: 'goal__n g92-tabular' });
      const el = h('li', { class: 'goal', title: goalLabel(g) }, goalIcon(theme, g, 30), n, h('span', { class: 'g92-sr-only' }, goalLabel(g)));
      this.hudGoals.append(el);
      this.goalEls.push({ el, n });
    }
    this.hudGoals.hidden = this.displayGoals.length === 0;
    this.hudInfo.hidden = this.displayGoals.length > 0;
    if (this.mode !== 'level') {
      const best = this.mode === 'timed' ? store.get('timedBest')[this.diff] : store.get('relaxBest');
      this.hudInfo.innerHTML = best > 0 ? `${UI_ICONS.trophy}<span>Rekord <b>${fmt(best)}</b></span>` : '';
    }
    this.updateGoals();
  }

  private updateGoals() {
    this.displayGoals.forEach((g, i) => {
      const ge = this.goalEls[i];
      if (!ge) return;
      const left = Math.max(0, g.target - g.done);
      const done = left === 0;
      const txt = g.kind === 'score' ? fmt(left) : String(left);
      if (done) {
        if (!ge.el.classList.contains('is-done')) {
          ge.el.classList.add('is-done');
          ge.n.innerHTML = UI_ICONS.check;
          if (!this.ended) gameSfx.play('star', { pitch: 2 });
        }
      } else {
        ge.el.classList.remove('is-done');
        if (ge.n.textContent !== txt) {
          ge.n.textContent = txt;
          ge.el.classList.remove('bump');
          void ge.el.offsetWidth;
          ge.el.classList.add('bump');
        }
      }
    });
  }

  private renderHud() {
    const s = this.state;
    if (this.mode === 'level') {
      this.hudMovesLabel.textContent = 'Tahy';
      this.hudMoves.textContent = String(s.movesLeft ?? 0);
      this.el.classList.toggle('is-low', (s.movesLeft ?? 99) <= 5 && !isWon(s));
    } else if (this.mode === 'timed') {
      this.hudMovesLabel.textContent = 'Čas';
      this.hudMoves.textContent = fmtTime(Math.ceil(this.timeLeft));
      this.el.classList.toggle('is-low', this.timeLeft <= 10);
    } else {
      this.hudMovesLabel.textContent = 'Pohoda';
      this.hudMoves.textContent = '∞';
      this.el.classList.remove('is-low');
    }
    this.renderScore();
  }

  private thresholds(): [number, number, number] | null {
    if (this.mode === 'level' && this.level) return [0, this.level.stars[0], this.level.stars[1]];
    if (this.mode === 'timed') return TIMED_STARS[this.diff];
    return null;
  }

  private renderScore() {
    this.hudScore.textContent = fmt(Math.round(this.shownScore));
    const th = this.thresholds();
    const starline = this.hudBar.parentElement!;
    starline.hidden = !th;
    if (!th) return;
    const max = th[2];
    const v = this.shownScore;
    (this.hudBar.firstElementChild as HTMLElement).style.width = `${Math.min(100, (v / max) * 100)}%`;
    const won = this.mode === 'level' ? this.displayGoals.every((g) => g.done >= g.target) : v >= th[0];
    const lit = [won || (this.mode === 'timed' && v >= th[0]), v >= th[1] && (this.mode !== 'level' || won || v >= th[1]), v >= th[2]];
    const html = lit.map((on) => `<span class="${on ? 'on' : ''}">${UI_ICONS.star}</span>`).join('');
    if (this.hudStars.innerHTML !== html) this.hudStars.innerHTML = html;
  }

  private animateScore() {
    cancelAnimationFrame(this.scoreRaf);
    const step = () => {
      const d = this.displayScore - this.shownScore;
      if (Math.abs(d) < 1) this.shownScore = this.displayScore;
      else this.shownScore += d * 0.18 + Math.sign(d);
      this.renderScore();
      this.updateRunner();
      if (this.shownScore !== this.displayScore) this.scoreRaf = requestAnimationFrame(step);
    };
    this.scoreRaf = requestAnimationFrame(step);
  }

  private updateRunner() {
    const scale = this.mode === 'level' && this.level ? this.level.stars[1] / 1.5 : this.mode === 'timed' ? TIMED_STARS[this.diff][2] / 1.5 : 2500;
    const sp = speedFromScore(this.shownScore, scale);
    this.runner.speed = sp;
    this.miniRunner.speed = sp;
  }

  private renderSide() {
    this.sideInfo.textContent = '';
    this.stageTitle.textContent =
      this.mode === 'level' && this.level
        ? `${this.daily ? '📅' : WORLDS[this.level.world].emoji} ${this.levelTitle()}`
        : this.mode === 'timed'
          ? `⏱️ Na čas · ${DIFFICULTIES.find((d) => d.id === this.diff)?.label ?? ''}`
          : '🧸 Pohoda';
    if (this.mode === 'level' && this.level) {
      const w = WORLDS[this.level.world];
      this.sideInfo.append(
        h('p', { class: 'side__eyebrow' }, `${w.emoji} ${w.name}`),
        h('p', { class: 'side__title' }, this.levelTitle()),
        h('p', { class: 'side__text' }, 'Čím víc bodů, tím rychleji zvířátko běží.'),
      );
    } else if (this.mode === 'timed') {
      const best = store.get('timedBest')[this.diff];
      this.sideInfo.append(
        h('p', { class: 'side__eyebrow' }, `⏱️ Na čas · ${DIFFICULTIES.find((d) => d.id === this.diff)?.label ?? ''}`),
        h('p', { class: 'side__title' }, best > 0 ? `Rekord ${fmt(best)}` : 'Zatím bez rekordu'),
        h('p', { class: 'side__text' }, 'Rychlé řetězy a speciály nesou nejvíc bodů.'),
      );
    } else {
      this.sideInfo.append(h('p', { class: 'side__eyebrow' }, '🧸 Pohoda'), h('p', { class: 'side__title' }, 'Hraj si, jak dlouho chceš'), h('p', { class: 'side__text' }, 'Zvířátko v kolečku běží rychleji, čím víc toho spojíš.'));
    }
  }

  /* ---------------- level intro ---------------- */

  private async levelIntro(level: LevelDef): Promise<boolean> {
    const theme = store.get('pieceTheme');
    const w = WORLDS[level.world];
    const rec = levelRecord(level.id);
    const goals = h('ul', { class: 'intro__goals' });
    for (const g of this.state.goals) {
      goals.append(h('li', null, goalIcon(theme, g, 40), h('span', null, goalLabel(g))));
    }
    const daily = this.daily ? dailyState() : null;
    const dateTxt = new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric' });
    const content = h(
      'div',
      { class: 'intro' },
      h('p', { class: 'intro__world' }, daily ? `📅 ${dateTxt} · stejná deska pro všechny` : `${w.emoji} ${w.name}`),
      goals,
      h('p', { class: 'intro__moves' }, h('b', null, String(level.moves)), ' tahů'),
    );
    if (daily) {
      content.append(
        h(
          'div',
          { class: 'intro__tip intro__tip--row' },
          h('span', { class: 'intro__daily-ico', 'aria-hidden': 'true' }, daily.doneToday ? '✅' : '🔥'),
          h(
            'div',
            null,
            h('b', null, daily.doneToday ? 'Dnes už splněno!' : daily.streak > 0 ? `Série ${daily.streak} ${daily.streak === 1 ? 'den' : daily.streak < 5 ? 'dny' : 'dní'} – pokračuj!` : 'Každý den nová výzva'),
            h('p', null, daily.doneToday ? `Můžeš si ji zahrát znovu a zkusit víc bodů (nejlépe ${fmt(daily.bestScore)}).` : 'Za první dnešní splnění dostaneš 🪙 50 navíc.'),
          ),
        ),
      );
    } else if (rec.stars > 0) {
      content.append(h('p', { class: 'intro__best', html: `<span class="intro__stars">${[0, 1, 2].map((i) => `<span class="${i < rec.stars ? 'on' : ''}">${UI_ICONS.star}</span>`).join('')}</span> Nejlepší: <b>${fmt(rec.best)}</b>` }));
    }
    if (level.tip && !daily) {
      const tip = TIPS[level.tip];
      content.append(h('div', { class: 'intro__tip' }, h('div', { class: 'intro__tip-pic' }, tip.pic(theme)), h('div', null, h('b', null, tip.title), h('p', null, tip.text))));
    }
    const d = openDialog({
      title: this.levelTitle(),
      content,
      className: 'level-intro',
      actions: [
        { label: this.daily ? LABELS.home : 'Mapa', value: 'back', variant: 'ghost', icon: this.daily ? LABEL_ICONS.home : MAP_ICON },
        { label: LABELS.play, value: 'play', variant: 'primary', icon: LABEL_ICONS.play, autofocus: true },
      ],
      dismissValue: 'back',
    });
    const v = await d.closed;
    return v === 'play';
  }

  /* ---------------- moves ---------------- */

  private canAct() {
    return this.active && !this.busy && !this.ended && !this.paused && !this.view.animating;
  }

  private cellTile(p: Pos) {
    const b = this.state.board;
    if (p.x < 0 || p.y < 0 || p.x >= b.w || p.y >= b.h) return null;
    return b.cells[p.y * b.w + p.x];
  }

  private isMovable(p: Pos) {
    const c = this.cellTile(p);
    return !!c && c.playable && c.crate === 0 && c.chain === 0 && !!c.tile;
  }

  private isSpecial(p: Pos) {
    const c = this.cellTile(p);
    return this.isMovable(p) && !!c?.tile && c.tile.special !== 'none';
  }

  async doMove(m: Move): Promise<boolean> {
    if (!this.canAct()) return false;
    clearTimeout(this.idleTimer);
    this.view.showHint(null);
    this.input.clearSelection();
    this.busy = true;
    this.displayGoals = this.state.goals.map((g) => ({ ...g }));
    this.displayScore = this.state.score;
    const specialsBefore = this.state.stats.specialsUsed;
    const res = playMove(this.state, m);
    if (!res.valid) {
      if (res.steps.length) {
        haptic('error');
        await this.view.play(res.steps);
      }
      this.busy = false;
      this.scheduleIdle();
      return false;
    }
    if (m.type === 'swap' && this.isComboSwap(res.steps)) {
      this.callout('Kombo!', 4);
      haptic('heavy');
    } else if (this.state.stats.specialsUsed > specialsBefore) haptic('tap');
    // timed mode: every special that goes off adds a second
    if (this.mode === 'timed' && this.timeLeft > 0) {
      const bonus = Math.min(5, this.state.stats.specialsUsed - specialsBefore);
      if (bonus > 0) {
        this.timeLeft += bonus;
        this.flashTime(`+${bonus} s`);
      }
    }
    this.renderHud();
    await this.view.play(res.steps);
    if (!this.active) return true;
    this.view.sync(this.state);
    this.syncDisplay();
    this.busy = false;
    void this.afterMove();
    return true;
  }

  private isComboSwap(steps: import('../core/types').Step[]) {
    const first = steps.find((s) => s.type === 'clear');
    return !!first && first.type === 'clear' && first.cleared.filter((c) => c.t === 0 && c.special !== 'none').length >= 2;
  }

  private syncDisplay() {
    this.displayGoals = this.state.goals.map((g) => ({ ...g }));
    this.displayScore = this.state.score;
    this.updateGoals();
    this.animateScore();
    this.renderHud();
  }

  private async afterMove() {
    if (this.ended || !this.active) return;
    if (this.mode === 'level') {
      if (isWon(this.state)) return this.winLevel();
      if (isLost(this.state)) return this.loseLevel();
      if (this.state.movesLeft === 5) this.callout('Posledních 5 tahů!', 2, 'warn');
    }
    if (this.mode === 'timed' && this.timeLeft <= 0) return this.endTimed();
    this.scheduleIdle();
  }

  private onViewEvent(e: ViewEvent) {
    switch (e.type) {
      case 'cleared':
        for (const g of this.displayGoals) {
          if (g.kind === 'color' && e.kind === 'gem' && e.color === g.color) g.done++;
          if (g.kind === 'special' && e.special !== 'none') {
            const fam = e.special === 'rocketH' || e.special === 'rocketV' ? 'rocket' : e.special;
            if (fam === g.special) g.done++;
          }
        }
        this.updateGoals();
        break;
      case 'created':
        for (const g of this.displayGoals) if (g.kind === 'color' && g.color === e.replacedColor) g.done++;
        this.updateGoals();
        break;
      case 'blocker':
        if (e.left === 0) for (const g of this.displayGoals) if (g.kind === e.kind) g.done++;
        this.updateGoals();
        break;
      case 'chick':
        for (const g of this.displayGoals) if (g.kind === 'chick') g.done += e.n;
        this.updateGoals();
        break;
      case 'score':
        this.displayScore += e.value;
        for (const g of this.displayGoals) if (g.kind === 'score') g.done = this.displayScore;
        this.updateGoals();
        this.animateScore();
        break;
      case 'cascade':
        if (e.n >= 2) {
          this.callout(CALLOUTS[Math.min(CALLOUTS.length - 1, e.n)], e.n);
          if (e.n >= 4) gameSfx.play('combo');
        }
        break;
      case 'shuffle':
        this.callout('Míchám dílky…', 2, 'info');
        break;
      case 'bonus':
        this.callout('Bonus za tahy!', 5);
        break;
    }
  }

  private flashTime(text: string) {
    const el = h('span', { class: 'hud__plus' }, text);
    this.hudMoves.parentElement!.append(el);
    setTimeout(() => el.remove(), 1200);
  }

  private callout(text: string, level: number, variant = '') {
    if (!this.active) return;
    const el = h('div', { class: `callout callout--${Math.min(6, level)}${variant ? ` callout--${variant}` : ''}` }, text);
    this.callouts.append(el);
    while (this.callouts.children.length > 2) this.callouts.firstElementChild?.remove();
    const ms = prefersReducedMotion() ? 900 : 1300;
    setTimeout(() => el.remove(), ms);
    this.live.textContent = text;
  }

  /* ---------------- hints ---------------- */

  private bumpIdle() {
    if (this.view.hint) this.view.showHint(null);
    this.scheduleIdle();
  }

  private scheduleIdle(delay?: number) {
    clearTimeout(this.idleTimer);
    if (!this.active || this.ended) return;
    const auto = store.get('hints');
    const d = delay ?? (this.mode === 'relax' ? 4500 : this.mode === 'timed' ? 5000 : 8000);
    if (!auto && delay === undefined) return;
    this.idleTimer = window.setTimeout(() => this.showHint(false), d);
  }

  showHint(manual: boolean) {
    if (!this.canAct()) {
      // board still settling – try again a bit later
      if (!manual && this.active && !this.ended && !this.paused) this.scheduleIdle(1200);
      return;
    }
    const hnt = bestHint(this.state.board);
    if (hnt) this.view.showHint({ a: hnt.a, b: hnt.b });
    else {
      const taps = findTaps(this.state.board);
      if (taps.length) this.view.showHint({ a: taps[0], b: taps[0] });
    }
    if (manual) gameSfx.play('select');
  }

  /* ---------------- pause ---------------- */

  async pause() {
    if (this.paused || this.ended || !this.active) return;
    this.paused = true;
    this.stopTimer();
    this.view.dim = 1;
    clearTimeout(this.idleTimer);
    const stats: { label: string; value: string | number }[] = [{ label: 'Body', value: this.state.score }];
    if (this.mode === 'level') stats.unshift({ label: 'Tahy', value: this.state.movesLeft ?? 0 });
    if (this.mode === 'timed') stats.unshift({ label: 'Čas', value: fmtTime(Math.ceil(this.timeLeft)) });
    let extra: HTMLElement | undefined;
    if (this.mode === 'level') {
      const theme = store.get('pieceTheme');
      extra = h('ul', { class: 'pause__goals' }, ...this.state.goals.map((g) => h('li', { class: g.done >= g.target ? 'is-done' : '' }, goalIcon(theme, g, 26), h('span', null, goalLabel(g)), h('b', null, g.done >= g.target ? '✓' : `${Math.max(0, g.target - g.done)}`))));
    }
    this.pauseOverlay = showPause({
      title: LABELS.pause,
      subtitle: this.mode === 'level' ? this.levelTitle() : this.mode === 'timed' ? 'Na čas' : 'Pohoda',
      stats,
      quit: true,
      container: this.el,
      ...(extra ? { extra } : {}),
    });
    const choice = await this.pauseOverlay;
    this.pauseOverlay = null;
    this.view.dim = 0;
    if (!this.active) return;
    this.paused = false;
    if (choice === 'resume') {
      if (this.mode === 'timed') this.startTimer();
      this.canvas.focus({ preventScroll: true });
      this.scheduleIdle();
    } else if (choice === 'restart') {
      this.restart();
    } else if (choice === 'quit') {
      if (this.mode === 'level') this.nav.go(this.daily ? '#/' : '#/mapa');
      else if (this.mode === 'relax') void this.endRelax();
      else this.nav.go('#/');
    }
    // 'menu' → the kit leaves the app itself
  }

  private restart() {
    if (this.mode === 'level' && this.level) {
      this.extraBought = 0;
      this.setup(createGame(levelConfig(this.level), this.daily ? dailySeed(this.daily) : randomSeed()));
      this.begin();
    } else if (this.mode === 'relax') {
      this.setup(createGame({ layout: PLAIN8, colors: DIFF_COLORS[this.diff], moves: null, goals: [] }, randomSeed()));
      this.begin();
    } else {
      void this.startTimed(true);
    }
  }

  private onKey(e: KeyboardEvent) {
    if (!this.active || this.el.hidden) return;
    if (document.querySelector('dialog[open]') || this.el.querySelector('.g92-overlay')) return;
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault();
      void this.pause();
    } else if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      this.showHint(true);
    }
  }

  /* ---------------- timer ---------------- */

  private startTimer() {
    this.stopTimer();
    this.timerLast = performance.now();
    const tick = (now: number) => {
      const dt = (now - this.timerLast) / 1000;
      this.timerLast = now;
      if (!this.paused && !this.ended) {
        this.timeLeft = Math.max(0, this.timeLeft - dt);
        const sec = Math.ceil(this.timeLeft);
        if (sec !== this.lastTickSec) {
          this.lastTickSec = sec;
          this.renderHud();
          if (sec <= 10 && sec > 0) gameSfx.play('tick');
        }
        if (this.timeLeft <= 0) {
          this.stopTimer();
          if (!this.busy) void this.endTimed();
          return;
        }
      }
      this.timerRaf = requestAnimationFrame(tick);
    };
    this.timerRaf = requestAnimationFrame(tick);
  }

  private stopTimer() {
    cancelAnimationFrame(this.timerRaf);
  }

  /* ---------------- endings ---------------- */

  private async winLevel() {
    const level = this.level!;
    this.ended = true;
    clearTimeout(this.idleTimer);
    gameSfx.play('win');
    haptic('success');
    this.callout('Úkol splněn!', 6, 'win');
    await new Promise((r) => setTimeout(r, 900));
    if (!this.active) return;
    if ((this.state.movesLeft ?? 0) > 0 || findTaps(this.state.board).length > 0) {
      const res = playBonus(this.state);
      await this.view.play(res.steps);
      if (!this.active) return;
      this.view.sync(this.state);
      this.syncDisplay();
      await new Promise((r) => setTimeout(r, 400));
    }
    const score = this.state.score;
    const stars = starsFor(level, true, score);
    if (this.daily) return this.winDaily(score, stars);
    const prev = levelRecord(level.id);
    const { newStars } = submitLevel(level.id, stars, score);
    const coins = coinsForScore(score) + newStars * 10;
    addCoins(coins);
    const fresh = this.commitGame(true);
    this.reportActivity();
    const isLast = level.id >= LEVELS.length;
    const choice = await showResults({
      title: `Úroveň ${level.id} splněna!`,
      subtitle:
        prev.stars === 0 && level.id % 10 === 0
          ? isLast
            ? 'Dohrál(a) jsi všechny úrovně! 🎉'
            : `Otevřel se nový svět: ${WORLDS[level.world + 1].emoji} ${WORLDS[level.world + 1].name}!`
          : stars === 3
            ? 'Všechny tři hvězdy – paráda!'
            : stars === 2
              ? 'Pro třetí hvězdu zkus víc bodů.'
              : 'Víc bodů = víc hvězd.',
      score,
      best: prev.best > 0 ? Math.max(prev.best, score) : null,
      isNewBest: prev.best > 0 && score > prev.best,
      stars,
      stats: this.statsWith(fresh, [
        { label: 'Mince', value: `+${coins}`, icon: '🪙' },
        { label: 'Nejdelší řetěz', value: `×${this.state.stats.maxCascade}` },
        { label: 'Speciály', value: this.state.stats.specialsUsed },
      ]),
      againLabel: isLast ? 'Mapa úrovní' : LABELS.next,
      againIcon: isLast ? MAP_ICON : LABEL_ICONS.next,
      actions: [
        { label: LABELS.again, value: 'retry', variant: 'secondary', icon: LABEL_ICONS.again },
        ...(isLast ? [] : [{ label: 'Mapa', value: 'map', variant: 'ghost' as const, icon: MAP_ICON }]),
      ],
      container: this.el,
    });
    if (!this.active) return;
    if (choice === 'again') this.nav.go(isLast ? '#/mapa' : `#/uroven/${level.id + 1}`);
    else if (choice === 'retry') this.nav.go(`#/uroven/${level.id}`, true);
    else if (choice === 'map') this.nav.go('#/mapa');
  }

  private async winDaily(score: number, stars: number) {
    const prevBest = dailyState().bestScore;
    const { first, streak } = submitDaily(score);
    const coins = coinsForScore(score) + (first ? 50 : 0);
    addCoins(coins);
    const fresh = this.commitGame(true);
    const choice = await showResults({
      title: 'Denní výzva splněna!',
      subtitle: first ? `🔥 Série ${streak} ${streak === 1 ? 'den' : streak < 5 ? 'dny' : 'dní'}. Zítra tě čeká nová výzva!` : 'Zítra tě čeká nová výzva!',
      score,
      best: first ? null : Math.max(prevBest, score),
      isNewBest: !first && score > prevBest,
      stars,
      stats: this.statsWith(fresh, [
        { label: 'Mince', value: `+${coins}`, icon: '🪙' },
        { label: 'Série', value: `${streak} 🔥` },
        { label: 'Nejdelší řetěz', value: `×${this.state.stats.maxCascade}` },
      ]),
      againLabel: LABELS.done,
      againIcon: UI_ICONS.check,
      actions: [
        { label: LABELS.again, value: 'retry', variant: 'secondary', icon: LABEL_ICONS.again },
        { label: 'Mapa', value: 'map', variant: 'ghost', icon: MAP_ICON },
      ],
      container: this.el,
    });
    if (!this.active) return;
    if (choice === 'again') this.nav.go('#/');
    else if (choice === 'retry') this.nav.go('#/denni', true);
    else if (choice === 'map') this.nav.go('#/mapa');
  }

  private async loseLevel() {
    const level = this.level!;
    this.ended = true;
    clearTimeout(this.idleTimer);
    const fresh = this.commitGame(false);
    const theme = store.get('pieceTheme');
    // what is still missing – as icon chips (non-readers see it too)
    const missing = this.state.goals.filter((g) => g.done < g.target);
    const chips = h(
      'ul',
      { class: 'lose__goals', 'aria-label': 'Co ještě chybělo' },
      ...missing.map((g) => {
        const left = g.target - g.done;
        return h('li', { class: 'goal', title: goalLabel(g) }, goalIcon(theme, g, 28), h('span', { class: 'goal__n g92-tabular' }, g.kind === 'score' ? fmt(left) : String(left)), h('span', { class: 'g92-sr-only' }, `${goalLabel(g)} – chybí ${left}`));
      }),
    );
    const cost = EXTRA_COST * (this.extraBought + 1);
    const coins = store.get('coins');
    const actions: { label: string; value: string; variant?: 'primary' | 'secondary' | 'ghost' | 'soft'; icon?: string }[] = [];
    const parts: Node[] = [chips];
    if (coins >= cost) actions.push({ label: `+${EXTRA_MOVES} tahů · 🪙 ${cost}`, value: 'extra', variant: 'soft' });
    else {
      // show the option exists, but that the coins are missing
      parts.push(
        h(
          'button',
          { type: 'button', class: 'g92-btn g92-btn--soft g92-btn--block lose__extra', disabled: true, 'aria-disabled': 'true' },
          `+${EXTRA_MOVES} tahů · 🪙 ${cost}`,
          h('small', null, ` (máš ${coins})`),
        ),
      );
    }
    actions.push(this.daily ? { label: LABELS.home, value: 'home', variant: 'ghost', icon: LABEL_ICONS.home } : { label: 'Mapa', value: 'home', variant: 'ghost', icon: MAP_ICON });
    const extra = this.resultsExtra(parts);
    const choice = await showResults({
      title: 'Došly tahy',
      stats: this.statsWith(fresh, []),
      subtitle: 'Tohle ještě chybělo:',
      score: this.state.score,
      lost: true,
      againLabel: LABELS.again,
      againIcon: LABEL_ICONS.again,
      actions,
      container: this.el,
      ...(extra ? { extra } : {}),
    });
    if (!this.active) return;
    if (choice === 'extra') {
      addCoins(-cost);
      this.extraBought++;
      this.state.movesLeft = EXTRA_MOVES;
      this.ended = false;
      this.renderHud();
      this.callout(`+${EXTRA_MOVES} tahů!`, 4);
      this.scheduleIdle();
      return;
    }
    if (choice === 'again') this.nav.go(this.daily ? '#/denni' : `#/uroven/${level.id}`, true);
    else if (choice === 'home') this.nav.go(this.daily ? '#/' : '#/mapa');
  }

  private async endTimed() {
    if (this.ended) return;
    this.ended = true;
    this.stopTimer();
    clearTimeout(this.idleTimer);
    this.view.showHint(null);
    this.callout('Čas vypršel!', 5, 'warn');
    await new Promise((r) => setTimeout(r, 900));
    if (!this.active) return;
    const score = this.state.score;
    const th = TIMED_STARS[this.diff];
    const stars = score >= th[2] ? 3 : score >= th[1] ? 2 : score >= th[0] ? 1 : 0;
    const bestMap = store.get('timedBest');
    const prevBest = bestMap[this.diff];
    const isNewBest = score > prevBest;
    if (isNewBest) store.set('timedBest', { ...bestMap, [this.diff]: score });
    const coins = coinsForScore(score);
    addCoins(coins);
    const fresh = this.commitGame(false);
    this.reportActivity();
    const choice = await showResults({
      title: isNewBest && prevBest > 0 ? 'Nový rekord!' : 'Čas vypršel!',
      subtitle: `${DIFFICULTIES.find((d) => d.id === this.diff)?.label ?? ''} · ${TIMED_SECONDS} s`,
      score,
      best: Math.max(prevBest, score),
      isNewBest: isNewBest && prevBest > 0,
      stars,
      stats: this.statsWith(fresh, [
        { label: 'Mince', value: `+${coins}`, icon: '🪙' },
        { label: 'Nejdelší řetěz', value: `×${this.state.stats.maxCascade}` },
        { label: 'Tahů', value: this.state.movesMade },
      ]),
      againLabel: LABELS.again,
      againIcon: LABEL_ICONS.again,
      actions: [{ label: LABELS.home, value: 'home', variant: 'ghost', icon: LABEL_ICONS.home }],
      container: this.el,
    });
    if (!this.active) return;
    if (choice === 'again') void this.startTimed(true);
    else if (choice === 'home') this.nav.go('#/');
  }

  private async endRelax() {
    this.ended = true;
    clearTimeout(this.idleTimer);
    const score = this.state.score;
    const prevBest = store.get('relaxBest');
    if (score > prevBest) store.set('relaxBest', score);
    const coins = coinsForScore(score);
    addCoins(coins);
    const fresh = this.commitGame(false);
    this.reportActivity();
    const choice = await showResults({
      title: 'Hezká hra!',
      score,
      best: Math.max(prevBest, score),
      isNewBest: score > prevBest && prevBest > 0,
      stats: this.statsWith(fresh, [
        { label: 'Mince', value: `+${coins}`, icon: '🪙' },
        { label: 'Spojeno dílků', value: this.state.stats.cleared },
      ]),
      againLabel: LABELS.again,
      againIcon: LABEL_ICONS.again,
      actions: [{ label: LABELS.home, value: 'home', variant: 'ghost', icon: LABEL_ICONS.home }],
      container: this.el,
    });
    if (!this.active) return;
    if (choice === 'again') this.restart();
    else if (choice === 'home') this.nav.go('#/');
  }

  /**
   * Results stats with new achievements as the last tile (kit rule: achievements belong into the stats, never
   * toasts over the buttons – QA SPOJ-03). Keeps the tile count at 3 so phones show one row.
   */
  private statsWith(fresh: Achievement[], stats: { label: string; value: string | number; icon?: string }[]) {
    if (!fresh.length) return stats;
    setTimeout(() => gameSfx.play('star', { pitch: 2 }), 900);
    const tile = {
      label: fresh.length === 1 ? 'Nový úspěch' : 'Nové úspěchy',
      value: fresh.slice(0, 3).map((x) => x.emoji).join(' ') + (fresh.length > 3 ? ' …' : ''),
      icon: '🏆',
    };
    return [...stats.slice(0, 2), tile];
  }

  /** extra block for the results overlay (mode-specific parts) */
  private resultsExtra(parts: Node[] = []): HTMLElement | undefined {
    if (!parts.length) return undefined;
    return h('div', { class: 'results-extra' }, ...parts);
  }

  /** write this game's stats (only what wasn't written yet); returns newly unlocked achievements */
  private commitGame(win: boolean): Achievement[] {
    const st = this.state.stats;
    const b = this.baseline;
    const chicks = this.state.chicks?.collected ?? 0;
    const delta = {
      wins: win ? 1 : 0,
      tiles: st.cleared - b.cleared,
      specials: st.specialsUsed - b.specialsUsed,
      rockets: st.used.rocket - b.used.rocket,
      bombs: st.used.bomb - b.used.bomb,
      butterflies: st.used.butterfly - b.used.butterfly,
      rainbowsMade: st.made.rainbow - b.made.rainbow,
      combos: st.combos - b.combos,
      megaCombos: st.megaCombos - b.megaCombos,
      chicks: chicks - this.baseChicks,
      bestCascade: st.maxCascade,
    };
    const any = Object.entries(delta).some(([k, v]) => k !== 'bestCascade' && v > 0) || st.maxCascade > b.maxCascade;
    this.baseline = { ...st, used: { ...st.used }, made: { ...st.made } };
    this.baseChicks = chicks;
    if (any) recordStats(delta);
    return checkAchievements();
  }

  private reportActivity() {
    const stars = totalStars();
    const next = LEVELS.find((l) => levelRecord(l.id).stars === 0);
    recordActivity('spojovacka', {
      progress: stars / MAX_STARS,
      metric: { value: stars, of: MAX_STARS, unit: ['hvězda', 'hvězdy', 'hvězd'] },
      note: next ? `Úroveň ${next.id}` : 'Všechny úrovně hotové',
      href: next ? `/spojovacka/#/uroven/${next.id}` : '/spojovacka/#/mapa',
    });
  }

  /* ---------------- debug / automation hook ---------------- */

  private exposeDebug() {
    const w = window as unknown as { __spojovacka?: unknown };
    const settle = async () => {
      for (let i = 0; i < 100 && (this.view.animating || this.busy); i++) await new Promise((r) => setTimeout(r, 30));
    };
    w.__spojovacka = {
      state: () => this.state,
      mode: () => this.mode,
      busy: () => this.busy,
      ended: () => this.ended,
      cellCenter: (x: number, y: number) => this.view.cellCenterClient({ x, y }),
      hint: () => bestHint(this.state.board),
      move: async (m: Move) => {
        await settle();
        return this.doMove(m);
      },
      /** play one move chosen by the bot (tests / demo) */
      botMove: async () => {
        await settle();
        const m = chooseMove(this.state, createRng(randomSeed()), 1, 16);
        return m ? this.doMove(m) : false;
      },
      setMovesLeft: (n: number) => {
        this.state.movesLeft = n;
        this.renderHud();
      },
      setTime: (s: number) => (this.timeLeft = s),
      /** screenshots: sprinkle one of every special onto the board */
      demoSpecials: () => {
        const b = this.state.board;
        const specials = ['rocketH', 'rocketV', 'bomb', 'butterfly', 'rainbow'] as const;
        let k = 0;
        for (let i = 0; i < b.cells.length && k < specials.length; i += 7) {
          const c = b.cells[i];
          if (c.tile && c.tile.kind === 'gem' && c.chain === 0) {
            c.tile.special = specials[k++];
            if (c.tile.special === 'rainbow') c.tile.color = -1;
          }
        }
        this.view.sync(this.state);
      },
      setPieceTheme: (t: 'shapes' | 'balls' | 'diamonds' | 'dinos') => {
        store.set('pieceTheme', t);
        this.setPieceTheme();
      },
      hintNow: () => this.showHint(false),
      setSpecial: (x: number, y: number, special: import('../core/types').Special) => {
        const c = this.state.board.cells[y * this.state.board.w + x];
        if (!c.tile) return;
        c.tile.special = special;
        if (special === 'rainbow') c.tile.color = -1;
        this.view.sync(this.state);
      },
    };
  }
}
