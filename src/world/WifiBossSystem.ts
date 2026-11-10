import * as THREE from 'three';
import { CONFIG } from '../core/Config';
import type { LaneIndex } from '../core/Types';
import { buildVoxelGeometry } from './VoxelBuilder';

export interface WifiBossStepEvents {
  justAppeared: boolean;
  spawnRelayLane: LaneIndex | null;
  spawn404Lane: LaneIndex | null;
  activeFiringBeamLane: LaneIndex | null;
  justDefeated: boolean;
  justFiredBeam: boolean;
}

export class WifiBossSystem {
  public readonly root = new THREE.Group();
  public active = false;
  public reconnectPct = 0;
  public relaysJammed = 0;

  private nextTriggerScore: number = CONFIG.WIFI_BOSS_FIRST_SCORE;
  private readonly satelliteGroup = new THREE.Group();
  private readonly warningStripMesh: THREE.Mesh;
  private readonly warningStripMat: THREE.MeshBasicMaterial;
  private readonly laserBeamMesh: THREE.Mesh;
  private readonly laserBeamMat: THREE.MeshBasicMaterial;
  private readonly arcMeshes: THREE.Mesh[] = [];
  private readonly arcMat: THREE.MeshStandardMaterial;

  private beamTargetLane: LaneIndex = 1;
  private beamPhase: 'cooldown' | 'telegraph' | 'firing' = 'cooldown';
  private beamTimer = 1.6;
  private relayDropTimer = 1.2;
  private hitFlashTimer = 0;
  private hoverClock = 0;

  constructor(forceImmediate = false) {
    if (forceImmediate) {
      this.nextTriggerScore = 8;
    }

    // 1. Hovering 3D Voxel Wi-Fi Router Satellite
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.65,
      vertexColors: true,
    });
    const chassisGeo = buildVoxelGeometry([
      { pos: [0, 0, 0], size: [3.2, 1.1, 1.8], color: 0x334155 },
      // Solar wings
      { pos: [-2.8, 0, 0], size: [2.2, 0.18, 1.2], color: 0x0284c7 },
      { pos: [2.8, 0, 0], size: [2.2, 0.18, 1.2], color: 0x0284c7 },
      // Router antennas
      { pos: [-1.1, 1.1, 0], size: [0.18, 1.4, 0.18], color: 0x94a3b8 },
      { pos: [1.1, 1.1, 0], size: [0.18, 1.4, 0.18], color: 0x94a3b8 },
    ]);
    this.satelliteGroup.add(new THREE.Mesh(chassisGeo, chassisMat));

    // Iconic 3 Concentric Glowing Wi-Fi Signal Arcs + Dot!
    this.arcMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x00e5ff,
      emissiveIntensity: 2.3,
      roughness: 0.2,
    });

    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), this.arcMat);
    dot.position.set(0, 1.55, 0.65);
    this.satelliteGroup.add(dot);
    this.arcMeshes.push(dot);

    for (let ring = 1; ring <= 3; ring++) {
      const r = 0.85 + ring * 0.78;
      const arcGeo = new THREE.TorusGeometry(r, 0.18, 8, 20, Math.PI * 0.68);
      const arc = new THREE.Mesh(arcGeo, this.arcMat);
      arc.position.set(0, 1.45, 0.65);
      arc.rotation.z = Math.PI * 0.16;
      this.satelliteGroup.add(arc);
      this.arcMeshes.push(arc);
    }

    this.satelliteGroup.position.set(0, 8.6, -26);
    this.satelliteGroup.visible = false;
    this.root.add(this.satelliteGroup);

    // 2. Ground Lane Scan-Warning Strip
    const stripGeo = new THREE.PlaneGeometry(2.35, 34);
    stripGeo.rotateX(-Math.PI * 0.5);
    this.warningStripMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.warningStripMesh = new THREE.Mesh(stripGeo, this.warningStripMat);
    this.warningStripMesh.position.set(0, 0.06, -12);
    this.warningStripMesh.visible = false;
    this.root.add(this.warningStripMesh);

    // 3. Firing Cyan Laser Beam Curtain
    const beamGeo = new THREE.BoxGeometry(1.65, 9.0, 32);
    this.laserBeamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.laserBeamMesh = new THREE.Mesh(beamGeo, this.laserBeamMat);
    this.laserBeamMesh.position.set(0, 4.5, -12);
    this.laserBeamMesh.visible = false;
    this.root.add(this.laserBeamMesh);
  }

  public reset(startScore = 0, forceImmediate = false): void {
    this.active = false;
    this.reconnectPct = 0;
    this.relaysJammed = 0;
    this.beamPhase = 'cooldown';
    this.beamTimer = 1.6;
    this.relayDropTimer = 1.0;
    this.hitFlashTimer = 0;
    this.satelliteGroup.visible = false;
    this.warningStripMesh.visible = false;
    this.laserBeamMesh.visible = false;

    if (forceImmediate) {
      this.nextTriggerScore = startScore + 5;
    } else {
      this.nextTriggerScore =
        startScore >= CONFIG.WIFI_BOSS_FIRST_SCORE
          ? startScore + 180
          : CONFIG.WIFI_BOSS_FIRST_SCORE;
    }
  }

  public onRelayJammed(): boolean {
    if (!this.active) return false;
    this.relaysJammed += 1;
    this.hitFlashTimer = 0.4;
    this.reconnectPct = Math.max(0, this.reconnectPct - 24);
    if (this.relaysJammed >= CONFIG.WIFI_RELAYS_TO_JAM) {
      this.active = false;
      this.satelliteGroup.visible = false;
      this.warningStripMesh.visible = false;
      this.laserBeamMesh.visible = false;
      return true;
    }
    return false;
  }

  public update(dt: number, score: number, dinoLane: LaneIndex): WifiBossStepEvents {
    const events: WifiBossStepEvents = {
      justAppeared: false,
      spawnRelayLane: null,
      spawn404Lane: null,
      activeFiringBeamLane: null,
      justDefeated: false,
      justFiredBeam: false,
    };

    if (!this.active) {
      if (score >= this.nextTriggerScore) {
        this.active = true;
        this.reconnectPct = 8;
        this.relaysJammed = 0;
        this.beamPhase = 'cooldown';
        this.beamTimer = 1.5;
        this.relayDropTimer = 0.8;
        this.satelliteGroup.visible = true;
        this.nextTriggerScore = score + CONFIG.WIFI_BOSS_INTERVAL;
        events.justAppeared = true;
      } else {
        return events;
      }
    }

    // Reconnection percentage ticks upward (creates urgency to smash Signal Relays!)
    this.reconnectPct = Math.min(99, this.reconnectPct + dt * 5.2);
    this.hoverClock += dt;

    // Hover & hit-recoil animation
    const targetX = CONFIG.LANES[this.beamTargetLane];
    this.satelliteGroup.position.x +=
      (targetX - this.satelliteGroup.position.x) * Math.min(1, dt * 4.2);
    this.satelliteGroup.position.y = 8.4 + Math.sin(this.hoverClock * 3.2) * 0.45;

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
      this.arcMat.emissive.setHex(0xff3b1f);
      this.satelliteGroup.rotation.z = Math.sin(this.hoverClock * 40) * 0.22;
    } else {
      this.arcMat.emissive.setHex(0x00e5ff);
      this.satelliteGroup.rotation.z = Math.sin(this.hoverClock * 1.8) * 0.06;
    }

    // Spawn Signal Relay pylons + 404 Monoliths ahead on the track
    this.relayDropTimer -= dt;
    if (this.relayDropTimer <= 0) {
      this.relayDropTimer = 2.65;
      const relayLane = Math.floor(Math.random() * 3) as LaneIndex;
      const monolithLane = ((relayLane + 1 + Math.floor(Math.random() * 2)) % 3) as LaneIndex;
      events.spawnRelayLane = relayLane;
      events.spawn404Lane = monolithLane;
    }

    // Laser Scan-Beam State Machine: Cooldown -> 1.15s Warning Telegraph -> 0.45s Beam Strike!
    this.beamTimer -= dt;
    if (this.beamPhase === 'cooldown') {
      this.warningStripMesh.visible = false;
      this.laserBeamMesh.visible = false;
      if (this.beamTimer <= 0) {
        this.beamTargetLane = dinoLane;
        this.beamPhase = 'telegraph';
        this.beamTimer = 1.15;
      }
    } else if (this.beamPhase === 'telegraph') {
      const laneX = CONFIG.LANES[this.beamTargetLane];
      this.warningStripMesh.visible = true;
      this.warningStripMesh.position.x = laneX;
      this.warningStripMat.opacity = 0.25 + Math.abs(Math.sin(this.hoverClock * 18)) * 0.45;
      this.laserBeamMesh.visible = false;

      if (this.beamTimer <= 0) {
        this.beamPhase = 'firing';
        this.beamTimer = 0.45;
        events.justFiredBeam = true;
      }
    } else if (this.beamPhase === 'firing') {
      const laneX = CONFIG.LANES[this.beamTargetLane];
      this.warningStripMesh.visible = true;
      this.warningStripMat.opacity = 0.85;
      this.laserBeamMesh.visible = true;
      this.laserBeamMesh.position.x = laneX;
      this.laserBeamMat.opacity = 0.58;
      events.activeFiringBeamLane = this.beamTargetLane;

      if (this.beamTimer <= 0) {
        this.beamPhase = 'cooldown';
        this.beamTimer = 1.85;
      }
    }

    return events;
  }
}
