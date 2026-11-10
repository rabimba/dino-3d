export type ActId = 1 | 2 | 3 | 4 | 5;

export type LaneIndex = 0 | 1 | 2;

export type CameraMode = 'chase' | 'cinematic' | 'classic_side';

export type GamePhase = 'prologue' | 'running' | 'rewinding' | 'paused' | 'gameover';

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface BiomePalette {
  skyTop: ColorRGB;
  skyHorizon: ColorRGB;
  fogColor: ColorRGB;
  groundMain: ColorRGB;
  groundAccent: ColorRGB;
  canyonRock: ColorRGB;
  dinoPrimary: ColorRGB;
  dinoBelly: ColorRGB;
  cactusColor: ColorRGB;
  sunIntensity: number;
  ambientIntensity: number;
  fogDensity: number;
  isNight: boolean;
  saturationMix: number; // 0 = classic Chrome monochrome, 1 = vibrant prehistoric color
}

export interface DirectorSnapshot {
  act: ActId;
  actTitle: string;
  actSubtitle: string;
  actChanged: boolean;
  isNight: boolean;
  nightJustToggled: boolean;
  targetSpeed: number;
  meteorsEnabled: boolean;
  meteorInterval: number;
  palette: BiomePalette;
}

export interface InputActions {
  jumpPressed: boolean;     // Edge trigger this tick / buffered
  jumpHeld: boolean;        // Continuous hold for variable jump height
  duckHeld: boolean;        // Continuous hold for crouch-slide
  fastDropPressed: boolean; // Edge trigger in mid-air for Ground-Pound / fast-drop
  moveLeftPressed: boolean;
  moveRightPressed: boolean;
  dashPressed: boolean;
  megaPressed: boolean;     // [R] / [F] or UI button to unleash Mega-Rex Overdrive
}

export interface DinoState {
  lane: LaneIndex;
  x: number;
  y: number;
  z: number;
  vy: number;
  width: number;
  height: number;
  depth: number;
  isGrounded: boolean;
  groundY: number;
  jumpsRemaining: number;
  coyoteTimer: number;
  jumpBufferTimer: number;
  isDucking: boolean;
  isFastDropping: boolean;
  justLanded: boolean;
  justGroundPounded: boolean;
  justJumped: boolean;
  justDoubleJumped: boolean;
  justDashed: boolean;
  isDashing: boolean;
  dashTimer: number;
  dashCooldown: number;
  isCrashed: boolean;
  runCycle: number;
  squashY: number;
  bankAngle: number;
  tarSlowTimer: number;
  rage: number;             // 0 .. 100
  megaTimer: number;        // > 0 when Giant Mega-Rex Overdrive is active
  justActivatedMega: boolean;
  justMegaStep: boolean;
  postRewindGrace: number;  // Brief invulnerability after Amber Time-Rewind
}

export type HazardKind =
  | 'cactus_small'
  | 'cactus_tall'
  | 'cactus_cluster'
  | 'pterodactyl'
  | 'boulder_cracked'
  | 'tar_patch'
  | 'geyser'
  | 'chasm'
  | 'meteor_crater'
  | 'meteor_bolide'
  | 'rock_arch'
  | 'amber_pickup'
  | 'wifi_relay'
  | 'monolith_404';

export interface ObstacleEntity {
  id: number;
  kind: HazardKind;
  lane: LaneIndex;
  laneSpan: number; // 1 = single lane, 2 = adjacent pair, 3 = full width
  x: number;
  y: number;        // Base Y of obstacle
  z: number;        // Center Z
  width: number;
  height: number;
  depth: number;
  active: boolean;
  shattered: boolean;
  nearMissAwarded: boolean;
  altitudeTier?: 'low' | 'mid' | 'high'; // For pterodactyls
  wingPhase?: number;
}

export interface PlatformEntity {
  id: number;
  lane: LaneIndex;
  x: number;
  y: number;          // Top surface height (e.g., 2.2 or 4.4)
  z: number;          // Center Z
  width: number;
  length: number;     // Extent along Z
  thickness: number;
  isRamp: boolean;    // Slopes smoothly from (y - 2.2) up to y
  isCrumbling: boolean;
  steppedOn: boolean;
  crumbleTimer: number;
  collapsed: boolean;
  active: boolean;
}

export interface MeteorStrike {
  id: number;
  lane: LaneIndex;
  x: number;
  targetY: number;
  z: number;          // World Z (moves with track so reticle stays pinned to ground!)
  startX: number;
  startY: number;
  startZOffset: number;
  timer: number;      // Counts down from METEOR_WARNING_TIME -> 0
  totalTime: number;
  impacted: boolean;
  blastTimer: number; // Brief active blast window right at impact (0.14s)
  active: boolean;
}

export interface BonusEvent {
  label: string;
  points: number;
  x: number;
  y: number;
  z: number;
}

export interface CollisionStepOutcome {
  crashed: boolean;
  crashReason?: HazardKind | 'meteor_blast' | 'chasm_fall' | 'wifi_beam';
  smashedObstacleIds: number[];
  jammedRelayIds: number[];
  megaStompedIds: number[];
  triggeredGeyserIds: number[];
  collectedAmberIds: number[];
  steppedTar: boolean;
  bonusEvents: BonusEvent[];
  nearMissCount: number;
}
