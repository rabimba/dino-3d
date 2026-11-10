import * as THREE from 'three';
import type { BiomePalette } from '../core/Types';
import { buildVoxelGeometry } from './VoxelBuilder';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  gravity: number;
  color: THREE.Color;
}

interface SceneryProp {
  mesh: THREE.Object3D;
  speedMult: number;
  wrapZ: number;
  resetZ: number;
  isTumbleweed?: boolean;
}

const MAX_PARTICLES = 280;

export class EnvironmentRenderer {
  public readonly root = new THREE.Group();
  public readonly sunLight: THREE.DirectionalLight;
  public readonly hemiLight: THREE.HemisphereLight;
  public readonly fog: THREE.FogExp2;

  private readonly skyUniforms: {
    uTopColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
  };
  private readonly roadMat: THREE.MeshStandardMaterial;
  private readonly outerDesertMat: THREE.MeshStandardMaterial;
  private readonly laneLineMat: THREE.MeshStandardMaterial;
  private readonly cliffMat: THREE.MeshStandardMaterial;
  private readonly cloudMat: THREE.MeshStandardMaterial;

  private readonly starsPoints: THREE.Points;
  private readonly starsMat: THREE.PointsMaterial;
  private readonly moonGroup = new THREE.Group();
  private readonly volcanoGroup = new THREE.Group();
  private readonly tumbleweedMat: THREE.MeshStandardMaterial;

  private readonly sceneryProps: SceneryProp[] = [];
  private readonly particles: Particle[] = [];
  private readonly particleInstanced: THREE.InstancedMesh;
  private readonly dummyObj = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    // 1. Atmospheric Exponential Fog
    this.fog = new THREE.FogExp2(0xf5f5f5, 0.0085);
    scene.fog = this.fog;

    // 2. Sky Gradient Dome Shader
    this.skyUniforms = {
      uTopColor: { value: new THREE.Color(0xf2f2f2) },
      uHorizonColor: { value: new THREE.Color(0xf7f7f7) },
    };
    const skyGeo = new THREE.SphereGeometry(220, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp(normalize(vWorldPos).y * 1.65, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.68));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.root.add(skyMesh);

    // 3. Directional Sun with crisp shadows + Hemisphere sky/sand bounce
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xd8c3a5, 0.95);
    this.root.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff6e5, 1.55);
    this.sunLight.position.set(22, 36, 18);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 140;
    this.sunLight.shadow.camera.left = -18;
    this.sunLight.shadow.camera.right = 18;
    this.sunLight.shadow.camera.top = 28;
    this.sunLight.shadow.camera.bottom = -42;
    this.sunLight.shadow.bias = -0.0005;
    this.root.add(this.sunLight);

    // 4. 3-Lane Canyon Trail + Outer Desert Floor
    this.roadMat = new THREE.MeshStandardMaterial({
      color: 0xe8e8e8,
      roughness: 0.92,
      metalness: 0.02,
    });
    const roadGeo = new THREE.PlaneGeometry(9.4, 210);
    roadGeo.rotateX(-Math.PI * 0.5);
    const roadMesh = new THREE.Mesh(roadGeo, this.roadMat);
    roadMesh.position.set(0, 0, -75);
    roadMesh.receiveShadow = true;
    this.root.add(roadMesh);

    this.outerDesertMat = new THREE.MeshStandardMaterial({
      color: 0xdcdcdc,
      roughness: 0.96,
    });
    for (const side of [-1, 1]) {
      const sideFloor = new THREE.Mesh(new THREE.PlaneGeometry(120, 220), this.outerDesertMat);
      sideFloor.rotation.x = -Math.PI * 0.5;
      sideFloor.position.set(side * 64.5, -0.04, -75);
      sideFloor.receiveShadow = true;
      this.root.add(sideFloor);
    }

    // Subtle sandstone lane-divider ruts at x = -1.4 and x = +1.4
    this.laneLineMat = new THREE.MeshStandardMaterial({
      color: 0xcfcfcf,
      roughness: 0.9,
    });
    for (const dividerX of [-1.4, 1.4, -4.45, 4.45]) {
      const width = Math.abs(dividerX) > 3 ? 0.22 : 0.11;
      const lineGeo = new THREE.PlaneGeometry(width, 200);
      lineGeo.rotateX(-Math.PI * 0.5);
      const lineMesh = new THREE.Mesh(lineGeo, this.laneLineMat);
      lineMesh.position.set(dividerX, 0.012, -75);
      lineMesh.receiveShadow = true;
      this.root.add(lineMesh);
    }

    // 5. Flanking Canyon Mesas, Pebbles & Classic Chrome 3D Voxel Clouds
    this.cliffMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d4,
      roughness: 0.88,
      vertexColors: true,
    });
    this.cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.65,
      transparent: true,
      opacity: 0.88,
    });
    this.tumbleweedMat = new THREE.MeshStandardMaterial({
      color: 0xa98467,
      roughness: 0.9,
      wireframe: true,
    });

    this.populateScenery();

    // 6. Night Mode Stars & Crescent Moon
    const starCount = 320;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.44;
      const r = 165;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi) + 8;
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 30;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xe0ecff,
      size: 1.45,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.starsPoints = new THREE.Points(starGeo, this.starsMat);
    this.root.add(this.starsPoints);

    const moonMesh = new THREE.Mesh(
      buildVoxelGeometry([
        { pos: [0, 0, 0], size: [2.8, 5.2, 1.2], color: 0xfefae0 },
        { pos: [1.4, 1.8, 0], size: [2.0, 1.6, 1.2], color: 0xfefae0 },
        { pos: [1.4, -1.8, 0], size: [2.0, 1.6, 1.2], color: 0xfefae0 },
      ]),
      new THREE.MeshBasicMaterial({ color: 0xfff8d6 })
    );
    this.moonGroup.add(moonMesh);
    this.moonGroup.position.set(24, 42, -135);
    this.moonGroup.visible = false;
    this.root.add(this.moonGroup);

    // 7. Instanced Particle Pool
    const pGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleInstanced = new THREE.InstancedMesh(pGeo, pMat, MAX_PARTICLES);
    this.particleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(this.particleInstanced);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 1,
        gravity: -18,
        color: new THREE.Color(0xffffff),
      });
      this.dummyObj.position.set(0, -999, 0);
      this.dummyObj.scale.setScalar(0.001);
      this.dummyObj.updateMatrix();
      this.particleInstanced.setMatrixAt(i, this.dummyObj.matrix);
      this.particleInstanced.setColorAt(i, new THREE.Color(0xffffff));
    }
  }

  private populateScenery(): void {
    // Ground pebbles along track shoulders (gives crisp sensation of forward speed!)
    const pebbleGeo = new THREE.BoxGeometry(0.32, 0.08, 0.45);
    for (let i = 0; i < 48; i++) {
      const pebble = new THREE.Mesh(pebbleGeo, this.laneLineMat);
      const laneSide = i % 2 === 0 ? -1 : 1;
      const x =
        Math.random() < 0.45
          ? (Math.random() - 0.5) * 8.2
          : laneSide * (4.9 + Math.random() * 8.0);
      pebble.position.set(x, 0.03, -Math.random() * 165 + 15);
      this.root.add(pebble);
      this.sceneryProps.push({
        mesh: pebble,
        speedMult: 1.0,
        wrapZ: 20,
        resetZ: -155,
      });
    }

    // Flanking stepped Canyon Mesas & Buttes
    const mesaGeo = buildVoxelGeometry([
      { pos: [0, 3.5, 0], size: [9.5, 7.0, 12.0], color: 0xffffff },
      { pos: [0.6, 8.2, -0.5], size: [6.2, 4.2, 8.2], color: 0xf0f0f0 },
      { pos: [-1.8, 1.8, 3.2], size: [6.0, 3.6, 6.0], color: 0xe2e2e2 },
    ]);

    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const mesa = new THREE.Mesh(mesaGeo, this.cliffMat);
      const scale = 0.8 + Math.random() * 1.35;
      mesa.scale.set(scale, scale * (0.7 + Math.random() * 0.8), scale);
      mesa.position.set(
        side * (16 + Math.random() * 26),
        -0.2,
        -i * 12 + 12
      );
      mesa.receiveShadow = true;
      this.root.add(mesa);
      this.sceneryProps.push({
        mesh: mesa,
        speedMult: 0.92,
        wrapZ: 28,
        resetZ: -165,
      });
    }

    // Nostalgic Chrome Voxel Clouds drifting overhead
    const cloudGeo = buildVoxelGeometry([
      { pos: [0, 0, 0], size: [4.6, 1.1, 2.2] },
      { pos: [-0.8, 0.75, 0], size: [2.4, 0.9, 1.8] },
      { pos: [1.1, 0.55, 0.2], size: [1.9, 0.75, 1.6] },
    ]);
    for (let i = 0; i < 10; i++) {
      const cloud = new THREE.Mesh(cloudGeo, this.cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 65,
        15 + Math.random() * 11,
        -Math.random() * 170 + 10
      );
      const s = 0.75 + Math.random() * 0.75;
      cloud.scale.setScalar(s);
      this.root.add(cloud);
      this.sceneryProps.push({
        mesh: cloud,
        speedMult: 0.22,
        wrapZ: 25,
        resetZ: -165,
      });
    }

    // Rolling desert tumbleweeds bouncing along the badlands shoulders
    const twGeo = new THREE.IcosahedronGeometry(0.45, 1);
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const tw = new THREE.Mesh(twGeo, this.tumbleweedMat);
      tw.position.set(side * (6.2 + Math.random() * 5.0), 0.45, -Math.random() * 145);
      this.root.add(tw);
      this.sceneryProps.push({
        mesh: tw,
        speedMult: 1.28,
        wrapZ: 20,
        resetZ: -155,
        isTumbleweed: true,
      });
    }

    // Distant Smoking Volcano on the horizon (awakens in Act III+)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(28, 34, 8), this.cliffMat);
    cone.position.y = 15;
    const calderaGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(5.5, 4.0, 2.2, 8),
      new THREE.MeshStandardMaterial({
        color: 0xff5400,
        emissive: 0xff3c00,
        emissiveIntensity: 2.2,
      })
    );
    calderaGlow.position.y = 31.5;
    this.volcanoGroup.add(cone, calderaGlow);
    this.volcanoGroup.position.set(16, -2, -162);
    this.volcanoGroup.visible = false;
    this.root.add(this.volcanoGroup);
  }

  public spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    spreadSpeed = 7.5,
    upwardBias = 6.0,
    scale = 1.0
  ): void {
    let spawned = 0;
    for (let i = 0; i < MAX_PARTICLES && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.6;
      p.y = y + Math.random() * 0.4;
      p.z = z + (Math.random() - 0.5) * 0.6;
      p.vx = (Math.random() - 0.5) * spreadSpeed * 2;
      p.vy = Math.random() * spreadSpeed + upwardBias;
      p.vz = (Math.random() - 0.5) * spreadSpeed * 2;
      p.maxLife = 0.35 + Math.random() * 0.45;
      p.life = p.maxLife;
      p.scale = scale * (0.7 + Math.random() * 0.8);
      p.gravity = -22;
      p.color.setHex(colorHex);
      spawned++;
    }
  }

  public update(
    dt: number,
    runSpeed: number,
    palette: BiomePalette,
    isScrolling: boolean,
    ashActive: boolean,
    volcanoActive = false
  ): void {
    this.volcanoGroup.visible = volcanoActive;
    // 1. Update Sky, Fog, Lights & Ground Palette
    this.skyUniforms.uTopColor.value.setRGB(
      palette.skyTop.r,
      palette.skyTop.g,
      palette.skyTop.b
    );
    this.skyUniforms.uHorizonColor.value.setRGB(
      palette.skyHorizon.r,
      palette.skyHorizon.g,
      palette.skyHorizon.b
    );
    this.fog.color.setRGB(palette.fogColor.r, palette.fogColor.g, palette.fogColor.b);
    this.fog.density = palette.fogDensity;

    this.roadMat.color.setRGB(
      palette.groundMain.r,
      palette.groundMain.g,
      palette.groundMain.b
    );
    this.outerDesertMat.color.setRGB(
      palette.groundMain.r * 0.92,
      palette.groundMain.g * 0.92,
      palette.groundMain.b * 0.92
    );
    this.laneLineMat.color.setRGB(
      palette.groundAccent.r,
      palette.groundAccent.g,
      palette.groundAccent.b
    );
    this.cliffMat.color.setRGB(
      palette.canyonRock.r,
      palette.canyonRock.g,
      palette.canyonRock.b
    );

    this.sunLight.intensity = palette.sunIntensity;
    this.hemiLight.intensity = palette.ambientIntensity;
    this.cloudMat.opacity = palette.isNight ? 0.22 : 0.85;

    // Night stars & moon fade
    const targetStarOpacity = palette.isNight ? 0.92 : ashActive ? 0.35 : 0.0;
    this.starsMat.opacity += (targetStarOpacity - this.starsMat.opacity) * Math.min(1, dt * 2.5);
    this.moonGroup.visible = palette.isNight;

    // 2. Scroll scenery treadmill
    if (isScrolling) {
      for (let i = 0; i < this.sceneryProps.length; i++) {
        const prop = this.sceneryProps[i];
        prop.mesh.position.z += runSpeed * prop.speedMult * dt;
        if (prop.isTumbleweed) {
          prop.mesh.rotation.x += runSpeed * dt * 1.4;
          prop.mesh.rotation.z += dt * 2.1;
          prop.mesh.position.y = 0.45 + Math.abs(Math.sin(prop.mesh.position.z * 0.45)) * 0.52;
        }
        if (prop.mesh.position.z > prop.wrapZ) {
          prop.mesh.position.z = prop.resetZ - Math.random() * 14;
        }
      }
    }

    // Ambient volcanic embers during Act IV/V Meteor Storm
    if (ashActive && isScrolling && Math.random() < dt * 22) {
      this.spawnBurst(
        (Math.random() - 0.5) * 16,
        6 + Math.random() * 8,
        -25 - Math.random() * 35,
        1,
        Math.random() < 0.5 ? 0xff6b00 : 0xffbe0b,
        1.5,
        -2.5,
        0.85
      );
    }

    // 3. Step Instanced Particles
    let needsColorSync = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.dummyObj.position.set(0, -999, 0);
        this.dummyObj.scale.setScalar(0.001);
        this.dummyObj.updateMatrix();
        this.particleInstanced.setMatrixAt(i, this.dummyObj.matrix);
        continue;
      }

      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += (p.vz + (isScrolling ? runSpeed * 0.45 : 0)) * dt;

      const lifeRatio = p.life / p.maxLife;
      this.dummyObj.position.set(p.x, p.y, p.z);
      this.dummyObj.rotation.set(lifeRatio * 4, lifeRatio * 3, 0);
      this.dummyObj.scale.setScalar(p.scale * lifeRatio);
      this.dummyObj.updateMatrix();
      this.particleInstanced.setMatrixAt(i, this.dummyObj.matrix);
      this.particleInstanced.setColorAt(i, p.color);
      needsColorSync = true;
    }

    this.particleInstanced.instanceMatrix.needsUpdate = true;
    if (needsColorSync && this.particleInstanced.instanceColor) {
      this.particleInstanced.instanceColor.needsUpdate = true;
    }
  }
}
