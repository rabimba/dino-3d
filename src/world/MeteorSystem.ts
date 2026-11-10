import * as THREE from 'three';
import { CONFIG } from '../core/Config';
import type { LaneIndex, MeteorStrike } from '../core/Types';

interface MeteorVisual {
  strike: MeteorStrike;
  group: THREE.Group;
  fireball: THREE.Mesh;
  tailMesh: THREE.Mesh;
  outerRing: THREE.Mesh;
  innerDisc: THREE.Mesh;
  shockwaveRing: THREE.Mesh;
  shockwaveMat: THREE.MeshBasicMaterial;
}

export interface MeteorStepEvents {
  spawnedCount: number;
  impacts: Array<{ lane: LaneIndex; x: number; y: number; z: number }>;
}

export class MeteorSystem {
  public readonly root = new THREE.Group();
  public readonly skyCometGroup = new THREE.Group();
  public readonly meteorLight = new THREE.PointLight(0xff6b1a, 0, 32, 1.4);
  public strikes: MeteorStrike[] = [];

  private visuals: MeteorVisual[] = [];
  private nextId = 1;
  private spawnTimer = 1.6;
  private lastLane: LaneIndex = 1;

  private readonly fireballGeo = new THREE.DodecahedronGeometry(0.62, 1);
  private readonly tailGeo: THREE.ConeGeometry;
  private readonly outerRingGeo: THREE.RingGeometry;
  private readonly innerDiscGeo: THREE.CircleGeometry;
  private readonly shockwaveGeo: THREE.RingGeometry;

  private readonly fireballMat = new THREE.MeshStandardMaterial({
    color: 0xffdd55,
    emissive: 0xff4800,
    emissiveIntensity: 2.6,
    roughness: 0.3,
  });

  private readonly tailMat = new THREE.MeshBasicMaterial({
    color: 0xff6d00,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  private readonly reticleMat = new THREE.MeshBasicMaterial({
    color: 0xff3b1f,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });

  private readonly innerDiscMat = new THREE.MeshBasicMaterial({
    color: 0xff9e00,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  constructor() {
    this.tailGeo = new THREE.ConeGeometry(0.55, 4.8, 10, 1, true);
    this.outerRingGeo = new THREE.RingGeometry(1.18, 1.42, 28);
    this.outerRingGeo.rotateX(-Math.PI * 0.5);

    this.innerDiscGeo = new THREE.CircleGeometry(1.22, 24);
    this.innerDiscGeo.rotateX(-Math.PI * 0.5);

    this.shockwaveGeo = new THREE.RingGeometry(0.6, 1.0, 28);
    this.shockwaveGeo.rotateX(-Math.PI * 0.5);

    // Fractured Chicxulub Skybox Comet (visible high in horizon during Act IV+)
    const nucleus = new THREE.Mesh(
      new THREE.DodecahedronGeometry(2.4, 1),
      new THREE.MeshBasicMaterial({ color: 0xffe599 })
    );
    const coma = new THREE.Mesh(
      new THREE.ConeGeometry(4.5, 28, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff5522,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    coma.rotation.z = -1.15;
    coma.position.set(12, 5.5, 0);
    this.skyCometGroup.add(nucleus, coma);
    this.skyCometGroup.position.set(-18, 36, -110);
    this.skyCometGroup.visible = false;
    this.root.add(this.skyCometGroup);
    this.root.add(this.meteorLight);
  }

  public reset(): void {
    for (const v of this.visuals) {
      this.root.remove(v.group);
    }
    this.strikes = [];
    this.visuals = [];
    this.spawnTimer = 0.35;
    this.skyCometGroup.visible = false;
    this.meteorLight.intensity = 0;
  }

  public update(
    dt: number,
    runSpeed: number,
    enabled: boolean,
    spawnInterval: number,
    dinoLane: LaneIndex
  ): MeteorStepEvents {
    const events: MeteorStepEvents = {
      spawnedCount: 0,
      impacts: [],
    };

    this.skyCometGroup.visible = enabled;
    if (enabled) {
      this.skyCometGroup.rotation.z = Math.sin(performance.now() * 0.0007) * 0.04;
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = spawnInterval * (0.82 + Math.random() * 0.36);
        // Pick a lane: 50% chance to pressure Dino's current lane, never repeating 3x identically
        let lane: LaneIndex =
          Math.random() < 0.5 ? dinoLane : (Math.floor(Math.random() * 3) as LaneIndex);
        if (lane === this.lastLane && Math.random() < 0.55) {
          lane = ((lane + 1 + Math.floor(Math.random() * 2)) % 3) as LaneIndex;
        }
        this.lastLane = lane;
        this.spawnMeteor(lane, runSpeed);
        events.spawnedCount += 1;
      }
    }

    const dz = runSpeed * dt;
    let closestDistSq = Infinity;
    let lightX = 0;
    let lightY = 4;
    let lightZ = -10;
    let hasActiveFireball = false;

    for (let i = this.visuals.length - 1; i >= 0; i--) {
      const vis = this.visuals[i];
      const m = vis.strike;

      // Ground target scrolls naturally with the desert track!
      m.z += dz;

      if (!m.impacted) {
        m.timer -= dt;
        const progress = 1 - Math.max(0, m.timer) / m.totalTime;

        // Pulse & fill target bullseye ring
        vis.outerRing.position.set(m.x, m.targetY + 0.05, m.z);
        const pulse = 1.0 + Math.sin(progress * Math.PI * 10) * 0.08;
        vis.outerRing.scale.setScalar(pulse);

        vis.innerDisc.position.set(m.x, m.targetY + 0.04, m.z);
        vis.innerDisc.scale.setScalar(Math.max(0.08, progress));

        // Interpolate fireball streak diagonally from upper skybox to target point
        const curX = m.startX + (m.x - m.startX) * progress;
        const curY = m.startY + (m.targetY - m.startY) * progress;
        const curZ = m.z + m.startZOffset * (1 - progress);
        vis.fireball.position.set(curX, curY, curZ);
        vis.fireball.rotation.x += dt * 7;
        vis.fireball.rotation.y += dt * 5;

        const dSq = curX * curX + curY * curY + curZ * curZ;
        if (dSq < closestDistSq) {
          closestDistSq = dSq;
          lightX = curX;
          lightY = Math.max(1.5, curY);
          lightZ = curZ;
          hasActiveFireball = true;
        }

        // Orient fiery tail opposite velocity vector
        const dirVec = new THREE.Vector3(
          m.startX - m.x,
          m.startY - m.targetY,
          m.startZOffset
        ).normalize();
        vis.tailMesh.position.set(
          curX + dirVec.x * 2.2,
          curY + dirVec.y * 2.2,
          curZ + dirVec.z * 2.2
        );
        vis.tailMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVec);

        if (m.timer <= 0) {
          m.impacted = true;
          m.blastTimer = 0.16;
          vis.fireball.visible = false;
          vis.tailMesh.visible = false;
          vis.outerRing.visible = false;
          vis.innerDisc.visible = false;
          vis.shockwaveRing.visible = true;
          vis.shockwaveRing.position.set(m.x, m.targetY + 0.08, m.z);
          vis.shockwaveRing.scale.setScalar(0.5);
          events.impacts.push({ lane: m.lane, x: m.x, y: m.targetY, z: m.z });
        }
      } else {
        m.blastTimer -= dt;
        vis.shockwaveRing.position.set(m.x, m.targetY + 0.08, m.z);
        vis.shockwaveRing.scale.addScalar(dt * 14);
        vis.shockwaveMat.opacity = Math.max(0, vis.shockwaveMat.opacity - dt * 2.8);

        if (vis.shockwaveMat.opacity <= 0.01 || m.z > CONFIG.DESPAWN_Z) {
          m.active = false;
          this.root.remove(vis.group);
          this.visuals.splice(i, 1);
          const idx = this.strikes.indexOf(m);
          if (idx >= 0) this.strikes.splice(idx, 1);
        }
      }
    }

    if (hasActiveFireball) {
      this.meteorLight.position.set(lightX, lightY, lightZ);
      this.meteorLight.intensity = 18;
    } else {
      this.meteorLight.intensity = Math.max(0, this.meteorLight.intensity - dt * 35);
    }

    return events;
  }

  private spawnMeteor(lane: LaneIndex, runSpeed: number): void {
    const x = CONFIG.LANES[lane];
    // Impact occurs between z = -2 and z = -15 ahead of Dino, so initial Z is further negative!
    const desiredImpactZ = -2.5 - Math.random() * 13.0;
    const initialZ = desiredImpactZ - runSpeed * CONFIG.METEOR_WARNING_TIME;

    const strike: MeteorStrike = {
      id: this.nextId++,
      lane,
      x,
      targetY: 0,
      z: initialZ,
      startX: x + (Math.random() - 0.5) * 14,
      startY: CONFIG.METEOR_START_HEIGHT,
      startZOffset: -18,
      timer: CONFIG.METEOR_WARNING_TIME,
      totalTime: CONFIG.METEOR_WARNING_TIME,
      impacted: false,
      blastTimer: 0,
      active: true,
    };

    const group = new THREE.Group();
    const fireball = new THREE.Mesh(this.fireballGeo, this.fireballMat);
    const tailMesh = new THREE.Mesh(this.tailGeo, this.tailMat);
    const outerRing = new THREE.Mesh(this.outerRingGeo, this.reticleMat);
    const innerDisc = new THREE.Mesh(this.innerDiscGeo, this.innerDiscMat);

    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const shockwaveRing = new THREE.Mesh(this.shockwaveGeo, shockwaveMat);
    shockwaveRing.visible = false;

    group.add(fireball, tailMesh, outerRing, innerDisc, shockwaveRing);
    this.root.add(group);

    this.strikes.push(strike);
    this.visuals.push({
      strike,
      group,
      fireball,
      tailMesh,
      outerRing,
      innerDisc,
      shockwaveRing,
      shockwaveMat,
    });
  }
}
