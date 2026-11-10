import * as THREE from 'three';
import type { CameraMode, DinoState, GamePhase } from '../core/Types';

export class CameraRig {
  public readonly camera: THREE.PerspectiveCamera;
  public mode: CameraMode = 'chase';

  private currentPos = new THREE.Vector3(13.8, 2.05, -3.6);
  private currentLookAt = new THREE.Vector3(0, 1.8, -3.6);
  private currentFov = 36;
  private trauma = 0;
  private shakeClock = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(36, aspect, 0.1, 320);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = Math.max(0.1, width / Math.max(1, height));
    this.camera.updateProjectionMatrix();
  }

  public cycleMode(): CameraMode {
    if (this.mode === 'chase') this.mode = 'cinematic';
    else if (this.mode === 'cinematic') this.mode = 'classic_side';
    else this.mode = 'chase';
    return this.mode;
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public resetToPrologue(): void {
    this.currentPos.set(13.8, 2.05, -3.6);
    this.currentLookAt.set(0, 1.8, -3.6);
    this.currentFov = 36;
    this.trauma = 0;
    this.camera.fov = this.currentFov;
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
    this.camera.updateProjectionMatrix();
  }

  public update(dt: number, phase: GamePhase, dino: DinoState): void {
    const targetPos = new THREE.Vector3();
    const targetLook = new THREE.Vector3();
    let targetFov = 54;

    if (phase === 'prologue') {
      // Faithful 2D Chrome Dino framing: Dino sits on left facing right!
      targetPos.set(13.8, 2.05, -3.6);
      targetLook.set(0, 1.8, -3.6);
      targetFov = 36;
    } else if (phase === 'gameover') {
      // Frame Rex slightly to the lower-left in side-three-quarter angle so shocked O_O eyes shine clearly!
      targetPos.set(dino.x + 3.9, dino.y + 2.45, dino.z + 3.8);
      targetLook.set(dino.x + 0.55, dino.y + 2.05, dino.z - 0.6);
      targetFov = 45;
    } else if (this.mode === 'classic_side') {
      // Playable 2.5D Nostalgia Side-View
      targetPos.set(16.2, 3.4 + dino.y * 0.45, -6.5);
      targetLook.set(dino.x * 0.4, 1.9 + dino.y * 0.4, -6.5);
      targetFov = 42;
    } else if (this.mode === 'cinematic') {
      // Low-slung dynamic action chase camera
      targetPos.set(dino.x * 0.68 + 1.55, 3.65 + dino.y * 0.55, 7.6);
      targetLook.set(dino.x * 0.42, 1.45 + dino.y * 0.4, -12.0);
      targetFov = dino.isDashing ? 65 : 58;
    } else {
      // Default Hero 3D Chase Platformer View (pulls back into an epic Kaiju wide-shot during Mega-Rex!)
      const megaBoost = dino.megaTimer > 0 ? 1 : 0;
      targetPos.set(
        dino.x * 0.52 + 1.05 + megaBoost * 0.6,
        4.75 + dino.y * 0.52 + megaBoost * 2.55,
        9.1 + megaBoost * 4.2
      );
      targetLook.set(dino.x * 0.35, 1.55 + dino.y * 0.38 + megaBoost * 1.1, -10.5);
      targetFov = dino.isDashing || megaBoost ? 62 : 54;
    }

    const smoothSpeed = phase === 'prologue' ? 8.0 : 5.6;
    const alpha = Math.min(1, smoothSpeed * dt);
    this.currentPos.lerp(targetPos, alpha);
    this.currentLookAt.lerp(targetLook, alpha);

    if (Math.abs(this.currentFov - targetFov) > 0.05) {
      this.currentFov += (targetFov - this.currentFov) * Math.min(1, 7.5 * dt);
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // Trauma screen shake (quadratic falloff feels punchy without nausea)
    this.shakeClock += dt * 42;
    let shakeX = 0;
    let shakeY = 0;
    if (this.trauma > 0) {
      const mag = this.trauma * this.trauma * 0.48;
      shakeX = Math.sin(this.shakeClock * 1.1) * mag;
      shakeY = Math.cos(this.shakeClock * 1.7) * mag;
      this.trauma = Math.max(0, this.trauma - dt * 2.1);
    }

    this.camera.position.set(
      this.currentPos.x + shakeX,
      this.currentPos.y + shakeY,
      this.currentPos.z
    );
    this.camera.lookAt(this.currentLookAt);
  }
}
