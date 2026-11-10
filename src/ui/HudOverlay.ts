import { CONFIG } from '../core/Config';
import type { ActId, CameraMode, GamePhase } from '../core/Types';

const HIGH_SCORE_STORAGE_KEY = 'chrome_dino_3d_hi_score_v1';

export interface RunStats {
  score: number;
  act: ActId;
  smashes: number;
  nearMisses: number;
}

export interface HudExtraStatus {
  chronoArmed: boolean;
  amberFragments: number;
  rage: number;
  megaTimer: number;
  wifiActive: boolean;
  wifiReconnectPct: number;
  wifiRelaysJammed: number;
}

export class HudOverlay {
  public highScore = 0;

  private readonly prologueCard: HTMLElement;
  private readonly actBadge: HTMLElement;
  private readonly chronoPill: HTMLElement;
  private readonly wifiBossBar: HTMLElement;
  private readonly wifiBossText: HTMLElement;
  private readonly wifiRelayCount: HTMLElement;
  private readonly wifiProgressFill: HTMLElement;
  private readonly rewindBanner: HTMLElement;
  private readonly hiScoreEl: HTMLElement;
  private readonly currentScoreEl: HTMLElement;
  private readonly actToast: HTMLElement;
  private readonly actToastTitle: HTMLElement;
  private readonly actToastSub: HTMLElement;
  private readonly dashFillEl: HTMLElement;
  private readonly dashLabelEl: HTMLElement;
  private readonly dashBtn: HTMLButtonElement;
  private readonly megaFillEl: HTMLElement;
  private readonly megaLabelEl: HTMLElement;
  private readonly megaBtn: HTMLButtonElement;
  private readonly camBtn: HTMLButtonElement;
  private readonly muteBtn: HTMLButtonElement;
  private readonly pauseBtn: HTMLButtonElement;
  private readonly pauseBanner: HTMLElement;
  private readonly gameoverCard: HTMLElement;
  private readonly finalScoreEl: HTMLElement;
  private readonly finalBestEl: HTMLElement;
  private readonly finalActEl: HTMLElement;
  private readonly finalComboEl: HTMLElement;
  private readonly bonusLayer: HTMLElement;

  private toastTimer = 0;
  private milestoneBlinkTimer = 0;

  constructor(callbacks: {
    onRestart: () => void;
    onDashClick: () => void;
    onMegaClick: () => void;
    onCameraClick: () => void;
    onMuteClick: () => void;
    onPauseClick: () => void;
  }) {
    this.highScore = this.loadHighScore();

    this.prologueCard = this.mustGet('prologue-card');
    this.actBadge = this.mustGet('act-badge');
    this.chronoPill = this.mustGet('chrono-pill');
    this.wifiBossBar = this.mustGet('wifi-boss-bar');
    this.wifiBossText = this.mustGet('wifi-boss-text');
    this.wifiRelayCount = this.mustGet('wifi-relay-count');
    this.wifiProgressFill = this.mustGet('wifi-progress-fill');
    this.rewindBanner = this.mustGet('rewind-banner');
    this.hiScoreEl = this.mustGet('hi-score');
    this.currentScoreEl = this.mustGet('current-score');
    this.actToast = this.mustGet('act-toast');
    this.actToastTitle = this.mustGet('act-toast-title');
    this.actToastSub = this.mustGet('act-toast-sub');
    this.dashFillEl = this.mustGet('dash-bar-fill');
    this.dashLabelEl = this.mustGet('dash-bar-label');
    this.dashBtn = this.mustGet('dash-btn') as HTMLButtonElement;
    this.megaFillEl = this.mustGet('mega-bar-fill');
    this.megaLabelEl = this.mustGet('mega-bar-label');
    this.megaBtn = this.mustGet('mega-btn') as HTMLButtonElement;
    this.camBtn = this.mustGet('cam-btn') as HTMLButtonElement;
    this.muteBtn = this.mustGet('mute-btn') as HTMLButtonElement;
    this.pauseBtn = this.mustGet('pause-btn') as HTMLButtonElement;
    this.pauseBanner = this.mustGet('pause-banner');
    this.gameoverCard = this.mustGet('gameover-card');
    this.finalScoreEl = this.mustGet('final-score');
    this.finalBestEl = this.mustGet('final-best');
    this.finalActEl = this.mustGet('final-act');
    this.finalComboEl = this.mustGet('final-combo');
    this.bonusLayer = this.mustGet('bonus-layer');

    const restartBtn = this.mustGet('restart-btn');
    restartBtn.addEventListener('click', callbacks.onRestart);
    this.dashBtn.addEventListener('click', callbacks.onDashClick);
    this.megaBtn.addEventListener('click', callbacks.onMegaClick);
    this.camBtn.addEventListener('click', callbacks.onCameraClick);
    this.muteBtn.addEventListener('click', callbacks.onMuteClick);
    this.pauseBtn.addEventListener('click', callbacks.onPauseClick);

    this.renderScoreDigits(0);
  }

  private mustGet(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing HUD element #${id}`);
    return el;
  }

  private loadHighScore(): number {
    try {
      const raw = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
      const parsed = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveHighScore(val: number): void {
    try {
      window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(Math.floor(val)));
    } catch {
      // Ignore storage quota / privacy mode restrictions
    }
  }

  private formatFiveDigits(n: number): string {
    return String(Math.min(99999, Math.floor(n))).padStart(5, '0');
  }

  public renderScoreDigits(score: number): void {
    this.hiScoreEl.textContent = `HI ${this.formatFiveDigits(this.highScore)}`;
    if (this.milestoneBlinkTimer <= 0) {
      this.currentScoreEl.textContent = this.formatFiveDigits(score);
    }
  }

  public triggerMilestoneFlash(milestoneScore: number): void {
    this.milestoneBlinkTimer = 1.05;
    this.currentScoreEl.textContent = this.formatFiveDigits(milestoneScore);
    this.currentScoreEl.classList.add('milestone-blink');
  }

  public showActBanner(title: string, subtitle: string): void {
    this.actToastTitle.textContent = title;
    this.actToastSub.textContent = subtitle;
    this.actToast.classList.add('visible');
    this.toastTimer = 3.2;
  }

  public spawnFloatingBonus(text: string): void {
    const pill = document.createElement('div');
    pill.className = 'bonus-popup';
    pill.textContent = text;
    this.bonusLayer.appendChild(pill);
    window.setTimeout(() => {
      pill.remove();
    }, 950);
  }

  public setPhase(phase: GamePhase, stats?: RunStats): void {
    this.prologueCard.classList.toggle('hidden', phase !== 'prologue');
    this.pauseBanner.classList.toggle('hidden', phase !== 'paused');
    this.gameoverCard.classList.toggle('hidden', phase !== 'gameover');
    this.rewindBanner.classList.toggle('hidden', phase !== 'rewinding');
    document.body.classList.toggle('rewinding-fx', phase === 'rewinding');

    if (phase === 'gameover') {
      this.actToast.classList.remove('visible');
      this.wifiBossBar.classList.add('hidden');
      this.toastTimer = 0;
    }

    if (phase === 'gameover' && stats) {
      const intScore = Math.floor(stats.score);
      if (intScore > this.highScore) {
        this.highScore = intScore;
        this.saveHighScore(this.highScore);
      }
      this.renderScoreDigits(intScore);
      this.finalScoreEl.textContent = this.formatFiveDigits(intScore);
      this.finalBestEl.textContent = this.formatFiveDigits(this.highScore);
      this.finalActEl.textContent = `Act ${stats.act}`;
      this.finalComboEl.textContent = `${stats.smashes} Smashes · ${stats.nearMisses} Near-Misses`;
    }
  }

  public updateCameraLabel(mode: CameraMode): void {
    const label =
      mode === 'chase' ? '3D CHASE' : mode === 'cinematic' ? 'ACTION CAM' : '2.5D CLASSIC';
    this.camBtn.textContent = `[C] CAM: ${label}`;
  }

  public updateMuteLabel(muted: boolean): void {
    this.muteBtn.textContent = muted ? '[M] SFX: OFF' : '[M] SFX: ON';
  }

  public update(
    dt: number,
    score: number,
    actTitle: string,
    dashCooldown: number,
    isNightOrDark: boolean,
    extra: HudExtraStatus
  ): void {
    document.body.classList.toggle('dark-ui', isNightOrDark);
    this.actBadge.textContent = actTitle;

    // 1. Amber Chrono-Core status pill
    this.chronoPill.classList.toggle('armed', extra.chronoArmed);
    this.chronoPill.textContent = extra.chronoArmed
      ? 'CHRONO-REWIND ARMED!'
      : `AMBER CHRONO: ${extra.amberFragments}/${CONFIG.AMBER_FOR_CHRONO_CHARGE}`;

    // 2. Wi-Fi Reconnecting Boss Bar
    this.wifiBossBar.classList.toggle('hidden', !extra.wifiActive);
    if (extra.wifiActive) {
      const pct = Math.floor(extra.wifiReconnectPct);
      this.wifiBossText.textContent = `WI-FI RECONNECTING: ${pct}%`;
      this.wifiRelayCount.textContent = `JAM RELAYS [${extra.wifiRelaysJammed}/${CONFIG.WIFI_RELAYS_TO_JAM}]`;
      this.wifiProgressFill.style.width = `${pct}%`;
    }

    // 3. Score & Act Toast
    if (this.milestoneBlinkTimer > 0) {
      this.milestoneBlinkTimer -= dt;
      if (this.milestoneBlinkTimer <= 0) {
        this.currentScoreEl.classList.remove('milestone-blink');
      }
    }
    this.renderScoreDigits(score);

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.actToast.classList.remove('visible');
      }
    }

    // 4. Roar-Dash Bar
    const readyRatio = 1 - Math.min(1, dashCooldown / CONFIG.DASH_COOLDOWN);
    this.dashFillEl.style.width = `${Math.round(readyRatio * 100)}%`;
    const isDashReady = dashCooldown <= 0.01;
    this.dashBtn.classList.toggle('ready', isDashReady);
    this.dashLabelEl.textContent = isDashReady
      ? 'ROAR-DASH READY [SHIFT]'
      : `RECHARGING ${dashCooldown.toFixed(1)}s`;

    // 5. Mega-Rex Rage Overdrive Bar
    if (extra.megaTimer > 0) {
      const activePct = Math.round((extra.megaTimer / CONFIG.MEGA_DURATION_SEC) * 100);
      this.megaFillEl.style.width = `${activePct}%`;
      this.megaBtn.classList.remove('mega-ready');
      this.megaBtn.classList.add('mega-active');
      this.megaLabelEl.textContent = `MEGA-REX STOMP! ${extra.megaTimer.toFixed(1)}s`;
    } else {
      const ragePct = Math.round((extra.rage / CONFIG.MEGA_RAGE_MAX) * 100);
      this.megaFillEl.style.width = `${ragePct}%`;
      this.megaBtn.classList.remove('mega-active');
      const isMegaReady = extra.rage >= CONFIG.MEGA_RAGE_MAX;
      this.megaBtn.classList.toggle('mega-ready', isMegaReady);
      this.megaLabelEl.textContent = isMegaReady
        ? 'UNLEASH MEGA-REX! [R]'
        : `EXTINCTION RAGE ${ragePct}% [R]`;
    }
  }
}
