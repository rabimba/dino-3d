import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/Config';
import { DinoController } from '../src/core/DinoController';
import type { ObstacleEntity } from '../src/core/Types';
import { ChronoGhostSystem } from '../src/world/ChronoGhostSystem';
import { WifiBossSystem } from '../src/world/WifiBossSystem';

describe('Twists: WifiBossSystem & ChronoGhostSystem', () => {
  it('triggers Wi-Fi Reconnecting Boss at score threshold and defeats it after 3 jammed relays', () => {
    const wifi = new WifiBossSystem();
    expect(wifi.active).toBe(false);

    const appearEv = wifi.update(0.1, CONFIG.WIFI_BOSS_FIRST_SCORE + 5, 1);
    expect(appearEv.justAppeared).toBe(true);
    expect(wifi.active).toBe(true);

    expect(wifi.onRelayJammed()).toBe(false);
    expect(wifi.onRelayJammed()).toBe(false);
    expect(wifi.onRelayJammed()).toBe(true); // 3rd relay defeats boss!
    expect(wifi.active).toBe(false);
  });

  it('arms Amber Chrono-Core after 3 Amber pickups and rewinds obstacles & score in reverse', () => {
    const chrono = new ChronoGhostSystem();
    const ctrl = new DinoController();

    expect(chrono.onAmberCollected(2)).toBe(false);
    expect(chrono.chronoCharges).toBe(0);
    expect(chrono.onAmberCollected(1)).toBe(true);
    expect(chrono.chronoCharges).toBe(1);

    // Record 1.5s of history
    let simScore = 100;
    for (let i = 0; i < 90; i++) {
      simScore += 0.5;
      ctrl.state.x = 0;
      chrono.recordAndSyncGhost(1 / 60, simScore, 20, ctrl.state);
    }

    expect(chrono.canTriggerRewind()).toBe(true);
    chrono.beginRewind();
    expect(chrono.chronoCharges).toBe(0);

    const hazard: ObstacleEntity = {
      id: 1,
      kind: 'cactus_tall',
      lane: 1,
      laneSpan: 1,
      x: 0,
      y: 0,
      z: 0,
      width: 1.3,
      height: 2.1,
      depth: 1.0,
      active: true,
      shattered: false,
      nearMissAwarded: false,
    };

    let finished = false;
    for (let i = 0; i < 30 && !finished; i++) {
      const res = chrono.stepRewind(0.05, ctrl.state, [hazard], [], []);
      finished = res.finished;
    }

    expect(finished).toBe(true);
    expect(hazard.z).toBeLessThan(-20); // Pushed far back toward the horizon!
    expect(ctrl.state.postRewindGrace).toBeCloseTo(CONFIG.POST_REWIND_GRACE_SEC, 2);
  });
});
