/**
 * g92 kit — barrel export. Importing it registers <g92-appbar> and applies settings to <html>.
 * CSS is separate: import './kit/kit.css' once in your entry.
 */
export { KIT_VERSION } from './version';
export { safeStorage, readJSON, writeJSON } from './storage';
export {
  settings,
  getSettings,
  getSettingsSnapshot,
  setSettings,
  subscribeSettings,
  reloadSettings,
  applySettings,
  resolvedTheme,
  prefersReducedMotion,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  type G92Settings,
  type ThemeSetting,
  type MotionSetting,
} from './settings';
export { createStore, type Store, type StoreOptions, type MigrationApi } from './store';
export {
  recordActivity,
  getActivity,
  clearActivity,
  recentApps,
  subscribeActivity,
  timeAgo,
  timeAgoShort,
  formatMetric,
  ACTIVITY_KEY,
  type ActivityEntry,
  type ActivityMap,
  type ActivityMetric,
  type ActivityUpdate,
} from './activity';
export { APPS, APP_BY_ID, ICONS, CATEGORY_LABELS, getApp, applyAccent, type G92App, type AppId, type AppCategory } from './apps';
export { sfx, play as playSfx, tone, unlockAudio, haptic, type SfxName, type ToneOptions, type HapticName } from './sfx';
export { h, starsHTML, plural, flash, bindRange, UI_ICONS, type UiIconName } from './dom';
export {
  openDialog,
  confirmDialog,
  alertDialog,
  openSettingsDialog,
  type DialogOptions,
  type DialogAction,
  type DialogHandle,
  type ConfirmOptions,
  type SettingsDialogOptions,
  type ButtonVariant,
} from './dialog';
export { toast, type ToastOptions, type ToastVariant } from './toast';
export { G92Appbar, defineAppbar } from './appbar';
export { confetti, confettiFrom, clearConfetti, type ConfettiOptions } from './confetti';
export {
  showStart,
  showPause,
  showResults,
  countdown,
  autoPause,
  type OverlayPromise,
  type OverlayBaseOptions,
  type StartOptions,
  type StartResult,
  type PauseOptions,
  type PauseChoice,
  type ResultsOptions,
  type ResultsChoice,
  type CountdownOptions,
  type Difficulty,
  type HowToStep,
  type KeyHint,
} from './overlay';
export { vocative, greeting, dayPart, countLabel, type DayPart } from './cz';
export { g92Pwa, type G92PwaOverrides } from './pwa';
export { appIconSvg, shade } from './apps';
export { createLoop, type Loop, type LoopOptions } from './loop';
export { fitCanvas, type CanvasView, type FitCanvasOptions } from './canvas';
export { createDaily, dayKey, type Daily, type DailyData, type DailyRecordResult } from './streak';
