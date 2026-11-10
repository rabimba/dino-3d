import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/Config';
import { StoryDirector } from '../src/core/StoryDirector';

describe('StoryDirector', () => {
  it('transitions cleanly across all 5 Story Acts at configured score milestones', () => {
    const dir = new StoryDirector();

    const s1 = dir.update(0, 0.016);
    expect(s1.act).toBe(1);
    expect(s1.meteorsEnabled).toBe(false);

    const s2 = dir.update(420, 0.016);
    expect(s2.act).toBe(2);
    expect(s2.actChanged).toBe(true);
    expect(s2.meteorsEnabled).toBe(false);

    const s3 = dir.update(950, 0.016);
    expect(s3.act).toBe(3);
    expect(s3.actChanged).toBe(true);
    expect(s3.meteorsEnabled).toBe(false);

    const s4 = dir.update(1650, 0.016);
    expect(s4.act).toBe(4);
    expect(s4.actChanged).toBe(true);
    expect(s4.meteorsEnabled).toBe(true);
    expect(s4.meteorInterval).toBeLessThan(2.5);

    const s5 = dir.update(2600, 0.016);
    expect(s5.act).toBe(5);
    expect(s5.actChanged).toBe(true);
    expect(s5.meteorsEnabled).toBe(true);
  });

  it('triggers Chrome Night Mode every 700 points and returns to Day after duration', () => {
    expect(StoryDirector.computeIsNight(0)).toBe(false);
    expect(StoryDirector.computeIsNight(699)).toBe(false);
    expect(StoryDirector.computeIsNight(700)).toBe(true);
    expect(StoryDirector.computeIsNight(850)).toBe(true);
    expect(StoryDirector.computeIsNight(930)).toBe(false);
    expect(StoryDirector.computeIsNight(1400)).toBe(true);
  });

  it('accelerates run speed smoothly and clamps at MAX_SPEED', () => {
    const dir = new StoryDirector();
    const early = dir.update(50, 0.5);
    const mid = dir.update(1200, 10.0);
    const extreme = dir.update(50000, 300.0);

    expect(mid.targetSpeed).toBeGreaterThan(early.targetSpeed);
    expect(extreme.targetSpeed).toBe(CONFIG.MAX_SPEED);
  });
});
