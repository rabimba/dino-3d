export const CONFIG = {
  // Spatial topology (Right-handed: -Z forward, +X right, +Y up)
  LANES: [-2.8, 0, 2.8] as readonly number[],
  LANE_WIDTH: 2.8,
  TRACK_HALF_WIDTH: 4.5,

  // Vertical platform tiers
  TIER_HEIGHTS: [0, 2.2, 4.4] as readonly number[],
  CHASM_DEATH_Y: -3.2,

  // Physics & Dino kinematics (tuned for snappy Chrome-faithful arcade feel)
  GRAVITY: -60.0,
  JUMP_VELOCITY: 21.2,
  DOUBLE_JUMP_VELOCITY: 18.6,
  GEYSER_LAUNCH_VELOCITY: 27.5,
  JUMP_CUTOFF_MULTIPLIER: 0.48, // Early release short-hop damping
  FAST_DROP_GRAVITY_MULT: 3.3,  // Classic Chrome speedDrop + Ground-Pound
  COYOTE_TIME: 0.1,             // 100ms grace after leaving a ledge
  JUMP_BUFFER_TIME: 0.12,       // 120ms pre-landing jump buffer
  LANE_SPRING_STIFFNESS: 26.0,  // Snappy lateral lane lerp speed

  // Dino dimensions (standing vs ducking)
  DINO_WIDTH: 1.25,
  DINO_STAND_HEIGHT: 2.35,
  DINO_DUCK_HEIGHT: 1.08,
  DINO_DEPTH: 1.65,
  HURTBOX_FORGIVENESS: 0.8,     // Inner 80% hurtbox for fair arcade grazes

  // Roar-Dash mechanics
  DASH_DURATION: 0.28,
  DASH_COOLDOWN: 3.4,
  DASH_SPEED_BOOST: 1.45,
  NEAR_MISS_COOLDOWN_REFUND: 1.0,
  NEAR_MISS_DISTANCE: 0.85,

  // Speed & Scoring (matches classic Chrome Dino pacing scaled to 3D)
  INITIAL_SPEED: 16.5,
  MAX_SPEED: 36.0,
  SPEED_ACCELERATION: 0.34,     // Units/sec gained per second of survival
  SCORE_PER_UNIT: 0.55,         // ~9-18 pts/sec matching classic Chrome Dino feel
  MILESTONE_INTERVAL: 100,

  // Story Act score thresholds
  ACT_THRESHOLDS: {
    ACT_1_BADLANDS: 0,
    ACT_2_CANYON_WINDS: 400,
    ACT_3_TECTONIC: 900,
    ACT_4_METEOR_SHOWER: 1600,
    ACT_5_OVERDRIVE: 2500,
  },

  // Classic Chrome 700-pt Night Mode cycle
  NIGHT_CYCLE_INTERVAL: 700,
  NIGHT_DURATION_SCORE: 220,

  // Chunk & Spawning
  SPAWN_Z: -112.0,
  DESPAWN_Z: 18.0,
  CHUNK_MIN_GAP: 12.5,

  // Meteor Shower parameters (Act IV+)
  METEOR_WARNING_TIME: 1.3,
  METEOR_START_HEIGHT: 23.5,
  METEOR_BLAST_RADIUS: 1.45,
  METEOR_CRATER_LIFETIME: 8.0,

  // Twist 1: Wi-Fi Reconnecting Meta-Boss
  WIFI_BOSS_FIRST_SCORE: 620,
  WIFI_BOSS_INTERVAL: 1050,
  WIFI_RELAYS_TO_JAM: 3,

  // Twist 2: Amber Time-Rewind & Ghost Rival
  AMBER_FOR_CHRONO_CHARGE: 3,
  REWIND_DURATION_REAL_SEC: 1.05,
  REWIND_HISTORY_SEC: 2.1,
  POST_REWIND_GRACE_SEC: 1.3,

  // Twist 3: Mega-Rex Rage Overdrive
  MEGA_RAGE_MAX: 100,
  MEGA_DURATION_SEC: 7.5,
  MEGA_SCALE: 2.35,
  RAGE_PER_SMASH: 28,
  RAGE_PER_NEAR_MISS: 18,
  RAGE_PER_AMBER: 14,
} as const;
