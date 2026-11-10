import * as THREE from 'three';
import type { BiomePalette, DinoState } from '../core/Types';
import { buildVoxelGeometry } from '../world/VoxelBuilder';

export class DinoMesh {
  public readonly root = new THREE.Group();
  public readonly shadowMesh: THREE.Mesh;

  private readonly bodyPivot = new THREE.Group();
  private readonly torsoGroup = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly jawGroup = new THREE.Group();
  private readonly normalEyesGroup = new THREE.Group();
  private readonly shockedEyesGroup = new THREE.Group();
  private readonly leftLegGroup = new THREE.Group();
  private readonly rightLegGroup = new THREE.Group();
  private readonly leftArmGroup = new THREE.Group();
  private readonly rightArmGroup = new THREE.Group();
  private readonly tailBaseGroup = new THREE.Group();
  private readonly tailTipGroup = new THREE.Group();
  private readonly dashAuraMesh: THREE.Mesh;
  private readonly chronoOrbMesh: THREE.Mesh;

  private readonly primaryMat: THREE.MeshStandardMaterial;
  private readonly bellyMat: THREE.MeshStandardMaterial;
  private readonly accentMat: THREE.MeshStandardMaterial;
  private readonly eyeWhiteMat: THREE.MeshBasicMaterial;
  private readonly eyePupilMat: THREE.MeshBasicMaterial;
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private readonly dashAuraMat: THREE.MeshBasicMaterial;

  private blinkTimer = 2.8;
  private isBlinking = false;
  private airSpinAngle = 0;
  private currentMegaScale = 1.0;

  constructor() {
    this.primaryMat = new THREE.MeshStandardMaterial({
      color: 0x535353,
      roughness: 0.62,
      metalness: 0.06,
      vertexColors: true,
    });

    this.bellyMat = new THREE.MeshStandardMaterial({
      color: 0x787878,
      roughness: 0.7,
      metalness: 0.04,
      vertexColors: true,
    });

    this.accentMat = new THREE.MeshStandardMaterial({
      color: 0xfafafa,
      roughness: 0.4,
      metalness: 0.05,
    });

    this.eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x141414 });

    this.root.add(this.bodyPivot);
    this.bodyPivot.add(this.torsoGroup);

    // 1. Torso & Dorsal Ridge (facing -Z)
    const torsoGeo = buildVoxelGeometry([
      // Core barrel chest & hips
      { pos: [0, 1.02, 0.05], size: [0.84, 0.86, 1.02], color: 0xffffff },
      { pos: [0, 1.28, -0.22], size: [0.76, 0.62, 0.68], color: 0xffffff },
      // Dorsal plates along spine
      { pos: [0, 1.64, -0.18], size: [0.16, 0.16, 0.18], color: 0xdadada },
      { pos: [0, 1.54, 0.12], size: [0.16, 0.16, 0.18], color: 0xdadada },
      { pos: [0, 1.38, 0.42], size: [0.15, 0.15, 0.18], color: 0xdadada },
    ]);
    const torsoMesh = new THREE.Mesh(torsoGeo, this.primaryMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.torsoGroup.add(torsoMesh);

    const bellyGeo = buildVoxelGeometry([
      { pos: [0, 0.96, -0.32], size: [0.64, 0.72, 0.42], color: 0xffffff },
      { pos: [0, 0.68, -0.02], size: [0.62, 0.32, 0.68], color: 0xffffff },
    ]);
    const bellyMesh = new THREE.Mesh(bellyGeo, this.bellyMat);
    bellyMesh.castShadow = true;
    this.torsoGroup.add(bellyMesh);

    // 2. Head & Snout (faithful blocky Chrome T-Rex silhouette extruded into 3D)
    this.headGroup.position.set(0, 1.58, -0.34);
    this.torsoGroup.add(this.headGroup);

    const skullGeo = buildVoxelGeometry([
      // Back cranium & brow ridge
      { pos: [0, 0.34, -0.04], size: [0.82, 0.66, 0.64], color: 0xffffff },
      // Chunky forward snout (-Z)
      { pos: [0, 0.32, -0.56], size: [0.74, 0.52, 0.64], color: 0xffffff },
      // Nostril bump at tip of snout
      { pos: [0, 0.56, -0.74], size: [0.54, 0.12, 0.24], color: 0xf0f0f0 },
      // Brow crest
      { pos: [0, 0.69, 0.04], size: [0.2, 0.12, 0.22], color: 0xd8d8d8 },
    ]);
    const skullMesh = new THREE.Mesh(skullGeo, this.primaryMat);
    skullMesh.castShadow = true;
    this.headGroup.add(skullMesh);

    // Upper teeth trim
    const teethGeo = buildVoxelGeometry([
      { pos: [-0.26, 0.03, -0.52], size: [0.08, 0.1, 0.1] },
      { pos: [0.26, 0.03, -0.52], size: [0.08, 0.1, 0.1] },
      { pos: [-0.24, 0.03, -0.74], size: [0.08, 0.1, 0.1] },
      { pos: [0.24, 0.03, -0.74], size: [0.08, 0.1, 0.1] },
    ]);
    const teethMesh = new THREE.Mesh(teethGeo, this.accentMat);
    this.headGroup.add(teethMesh);

    // Articulated Lower Jaw
    this.jawGroup.position.set(0, 0.04, -0.1);
    this.headGroup.add(this.jawGroup);
    const jawGeo = buildVoxelGeometry([
      { pos: [0, -0.06, -0.34], size: [0.62, 0.18, 0.68], color: 0xffffff },
    ]);
    const jawMesh = new THREE.Mesh(jawGeo, this.primaryMat);
    jawMesh.castShadow = true;
    this.jawGroup.add(jawMesh);

    // Normal Eyes (both sides so side-cam AND chase-cam see expressive eyes)
    this.headGroup.add(this.normalEyesGroup);
    const eyeScleraGeo = new THREE.BoxGeometry(0.06, 0.15, 0.15);
    const eyePupilGeo = new THREE.BoxGeometry(0.075, 0.08, 0.08);
    for (const side of [-1, 1]) {
      const sclera = new THREE.Mesh(eyeScleraGeo, this.eyeWhiteMat);
      sclera.position.set(side * 0.41, 0.44, -0.18);
      const pupil = new THREE.Mesh(eyePupilGeo, this.eyePupilMat);
      pupil.position.set(side * 0.415, 0.44, -0.2);
      this.normalEyesGroup.add(sclera, pupil);
    }

    // Iconic Chrome Game-Over "O_O" Shocked Eyes
    this.shockedEyesGroup.visible = false;
    this.headGroup.add(this.shockedEyesGroup);
    const shockWhiteGeo = new THREE.BoxGeometry(0.07, 0.26, 0.26);
    const shockPupilGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    for (const side of [-1, 1]) {
      const sw = new THREE.Mesh(shockWhiteGeo, this.eyeWhiteMat);
      sw.position.set(side * 0.415, 0.44, -0.18);
      const sp = new THREE.Mesh(shockPupilGeo, this.eyePupilMat);
      sp.position.set(side * 0.422, 0.44, -0.18);
      this.shockedEyesGroup.add(sw, sp);
    }

    // 3. Tiny T-Rex Forelimbs
    this.leftArmGroup.position.set(-0.4, 1.18, -0.46);
    this.rightArmGroup.position.set(0.4, 1.18, -0.46);
    this.torsoGroup.add(this.leftArmGroup, this.rightArmGroup);

    const armGeo = buildVoxelGeometry([
      { pos: [0, -0.04, -0.16], size: [0.14, 0.14, 0.3], color: 0xffffff },
      { pos: [0, -0.15, -0.28], size: [0.12, 0.16, 0.12], color: 0xe6e6e6 },
    ]);
    this.leftArmGroup.add(new THREE.Mesh(armGeo, this.primaryMat));
    this.rightArmGroup.add(new THREE.Mesh(armGeo, this.primaryMat));

    // 4. Articulated Hind Legs
    this.leftLegGroup.position.set(-0.29, 0.68, 0.06);
    this.rightLegGroup.position.set(0.29, 0.68, 0.06);
    this.bodyPivot.add(this.leftLegGroup, this.rightLegGroup);

    const legGeo = buildVoxelGeometry([
      // Muscular thigh
      { pos: [0, -0.18, 0], size: [0.28, 0.4, 0.36], color: 0xffffff },
      // Shin
      { pos: [0, -0.46, 0.04], size: [0.2, 0.32, 0.22], color: 0xf0f0f0 },
      // 3-toed foot extending forward (-Z)
      { pos: [0, -0.62, -0.08], size: [0.28, 0.12, 0.42], color: 0xe0e0e0 },
    ]);
    const leftLegMesh = new THREE.Mesh(legGeo, this.primaryMat);
    const rightLegMesh = new THREE.Mesh(legGeo, this.primaryMat);
    leftLegMesh.castShadow = true;
    rightLegMesh.castShadow = true;
    this.leftLegGroup.add(leftLegMesh);
    this.rightLegGroup.add(rightLegMesh);

    // 5. Two-Stage Counterbalance Tail (+Z)
    this.tailBaseGroup.position.set(0, 0.98, 0.52);
    this.torsoGroup.add(this.tailBaseGroup);

    const tailBaseGeo = buildVoxelGeometry([
      { pos: [0, 0.04, 0.28], size: [0.54, 0.48, 0.58], color: 0xffffff },
    ]);
    const tailBaseMesh = new THREE.Mesh(tailBaseGeo, this.primaryMat);
    tailBaseMesh.castShadow = true;
    this.tailBaseGroup.add(tailBaseMesh);

    this.tailTipGroup.position.set(0, 0.08, 0.54);
    this.tailBaseGroup.add(this.tailTipGroup);
    const tailTipGeo = buildVoxelGeometry([
      { pos: [0, 0.05, 0.28], size: [0.34, 0.3, 0.56], color: 0xf4f4f4 },
      { pos: [0, 0.12, 0.68], size: [0.18, 0.18, 0.38], color: 0xe8e8e8 },
    ]);
    const tailTipMesh = new THREE.Mesh(tailTipGeo, this.primaryMat);
    tailTipMesh.castShadow = true;
    this.tailTipGroup.add(tailTipMesh);

    // 6. Roar-Dash Sonic Cone Aura
    const coneGeo = new THREE.ConeGeometry(0.95, 2.2, 12, 1, true);
    coneGeo.rotateX(-Math.PI * 0.5); // Tip points toward -Z (forward)
    this.dashAuraMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.dashAuraMesh = new THREE.Mesh(coneGeo, this.dashAuraMat);
    this.dashAuraMesh.position.set(0, 1.15, -0.75);
    this.root.add(this.dashAuraMesh);

    // Orbiting Golden Amber Chrono-Core (visible when 2s Time-Rewind is armed!)
    const orbGeo = new THREE.OctahedronGeometry(0.28, 0);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xff9f1c,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    });
    this.chronoOrbMesh = new THREE.Mesh(orbGeo, orbMat);
    this.chronoOrbMesh.visible = false;
    this.root.add(this.chronoOrbMesh);

    // 7. Crisp Ground Landing Shadow Disc
    const shadowGeo = new THREE.CircleGeometry(0.78, 24);
    shadowGeo.rotateX(-Math.PI * 0.5);
    this.shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, this.shadowMat);
  }

  public sync(
    dt: number,
    dino: DinoState,
    supportY: number,
    palette: BiomePalette,
    isPrologue: boolean,
    chronoArmed = false
  ): void {
    // Update palette colors & Mega-Rex volcanic emissive glow
    this.primaryMat.color.setRGB(
      palette.dinoPrimary.r,
      palette.dinoPrimary.g,
      palette.dinoPrimary.b
    );
    if (dino.megaTimer > 0) {
      this.primaryMat.emissive.setHex(0xff5400);
      this.primaryMat.emissiveIntensity = 0.52 + Math.sin(performance.now() * 0.015) * 0.18;
    } else if (dino.postRewindGrace > 0) {
      this.primaryMat.emissive.setHex(0x38bdf8);
      this.primaryMat.emissiveIntensity = 0.45 + Math.sin(performance.now() * 0.04) * 0.35;
    } else {
      this.primaryMat.emissive.setHex(0x000000);
      this.primaryMat.emissiveIntensity = 0;
    }

    this.bellyMat.color.setRGB(
      palette.dinoBelly.r,
      palette.dinoBelly.g,
      palette.dinoBelly.b
    );

    // Smooth Giant Mega-Rex scale transition (1.0x <-> 2.35x!)
    const targetMega = dino.megaTimer > 0 ? 2.35 : 1.0;
    this.currentMegaScale += (targetMega - this.currentMegaScale) * Math.min(1, dt * 8.5);

    // Position & squash-stretch conservation of volume
    this.root.position.set(dino.x, dino.y, dino.z);
    const sy = dino.squashY * this.currentMegaScale;
    const sxz = (1 / Math.sqrt(Math.max(0.5, dino.squashY))) * this.currentMegaScale;
    this.bodyPivot.scale.set(sxz, sy, sxz);
    this.bodyPivot.rotation.z = dino.bankAngle;

    // Orbiting Golden Amber Chrono-Core
    this.chronoOrbMesh.visible = chronoArmed && !dino.isCrashed;
    if (this.chronoOrbMesh.visible) {
      const t = performance.now() * 0.004;
      const r = 1.05 * this.currentMegaScale;
      this.chronoOrbMesh.position.set(
        Math.cos(t) * r,
        (1.25 + Math.sin(t * 2) * 0.18) * this.currentMegaScale,
        Math.sin(t) * r
      );
      this.chronoOrbMesh.rotation.y = t * 2;
    }

    // Ground shadow tracks landing spot directly beneath Rex
    const shadowGround = Number.isFinite(supportY) ? supportY : -3.5;
    const heightAboveGround = Math.max(0, dino.y - shadowGround);
    const shadowScale =
      Math.max(0.32, 1.0 - heightAboveGround * 0.11) * this.currentMegaScale;
    this.shadowMesh.position.set(dino.x, shadowGround + 0.03, dino.z);
    this.shadowMesh.scale.setScalar(shadowScale);
    this.shadowMesh.visible = Number.isFinite(supportY);
    this.shadowMat.opacity = Math.max(0.08, 0.36 - heightAboveGround * 0.05);

    // Crash eyes vs normal blinking eyes
    if (dino.isCrashed) {
      this.normalEyesGroup.visible = false;
      this.shockedEyesGroup.visible = true;
      this.jawGroup.rotation.x = -0.32;
      return;
    } else {
      this.shockedEyesGroup.visible = false;
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.isBlinking = !this.isBlinking;
        this.blinkTimer = this.isBlinking ? 0.11 : 2.4 + Math.random() * 2.2;
      }
      this.normalEyesGroup.visible = !this.isBlinking;
    }

    // Double-jump celebratory forward tuck / tail-whip spin
    if (dino.justDoubleJumped) {
      this.airSpinAngle = Math.PI * 2;
    }
    if (this.airSpinAngle > 0) {
      this.airSpinAngle = Math.max(0, this.airSpinAngle - dt * 16.5);
    }

    // Ducking vs Dashing vs Running torso posture
    if (dino.isDucking) {
      // Iconic horizontal Chrome Dino duck-run pose!
      this.torsoGroup.position.set(0, -0.44, -0.18);
      this.torsoGroup.rotation.x = -0.62;
      this.headGroup.position.set(0, 1.48, -0.45);
      this.headGroup.rotation.x = 0.42;
    } else if (dino.isDashing) {
      this.torsoGroup.position.set(0, -0.15, -0.12);
      this.torsoGroup.rotation.x = -0.38;
      this.headGroup.position.set(0, 1.56, -0.38);
      this.headGroup.rotation.x = 0.22;
    } else {
      const strideBob =
        !isPrologue && dino.isGrounded ? Math.abs(Math.sin(dino.runCycle)) * 0.11 : 0;
      this.torsoGroup.position.set(0, strideBob, 0);
      this.torsoGroup.rotation.x = -this.airSpinAngle;
      this.headGroup.position.set(0, 1.58 + strideBob * 0.35, -0.34);
      this.headGroup.rotation.x = !isPrologue && dino.isGrounded ? Math.sin(dino.runCycle * 2) * 0.04 : 0;
    }

    // Jaw roar during Dash
    const targetJawRot = dino.isDashing ? -0.46 : -0.03;
    this.jawGroup.rotation.x += (targetJawRot - this.jawGroup.rotation.x) * Math.min(1, 18 * dt);

    // Legs animation
    if (isPrologue) {
      this.leftLegGroup.rotation.x = 0;
      this.rightLegGroup.rotation.x = 0;
      this.leftArmGroup.rotation.x = 0.15;
      this.rightArmGroup.rotation.x = 0.15;
    } else if (!dino.isGrounded) {
      // Airborne athletic tuck
      this.leftLegGroup.rotation.x = -0.52;
      this.rightLegGroup.rotation.x = 0.36;
      // Excited tiny-arm paddle in air!
      const paddle = Math.sin(performance.now() * 0.025) * 0.45;
      this.leftArmGroup.rotation.x = paddle;
      this.rightArmGroup.rotation.x = -paddle;
    } else {
      const swing = Math.sin(dino.runCycle) * 0.78;
      this.leftLegGroup.rotation.x = swing;
      this.rightLegGroup.rotation.x = -swing;
      this.leftArmGroup.rotation.x = -swing * 0.25;
      this.rightArmGroup.rotation.x = swing * 0.25;
    }

    // Secondary tail sway & banking counterbalance
    const tailSway = isPrologue ? 0 : Math.cos(dino.runCycle) * 0.18 - dino.bankAngle * 1.4;
    this.tailBaseGroup.rotation.y = tailSway;
    this.tailTipGroup.rotation.y = tailSway * 1.25;

    // Dash sonic aura pulse
    if (dino.isDashing) {
      this.dashAuraMat.opacity = 0.52;
      this.dashAuraMesh.rotation.z += dt * 14;
      this.dashAuraMesh.scale.setScalar(1.0 + Math.sin(performance.now() * 0.04) * 0.1);
    } else {
      this.dashAuraMat.opacity = Math.max(0, this.dashAuraMat.opacity - dt * 8);
    }
  }
}
