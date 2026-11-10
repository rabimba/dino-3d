import { describe, expect, it } from 'vitest';
import { CollisionSystem } from '../src/core/CollisionSystem';
import { CONFIG } from '../src/core/Config';
import { DinoController } from '../src/core/DinoController';
import type { MeteorStrike, ObstacleEntity, PlatformEntity } from '../src/core/Types';

function makeObstacle(partial: Partial<ObstacleEntity>): ObstacleEntity {
  return {
    id: 1,
    kind: 'cactus_small',
    lane: 1,
    laneSpan: 1,
    x: 0,
    y: 0,
    z: 0,
    width: 1.2,
    height: 1.45,
    depth: 1.0,
    active: true,
    shattered: false,
    nearMissAwarded: false,
    ...partial,
  };
}

describe('CollisionSystem', () => {
  it('crashes when running directly into a cactus and clears it when jumping above', () => {
    const col = new CollisionSystem();
    const ctrl = new DinoController();
    const cactus = makeObstacle({ kind: 'cactus_small', y: 0, height: 1.44, z: 0 });

    // Grounded collision
    const hitRes = col.evaluate(0.016, ctrl.state, [], [cactus], []);
    expect(hitRes.crashed).toBe(true);
    expect(hitRes.crashReason).toBe('cactus_small');

    // Airborne jump clearance
    ctrl.state.y = 1.65;
    const clearRes = col.evaluate(0.016, ctrl.state, [], [cactus], []);
    expect(clearRes.crashed).toBe(false);
  });

  it('hits a standing Dino on mid-altitude Pterodactyls, but passes safely when ducking', () => {
    const col = new CollisionSystem();
    const ctrl = new DinoController();
    const ptero = makeObstacle({
      id: 2,
      kind: 'pterodactyl',
      y: 1.26,
      height: 0.88,
      width: 2.0,
      z: 0,
    });

    // Standing upright -> hits
    expect(col.evaluate(0.016, ctrl.state, [], [ptero], []).crashed).toBe(true);

    // Ducking -> passes safely underneath!
    ctrl.state.isDucking = true;
    ctrl.state.height = CONFIG.DINO_DUCK_HEIGHT;
    expect(col.evaluate(0.016, ctrl.state, [], [ptero], []).crashed).toBe(false);

    // Just past Dino -> awards Near-Miss bonus!
    ptero.z = 0.9;
    const nearOutcome = col.evaluate(0.016, ctrl.state, [], [ptero], []);
    expect(nearOutcome.nearMissCount).toBe(1);
    expect(nearOutcome.bonusEvents[0]?.points).toBe(15);
  });

  it('shatters cracked boulders during Roar-Dash or Ground-Pound instead of crashing', () => {
    const col = new CollisionSystem();
    const ctrl = new DinoController();
    const boulder = makeObstacle({
      id: 9,
      kind: 'boulder_cracked',
      width: 1.85,
      height: 1.9,
      depth: 1.7,
    });

    // Without dash -> crashes
    expect(col.evaluate(0.016, ctrl.state, [], [{ ...boulder }], []).crashed).toBe(true);

    // With Roar-Dash -> smashes boulder & awards +25 bonus!
    ctrl.state.isDashing = true;
    const smashOutcome = col.evaluate(0.016, ctrl.state, [], [boulder], []);
    expect(smashOutcome.crashed).toBe(false);
    expect(smashOutcome.smashedObstacleIds).toContain(9);
    expect(boulder.shattered).toBe(true);
    expect(smashOutcome.bonusEvents[0]?.points).toBe(25);
  });

  it('computes multi-tier platform support height and open chasm drops accurately', () => {
    const col = new CollisionSystem();
    const ctrl = new DinoController();

    const plateau: PlatformEntity = {
      id: 1,
      lane: 1,
      x: 0,
      y: 2.2,
      z: 0,
      width: 2.45,
      length: 10,
      thickness: 0.4,
      isRamp: false,
      isCrumbling: false,
      steppedOn: false,
      crumbleTimer: 0.55,
      collapsed: false,
      active: true,
    };

    // Above Tier-1 plateau -> lands at 2.2
    ctrl.state.y = 2.35;
    expect(col.computeSupportHeight(ctrl.state, [plateau], [])).toBeCloseTo(2.2, 2);

    // Over open chasm with no platform -> support is -Infinity
    ctrl.state.y = 0;
    const chasm = makeObstacle({ kind: 'chasm', width: 2.65, depth: 6.0, z: 0 });
    expect(col.computeSupportHeight(ctrl.state, [], [chasm])).toBe(-Infinity);
  });

  it('detects active meteor impact blasts on the target lane while sparing adjacent lanes', () => {
    const col = new CollisionSystem();
    const ctrl = new DinoController();

    const activeStrike: MeteorStrike = {
      id: 77,
      lane: 1,
      x: 0,
      targetY: 0,
      z: 0,
      startX: 0,
      startY: 34,
      startZOffset: -18,
      timer: 0,
      totalTime: 1.3,
      impacted: true,
      blastTimer: 0.12,
      active: true,
    };

    // Same lane (center x = 0) -> caught in meteor blast
    expect(col.evaluate(0.016, ctrl.state, [], [], [activeStrike]).crashed).toBe(true);

    // Dodged to Left lane (x = -2.8) -> completely safe!
    ctrl.state.lane = 0;
    ctrl.state.x = CONFIG.LANES[0];
    expect(col.evaluate(0.016, ctrl.state, [], [], [activeStrike]).crashed).toBe(false);
  });

  it('collects Amber crystals for bonus points and ducks safely under skimming meteor bolides', () => {
    const col = new CollisionSystem();
    const ctrl = new DinoController();

    const amber = makeObstacle({
      id: 42,
      kind: 'amber_pickup',
      y: 0.15,
      width: 1.05,
      height: 1.1,
      depth: 1.05,
    });

    const pickupRes = col.evaluate(0.016, ctrl.state, [], [amber], []);
    expect(pickupRes.crashed).toBe(false);
    expect(pickupRes.collectedAmberIds).toContain(42);
    expect(pickupRes.bonusEvents[0]?.points).toBe(30);

    const bolide = makeObstacle({
      id: 43,
      kind: 'meteor_bolide',
      y: 1.26,
      width: 1.85,
      height: 0.95,
      depth: 1.8,
    });

    // Standing hits skimming bolide; ducking slides safely underneath!
    expect(col.evaluate(0.016, ctrl.state, [], [bolide], []).crashed).toBe(true);
    ctrl.state.isDucking = true;
    ctrl.state.height = CONFIG.DINO_DUCK_HEIGHT;
    expect(col.evaluate(0.016, ctrl.state, [], [bolide], []).crashed).toBe(false);
  });

  it('stomps hazards & headbutts meteors during Mega-Rex Overdrive, and jams Wi-Fi relays', () => {
    const col = new CollisionSystem();
    const ctrl = new DinoController();
    ctrl.state.megaTimer = 5.0;

    const monolith = makeObstacle({ id: 50, kind: 'monolith_404', height: 2.5 });
    const relay = makeObstacle({ id: 51, kind: 'wifi_relay', height: 2.2 });
    const strike: MeteorStrike = {
      id: 88,
      lane: 1,
      x: 0,
      targetY: 0,
      z: 0,
      startX: 0,
      startY: 23,
      startZOffset: -18,
      timer: 0,
      totalTime: 1.3,
      impacted: true,
      blastTimer: 0.12,
      active: true,
    };

    const res = col.evaluate(0.016, ctrl.state, [], [monolith, relay], [strike], 1);
    expect(res.crashed).toBe(false);
    expect(res.megaStompedIds).toEqual([50, 51]);
    expect(res.jammedRelayIds).toEqual([51]);
    expect(strike.blastTimer).toBe(0); // Meteor headbutted!
  });
});
