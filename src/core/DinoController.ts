import { CONFIG } from './Config';
import type { DinoState, InputActions, LaneIndex } from './Types';

export class DinoController {
  public state: DinoState;

  constructor() {
    this.state = this.createInitialState();
  }

  public createInitialState(): DinoState {
    return {
      lane: 1,
      x: CONFIG.LANES[1],
      y: 0,
      z: 0,
      vy: 0,
      width: CONFIG.DINO_WIDTH,
      height: CONFIG.DINO_STAND_HEIGHT,
      depth: CONFIG.DINO_DEPTH,
      isGrounded: true,
      groundY: 0,
      jumpsRemaining: 2,
      coyoteTimer: CONFIG.COYOTE_TIME,
      jumpBufferTimer: 0,
      isDucking: false,
      isFastDropping: false,
      justLanded: false,
      justGroundPounded: false,
      justJumped: false,
      justDoubleJumped: false,
      justDashed: false,
      isDashing: false,
      dashTimer: 0,
      dashCooldown: 0,
      isCrashed: false,
      runCycle: 0,
      squashY: 1,
      bankAngle: 0,
      tarSlowTimer: 0,
      rage: 0,
      megaTimer: 0,
      justActivatedMega: false,
      justMegaStep: false,
      postRewindGrace: 0,
    };
  }

  public addRage(amount: number): void {
    if (this.state.megaTimer > 0) return;
    this.state.rage = Math.min(CONFIG.MEGA_RAGE_MAX, this.state.rage + amount);
  }

  public activateMegaRex(): boolean {
    const s = this.state;
    if (s.megaTimer > 0 || s.rage < CONFIG.MEGA_RAGE_MAX) return false;
    s.rage = 0;
    s.megaTimer = CONFIG.MEGA_DURATION_SEC;
    s.isDucking = false;
    s.isFastDropping = false;
    s.squashY = 1.28;
    s.justActivatedMega = true;
    return true;
  }

  public reset(): void {
    this.state = this.createInitialState();
  }

  public refundDashCooldown(seconds: number): void {
    this.state.dashCooldown = Math.max(0, this.state.dashCooldown - seconds);
  }

  public triggerGeyserLaunch(): void {
    const s = this.state;
    s.vy = CONFIG.GEYSER_LAUNCH_VELOCITY;
    s.isGrounded = false;
    s.isFastDropping = false;
    s.isDucking = false;
    s.jumpsRemaining = 1; // Keep 1 mid-air double-jump available after a geyser launch!
    s.squashY = 1.24;
  }

  public applyTarSlow(): void {
    this.state.tarSlowTimer = 1.1;
  }

  public step(dt: number, input: InputActions, supportY: number, runSpeed: number): void {
    const s = this.state;
    s.justLanded = false;
    s.justGroundPounded = false;
    s.justJumped = false;
    s.justDoubleJumped = false;
    s.justDashed = false;
    s.justActivatedMega = false;
    s.justMegaStep = false;

    if (s.isCrashed) {
      return;
    }

    // Giant Mega-Rex strides effortlessly over ground chasms
    const effectiveSupportY =
      s.megaTimer > 0 || s.postRewindGrace > 0 ? Math.max(0, supportY) : supportY;

    // 1. Cooldown, Rage & Grace timers
    if (input.megaPressed && s.rage >= CONFIG.MEGA_RAGE_MAX && s.megaTimer <= 0) {
      this.activateMegaRex();
    }
    if (s.megaTimer > 0) {
      s.megaTimer = Math.max(0, s.megaTimer - dt);
    }
    if (s.postRewindGrace > 0) {
      s.postRewindGrace = Math.max(0, s.postRewindGrace - dt);
    }
    if (s.dashCooldown > 0) {
      s.dashCooldown = Math.max(0, s.dashCooldown - dt);
    }
    if (s.tarSlowTimer > 0) {
      s.tarSlowTimer = Math.max(0, s.tarSlowTimer - dt);
    }
    if (input.jumpPressed) {
      s.jumpBufferTimer = CONFIG.JUMP_BUFFER_TIME;
    } else if (s.jumpBufferTimer > 0) {
      s.jumpBufferTimer = Math.max(0, s.jumpBufferTimer - dt);
    }

    // 2. Lateral 3-Lane switching (works on ground and mid-air!)
    if (input.moveLeftPressed && !input.moveRightPressed && s.lane > 0) {
      s.lane = (s.lane - 1) as LaneIndex;
      s.bankAngle = 0.24;
    } else if (input.moveRightPressed && !input.moveLeftPressed && s.lane < 2) {
      s.lane = (s.lane + 1) as LaneIndex;
      s.bankAngle = -0.24;
    }

    const targetX = CONFIG.LANES[s.lane];
    const laneLerpSpeed =
      (s.tarSlowTimer > 0 ? CONFIG.LANE_SPRING_STIFFNESS * 0.55 : CONFIG.LANE_SPRING_STIFFNESS) * dt;
    s.x += (targetX - s.x) * Math.min(1, laneLerpSpeed);
    if (Math.abs(targetX - s.x) < 0.005) {
      s.x = targetX;
    }
    s.bankAngle += (0 - s.bankAngle) * Math.min(1, 12 * dt);

    // 3. Roar-Dash activation & active suspension
    if (input.dashPressed && s.dashCooldown <= 0 && !s.isDashing) {
      s.isDashing = true;
      s.dashTimer = CONFIG.DASH_DURATION;
      s.dashCooldown = CONFIG.DASH_COOLDOWN;
      s.isFastDropping = false;
      s.isDucking = false;
      s.vy = Math.max(0, s.vy * 0.25); // Suspend downward fall during chasm dash!
      s.squashY = 0.86;
      s.justDashed = true;
    }

    if (s.isDashing) {
      s.dashTimer -= dt;
      if (s.dashTimer <= 0) {
        s.isDashing = false;
        s.dashTimer = 0;
      }
    }

    // 4. Check if support beneath Dino dropped away (walked off plateau or over chasm)
    if (s.isGrounded && effectiveSupportY < s.y - 0.18) {
      s.isGrounded = false;
      s.coyoteTimer = CONFIG.COYOTE_TIME;
    }

    if (s.isGrounded) {
      s.coyoteTimer = CONFIG.COYOTE_TIME;
      s.jumpsRemaining = 2;
    } else if (s.coyoteTimer > 0) {
      s.coyoteTimer = Math.max(0, s.coyoteTimer - dt);
      if (s.coyoteTimer === 0 && s.jumpsRemaining === 2) {
        // Walked off a ledge without jumping: still allow 1 air jump
        s.jumpsRemaining = 1;
      }
    }

    // 5. Jump & Double-Jump execution
    const canPrimaryJump = s.isGrounded || s.coyoteTimer > 0;
    if (s.jumpBufferTimer > 0) {
      if (canPrimaryJump) {
        const tarPenalty = s.tarSlowTimer > 0 ? 0.86 : 1.0;
        s.vy = CONFIG.JUMP_VELOCITY * tarPenalty;
        s.isGrounded = false;
        s.coyoteTimer = 0;
        s.jumpBufferTimer = 0;
        s.jumpsRemaining = 1;
        s.isDucking = false;
        s.isFastDropping = false;
        s.squashY = 1.2;
        s.justJumped = true;
      } else if (s.jumpsRemaining > 0 && input.jumpPressed) {
        s.vy = CONFIG.DOUBLE_JUMP_VELOCITY;
        s.jumpsRemaining -= 1;
        s.jumpBufferTimer = 0;
        s.isDucking = false;
        s.isFastDropping = false;
        s.squashY = 1.18;
        s.justDoubleJumped = true;
      }
    }

    // Variable jump height: releasing jump early while rising trims upward momentum
    if (!input.jumpHeld && s.vy > 6.0 && !s.isFastDropping) {
      s.vy *= Math.pow(CONFIG.JUMP_CUTOFF_MULTIPLIER, dt * 14);
    }

    // 6. Duck (grounded) & Fast-Drop / Ground-Pound (airborne)
    if (!s.isGrounded && !s.isDashing && (input.fastDropPressed || input.duckHeld)) {
      if (!s.isFastDropping) {
        s.isFastDropping = true;
        s.vy = Math.min(s.vy, -22.0); // Immediate snappy downward velocity like Chrome Dino
      }
    }

    // 7. Vertical integration & platform/ground snap
    if (!s.isGrounded) {
      if (s.isDashing) {
        // Hold altitude steady across gaps while dashing (unless rising slightly)
        s.y += Math.max(0, s.vy) * dt;
      } else {
        const gravMult = s.isFastDropping ? CONFIG.FAST_DROP_GRAVITY_MULT : 1.0;
        s.vy += CONFIG.GRAVITY * gravMult * dt;
        s.y += s.vy * dt;
      }

      // Check landing against current support surface
      if (Number.isFinite(effectiveSupportY) && s.vy <= 0 && s.y <= effectiveSupportY) {
        const wasGroundPound = s.isFastDropping;
        s.y = effectiveSupportY;
        s.vy = 0;
        s.isGrounded = true;
        s.groundY = effectiveSupportY;
        s.jumpsRemaining = 2;
        s.isFastDropping = false;
        s.justLanded = true;
        s.justGroundPounded = wasGroundPound;
        s.squashY = wasGroundPound ? 0.72 : 0.84;
      }
    } else {
      // Smoothly follow gentle ramp inclines when grounded
      s.y = effectiveSupportY;
      s.groundY = effectiveSupportY;
    }

    // 8. Posture & hurtbox height update (Mega-Rex stays tall and unstoppable!)
    s.isDucking = s.isGrounded && input.duckHeld && !s.isDashing && s.megaTimer <= 0;
    s.height = s.isDucking ? CONFIG.DINO_DUCK_HEIGHT : CONFIG.DINO_STAND_HEIGHT;

    // 9. Procedural animation springs
    s.squashY += (1.0 - s.squashY) * Math.min(1, 14 * dt);
    const prevStrideStep = Math.floor(s.runCycle / Math.PI);
    if (s.isGrounded) {
      s.runCycle += runSpeed * dt * (s.megaTimer > 0 ? 0.58 : 0.82);
      if (s.megaTimer > 0 && Math.floor(s.runCycle / Math.PI) !== prevStrideStep) {
        s.justMegaStep = true;
      }
    } else {
      s.runCycle += runSpeed * dt * 0.22;
    }
  }
}
