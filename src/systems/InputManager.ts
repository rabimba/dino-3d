import type { InputActions } from '../core/Types';

export interface SystemToggleEvents {
  cameraToggled: boolean;
  muteToggled: boolean;
  pauseToggled: boolean;
  anyStartPressed: boolean;
}

export class InputManager {
  private keysDown = new Set<string>();

  private queuedJump = false;
  private queuedFastDrop = false;
  private queuedLeft = false;
  private queuedRight = false;
  private queuedDash = false;
  private queuedMega = false;

  private queuedCameraToggle = false;
  private queuedMuteToggle = false;
  private queuedPauseToggle = false;
  private queuedStart = false;

  private touchActive = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchDucking = false;
  private touchGestureConsumed = false;
  private lastTapTime = 0;

  // Gamepad previous button states for edge detection
  private prevGpJump = false;
  private prevGpDuck = false;
  private prevGpDash = false;
  private prevGpLeft = false;
  private prevGpRight = false;
  private prevGpCam = false;
  private prevGpPause = false;

  constructor(targetElement: HTMLElement = window.document.body) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    targetElement.addEventListener('touchstart', this.onTouchStart, { passive: false });
    targetElement.addEventListener('touchmove', this.onTouchMove, { passive: false });
    targetElement.addEventListener('touchend', this.onTouchEnd);
  }

  public triggerDashFromUi(): void {
    this.queuedDash = true;
    this.queuedStart = true;
  }

  public triggerMegaFromUi(): void {
    this.queuedMega = true;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      e.preventDefault();
    }

    const isRepeat = this.keysDown.has(code);
    this.keysDown.add(code);
    if (isRepeat) return;

    if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') {
      this.queuedJump = true;
      this.queuedStart = true;
    } else if (code === 'KeyS' || code === 'ArrowDown') {
      this.queuedFastDrop = true;
    } else if (code === 'KeyA' || code === 'ArrowLeft') {
      this.queuedLeft = true;
    } else if (code === 'KeyD' || code === 'ArrowRight') {
      this.queuedRight = true;
    } else if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyE') {
      this.queuedDash = true;
    } else if (code === 'KeyR' || code === 'KeyF') {
      this.queuedMega = true;
    } else if (code === 'KeyC') {
      this.queuedCameraToggle = true;
    } else if (code === 'KeyM') {
      this.queuedMuteToggle = true;
    } else if (code === 'KeyP' || code === 'Escape') {
      this.queuedPauseToggle = true;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  private onBlur = (): void => {
    this.keysDown.clear();
    this.touchActive = false;
    this.touchDucking = false;
  };

  private onTouchStart = (e: TouchEvent): void => {
    if ((e.target as HTMLElement | null)?.closest('button')) {
      return;
    }
    e.preventDefault();
    const t = e.changedTouches[0];
    this.touchActive = true;
    this.touchStartX = t.clientX;
    this.touchStartY = t.clientY;
    this.touchGestureConsumed = false;
    this.queuedStart = true;
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.touchActive || this.touchGestureConsumed) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;

    if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) this.queuedLeft = true;
      else this.queuedRight = true;
      this.touchGestureConsumed = true;
    } else if (dy > 28 && Math.abs(dy) > Math.abs(dx)) {
      this.queuedFastDrop = true;
      this.touchDucking = true;
      this.touchGestureConsumed = true;
    }
  };

  private onTouchEnd = (): void => {
    if (this.touchActive && !this.touchGestureConsumed) {
      const now = performance.now();
      if (now - this.lastTapTime < 230) {
        this.queuedDash = true;
      } else {
        this.queuedJump = true;
      }
      this.lastTapTime = now;
    }
    this.touchActive = false;
    this.touchDucking = false;
    this.touchGestureConsumed = false;
  };

  private pollGamepad(): { jumpHeld: boolean; duckHeld: boolean } {
    let jumpHeld = false;
    let duckHeld = false;

    if (typeof navigator === 'undefined' || !navigator.getGamepads) {
      return { jumpHeld, duckHeld };
    }

    const pads = navigator.getGamepads();
    const gp = pads && pads[0];
    if (!gp) return { jumpHeld, duckHeld };

    const gpJump = Boolean(gp.buttons[0]?.pressed);
    const gpDuck = Boolean(gp.buttons[1]?.pressed || (gp.axes[1] ?? 0) > 0.55);
    const gpDash = Boolean(gp.buttons[2]?.pressed || gp.buttons[5]?.pressed);
    const gpCam = Boolean(gp.buttons[3]?.pressed);
    const gpPause = Boolean(gp.buttons[9]?.pressed);
    const gpLeft = Boolean(gp.buttons[14]?.pressed || (gp.axes[0] ?? 0) < -0.5);
    const gpRight = Boolean(gp.buttons[15]?.pressed || (gp.axes[0] ?? 0) > 0.5);

    if (gpJump && !this.prevGpJump) {
      this.queuedJump = true;
      this.queuedStart = true;
    }
    if (gpDuck && !this.prevGpDuck) this.queuedFastDrop = true;
    if (gpDash && !this.prevGpDash) this.queuedDash = true;
    if (gpLeft && !this.prevGpLeft) this.queuedLeft = true;
    if (gpRight && !this.prevGpRight) this.queuedRight = true;
    if (gpCam && !this.prevGpCam) this.queuedCameraToggle = true;
    if (gpPause && !this.prevGpPause) this.queuedPauseToggle = true;

    this.prevGpJump = gpJump;
    this.prevGpDuck = gpDuck;
    this.prevGpDash = gpDash;
    this.prevGpLeft = gpLeft;
    this.prevGpRight = gpRight;
    this.prevGpCam = gpCam;
    this.prevGpPause = gpPause;

    jumpHeld = gpJump;
    duckHeld = gpDuck;
    return { jumpHeld, duckHeld };
  }

  public consumeSystemToggles(): SystemToggleEvents {
    this.pollGamepad();
    const res: SystemToggleEvents = {
      cameraToggled: this.queuedCameraToggle,
      muteToggled: this.queuedMuteToggle,
      pauseToggled: this.queuedPauseToggle,
      anyStartPressed: this.queuedStart,
    };
    this.queuedCameraToggle = false;
    this.queuedMuteToggle = false;
    this.queuedPauseToggle = false;
    this.queuedStart = false;
    return res;
  }

  public consumeStepActions(): InputActions {
    const gpState = this.pollGamepad();

    const jumpHeld =
      this.keysDown.has('Space') ||
      this.keysDown.has('KeyW') ||
      this.keysDown.has('ArrowUp') ||
      this.touchActive ||
      gpState.jumpHeld;

    const duckHeld =
      this.keysDown.has('KeyS') ||
      this.keysDown.has('ArrowDown') ||
      this.touchDucking ||
      gpState.duckHeld;

    const actions: InputActions = {
      jumpPressed: this.queuedJump,
      jumpHeld,
      duckHeld,
      fastDropPressed: this.queuedFastDrop,
      moveLeftPressed: this.queuedLeft,
      moveRightPressed: this.queuedRight,
      dashPressed: this.queuedDash,
      megaPressed: this.queuedMega,
    };

    this.queuedJump = false;
    this.queuedFastDrop = false;
    this.queuedLeft = false;
    this.queuedRight = false;
    this.queuedDash = false;
    this.queuedMega = false;

    return actions;
  }

  public clearQueuedActions(): void {
    this.queuedJump = false;
    this.queuedFastDrop = false;
    this.queuedLeft = false;
    this.queuedRight = false;
    this.queuedDash = false;
    this.queuedMega = false;
    this.queuedStart = false;
  }
}
