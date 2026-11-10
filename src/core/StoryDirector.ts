import { CONFIG } from './Config';
import type { ActId, BiomePalette, ColorRGB, DirectorSnapshot } from './Types';

function rgb(hex: number): ColorRGB {
  return {
    r: ((hex >> 16) & 0xff) / 255,
    g: ((hex >> 8) & 0xff) / 255,
    b: (hex & 0xff) / 255,
  };
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: ColorRGB, b: ColorRGB, t: number): ColorRGB {
  return {
    r: lerpNum(a.r, b.r, t),
    g: lerpNum(a.g, b.g, t),
    b: lerpNum(a.b, b.b, t),
  };
}

function lerpPalette(a: BiomePalette, b: BiomePalette, t: number): BiomePalette {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    skyTop: lerpColor(a.skyTop, b.skyTop, clamped),
    skyHorizon: lerpColor(a.skyHorizon, b.skyHorizon, clamped),
    fogColor: lerpColor(a.fogColor, b.fogColor, clamped),
    groundMain: lerpColor(a.groundMain, b.groundMain, clamped),
    groundAccent: lerpColor(a.groundAccent, b.groundAccent, clamped),
    canyonRock: lerpColor(a.canyonRock, b.canyonRock, clamped),
    dinoPrimary: lerpColor(a.dinoPrimary, b.dinoPrimary, clamped),
    dinoBelly: lerpColor(a.dinoBelly, b.dinoBelly, clamped),
    cactusColor: lerpColor(a.cactusColor, b.cactusColor, clamped),
    sunIntensity: lerpNum(a.sunIntensity, b.sunIntensity, clamped),
    ambientIntensity: lerpNum(a.ambientIntensity, b.ambientIntensity, clamped),
    fogDensity: lerpNum(a.fogDensity, b.fogDensity, clamped),
    isNight: b.isNight,
    saturationMix: lerpNum(a.saturationMix, b.saturationMix, clamped),
  };
}

const PALETTES: Record<ActId | 'night', BiomePalette> = {
  // Act I: Faithful Chrome Offline Monochrome (#f7f7f7 paper sky, #535353 charcoal T-Rex & cacti)
  1: {
    skyTop: rgb(0xf2f2f2),
    skyHorizon: rgb(0xf7f7f7),
    fogColor: rgb(0xf5f5f5),
    groundMain: rgb(0xe8e8e8),
    groundAccent: rgb(0xcfcfcf),
    canyonRock: rgb(0xd4d4d4),
    dinoPrimary: rgb(0x535353),
    dinoBelly: rgb(0x787878),
    cactusColor: rgb(0x4a4a4a),
    sunIntensity: 1.55,
    ambientIntensity: 0.95,
    fogDensity: 0.0062,
    isNight: false,
    saturationMix: 0.0,
  },
  // Act II: Canyon Winds — Prehistoric golden-hour warmth bleeds into the desert
  2: {
    skyTop: rgb(0x2c7da0),
    skyHorizon: rgb(0xffb76b),
    fogColor: rgb(0xf4b982),
    groundMain: rgb(0xe3a869),
    groundAccent: rgb(0xc98349),
    canyonRock: rgb(0xb85d3b),
    dinoPrimary: rgb(0x3d6b52),
    dinoBelly: rgb(0x8ab87a),
    cactusColor: rgb(0x2d6a4f),
    sunIntensity: 1.85,
    ambientIntensity: 0.78,
    fogDensity: 0.0068,
    isNight: false,
    saturationMix: 0.85,
  },
  // Act III: Tectonic Awakening — Deep amber badlands & volcanic haze
  3: {
    skyTop: rgb(0x3d2c5e),
    skyHorizon: rgb(0xe07a5f),
    fogColor: rgb(0xc96d55),
    groundMain: rgb(0xb56547),
    groundAccent: rgb(0x8c442f),
    canyonRock: rgb(0x6e352c),
    dinoPrimary: rgb(0x3a6e58),
    dinoBelly: rgb(0x95c481),
    cactusColor: rgb(0x345e47),
    sunIntensity: 1.75,
    ambientIntensity: 0.72,
    fogDensity: 0.0074,
    isNight: false,
    saturationMix: 1.0,
  },
  // Act IV: Skyfall Meteor Shower — Bruised crimson-violet extinction sky
  4: {
    skyTop: rgb(0x1a102b),
    skyHorizon: rgb(0x9e2a2b),
    fogColor: rgb(0x6b2028),
    groundMain: rgb(0x633a34),
    groundAccent: rgb(0x452522),
    canyonRock: rgb(0x3d1e24),
    dinoPrimary: rgb(0x468267),
    dinoBelly: rgb(0xa7d48e),
    cactusColor: rgb(0x3b6e52),
    sunIntensity: 1.5,
    ambientIntensity: 0.62,
    fogDensity: 0.0078,
    isNight: false,
    saturationMix: 1.0,
  },
  // Act V: Extinction Overdrive — High-contrast obsidian & neon dawn fire
  5: {
    skyTop: rgb(0x0f172a),
    skyHorizon: rgb(0xd94e34),
    fogColor: rgb(0x522335),
    groundMain: rgb(0x4a303d),
    groundAccent: rgb(0x2f1d29),
    canyonRock: rgb(0x281826),
    dinoPrimary: rgb(0x4ea87e),
    dinoBelly: rgb(0xb8e69c),
    cactusColor: rgb(0x40825d),
    sunIntensity: 1.7,
    ambientIntensity: 0.68,
    fogDensity: 0.0076,
    isNight: false,
    saturationMix: 1.0,
  },
  // Classic Chrome 700-pt Night Inversion (Obsidian sky, silver-lit T-Rex, glowing moon/stars)
  night: {
    skyTop: rgb(0x070913),
    skyHorizon: rgb(0x141b2d),
    fogColor: rgb(0x101626),
    groundMain: rgb(0x1d2436),
    groundAccent: rgb(0x2b354d),
    canyonRock: rgb(0x161d2e),
    dinoPrimary: rgb(0xd8e2ec),
    dinoBelly: rgb(0x9fb3c8),
    cactusColor: rgb(0x8da9c4),
    sunIntensity: 0.9,
    ambientIntensity: 0.65,
    fogDensity: 0.0072,
    isNight: true,
    saturationMix: 0.5,
  },
};

const ACT_METADATA: Record<ActId, { title: string; subtitle: string }> = {
  1: {
    title: 'ACT I · THE MONOCHROME BADLANDS',
    subtitle: 'Jump cacti & switch lanes · Classic offline desert awakened',
  },
  2: {
    title: 'ACT II · CANYON WINDS & WINGED SHADOWS',
    subtitle: 'Duck swooping Pterodactyls · Smash cracked boulders with SHIFT Dash',
  },
  3: {
    title: 'ACT III · TECTONIC AWAKENING',
    subtitle: 'Cross canyon chasms · Ride steam geysers & crumbling bridges',
  },
  4: {
    title: 'ACT IV · SKYFALL: EXTINCTION STORM',
    subtitle: 'WARNING: Watch ground target reticles — Meteors incoming!',
  },
  5: {
    title: 'ACT V · EXTINCTION OVERDRIVE',
    subtitle: 'Maximum velocity prehistoric survival!',
  },
};

export class StoryDirector {
  private currentAct: ActId = 1;
  private wasNight = false;
  private currentPalette: BiomePalette = { ...PALETTES[1] };
  private elapsedRunSeconds = 0;

  public reset(): void {
    this.currentAct = 1;
    this.wasNight = false;
    this.currentPalette = { ...PALETTES[1] };
    this.elapsedRunSeconds = 0;
  }

  public static computeActForScore(score: number): ActId {
    const t = CONFIG.ACT_THRESHOLDS;
    if (score >= t.ACT_5_OVERDRIVE) return 5;
    if (score >= t.ACT_4_METEOR_SHOWER) return 4;
    if (score >= t.ACT_3_TECTONIC) return 3;
    if (score >= t.ACT_2_CANYON_WINDS) return 2;
    return 1;
  }

  public static computeIsNight(score: number): boolean {
    if (score < CONFIG.NIGHT_CYCLE_INTERVAL) return false;
    const cyclePos = score % CONFIG.NIGHT_CYCLE_INTERVAL;
    return cyclePos < CONFIG.NIGHT_DURATION_SCORE;
  }

  public update(score: number, dt: number): DirectorSnapshot {
    this.elapsedRunSeconds += dt;

    const nextAct = StoryDirector.computeActForScore(score);
    const actChanged = nextAct !== this.currentAct;
    this.currentAct = nextAct;

    const isNight = StoryDirector.computeIsNight(score);
    const nightJustToggled = isNight !== this.wasNight;
    this.wasNight = isNight;

    // Speed scales smoothly with both score and time, capped at MAX_SPEED
    const scoreBasedBoost = score * 0.0062;
    const timeBasedBoost = this.elapsedRunSeconds * CONFIG.SPEED_ACCELERATION * 0.35;
    const targetSpeed = Math.min(
      CONFIG.MAX_SPEED,
      CONFIG.INITIAL_SPEED + scoreBasedBoost + timeBasedBoost
    );

    // Meteors activate in Act IV+ (with rare preview shooting-star strikes late in Act III if desired, kept strictly Act IV+ per plan)
    const meteorsEnabled = nextAct >= 4;
    let meteorInterval = 999;
    if (nextAct === 4) {
      const progress = Math.min(1, (score - CONFIG.ACT_THRESHOLDS.ACT_4_METEOR_SHOWER) / 900);
      meteorInterval = lerpNum(2.25, 1.35, progress);
    } else if (nextAct === 5) {
      const cycleMod = (score - CONFIG.ACT_THRESHOLDS.ACT_5_OVERDRIVE) % 900;
      // Dynamic breather waves inside Overdrive so intensity pulses thrillingly
      meteorInterval = cycleMod > 650 ? 1.85 : 1.05;
    }

    // Choose target biome palette (Act V cycles sub-atmospheres every 700 pts when not in Night Mode)
    let targetPalette = PALETTES[nextAct];
    if (nextAct === 5 && !isNight) {
      const subEra = Math.floor((score - CONFIG.ACT_THRESHOLDS.ACT_5_OVERDRIVE) / 600) % 3;
      if (subEra === 1) targetPalette = PALETTES[2]; // Golden Dawn Oasis breather
      else if (subEra === 2) targetPalette = PALETTES[1]; // Hyper-Monochrome Glitch tribute!
    }
    if (isNight) {
      targetPalette = PALETTES.night;
    }

    const blendSpeed = dt > 0 ? Math.min(1, dt * 1.8) : 1;
    this.currentPalette = lerpPalette(this.currentPalette, targetPalette, blendSpeed);

    const meta = ACT_METADATA[nextAct];

    return {
      act: nextAct,
      actTitle: meta.title,
      actSubtitle: meta.subtitle,
      actChanged,
      isNight,
      nightJustToggled,
      targetSpeed,
      meteorsEnabled,
      meteorInterval,
      palette: this.currentPalette,
    };
  }
}
