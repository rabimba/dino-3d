import * as THREE from 'three';
import { CONFIG } from '../core/Config';
import type { DinoState, LaneIndex, MeteorStrike, ObstacleEntity, PlatformEntity } from '../core/Types';
import { buildVoxelGeometry } from './VoxelBuilder';

interface RewindFrame {
  score: number;
  runSpeed: number;
  lane: LaneIndex;
  x: number;
  y: number;
  runCycle: number;
}

interface GhostSample {
  t: number;
  score: number;
  x: number;
  y: number;
  duck: number;
}

interface SavedGhostRun {
  maxScore: number;
  samples: GhostSample[];
}

const GHOST_STORAGE_KEY = 'chrome_dino_3d_ghost_run_v1';
const MAX_REWIND_FRAMES = 130; // ~2.16s at 60Hz sampling

export class ChronoGhostSystem {
  public readonly root = new THREE.Group();

  // Amber Chrono-Rewind state
  public amberFragments = 0;
  public chronoCharges = 0;
  private rewindBuffer: RewindFrame[] = [];
  private sampleAccum = 0;
  private rewindProgress = 0;
  private rewindStartSnapshotIndex = 0;

  // Holographic Crowned Ghost Rival state
  private readonly ghostGroup = new THREE.Group();
  private readonly ghostBodyMesh: THREE.Mesh;
  private readonly ghostCrownMesh: THREE.Mesh;
  private readonly ghostMat: THREE.MeshBasicMaterial;

  private activeRunTime = 0;
  private ghostRecordAccum = 0;
  private currentRunSamples: GhostSample[] = [];
  private rivalRun: SavedGhostRun;
  public rivalOvertaken = false;

  constructor(startWithChrono = false) {
    if (startWithChrono) {
      this.chronoCharges = 1;
    }

    // Build Translucent Holographic Ghost T-Rex + Floating Golden Crown!
    this.ghostMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: false,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    });

    const ghostGeo = buildVoxelGeometry([
      // Body & tail silhouette
      { pos: [0, 1.0, 0.05], size: [0.8, 0.85, 1.0] },
      { pos: [0, 1.0, 0.72], size: [0.46, 0.38, 0.75] },
      // Head & snout (-Z)
      { pos: [0, 1.82, -0.45], size: [0.76, 0.58, 0.92] },
      // Legs
      { pos: [-0.26, 0.35, 0.05], size: [0.24, 0.7, 0.32] },
      { pos: [0.26, 0.35, 0.05], size: [0.24, 0.7, 0.32] },
    ]);
    this.ghostBodyMesh = new THREE.Mesh(ghostGeo, this.ghostMat);
    this.ghostGroup.add(this.ghostBodyMesh);

    // Floating Golden Voxel Crown atop Ghost Rival!
    const crownGeo = buildVoxelGeometry([
      { pos: [0, 0, 0], size: [0.58, 0.14, 0.58], color: 0xffd166 },
      { pos: [-0.22, 0.14, -0.22], size: [0.14, 0.18, 0.14], color: 0xffbe0b },
      { pos: [0.22, 0.14, -0.22], size: [0.14, 0.18, 0.14], color: 0xffbe0b },
      { pos: [0, 0.16, -0.22], size: [0.14, 0.22, 0.14], color: 0xffe66d },
      { pos: [-0.22, 0.14, 0.22], size: [0.14, 0.18, 0.14], color: 0xffbe0b },
      { pos: [0.22, 0.14, 0.22], size: [0.14, 0.18, 0.14], color: 0xffbe0b },
    ]);
    const crownMat = new THREE.MeshBasicMaterial({ color: 0xffd166, vertexColors: true });
    this.ghostCrownMesh = new THREE.Mesh(crownGeo, crownMat);
    this.ghostCrownMesh.position.set(0, 2.38, -0.42);
    this.ghostGroup.add(this.ghostCrownMesh);

    this.ghostGroup.visible = false;
    this.root.add(this.ghostGroup);

    this.rivalRun = this.loadSavedGhost() ?? this.createDefaultPaceSetterGhost();
  }

  public resetForNewRun(startWithChrono = false): void {
    this.amberFragments = 0;
    this.chronoCharges = startWithChrono ? 1 : 0;
    this.rewindBuffer = [];
    this.sampleAccum = 0;
    this.activeRunTime = 0;
    this.ghostRecordAccum = 0;
    this.currentRunSamples = [];
    this.rivalOvertaken = false;
    this.ghostGroup.visible = false;
  }

  public onAmberCollected(count: number): boolean {
    if (this.chronoCharges >= 1) return false;
    this.amberFragments += count;
    if (this.amberFragments >= CONFIG.AMBER_FOR_CHRONO_CHARGE) {
      this.amberFragments = 0;
      this.chronoCharges = 1;
      return true; // Newly armed Chrono-Core!
    }
    return false;
  }

  public canTriggerRewind(): boolean {
    return this.chronoCharges > 0 && this.rewindBuffer.length >= 12;
  }

  public beginRewind(): void {
    this.chronoCharges = Math.max(0, this.chronoCharges - 1);
    this.amberFragments = 0;
    this.rewindProgress = 0;
    this.rewindStartSnapshotIndex = this.rewindBuffer.length - 1;
  }

  /**
   * Steps the 2-second Amber Time-Rewind in reverse over REWIND_DURATION_REAL_SEC,
   * pulling obstacles backward into the horizon and lifting meteors back into the clouds!
   * Returns { finished, score } when complete.
   */
  public stepRewind(
    realDt: number,
    dino: DinoState,
    obstacles: ObstacleEntity[],
    platforms: PlatformEntity[],
    meteors: MeteorStrike[]
  ): { finished: boolean; rewoundScore: number } {
    this.rewindProgress += realDt / CONFIG.REWIND_DURATION_REAL_SEC;
    const clamped = Math.min(1, this.rewindProgress);

    const targetIdx = Math.max(
      0,
      Math.floor((1 - clamped) * this.rewindStartSnapshotIndex)
    );
    const frame = this.rewindBuffer[targetIdx];

    // Push track entities backward (-Z) at 2x speed!
    const reverseSpeed = (frame?.runSpeed ?? CONFIG.INITIAL_SPEED) * 2.0;
    const backDz = reverseSpeed * realDt;

    for (const obs of obstacles) {
      obs.z -= backDz;
    }
    for (const plat of platforms) {
      plat.z -= backDz;
    }
    for (const m of meteors) {
      m.z -= backDz;
      if (!m.impacted) {
        m.timer = Math.min(m.totalTime, m.timer + realDt * 2.0);
      }
    }

    if (frame) {
      dino.lane = frame.lane;
      dino.x = frame.x;
      dino.y = Math.max(0, frame.y);
      dino.runCycle = frame.runCycle;
      dino.vy = 0;
      dino.isCrashed = false;
    }

    if (clamped >= 1) {
      const finalScore = frame ? frame.score : 0;
      this.rewindBuffer = this.rewindBuffer.slice(0, 1);
      // Clear any immediate collision traps around Rex so resumption is 100% fair
      for (const obs of obstacles) {
        if (obs.kind !== 'amber_pickup' && obs.z > -16 && obs.z < 6) {
          obs.active = false;
        }
      }
      dino.y = Math.max(0, dino.y);
      dino.isGrounded = dino.y === 0;
      dino.postRewindGrace = CONFIG.POST_REWIND_GRACE_SEC;
      return { finished: true, rewoundScore: finalScore };
    }

    return { finished: false, rewoundScore: frame ? frame.score : 0 };
  }

  /**
   * Records rewind history + ghost telemetry, and animates the Crowned Ghost Rival!
   * Returns true on the exact tick the player overtakes the Ghost Rival's record!
   */
  public recordAndSyncGhost(
    dt: number,
    score: number,
    runSpeed: number,
    dino: DinoState
  ): boolean {
    this.activeRunTime += dt;

    // 1. Sample 60Hz Rewind Ring Buffer
    this.sampleAccum += dt;
    if (this.sampleAccum >= 1 / 60) {
      this.sampleAccum = 0;
      this.rewindBuffer.push({
        score,
        runSpeed,
        lane: dino.lane,
        x: dino.x,
        y: dino.y,
        runCycle: dino.runCycle,
      });
      if (this.rewindBuffer.length > MAX_REWIND_FRAMES) {
        this.rewindBuffer.shift();
      }
    }

    // 2. Sample 10Hz Ghost Recording
    this.ghostRecordAccum += dt;
    if (this.ghostRecordAccum >= 0.1) {
      this.ghostRecordAccum = 0;
      this.currentRunSamples.push({
        t: Number(this.activeRunTime.toFixed(2)),
        score: Math.round(score * 10) / 10,
        x: Number(dino.x.toFixed(2)),
        y: Number(dino.y.toFixed(2)),
        duck: dino.isDucking ? 1 : 0,
      });
    }

    // 3. Animate Rival Ghost
    if (this.rivalOvertaken || this.rivalRun.samples.length < 2) {
      this.ghostGroup.visible = false;
      return false;
    }

    if (score > this.rivalRun.maxScore) {
      this.rivalOvertaken = true;
      this.ghostGroup.visible = false;
      return true; // Overtaken celebration!
    }

    const sample = this.sampleGhostAtTime(this.activeRunTime);
    // Keep Ghost visibly pacing ahead (-Z) proportional to remaining gap to rival's maxScore
    const scoreGap = Math.max(0, this.rivalRun.maxScore - score);
    const leadZ = -Math.min(14.0, 2.6 + scoreGap * 0.035);

    this.ghostGroup.visible = true;
    this.ghostGroup.position.set(sample.x, sample.y, leadZ);
    this.ghostBodyMesh.scale.y = sample.duck ? 0.52 : 1.0;
    this.ghostCrownMesh.position.y = sample.duck ? 1.45 : 2.38;
    this.ghostCrownMesh.rotation.y += dt * 3.0;
    this.ghostMat.opacity = 0.28 + Math.sin(this.activeRunTime * 6) * 0.08;

    return false;
  }

  public commitRunIfBest(finalScore: number): void {
    const intScore = Math.floor(finalScore);
    if (intScore > this.rivalRun.maxScore && this.currentRunSamples.length >= 5) {
      this.rivalRun = {
        maxScore: intScore,
        samples: this.currentRunSamples.slice(0, 1800), // Up to 3 minutes at 10Hz
      };
      try {
        window.localStorage.setItem(GHOST_STORAGE_KEY, JSON.stringify(this.rivalRun));
      } catch {
        // Ignore storage errors
      }
    }
  }

  private sampleGhostAtTime(t: number): GhostSample {
    const arr = this.rivalRun.samples;
    if (arr.length === 0) return { t: 0, score: 0, x: 0, y: 0, duck: 0 };
    // Loop rival movement cleanly if player takes longer in wall-clock time before beating score
    const maxT = Math.max(0.2, arr[arr.length - 1].t);
    const wrappedT = t % maxT;

    for (let i = 0; i < arr.length - 1; i++) {
      const a = arr[i];
      const b = arr[i + 1];
      if (wrappedT >= a.t && wrappedT <= b.t) {
        const alpha = (wrappedT - a.t) / Math.max(0.001, b.t - a.t);
        return {
          t: wrappedT,
          score: a.score + (b.score - a.score) * alpha,
          x: a.x + (b.x - a.x) * alpha,
          y: a.y + (b.y - a.y) * alpha,
          duck: alpha < 0.5 ? a.duck : b.duck,
        };
      }
    }
    return arr[arr.length - 1];
  }

  private loadSavedGhost(): SavedGhostRun | null {
    try {
      const raw = window.localStorage.getItem(GHOST_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SavedGhostRun;
      if (parsed && parsed.maxScore > 0 && Array.isArray(parsed.samples)) {
        return parsed;
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }

  /** Built-in 500-pt "Chrome Dev Pace-Setter" Ghost so Run #1 immediately has an exciting rival! */
  private createDefaultPaceSetterGhost(): SavedGhostRun {
    const samples: GhostSample[] = [];
    const lanes = [-2.8, 0, 2.8];
    let laneIdx = 1;
    for (let i = 0; i <= 450; i++) {
      const t = i * 0.1;
      if (i % 28 === 0) {
        laneIdx = (laneIdx + 1) % 3;
      }
      const jumpPhase = i % 34;
      const y = jumpPhase < 8 ? Math.sin((jumpPhase / 8) * Math.PI) * 2.4 : 0;
      samples.push({
        t,
        score: t * 11.2,
        x: lanes[laneIdx],
        y,
        duck: i % 53 < 6 && y === 0 ? 1 : 0,
      });
    }
    return {
      maxScore: 500,
      samples,
    };
  }
}
