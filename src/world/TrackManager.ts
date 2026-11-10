import * as THREE from 'three';
import { CONFIG } from '../core/Config';
import type {
  ActId,
  BiomePalette,
  HazardKind,
  LaneIndex,
  ObstacleEntity,
  PlatformEntity,
} from '../core/Types';
import { buildVoxelGeometry } from './VoxelBuilder';

interface ObstacleVisual {
  entity: ObstacleEntity;
  group: THREE.Group;
  leftWing?: THREE.Group;
  rightWing?: THREE.Group;
  shadowMesh?: THREE.Mesh;
}

interface PlatformVisual {
  entity: PlatformEntity;
  group: THREE.Group;
  slabMesh: THREE.Mesh;
}

export class TrackManager {
  public readonly root = new THREE.Group();
  public obstacles: ObstacleEntity[] = [];
  public platforms: PlatformEntity[] = [];

  private obstacleVisuals: ObstacleVisual[] = [];
  private platformVisuals: PlatformVisual[] = [];

  private nextId = 1;
  private distanceUntilNextSpawn = 18;

  // Shared materials updated dynamically by BiomePalette
  private readonly cactusMat = new THREE.MeshStandardMaterial({
    color: 0x4a4a4a,
    roughness: 0.72,
    vertexColors: true,
  });
  private readonly rockMat = new THREE.MeshStandardMaterial({
    color: 0xb85d3b,
    roughness: 0.82,
    vertexColors: true,
  });
  private readonly crackedSeamMat = new THREE.MeshStandardMaterial({
    color: 0xff9f1c,
    emissive: 0xff6b00,
    emissiveIntensity: 1.6,
    roughness: 0.35,
  });
  private readonly pteroMat = new THREE.MeshStandardMaterial({
    color: 0x5c5470,
    roughness: 0.6,
    vertexColors: true,
  });
  private readonly tarMat = new THREE.MeshStandardMaterial({
    color: 0x141118,
    roughness: 0.16,
    metalness: 0.35,
  });
  private readonly geyserMat = new THREE.MeshStandardMaterial({
    color: 0x90e0ef,
    emissive: 0x00b4d8,
    emissiveIntensity: 1.3,
    transparent: true,
    opacity: 0.85,
  });
  private readonly chasmMat = new THREE.MeshBasicMaterial({
    color: 0x08050a,
  });
  private readonly craterLavaMat = new THREE.MeshStandardMaterial({
    color: 0xff4d00,
    emissive: 0xff3300,
    emissiveIntensity: 2.0,
    roughness: 0.4,
  });
  private readonly crumblingMat = new THREE.MeshStandardMaterial({
    color: 0xd97757,
    roughness: 0.85,
    vertexColors: true,
  });
  private readonly shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  private readonly blossomMat = new THREE.MeshStandardMaterial({
    color: 0xff6b8b,
    emissive: 0xff477e,
    emissiveIntensity: 0.45,
    roughness: 0.5,
  });
  private readonly amberMat = new THREE.MeshStandardMaterial({
    color: 0xffbe0b,
    emissive: 0xfb8500,
    emissiveIntensity: 1.55,
    roughness: 0.18,
    metalness: 0.2,
  });
  private readonly bolideMat = new THREE.MeshStandardMaterial({
    color: 0xffe066,
    emissive: 0xff4500,
    emissiveIntensity: 2.4,
    roughness: 0.25,
  });
  private readonly relayGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x00e5ff,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  private readonly monolithMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });
  private showBlossoms = false;

  // Pre-built shared geometries
  private readonly smallCactusGeo: THREE.BufferGeometry;
  private readonly tallCactusGeo: THREE.BufferGeometry;
  private readonly clusterCactusGeo: THREE.BufferGeometry;
  private readonly boulderBaseGeo: THREE.BufferGeometry;
  private readonly pteroBodyGeo: THREE.BufferGeometry;
  private readonly pteroWingGeo: THREE.BufferGeometry;

  constructor() {
    this.smallCactusGeo = buildVoxelGeometry([
      { pos: [0, 0.72, 0], size: [0.42, 1.44, 0.42], color: 0xffffff },
      { pos: [-0.34, 0.82, 0], size: [0.26, 0.18, 0.26], color: 0xf2f2f2 },
      { pos: [-0.42, 1.05, 0], size: [0.22, 0.48, 0.24], color: 0xf2f2f2 },
      { pos: [0.34, 0.66, 0], size: [0.26, 0.18, 0.26], color: 0xf2f2f2 },
      { pos: [0.42, 0.92, 0], size: [0.22, 0.48, 0.24], color: 0xf2f2f2 },
    ]);

    this.tallCactusGeo = buildVoxelGeometry([
      { pos: [0, 1.08, 0], size: [0.5, 2.16, 0.5], color: 0xffffff },
      { pos: [-0.4, 1.18, 0], size: [0.32, 0.22, 0.3], color: 0xededed },
      { pos: [-0.52, 1.56, 0], size: [0.26, 0.72, 0.28], color: 0xededed },
      { pos: [0.4, 0.96, 0], size: [0.32, 0.22, 0.3], color: 0xededed },
      { pos: [0.52, 1.34, 0], size: [0.26, 0.7, 0.28], color: 0xededed },
    ]);

    this.clusterCactusGeo = buildVoxelGeometry([
      // Center tall saguaro
      { pos: [0, 1.02, 0], size: [0.46, 2.04, 0.46], color: 0xffffff },
      // Left companion
      { pos: [-0.62, 0.74, 0.14], size: [0.38, 1.48, 0.38], color: 0xeaeaea },
      { pos: [-0.92, 0.95, 0.14], size: [0.22, 0.45, 0.22], color: 0xeaeaea },
      // Right companion
      { pos: [0.62, 0.82, -0.12], size: [0.4, 1.64, 0.4], color: 0xf4f4f4 },
      { pos: [0.92, 1.08, -0.12], size: [0.22, 0.48, 0.22], color: 0xf4f4f4 },
    ]);

    this.boulderBaseGeo = buildVoxelGeometry([
      { pos: [0, 0.95, 0], size: [1.75, 1.85, 1.65], color: 0xd8a47f },
      { pos: [-0.2, 1.45, 0.1], size: [1.15, 0.85, 1.1], color: 0xc48f6a },
      { pos: [0.3, 0.65, -0.2], size: [1.25, 1.1, 1.25], color: 0xb57d58 },
    ]);

    // Pterodactyl flies toward +Z (facing the player / running Dino!)
    this.pteroBodyGeo = buildVoxelGeometry([
      // Torso
      { pos: [0, 0, 0], size: [0.42, 0.38, 0.95], color: 0xffffff },
      // Head crest (-Z) & pointed beak (+Z toward player)
      { pos: [0, 0.18, -0.35], size: [0.16, 0.24, 0.58], color: 0xe2e2e2 },
      { pos: [0, 0.06, 0.68], size: [0.22, 0.2, 0.72], color: 0xf5cb5c },
    ]);

    this.pteroWingGeo = buildVoxelGeometry([
      { pos: [0.55, 0, 0.04], size: [1.1, 0.09, 0.58], color: 0xf0f0f0 },
      { pos: [1.15, 0.02, -0.06], size: [0.55, 0.07, 0.36], color: 0xdadada },
    ]);
  }

  public reset(): void {
    for (const v of this.obstacleVisuals) {
      this.root.remove(v.group);
    }
    for (const p of this.platformVisuals) {
      this.root.remove(p.group);
    }
    this.obstacles = [];
    this.platforms = [];
    this.obstacleVisuals = [];
    this.platformVisuals = [];
    this.distanceUntilNextSpawn = 6;
  }

  /**
   * Pre-populates initial hazards & platforms starting safely ~2.2s ahead (z = -38..-92)
   * so the 3D canyon feels immediately alive the moment the camera swings behind Rex.
   */
  public seedInitialTrack(act: ActId): void {
    let cursorZ = -38;
    for (let i = 0; i < 3; i++) {
      const len = this.spawnPatternForAct(act, cursorZ);
      cursorZ -= len + 18;
    }
    this.distanceUntilNextSpawn = 8;
  }

  public update(dt: number, runSpeed: number, act: ActId, palette: BiomePalette): void {
    // Sync dynamic biome colors
    this.cactusMat.color.setRGB(
      palette.cactusColor.r,
      palette.cactusColor.g,
      palette.cactusColor.b
    );
    this.rockMat.color.setRGB(
      palette.canyonRock.r * 1.12,
      palette.canyonRock.g * 1.12,
      palette.canyonRock.b * 1.12
    );
    if (palette.saturationMix < 0.25) {
      this.pteroMat.color.setHex(0x535353);
      this.showBlossoms = false;
    } else {
      this.pteroMat.color.setHex(palette.isNight ? 0xb8c0ff : 0x6d597a);
      this.showBlossoms = true;
    }

    const dz = runSpeed * dt;

    // 1. Advance existing obstacles & animate flapping wings / shattered hides
    for (let i = this.obstacleVisuals.length - 1; i >= 0; i--) {
      const vis = this.obstacleVisuals[i];
      const obs = vis.entity;
      const extraSpeed =
        obs.kind === 'pterodactyl'
          ? runSpeed * 0.18 * dt
          : obs.kind === 'meteor_bolide'
          ? runSpeed * 0.36 * dt
          : 0;
      obs.z += dz + extraSpeed;

      if (!obs.active || obs.shattered || obs.z > CONFIG.DESPAWN_Z) {
        if (obs.z > CONFIG.DESPAWN_Z || !obs.active) {
          this.root.remove(vis.group);
          this.obstacleVisuals.splice(i, 1);
          const idx = this.obstacles.indexOf(obs);
          if (idx >= 0) this.obstacles.splice(idx, 1);
          continue;
        }
      }

      vis.group.position.set(obs.x, obs.y, obs.z);

      if (obs.kind === 'amber_pickup') {
        vis.group.rotation.y += dt * 3.2;
        vis.group.position.y = obs.y + Math.sin(performance.now() * 0.005 + obs.id) * 0.14;
      } else if (obs.kind === 'meteor_bolide') {
        vis.group.rotation.z += dt * 9.0;
      } else if (obs.kind === 'pterodactyl' && vis.leftWing && vis.rightWing) {
        obs.wingPhase = (obs.wingPhase ?? 0) + dt * 11.5;
        const flap = Math.sin(obs.wingPhase) * 0.58;
        vis.leftWing.rotation.z = -flap;
        vis.rightWing.rotation.z = flap;
        if (vis.shadowMesh) {
          vis.shadowMesh.position.set(0, -obs.y + 0.04, 0);
        }
      }
    }

    // 2. Advance platforms & animate crumbling bridges
    for (let i = this.platformVisuals.length - 1; i >= 0; i--) {
      const pvis = this.platformVisuals[i];
      const plat = pvis.entity;
      plat.z += dz;

      if (plat.z - plat.length * 0.5 > CONFIG.DESPAWN_Z) {
        plat.active = false;
        this.root.remove(pvis.group);
        this.platformVisuals.splice(i, 1);
        const idx = this.platforms.indexOf(plat);
        if (idx >= 0) this.platforms.splice(idx, 1);
        continue;
      }

      if (plat.collapsed) {
        pvis.group.position.y -= 22 * dt;
        pvis.group.rotation.x += 1.8 * dt;
      } else {
        let jitterX = 0;
        if (plat.isCrumbling && plat.steppedOn) {
          jitterX = Math.sin(performance.now() * 0.08) * 0.09;
        }
        pvis.group.position.set(plat.x + jitterX, 0, plat.z);
      }
    }

    // 3. Stream new obstacle/platform patterns ahead
    this.distanceUntilNextSpawn -= dz;
    if (this.distanceUntilNextSpawn <= 0) {
      const patternLength = this.spawnPatternForAct(act, CONFIG.SPAWN_Z);
      const speedFactor = runSpeed / CONFIG.INITIAL_SPEED;
      const gap = CONFIG.CHUNK_MIN_GAP * (0.85 + speedFactor * 0.34) + Math.random() * 6.5;
      this.distanceUntilNextSpawn = patternLength + gap;
    }
  }

  public spawnBossHazard(kind: 'wifi_relay' | 'monolith_404', lane: LaneIndex, z = -92): void {
    this.addObstacle(kind, lane, 0, z);
  }

  public spawnMeteorCrater(lane: LaneIndex, x: number, y: number, z: number): void {
    // 25% of meteor impacts blast up an angled obsidian launch ramp over surrounding hazards!
    if (Math.random() < 0.25 && z < -6) {
      this.addPlatform(lane, 2.2, z - 2.6, 6.8, true, false);
      this.addObstacle('amber_pickup', lane, 2.35, z - 5.2);
      return;
    }

    const obs: ObstacleEntity = {
      id: this.nextId++,
      kind: 'meteor_crater',
      lane,
      laneSpan: 1,
      x,
      y,
      z,
      width: 2.0,
      height: 1.15,
      depth: 2.0,
      active: true,
      shattered: false,
      nearMissAwarded: false,
    };

    const group = new THREE.Group();
    const rimGeo = new THREE.TorusGeometry(0.92, 0.34, 8, 14);
    rimGeo.rotateX(Math.PI * 0.5);
    const rimMesh = new THREE.Mesh(rimGeo, this.rockMat);
    rimMesh.position.y = 0.26;
    rimMesh.castShadow = true;

    const coreGeo = new THREE.CylinderGeometry(0.75, 0.65, 0.22, 12);
    const coreMesh = new THREE.Mesh(coreGeo, this.craterLavaMat);
    coreMesh.position.y = 0.12;

    group.add(rimMesh, coreMesh);
    group.position.set(x, y, z);

    this.root.add(group);
    this.obstacles.push(obs);
    this.obstacleVisuals.push({ entity: obs, group });
  }

  private spawnPatternForAct(act: ActId, baseZ: number): number {
    const roll = Math.random();

    // Act I: Classic Cacti + Gentle Introductory Sandstone Ramps
    if (act === 1) {
      if (roll < 0.35) {
        // Single small or tall cactus in random lane (often center so player has to jump or switch!)
        const lane = (Math.random() < 0.55 ? 1 : Math.floor(Math.random() * 3)) as LaneIndex;
        const kind: HazardKind = Math.random() < 0.6 ? 'cactus_small' : 'cactus_tall';
        this.addObstacle(kind, lane, 0, baseZ);
        return 4;
      } else if (roll < 0.72) {
        // Two-lane staggered or paired cacti leaving 1 open lane + jumpable height
        const openLane = Math.floor(Math.random() * 3) as LaneIndex;
        for (let l = 0; l < 3; l++) {
          if (l === openLane) continue;
          this.addObstacle(
            l === 1 ? 'cactus_cluster' : 'cactus_small',
            l as LaneIndex,
            0,
            baseZ - (l * 1.2)
          );
        }
        return 6;
      } else {
        // Introductory sandstone ramp + low plateau on one lane with cacti on ground beside it!
        const rampLane = Math.floor(Math.random() * 3) as LaneIndex;
        this.addPlatform(rampLane, 2.2, baseZ - 4, 8.0, true, false);
        this.addPlatform(rampLane, 2.2, baseZ - 14, 12.0, false, false);
        this.addObstacle('amber_pickup', rampLane, 2.35, baseZ - 12);
        this.addObstacle('amber_pickup', rampLane, 2.35, baseZ - 16);
        const otherLane = ((rampLane + 1) % 3) as LaneIndex;
        this.addObstacle('cactus_tall', otherLane, 0, baseZ - 12);
        return 22;
      }
    }

    // Act II: Pterodactyls (3 altitudes), Cracked Boulders, Rock Arches & Tier-1 Plateaus
    if (act === 2) {
      if (roll < 0.28) {
        // Swooping Pterodactyl squadron across 2 lanes
        const altOptions: Array<'low' | 'mid' | 'high'> = ['low', 'mid', 'high'];
        const alt = altOptions[Math.floor(Math.random() * altOptions.length)];
        const primaryLane = 1 as LaneIndex;
        const secondLane = (Math.random() < 0.5 ? 0 : 2) as LaneIndex;
        this.addPterodactyl(primaryLane, alt, baseZ);
        this.addPterodactyl(secondLane, alt === 'low' ? 'mid' : 'low', baseZ - 5.5);
        return 10;
      } else if (roll < 0.55) {
        // Cracked Smashable Boulder + Cacti flanking it (encourages SHIFT Roar-Dash or lane dodge!)
        const boulderLane = 1 as LaneIndex;
        this.addObstacle('boulder_cracked', boulderLane, 0, baseZ);
        const sideLane = (Math.random() < 0.5 ? 0 : 2) as LaneIndex;
        this.addObstacle('cactus_cluster', sideLane, 0, baseZ - 1.5);
        return 6;
      } else if (roll < 0.78) {
        // Low Rock Arch (Duck-Slide tunnel!) + tall cactus beside it
        const archLane = (Math.random() < 0.6 ? 1 : 0) as LaneIndex;
        this.addObstacle('rock_arch', archLane, 0, baseZ);
        this.addObstacle('cactus_tall', ((archLane + 1) % 3) as LaneIndex, 0, baseZ);
        return 6;
      } else {
        // Elevated Tier-1 Plateau chain with Amber crystals & cracked boulder reward on top!
        const lane = Math.floor(Math.random() * 3) as LaneIndex;
        this.addPlatform(lane, 2.2, baseZ - 4, 8.0, true, false);
        this.addPlatform(lane, 2.2, baseZ - 15, 14.0, false, false);
        this.addObstacle('amber_pickup', lane, 2.35, baseZ - 11);
        this.addObstacle('boulder_cracked', lane, 2.2, baseZ - 17);
        this.addObstacle('cactus_cluster', ((lane + 2) % 3) as LaneIndex, 0, baseZ - 10);
        return 24;
      }
    }

    // Act III, IV & V: Chasms, Crumbling Bridges, Steam Geysers to Tier-2, Tar Patches & Combined Gauntlets
    if (roll < 0.24) {
      // Canyon Chasm across 2 lanes (or all 3 with a bridge / jumpable gap!)
      const safeLane = Math.floor(Math.random() * 3) as LaneIndex;
      for (let l = 0; l < 3; l++) {
        this.addObstacle('chasm', l as LaneIndex, 0, baseZ - 4);
      }
      // Crumbling stone bridge spanning the chasm on safeLane!
      this.addPlatform(safeLane, 0.15, baseZ - 4, 8.5, false, true);
      // Plus a cracked boulder just after on another lane
      this.addObstacle('boulder_cracked', ((safeLane + 1) % 3) as LaneIndex, 0, baseZ - 13);
      return 18;
    } else if (roll < 0.48) {
      // Steam Geyser Launchpad -> Tier-2 Sky Mesa with Amber Crystal cache!
      const geyserLane = 1 as LaneIndex;
      this.addObstacle('geyser', geyserLane, 0, baseZ - 2);
      this.addPlatform(geyserLane, 4.4, baseZ - 16, 16.0, false, false);
      this.addObstacle('amber_pickup', geyserLane, 4.55, baseZ - 12);
      this.addObstacle('amber_pickup', geyserLane, 4.55, baseZ - 15);
      this.addObstacle('boulder_cracked', geyserLane, 4.4, baseZ - 19);
      // Ground hazards below the sky mesa for anyone staying low
      this.addObstacle('cactus_tall', 0, 0, baseZ - 12);
      this.addObstacle(act >= 4 ? 'meteor_bolide' : 'rock_arch', 2, 0, baseZ - 15);
      return 26;
    } else if (roll < 0.72) {
      // Multi-tier crumbling bridge hop + swooping Pterodactyls
      const startLane = (Math.random() < 0.5 ? 0 : 2) as LaneIndex;
      this.addPlatform(startLane, 2.2, baseZ - 4, 8.0, true, false);
      this.addPlatform(startLane, 2.2, baseZ - 14, 9.5, false, true);
      this.addPlatform(1, 2.2, baseZ - 25, 11.0, false, true);
      this.addObstacle('tar_patch', ((startLane + 1) % 3) as LaneIndex, 0, baseZ - 9);
      this.addPterodactyl(1, 'mid', baseZ - 11);
      return 32;
    } else {
      // High-intensity slalom: Tar + Cracked Boulder + Pterodactyl + Chasm
      this.addObstacle('tar_patch', 0, 0, baseZ - 2);
      this.addObstacle('boulder_cracked', 1, 0, baseZ - 4);
      this.addObstacle('cactus_cluster', 2, 0, baseZ - 4);
      this.addPterodactyl(1, 'mid', baseZ - 13);
      this.addObstacle('chasm', 0, 0, baseZ - 14);
      return 20;
    }
  }

  private addObstacle(kind: HazardKind, lane: LaneIndex, baseY: number, z: number): void {
    const x = CONFIG.LANES[lane];
    let width = 1.2;
    let height = 1.45;
    let depth = 1.1;

    const group = new THREE.Group();

    switch (kind) {
      case 'cactus_small': {
        width = 1.15;
        height = 1.44;
        depth = 0.9;
        const m = new THREE.Mesh(this.smallCactusGeo, this.cactusMat);
        m.castShadow = true;
        group.add(m);
        if (this.showBlossoms) {
          const fl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.2), this.blossomMat);
          fl.position.set(0, 1.5, 0);
          group.add(fl);
        }
        break;
      }
      case 'cactus_tall': {
        width = 1.35;
        height = 2.15;
        depth = 1.0;
        const m = new THREE.Mesh(this.tallCactusGeo, this.cactusMat);
        m.castShadow = true;
        group.add(m);
        if (this.showBlossoms) {
          const fl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.24), this.blossomMat);
          fl.position.set(0, 2.22, 0);
          group.add(fl);
        }
        break;
      }
      case 'amber_pickup': {
        width = 1.05;
        height = 1.1;
        depth = 1.05;
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.46, 0), this.amberMat);
        gem.position.y = 0.58;
        gem.castShadow = true;
        group.add(gem);
        break;
      }
      case 'meteor_bolide': {
        // Head-height skimming fireball — duck/slide right underneath!
        width = 1.85;
        height = 0.95;
        depth = 1.8;
        baseY += 1.26;
        const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.54, 1), this.bolideMat);
        head.position.y = 0.45;
        const wake = new THREE.Mesh(
          new THREE.ConeGeometry(0.48, 3.2, 10, 1, true),
          new THREE.MeshBasicMaterial({
            color: 0xff6d00,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        wake.rotation.x = -Math.PI * 0.5;
        wake.position.set(0, 0.45, -1.7);
        const shadowGeo = new THREE.CircleGeometry(0.7, 14);
        shadowGeo.rotateX(-Math.PI * 0.5);
        const sh = new THREE.Mesh(shadowGeo, this.shadowMat);
        sh.position.set(0, -baseY + 0.04, 0);
        group.add(head, wake, sh);
        break;
      }
      case 'wifi_relay': {
        // Smashable Signal Relay Pylon — Dash, Ground-Pound, or Mega-Stomp to jam Wi-Fi!
        width = 1.65;
        height = 2.25;
        depth = 1.5;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.82, 0.55, 8), this.monolithMat);
        base.position.y = 0.28;
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.5, 8), this.relayGlowMat);
        mast.position.y = 1.15;
        const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), this.relayGlowMat);
        orb.position.y = 2.05;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.09, 6, 16), this.relayGlowMat);
        ring.rotation.x = Math.PI * 0.5;
        ring.position.y = 1.35;
        group.add(base, mast, orb, ring);
        break;
      }
      case 'monolith_404': {
        // Glitching tall browser 404 Monolith block
        width = 1.95;
        height = 2.55;
        depth = 1.35;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.55, 1.3), this.monolithMat);
        slab.position.y = 1.28;
        slab.castShadow = true;
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.22, 1.36), this.relayGlowMat);
        stripe.position.y = 1.95;
        group.add(slab, stripe);
        break;
      }
      case 'cactus_cluster': {
        width = 2.15;
        height = 2.02;
        depth = 1.25;
        const m = new THREE.Mesh(this.clusterCactusGeo, this.cactusMat);
        m.castShadow = true;
        group.add(m);
        break;
      }
      case 'boulder_cracked': {
        width = 1.85;
        height = 1.9;
        depth = 1.7;
        const rock = new THREE.Mesh(this.boulderBaseGeo, this.rockMat);
        rock.castShadow = true;
        // Glowing amber crack seams signaling smashability!
        const seam1 = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.14, 1.72), this.crackedSeamMat);
        seam1.position.y = 0.95;
        seam1.rotation.z = 0.28;
        const seam2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 1.72), this.crackedSeamMat);
        seam2.position.y = 0.95;
        seam2.rotation.x = -0.2;
        group.add(rock, seam1, seam2);
        break;
      }
      case 'rock_arch': {
        // Overhead lintel beam: pillars sit at lane edges visually while hurtbox is the overhead lintel!
        width = 2.1;
        height = 1.55; // Hurtbox spans from y = baseY + 1.22 up to baseY + 2.77
        depth = 1.4;
        baseY += 1.22;
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.55, 1.35, 1.4), this.rockMat);
        lintel.position.y = 0.72;
        lintel.castShadow = true;
        const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.3, 1.3), this.rockMat);
        leftPillar.position.set(-1.12, -0.58, 0);
        leftPillar.castShadow = true;
        const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.3, 1.3), this.rockMat);
        rightPillar.position.set(1.12, -0.58, 0);
        rightPillar.castShadow = true;
        group.add(lintel, leftPillar, rightPillar);
        break;
      }
      case 'tar_patch': {
        width = 2.2;
        height = 0.25;
        depth = 3.6;
        const pool = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.15, 0.12, 14), this.tarMat);
        pool.scale.set(1, 1, 1.6);
        pool.position.y = 0.06;
        group.add(pool);
        break;
      }
      case 'geyser': {
        width = 1.65;
        height = 1.4;
        depth = 1.65;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.22, 8, 14), this.rockMat);
        ring.rotateX(Math.PI * 0.5);
        ring.position.y = 0.12;
        const plume = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 10, 1, true), this.geyserMat);
        plume.rotateX(Math.PI);
        plume.position.y = 1.25;
        group.add(ring, plume);
        break;
      }
      case 'chasm': {
        width = 2.65;
        height = 0.5;
        depth = 6.2;
        const pit = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.12, 6.2), this.chasmMat);
        pit.position.y = 0.02;
        const frontRim = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.22, 0.35), this.rockMat);
        frontRim.position.set(0, 0.08, 3.1);
        const backRim = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.22, 0.35), this.rockMat);
        backRim.position.set(0, 0.08, -3.1);
        group.add(pit, frontRim, backRim);
        break;
      }
      default:
        break;
    }

    const entity: ObstacleEntity = {
      id: this.nextId++,
      kind,
      lane,
      laneSpan: 1,
      x,
      y: baseY,
      z,
      width,
      height,
      depth,
      active: true,
      shattered: false,
      nearMissAwarded: false,
    };

    group.position.set(x, baseY, z);
    this.root.add(group);
    this.obstacles.push(entity);
    this.obstacleVisuals.push({ entity, group });
  }

  private addPterodactyl(lane: LaneIndex, altitude: 'low' | 'mid' | 'high', z: number): void {
    const x = CONFIG.LANES[lane];
    const y = altitude === 'low' ? 0.35 : altitude === 'mid' ? 1.26 : 2.5;

    const group = new THREE.Group();
    const body = new THREE.Mesh(this.pteroBodyGeo, this.pteroMat);
    body.castShadow = true;

    const leftWing = new THREE.Group();
    const lwMesh = new THREE.Mesh(this.pteroWingGeo, this.pteroMat);
    lwMesh.scale.x = -1;
    leftWing.add(lwMesh);

    const rightWing = new THREE.Group();
    const rwMesh = new THREE.Mesh(this.pteroWingGeo, this.pteroMat);
    rightWing.add(rwMesh);

    const shadowGeo = new THREE.CircleGeometry(0.75, 16);
    shadowGeo.rotateX(-Math.PI * 0.5);
    const shadowMesh = new THREE.Mesh(shadowGeo, this.shadowMat);
    shadowMesh.position.set(0, -y + 0.04, 0);

    group.add(body, leftWing, rightWing, shadowMesh);
    group.position.set(x, y, z);

    const entity: ObstacleEntity = {
      id: this.nextId++,
      kind: 'pterodactyl',
      lane,
      laneSpan: 1,
      x,
      y,
      z,
      width: 2.1,
      height: 0.88,
      depth: 1.5,
      active: true,
      shattered: false,
      nearMissAwarded: false,
      altitudeTier: altitude,
      wingPhase: Math.random() * Math.PI * 2,
    };

    this.root.add(group);
    this.obstacles.push(entity);
    this.obstacleVisuals.push({ entity, group, leftWing, rightWing, shadowMesh });
  }

  private addPlatform(
    lane: LaneIndex,
    topY: number,
    z: number,
    length: number,
    isRamp: boolean,
    isCrumbling: boolean
  ): void {
    const x = CONFIG.LANES[lane];
    const width = 2.45;
    const thickness = 0.42;

    const group = new THREE.Group();
    const mat = isCrumbling ? this.crumblingMat : this.rockMat;

    let slabMesh: THREE.Mesh;
    if (isRamp) {
      const rise = Math.min(2.2, topY);
      const hyp = Math.hypot(length, rise);
      const pitch = Math.atan2(rise, length);
      const geo = new THREE.BoxGeometry(width, thickness, hyp);
      slabMesh = new THREE.Mesh(geo, mat);
      // Leading edge (+Z) starts near y = (topY - rise), rises toward -Z up to topY
      slabMesh.position.set(0, topY - rise * 0.5 - thickness * 0.4, 0);
      slabMesh.rotation.x = pitch;
    } else {
      const geo = new THREE.BoxGeometry(width, thickness, length);
      slabMesh = new THREE.Mesh(geo, mat);
      slabMesh.position.set(0, topY - thickness * 0.5, 0);

      // Add supporting canyon mesa pillars if high above floor
      if (topY >= 1.5 && !isCrumbling) {
        const pillarH = topY - thickness;
        const pGeo = new THREE.BoxGeometry(width * 0.65, pillarH, 0.9);
        const pFront = new THREE.Mesh(pGeo, this.rockMat);
        pFront.position.set(0, pillarH * 0.5, length * 0.36);
        const pBack = new THREE.Mesh(pGeo, this.rockMat);
        pBack.position.set(0, pillarH * 0.5, -length * 0.36);
        group.add(pFront, pBack);
      }
    }

    slabMesh.castShadow = true;
    slabMesh.receiveShadow = true;
    group.add(slabMesh);
    group.position.set(x, 0, z);

    const entity: PlatformEntity = {
      id: this.nextId++,
      lane,
      x,
      y: topY,
      z,
      width,
      length,
      thickness,
      isRamp,
      isCrumbling,
      steppedOn: false,
      crumbleTimer: 0.55,
      collapsed: false,
      active: true,
    };

    this.root.add(group);
    this.platforms.push(entity);
    this.platformVisuals.push({ entity, group, slabMesh });
  }
}
