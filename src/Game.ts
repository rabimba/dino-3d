import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { CollisionSystem } from './core/CollisionSystem';
import { CONFIG } from './core/Config';
import { DinoController } from './core/DinoController';
import { StoryDirector } from './core/StoryDirector';
import type { DirectorSnapshot, GamePhase } from './core/Types';
import { DinoMesh } from './entities/DinoMesh';
import { InputManager } from './systems/InputManager';
import { SoundManager } from './systems/SoundManager';
import { HudOverlay } from './ui/HudOverlay';
import { CameraRig } from './world/CameraRig';
import { ChronoGhostSystem } from './world/ChronoGhostSystem';
import { EnvironmentRenderer } from './world/EnvironmentRenderer';
import { MeteorSystem } from './world/MeteorSystem';
import { TrackManager } from './world/TrackManager';
import { WifiBossSystem } from './world/WifiBossSystem';

const FIXED_DT = 1 / 120;

export class Game {
  public phase: GamePhase = 'prologue';
  public score = 0;
  public runSpeed: number = CONFIG.INITIAL_SPEED;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;

  public readonly director = new StoryDirector();
  public readonly dinoController = new DinoController();
  public readonly collisionSystem = new CollisionSystem();
  public readonly dinoMesh = new DinoMesh();
  public readonly trackManager = new TrackManager();
  public readonly meteorSystem = new MeteorSystem();
  public readonly wifiBoss: WifiBossSystem;
  public readonly chronoGhost: ChronoGhostSystem;
  public readonly environment: EnvironmentRenderer;
  public readonly cameraRig: CameraRig;
  public readonly input: InputManager;
  public readonly sound = new SoundManager();
  public readonly hud: HudOverlay;

  private directorSnap: DirectorSnapshot;
  private lastFrameTime = 0;
  private accumulator = 0;
  private lastMilestone = 0;
  private gameOverLockTimer = 0;
  private totalSmashes = 0;
  private totalNearMisses = 0;
  private initialStartScore = 0;
  private forceWifiBoss = false;
  private forceChronoReady = false;
  private forceMegaReady = false;

  constructor(canvas: HTMLCanvasElement) {
    const params = new URLSearchParams(window.location.search);
    const parsedStart = Number(params.get('startScore') ?? '0');
    if (Number.isFinite(parsedStart) && parsedStart > 0) {
      this.initialStartScore = parsedStart;
    }
    this.forceWifiBoss = params.get('wifiBoss') === '1';
    this.forceChronoReady = params.get('chronoReady') === '1';
    this.forceMegaReady = params.get('megaReady') === '1';

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.cameraRig = new CameraRig(window.innerWidth / Math.max(1, window.innerHeight));

    this.environment = new EnvironmentRenderer(this.scene);
    this.wifiBoss = new WifiBossSystem(this.forceWifiBoss);
    this.chronoGhost = new ChronoGhostSystem(this.forceChronoReady);

    this.scene.add(this.environment.root);
    this.scene.add(this.trackManager.root);
    this.scene.add(this.meteorSystem.root);
    this.scene.add(this.wifiBoss.root);
    this.scene.add(this.chronoGhost.root);
    this.scene.add(this.dinoMesh.root);
    this.scene.add(this.dinoMesh.shadowMesh);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.cameraRig.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.52,
      0.35,
      1.02
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.input = new InputManager(canvas);
    this.hud = new HudOverlay({
      onRestart: () => this.startNewRun(),
      onDashClick: () => this.input.triggerDashFromUi(),
      onMegaClick: () => this.input.triggerMegaFromUi(),
      onCameraClick: () => {
        const mode = this.cameraRig.cycleMode();
        this.hud.updateCameraLabel(mode);
      },
      onMuteClick: () => {
        const muted = this.sound.toggleMute();
        this.hud.updateMuteLabel(muted);
      },
      onPauseClick: () => this.togglePause(),
    });

    this.directorSnap = this.director.update(0, 0);
    this.dinoMesh.sync(0, this.dinoController.state, 0, this.directorSnap.palette, true, false);
    this.environment.update(0, 0, this.directorSnap.palette, false, false, false);
    this.hud.setPhase('prologue');

    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  public start(): void {
    this.lastFrameTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.cameraRig.resize(w, h);
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.resolution.set(w, h);
  };

  private onVisibilityChange = (): void => {
    if (document.hidden && this.phase === 'running') {
      this.phase = 'paused';
      this.hud.setPhase('paused');
    }
  };

  public togglePause(): void {
    if (this.phase === 'running') {
      this.phase = 'paused';
      this.hud.setPhase('paused');
    } else if (this.phase === 'paused') {
      this.phase = 'running';
      this.hud.setPhase('running');
      this.lastFrameTime = performance.now();
    }
  }

  public startNewRun(): void {
    this.director.reset();
    this.dinoController.reset();
    this.trackManager.reset();
    this.meteorSystem.reset();
    this.input.clearQueuedActions();

    this.score = this.initialStartScore;
    this.wifiBoss.reset(this.score, this.forceWifiBoss);
    this.chronoGhost.resetForNewRun(this.forceChronoReady);
    if (this.forceMegaReady) {
      this.dinoController.state.rage = CONFIG.MEGA_RAGE_MAX;
    }

    this.lastMilestone = Math.floor(this.score / CONFIG.MILESTONE_INTERVAL);
    this.totalSmashes = 0;
    this.totalNearMisses = 0;
    this.phase = 'running';

    this.dinoController.state.vy = CONFIG.JUMP_VELOCITY * 0.88;
    this.dinoController.state.isGrounded = false;
    this.dinoController.state.jumpsRemaining = 1;
    this.sound.playJump(false);

    this.directorSnap = this.director.update(this.score, 0);
    this.runSpeed = this.directorSnap.targetSpeed;
    this.trackManager.seedInitialTrack(this.directorSnap.act);
    this.trackManager.update(0, this.runSpeed, this.directorSnap.act, this.directorSnap.palette);
    this.hud.setPhase('running');
    this.hud.showActBanner(this.directorSnap.actTitle, this.directorSnap.actSubtitle);
  }

  private loop = (now: number): void => {
    requestAnimationFrame(this.loop);

    const frameDt = Math.min(0.05, Math.max(0, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;

    const toggles = this.input.consumeSystemToggles();
    if (toggles.cameraToggled) {
      const mode = this.cameraRig.cycleMode();
      this.hud.updateCameraLabel(mode);
    }
    if (toggles.muteToggled) {
      const muted = this.sound.toggleMute();
      this.hud.updateMuteLabel(muted);
    }
    if (toggles.pauseToggled) {
      this.togglePause();
    }

    if (this.phase === 'prologue') {
      if (toggles.anyStartPressed) {
        this.startNewRun();
      }
    } else if (this.phase === 'gameover') {
      this.gameOverLockTimer = Math.max(0, this.gameOverLockTimer - frameDt);
      if (toggles.anyStartPressed && this.gameOverLockTimer <= 0) {
        this.startNewRun();
      }
    } else if (this.phase === 'rewinding') {
      const res = this.chronoGhost.stepRewind(
        frameDt,
        this.dinoController.state,
        this.trackManager.obstacles,
        this.trackManager.platforms,
        this.meteorSystem.strikes
      );
      this.score = res.rewoundScore;
      // Sync visual mesh positions while rewinding!
      this.trackManager.update(0, 0, this.directorSnap.act, this.directorSnap.palette);
      if (res.finished) {
        this.phase = 'running';
        this.hud.setPhase('running');
        this.hud.spawnFloatingBonus('TIMELINE RESTORED!');
      }
    } else if (this.phase === 'running') {
      this.accumulator += frameDt;
      while (this.accumulator >= FIXED_DT) {
        this.fixedStep(FIXED_DT);
        this.accumulator -= FIXED_DT;
        if (this.phase !== 'running') {
          this.accumulator = 0;
          break;
        }
      }
    }

    const dino = this.dinoController.state;
    const supportY = this.collisionSystem.computeSupportHeight(
      dino,
      this.trackManager.platforms,
      this.trackManager.obstacles
    );

    this.dinoMesh.sync(
      frameDt,
      dino,
      supportY,
      this.directorSnap.palette,
      this.phase === 'prologue',
      this.chronoGhost.chronoCharges > 0
    );
    this.cameraRig.update(frameDt, this.phase === 'rewinding' ? 'running' : this.phase, dino);

    const isDarkSky = this.directorSnap.isNight || this.directorSnap.act >= 4;
    this.hud.update(frameDt, this.score, this.directorSnap.actTitle, dino.dashCooldown, isDarkSky, {
      chronoArmed: this.chronoGhost.chronoCharges > 0,
      amberFragments: this.chronoGhost.amberFragments,
      rage: dino.rage,
      megaTimer: dino.megaTimer,
      wifiActive: this.wifiBoss.active,
      wifiReconnectPct: this.wifiBoss.reconnectPct,
      wifiRelaysJammed: this.wifiBoss.relaysJammed,
    });

    this.composer.render();
  };

  private fixedStep(dt: number): void {
    const actions = this.input.consumeStepActions();
    const dino = this.dinoController.state;
    const prevLane = dino.lane;

    // 1. Update Story Director, Speed & Score
    this.directorSnap = this.director.update(this.score, dt);
    const dashMult = dino.isDashing ? CONFIG.DASH_SPEED_BOOST : dino.megaTimer > 0 ? 1.18 : 1.0;
    this.runSpeed = this.directorSnap.targetSpeed * dashMult;

    if (this.directorSnap.actChanged) {
      this.hud.showActBanner(this.directorSnap.actTitle, this.directorSnap.actSubtitle);
      this.sound.playMilestone();
    }

    this.score += this.runSpeed * dt * CONFIG.SCORE_PER_UNIT;
    const milestone = Math.floor(this.score / CONFIG.MILESTONE_INTERVAL);
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
      this.sound.playMilestone();
      this.hud.triggerMilestoneFlash(milestone * CONFIG.MILESTONE_INTERVAL);
    }

    // 2. Update Wi-Fi Reconnecting Boss, Track & Meteor Showers
    const wifiEvents = this.wifiBoss.update(dt, this.score, dino.lane);
    if (wifiEvents.justAppeared) {
      this.sound.playWifiAlert();
      this.hud.showActBanner(
        'WARNING · WI-FI SIGNAL RECONNECTING!',
        'Smash 3 cyan Signal Relays with SHIFT Dash or Mega-Rex to stay offline!'
      );
    }
    if (wifiEvents.spawnRelayLane !== null) {
      this.trackManager.spawnBossHazard('wifi_relay', wifiEvents.spawnRelayLane, -94);
    }
    if (wifiEvents.spawn404Lane !== null) {
      this.trackManager.spawnBossHazard('monolith_404', wifiEvents.spawn404Lane, -98);
    }

    this.trackManager.update(dt, this.runSpeed, this.directorSnap.act, this.directorSnap.palette);
    const meteorEvents = this.meteorSystem.update(
      dt,
      this.runSpeed,
      this.directorSnap.meteorsEnabled,
      this.directorSnap.meteorInterval,
      dino.lane
    );

    if (meteorEvents.spawnedCount > 0) {
      this.sound.playMeteorWhistle();
    }
    for (const imp of meteorEvents.impacts) {
      this.trackManager.spawnMeteorCrater(imp.lane, imp.x, imp.y, imp.z);
      this.environment.spawnBurst(imp.x, imp.y + 0.3, imp.z, 22, 0xff5500, 11, 9, 1.35);
      this.cameraRig.addTrauma(0.58);
      this.sound.playMeteorImpact();
    }

    // 3. Step Dino Kinematics
    const supportY = this.collisionSystem.computeSupportHeight(
      dino,
      this.trackManager.platforms,
      this.trackManager.obstacles
    );
    this.dinoController.step(dt, actions, supportY, this.runSpeed);

    if (dino.justActivatedMega) {
      this.sound.playMegaActivate();
      this.cameraRig.addTrauma(0.65);
      this.hud.spawnFloatingBonus('MEGA-REX UNLEASHED!');
      this.environment.spawnBurst(dino.x, dino.y + 1.5, dino.z, 28, 0xffbe0b, 12, 10, 1.5);
    }
    if (dino.justMegaStep) {
      this.sound.playMegaStomp();
      this.cameraRig.addTrauma(0.18);
      this.environment.spawnBurst(dino.x, dino.y + 0.1, dino.z, 6, 0xd4a373, 5, 3, 1.0);
    }
    if (dino.lane !== prevLane) {
      this.sound.playLaneShift();
      this.environment.spawnBurst(dino.x, dino.y + 0.1, dino.z, 4, 0xd4a373, 3.5, 2.5, 0.7);
    }
    if (dino.justJumped) {
      this.sound.playJump(false);
      this.environment.spawnBurst(dino.x, dino.y + 0.1, dino.z, 6, 0xd8c3a5, 4.0, 3.0, 0.85);
    }
    if (dino.justDoubleJumped) {
      this.sound.playJump(true);
      this.environment.spawnBurst(dino.x, dino.y + 0.3, dino.z, 8, 0xffffff, 5.0, 2.5, 0.8);
    }
    if (dino.justDashed) {
      this.sound.playRoarDash();
      this.cameraRig.addTrauma(0.28);
      this.environment.spawnBurst(dino.x, dino.y + 1.0, dino.z + 0.5, 12, 0xffaa00, 7.0, 3.0, 1.0);
    }
    if (dino.justGroundPounded) {
      this.sound.playGroundPound();
      this.cameraRig.addTrauma(0.45);
      this.environment.spawnBurst(dino.x, dino.y + 0.1, dino.z, 16, 0xe09f3e, 9.5, 4.5, 1.15);
    }

    // 4. Record Chrono History & Animate Crowned Ghost Rival!
    const overtookGhost = this.chronoGhost.recordAndSyncGhost(dt, this.score, this.runSpeed, dino);
    if (overtookGhost) {
      this.score += 100;
      this.sound.playMilestone();
      this.hud.spawnFloatingBonus('+100 RIVAL GHOST OVERTAKEN!');
      this.environment.spawnBurst(dino.x, dino.y + 2.2, dino.z - 2.5, 26, 0xffd166, 10, 9, 1.3);
    }

    // 5. Evaluate Collisions, Mega-Stomps, Wi-Fi Relays & Amber Pickups
    const outcome = this.collisionSystem.evaluate(
      dt,
      dino,
      this.trackManager.platforms,
      this.trackManager.obstacles,
      this.meteorSystem.strikes,
      wifiEvents.activeFiringBeamLane
    );

    if (outcome.steppedTar) {
      this.dinoController.applyTarSlow();
    }

    if (outcome.triggeredGeyserIds.length > 0) {
      this.dinoController.triggerGeyserLaunch();
      this.sound.playGeyser();
      this.environment.spawnBurst(dino.x, dino.y + 0.4, dino.z, 16, 0x90e0ef, 6.0, 12.0, 1.2);
    }

    if (outcome.collectedAmberIds.length > 0) {
      this.sound.playNearMiss();
      this.dinoController.refundDashCooldown(outcome.collectedAmberIds.length * 0.8);
      this.dinoController.addRage(outcome.collectedAmberIds.length * CONFIG.RAGE_PER_AMBER);
      const justArmedChrono = this.chronoGhost.onAmberCollected(outcome.collectedAmberIds.length);
      if (justArmedChrono) {
        this.sound.playMilestone();
        this.hud.spawnFloatingBonus('CHRONO-REWIND ARMED!');
      }
      this.environment.spawnBurst(dino.x, dino.y + 1.2, dino.z, 12, 0xffbe0b, 6.5, 6.0, 1.0);
    }

    const smashTotal = outcome.smashedObstacleIds.length + outcome.megaStompedIds.length;
    if (smashTotal > 0) {
      this.totalSmashes += smashTotal;
      this.dinoController.addRage(outcome.smashedObstacleIds.length * CONFIG.RAGE_PER_SMASH);
      this.sound.playSmash();
      this.cameraRig.addTrauma(0.5);
      this.environment.spawnBurst(dino.x, dino.y + 1.0, dino.z - 1.0, 20, 0xff9f1c, 11.0, 8.0, 1.3);
    }

    for (let i = 0; i < outcome.jammedRelayIds.length; i++) {
      const bossDefeated = this.wifiBoss.onRelayJammed();
      this.environment.spawnBurst(0, 7.5, -24, 24, 0x00e5ff, 14, 6, 1.5);
      if (bossDefeated) {
        this.score += 150;
        this.sound.playMilestone();
        this.cameraRig.addTrauma(0.75);
        this.hud.spawnFloatingBonus('+150 CONNECTION_REFUSED! STAYING OFFLINE!');
        this.environment.spawnBurst(0, 8.5, -25, 45, 0x38bdf8, 18, 12, 1.8);
      }
    }

    if (outcome.nearMissCount > 0) {
      this.totalNearMisses += outcome.nearMissCount;
      this.dinoController.refundDashCooldown(
        outcome.nearMissCount * CONFIG.NEAR_MISS_COOLDOWN_REFUND
      );
      this.dinoController.addRage(outcome.nearMissCount * CONFIG.RAGE_PER_NEAR_MISS);
      this.sound.playNearMiss();
    }

    for (const bonus of outcome.bonusEvents) {
      this.score += bonus.points;
      this.hud.spawnFloatingBonus(bonus.label);
    }

    // 6. Update Scenery & Particles
    this.environment.update(
      dt,
      this.runSpeed,
      this.directorSnap.palette,
      true,
      this.directorSnap.meteorsEnabled,
      this.directorSnap.act >= 3
    );

    // 7. Handle Fatal Hit: Clutch Auto-Mega -> Amber Time-Rewind -> Game Over!
    if (outcome.crashed) {
      // Clutch Save #1: If Rage is at 100%, auto-unleash Mega-Rex instead of dying!
      if (dino.rage >= CONFIG.MEGA_RAGE_MAX && this.dinoController.activateMegaRex()) {
        dino.postRewindGrace = 0.6;
        this.sound.playMegaActivate();
        this.cameraRig.addTrauma(0.7);
        this.hud.spawnFloatingBonus('CLUTCH MEGA-REX SAVE!');
        return;
      }

      // Clutch Save #2: If Amber Chrono-Core is armed, reverse time 2.0 seconds!
      if (this.chronoGhost.canTriggerRewind()) {
        this.chronoGhost.beginRewind();
        this.phase = 'rewinding';
        this.sound.playTimeRewind();
        this.hud.setPhase('rewinding');
        return;
      }

      // Otherwise: Classic Chrome Game Over + Save Ghost if new Best!
      dino.isCrashed = true;
      this.phase = 'gameover';
      this.gameOverLockTimer = 0.38;
      this.chronoGhost.commitRunIfBest(this.score);
      this.sound.playGameOver();
      this.cameraRig.addTrauma(0.75);
      this.hud.setPhase('gameover', {
        score: this.score,
        act: this.directorSnap.act,
        smashes: this.totalSmashes,
        nearMisses: this.totalNearMisses,
      });
    }
  }
}
