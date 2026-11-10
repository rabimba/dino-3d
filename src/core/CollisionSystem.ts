import { CONFIG } from './Config';
import type {
  CollisionStepOutcome,
  DinoState,
  LaneIndex,
  MeteorStrike,
  ObstacleEntity,
  PlatformEntity,
} from './Types';

export class CollisionSystem {
  /**
   * Computes the vertical support height directly beneath the Dino at (dinoX, dinoZ),
   * accounting for main desert floor (y = 0), active chasms (-Infinity), ramps, and multi-tier platforms.
   */
  public computeSupportHeight(
    dino: DinoState,
    platforms: readonly PlatformEntity[],
    obstacles: readonly ObstacleEntity[]
  ): number {
    // Check if the main floor (y = 0) has an active chasm beneath the Dino's center
    let floorOpenChasm = false;
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (!obs.active || obs.kind !== 'chasm') continue;
      const halfW = obs.width * 0.46;
      const halfD = obs.depth * 0.44;
      if (
        Math.abs(dino.x - obs.x) <= halfW &&
        Math.abs(dino.z - obs.z) <= halfD
      ) {
        floorOpenChasm = true;
        break;
      }
    }

    let bestSupportY = floorOpenChasm ? -Infinity : 0;

    // Check elevated platforms & ramps
    for (let i = 0; i < platforms.length; i++) {
      const plat = platforms[i];
      if (!plat.active || plat.collapsed) continue;

      const halfW = (plat.width + dino.width * 0.55) * 0.5;
      const halfL = (plat.length + dino.depth * 0.45) * 0.5;

      if (Math.abs(dino.x - plat.x) > halfW) continue;
      if (Math.abs(dino.z - plat.z) > halfL) continue;

      let surfaceY = plat.y;
      if (plat.isRamp) {
        // Ramp rises toward -Z: front edge closer to Dino (+Z side of ramp) is lower, back edge (-Z side) is higher!
        // Wait: incoming ramp travels +Z toward Dino at z=0!
        // The leading edge that reaches Dino FIRST is at (plat.z + plat.length/2).
        // The trailing high end that reaches Dino LATER is at (plat.z - plat.length/2).
        const frontZ = plat.z + plat.length * 0.5;
        const t = Math.max(0, Math.min(1, (frontZ - dino.z) / Math.max(0.01, plat.length)));
        const baseHeight = Math.max(0, plat.y - 2.2);
        surfaceY = baseHeight + t * (plat.y - baseHeight);
      }

      // Dino can stand/land on this surface if already above it (with generous step-up tolerance on ramps)
      const stepTolerance = plat.isRamp ? 0.95 : 0.42;
      if (dino.y >= surfaceY - stepTolerance && surfaceY > bestSupportY) {
        bestSupportY = surfaceY;
      }
    }

    return bestSupportY;
  }

  /**
   * Updates crumbling platforms when stepped on or smashed via Ground-Pound,
   * and evaluates all obstacle, meteor blast, near-miss, and chasm interactions.
   */
  public evaluate(
    dt: number,
    dino: DinoState,
    platforms: PlatformEntity[],
    obstacles: ObstacleEntity[],
    meteors: MeteorStrike[],
    activeWifiBeamLane: LaneIndex | null = null
  ): CollisionStepOutcome {
    const outcome: CollisionStepOutcome = {
      crashed: false,
      smashedObstacleIds: [],
      jammedRelayIds: [],
      megaStompedIds: [],
      triggeredGeyserIds: [],
      collectedAmberIds: [],
      steppedTar: false,
      bonusEvents: [],
      nearMissCount: 0,
    };

    const isMega = dino.megaTimer > 0;
    const hasGrace = dino.postRewindGrace > 0;

    // 1. Chasm pit fall check
    if (dino.y <= CONFIG.CHASM_DEATH_Y && !isMega && !hasGrace) {
      outcome.crashed = true;
      outcome.crashReason = 'chasm_fall';
      return outcome;
    }

    // 2. Update crumbling bridges beneath Dino
    for (let i = 0; i < platforms.length; i++) {
      const plat = platforms[i];
      if (!plat.active || plat.collapsed || !plat.isCrumbling) continue;

      const onPlatX = Math.abs(dino.x - plat.x) <= (plat.width + dino.width * 0.5) * 0.5;
      const onPlatZ = Math.abs(dino.z - plat.z) <= (plat.length + dino.depth * 0.4) * 0.5;
      const onPlatY = dino.isGrounded && Math.abs(dino.y - plat.y) <= 0.25;

      if (onPlatX && onPlatZ && onPlatY) {
        plat.steppedOn = true;
        // Ground-pounding a crumbling bridge collapses it immediately with a bonus!
        if (dino.justGroundPounded) {
          plat.collapsed = true;
          outcome.bonusEvents.push({
            label: '+20 BRIDGE SMASH!',
            points: 20,
            x: plat.x,
            y: plat.y,
            z: plat.z,
          });
        }
      }

      if (plat.steppedOn && !plat.collapsed) {
        plat.crumbleTimer -= dt;
        if (plat.crumbleTimer <= 0) {
          plat.collapsed = true;
        }
      }
    }

    // Forgiving inner hurtbox for the Dino (expanded into a giant stomp box during Mega-Rex Overdrive!)
    const f = isMega ? 1.35 : CONFIG.HURTBOX_FORGIVENESS;
    const dHalfW = dino.width * 0.5 * f;
    const dHalfD = dino.depth * 0.5 * f;
    const dMinX = dino.x - dHalfW;
    const dMaxX = dino.x + dHalfW;
    const dMinY = dino.y + 0.06;
    const dMaxY = dino.y + dino.height * (isMega ? CONFIG.MEGA_SCALE : dino.isDucking ? 0.92 : 0.9);
    const dMinZ = dino.z - dHalfD;
    const dMaxZ = dino.z + dHalfD;

    // 3. Evaluate obstacles
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (!obs.active || obs.shattered || obs.kind === 'chasm') continue;

      const oHalfW = obs.width * 0.5 * f;
      const oHalfD = obs.depth * 0.5 * f;
      const oMinX = obs.x - oHalfW;
      const oMaxX = obs.x + oHalfW;
      const oMinY = obs.y;
      const oMaxY = obs.y + obs.height * f;
      const oMinZ = obs.z - oHalfD;
      const oMaxZ = obs.z + oHalfD;

      const overlapX = dMinX <= oMaxX && dMaxX >= oMinX;
      const overlapY = dMinY <= oMaxY && dMaxY >= oMinY;
      const overlapZ = dMinZ <= oMaxZ && dMaxZ >= oMinZ;

      if (overlapX && overlapY && overlapZ) {
        if (obs.kind === 'amber_pickup') {
          obs.active = false;
          outcome.collectedAmberIds.push(obs.id);
          outcome.bonusEvents.push({
            label: '+30 AMBER!',
            points: 30,
            x: obs.x,
            y: obs.y + 0.8,
            z: obs.z,
          });
          continue;
        }

        if (obs.kind === 'geyser') {
          obs.active = false;
          outcome.triggeredGeyserIds.push(obs.id);
          outcome.bonusEvents.push({
            label: '+15 GEYSER LIFT!',
            points: 15,
            x: obs.x,
            y: obs.y + 1,
            z: obs.z,
          });
          continue;
        }

        if (obs.kind === 'tar_patch') {
          if (!isMega) outcome.steppedTar = true;
          continue;
        }

        // Giant Mega-Rex stomps EVERY hazard & jams Wi-Fi Relays effortlessly!
        if (isMega) {
          obs.shattered = true;
          obs.active = false;
          outcome.megaStompedIds.push(obs.id);
          if (obs.kind === 'wifi_relay') {
            outcome.jammedRelayIds.push(obs.id);
            outcome.bonusEvents.push({
              label: '+40 RELAY STOMPED!',
              points: 40,
              x: obs.x,
              y: obs.y + 1.5,
              z: obs.z,
            });
          } else {
            outcome.bonusEvents.push({
              label: '+20 MEGA STOMP!',
              points: 20,
              x: obs.x,
              y: obs.y + 1.5,
              z: obs.z,
            });
          }
          continue;
        }

        if (
          (obs.kind === 'boulder_cracked' || obs.kind === 'wifi_relay') &&
          (dino.isDashing || dino.isFastDropping || dino.justGroundPounded)
        ) {
          obs.shattered = true;
          obs.active = false;
          outcome.smashedObstacleIds.push(obs.id);
          if (obs.kind === 'wifi_relay') {
            outcome.jammedRelayIds.push(obs.id);
            outcome.bonusEvents.push({
              label: '+40 SIGNAL JAMMED!',
              points: 40,
              x: obs.x,
              y: obs.y + 1.3,
              z: obs.z,
            });
          } else {
            outcome.bonusEvents.push({
              label: '+25 SMASH!',
              points: 25,
              x: obs.x,
              y: obs.y + 1.1,
              z: obs.z,
            });
          }
          continue;
        }

        // Roar-Dash or Post-Rewind Grace safely clears hazards
        if (hasGrace || (obs.kind === 'meteor_crater' && dino.isDashing)) {
          continue;
        }

        outcome.crashed = true;
        outcome.crashReason = obs.kind;
        return outcome;
      }

      // Near-miss check: genuine hazard just passed Dino's Z plane without hitting
      const isGenuineHazard =
        obs.kind !== 'amber_pickup' && obs.kind !== 'tar_patch' && obs.kind !== 'geyser';
      if (isGenuineHazard && !obs.nearMissAwarded && obs.z > dino.z + 0.3 && obs.z < dino.z + 4.5) {
        const dx = Math.max(0, Math.abs(dino.x - obs.x) - (dHalfW + oHalfW));
        const dy =
          dMaxY < oMinY
            ? oMinY - dMaxY
            : dMinY > oMaxY
            ? dMinY - oMaxY
            : 0;
        const clearance = Math.hypot(dx, dy);
        if (clearance <= CONFIG.NEAR_MISS_DISTANCE) {
          obs.nearMissAwarded = true;
          outcome.nearMissCount += 1;
          outcome.bonusEvents.push({
            label: '+15 CLOSE CALL!',
            points: 15,
            x: dino.x,
            y: dino.y + dino.height,
            z: dino.z,
          });
        }
      }
    }

    // 4. Evaluate active Meteor impact blasts
    for (let i = 0; i < meteors.length; i++) {
      const m = meteors[i];
      if (!m.active || !m.impacted || m.blastTimer <= 0) continue;

      const distXZ = Math.hypot(dino.x - m.x, dino.z - m.z);
      const inVerticalBlast = dino.y < m.targetY + 1.9 && dino.y + dino.height > m.targetY - 0.5;

      if (distXZ <= CONFIG.METEOR_BLAST_RADIUS * (isMega ? 1.2 : CONFIG.HURTBOX_FORGIVENESS) && inVerticalBlast) {
        if (isMega) {
          m.blastTimer = 0;
          outcome.bonusEvents.push({
            label: '+50 METEOR HEADBUTT!',
            points: 50,
            x: m.x,
            y: m.targetY + 2.5,
            z: m.z,
          });
          continue;
        }
        if (!dino.isDashing && !hasGrace) {
          outcome.crashed = true;
          outcome.crashReason = 'meteor_blast';
          return outcome;
        }
      }
    }

    // 5. Evaluate sweeping Wi-Fi Satellite Laser Scan-Beam
    if (
      activeWifiBeamLane !== null &&
      dino.lane === activeWifiBeamLane &&
      dino.y < 2.0 &&
      !dino.isDashing &&
      !isMega &&
      !hasGrace
    ) {
      outcome.crashed = true;
      outcome.crashReason = 'wifi_beam';
      return outcome;
    }

    return outcome;
  }
}
