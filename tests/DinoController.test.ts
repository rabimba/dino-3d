import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/Config';
import { DinoController } from '../src/core/DinoController';
import type { InputActions } from '../src/core/Types';

function idleInput(overrides: Partial<InputActions> = {}): InputActions {
  return {
    jumpPressed: false,
    jumpHeld: false,
    duckHeld: false,
    fastDropPressed: false,
    moveLeftPressed: false,
    moveRightPressed: false,
    dashPressed: false,
    megaPressed: false,
    ...overrides,
  };
}

describe('DinoController', () => {
  it('reaches a higher apex when holding jump vs releasing early (variable jump height)', () => {
    const dt = 1 / 120;

    // Full hold jump
    const fullDino = new DinoController();
    fullDino.step(dt, idleInput({ jumpPressed: true, jumpHeld: true }), 0, 18);
    let maxFullY = 0;
    for (let i = 0; i < 90; i++) {
      fullDino.step(dt, idleInput({ jumpHeld: true }), 0, 18);
      maxFullY = Math.max(maxFullY, fullDino.state.y);
    }

    // Short hop (release immediately after takeoff)
    const hopDino = new DinoController();
    hopDino.step(dt, idleInput({ jumpPressed: true, jumpHeld: true }), 0, 18);
    let maxHopY = 0;
    for (let i = 0; i < 90; i++) {
      hopDino.step(dt, idleInput({ jumpHeld: false }), 0, 18);
      maxHopY = Math.max(maxHopY, hopDino.state.y);
    }

    expect(maxFullY).toBeGreaterThan(3.0);
    expect(maxHopY).toBeGreaterThan(1.0);
    expect(maxFullY).toBeGreaterThan(maxHopY + 0.8);
  });

  it('allows one mid-air double jump and blocks a third air jump until landing', () => {
    const dt = 1 / 120;
    const ctrl = new DinoController();

    // Primary jump
    ctrl.step(dt, idleInput({ jumpPressed: true, jumpHeld: true }), 0, 18);
    expect(ctrl.state.justJumped).toBe(true);
    expect(ctrl.state.jumpsRemaining).toBe(1);

    for (let i = 0; i < 20; i++) {
      ctrl.step(dt, idleInput({ jumpHeld: false }), 0, 18);
    }

    // Secondary air jump
    ctrl.step(dt, idleInput({ jumpPressed: true, jumpHeld: true }), 0, 18);
    expect(ctrl.state.justDoubleJumped).toBe(true);
    expect(ctrl.state.jumpsRemaining).toBe(0);

    // Attempt third jump in air — should not fire
    const vyBefore = ctrl.state.vy;
    ctrl.step(dt, idleInput({ jumpPressed: true, jumpHeld: true }), 0, 18);
    expect(ctrl.state.justDoubleJumped).toBe(false);
    expect(ctrl.state.vy).toBeLessThan(vyBefore);
  });

  it('supports coyote time shortly after stepping off an elevated ledge', () => {
    const dt = 1 / 120;
    const ctrl = new DinoController();
    ctrl.state.y = 2.2;
    ctrl.state.groundY = 2.2;

    // Step off plateau (support drops to 0) for 50ms (< 100ms coyote window)
    for (let i = 0; i < 6; i++) {
      ctrl.step(dt, idleInput(), 0, 18);
    }
    expect(ctrl.state.isGrounded).toBe(false);
    expect(ctrl.state.coyoteTimer).toBeGreaterThan(0);

    // Pressing jump within coyote window executes full primary jump (plus 1 tick of Euler gravity) and preserves air double-jump!
    ctrl.step(dt, idleInput({ jumpPressed: true, jumpHeld: true }), 0, 18);
    expect(ctrl.state.justJumped).toBe(true);
    expect(ctrl.state.jumpsRemaining).toBe(1);
    expect(ctrl.state.vy).toBeCloseTo(CONFIG.JUMP_VELOCITY + CONFIG.GRAVITY * dt, 2);
  });

  it('shrinks hurtbox when ducking on ground and triggers Ground-Pound when pressed in air', () => {
    const dt = 1 / 120;
    const ctrl = new DinoController();

    // Ducking on ground
    ctrl.step(dt, idleInput({ duckHeld: true }), 0, 18);
    expect(ctrl.state.isDucking).toBe(true);
    expect(ctrl.state.height).toBe(CONFIG.DINO_DUCK_HEIGHT);

    // Jump, then trigger Fast-Drop / Ground-Pound in mid-air
    ctrl.step(dt, idleInput({ jumpPressed: true, jumpHeld: true }), 0, 18);
    for (let i = 0; i < 15; i++) {
      ctrl.step(dt, idleInput({ jumpHeld: true }), 0, 18);
    }
    expect(ctrl.state.y).toBeGreaterThan(1.5);

    ctrl.step(dt, idleInput({ fastDropPressed: true, duckHeld: true }), 0, 18);
    expect(ctrl.state.isFastDropping).toBe(true);
    expect(ctrl.state.vy).toBeLessThanOrEqual(-22);

    let sawGroundPound = false;
    for (let i = 0; i < 30; i++) {
      ctrl.step(dt, idleInput({ duckHeld: false }), 0, 18);
      if (ctrl.state.justGroundPounded) {
        sawGroundPound = true;
        break;
      }
    }
    expect(sawGroundPound).toBe(true);
    expect(ctrl.state.isGrounded).toBe(true);
  });

  it('switches across the 3 discrete lanes and clamps at Left (0) and Right (2)', () => {
    const dt = 1 / 60;
    const ctrl = new DinoController();
    expect(ctrl.state.lane).toBe(1);

    ctrl.step(dt, idleInput({ moveLeftPressed: true }), 0, 18);
    expect(ctrl.state.lane).toBe(0);
    ctrl.step(dt, idleInput({ moveLeftPressed: true }), 0, 18);
    expect(ctrl.state.lane).toBe(0); // Clamped

    ctrl.step(dt, idleInput({ moveRightPressed: true }), 0, 18);
    ctrl.step(dt, idleInput({ moveRightPressed: true }), 0, 18);
    ctrl.step(dt, idleInput({ moveRightPressed: true }), 0, 18);
    expect(ctrl.state.lane).toBe(2); // Clamped

    for (let i = 0; i < 30; i++) {
      ctrl.step(dt, idleInput(), 0, 18);
    }
    expect(ctrl.state.x).toBeCloseTo(CONFIG.LANES[2], 2);
  });

  it('suspends fall over chasms during Roar-Dash and refunds cooldown on near-miss', () => {
    const dt = 1 / 120;
    const ctrl = new DinoController();

    // Start airborne over open chasm (-Infinity support) and Dash!
    ctrl.state.isGrounded = false;
    ctrl.state.y = 1.0;
    ctrl.state.vy = -5.0;

    ctrl.step(dt, idleInput({ dashPressed: true }), -Infinity, 20);
    expect(ctrl.state.isDashing).toBe(true);
    expect(ctrl.state.dashCooldown).toBeCloseTo(CONFIG.DASH_COOLDOWN, 2);

    for (let i = 0; i < 15; i++) {
      ctrl.step(dt, idleInput(), -Infinity, 20);
    }
    // Should hold altitude >= 1.0 during dash!
    expect(ctrl.state.y).toBeGreaterThanOrEqual(1.0);

    const beforeRefund = ctrl.state.dashCooldown;
    ctrl.refundDashCooldown(CONFIG.NEAR_MISS_COOLDOWN_REFUND);
    expect(ctrl.state.dashCooldown).toBeCloseTo(beforeRefund - CONFIG.NEAR_MISS_COOLDOWN_REFUND, 3);
  });

  it('activates Mega-Rex Overdrive at 100% Rage and strides safely across chasms', () => {
    const dt = 1 / 60;
    const ctrl = new DinoController();

    ctrl.addRage(60);
    expect(ctrl.activateMegaRex()).toBe(false); // Not at 100% yet

    ctrl.addRage(50);
    expect(ctrl.state.rage).toBe(CONFIG.MEGA_RAGE_MAX);

    ctrl.step(dt, idleInput({ megaPressed: true }), -Infinity, 22);
    expect(ctrl.state.justActivatedMega).toBe(true);
    expect(ctrl.state.megaTimer).toBeGreaterThan(7.0);
    expect(ctrl.state.rage).toBe(0);

    // Even over an open chasm (-Infinity), Mega-Rex stays grounded at y = 0!
    for (let i = 0; i < 20; i++) {
      ctrl.step(dt, idleInput(), -Infinity, 22);
    }
    expect(ctrl.state.y).toBe(0);
  });
});
