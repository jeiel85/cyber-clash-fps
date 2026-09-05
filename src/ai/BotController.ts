import * as THREE from 'three';
import { HeroBase, Team, HeroType } from '../heroes/HeroBase';
import { Striker } from '../heroes/Striker';
import { Vanguard } from '../heroes/Vanguard';
import { Specter } from '../heroes/Specter';
import { Remedy } from '../heroes/Remedy';
import { PhysicsWorld } from '../core/Physics';
import { PickupManager } from '../world/Pickups';

export class BotController {
  public bots: HeroBase[] = [];
  public physics: PhysicsWorld;
  public scene: THREE.Scene;
  public pickups: PickupManager;

  constructor(physics: PhysicsWorld, scene: THREE.Scene, pickups: PickupManager) {
    this.physics = physics;
    this.scene = scene;
    this.pickups = pickups;
  }

  public createBot(name: string, heroType: HeroType, team: Team): HeroBase {
    const id = `bot_${Math.random().toString(36).substring(2, 8)}`;
    let bot: HeroBase;

    switch (heroType) {
      case 'vanguard':
        bot = new Vanguard(id, name, team, false, this.physics, this.scene);
        break;
      case 'specter':
        bot = new Specter(id, name, team, false, this.physics, this.scene);
        break;
      case 'remedy':
        bot = new Remedy(id, name, team, false, this.physics, this.scene);
        break;
      case 'striker':
      default:
        bot = new Striker(id, name, team, false, this.physics, this.scene);
        break;
    }

    // Set spawn point
    bot.respawn();
    this.bots.push(bot);
    return bot;
  }

  public clearBots(): void {
    for (const b of this.bots) {
      this.scene.remove(b.model3D);
    }
    this.bots = [];
  }

  public update(
    dt: number,
    allHeroes: HeroBase[],
    objectivePos: THREE.Vector3
  ): void {
    for (const bot of this.bots) {
      bot.update(dt);
      if (!bot.isAlive) continue;

      // 1. Target evaluation: find closest enemy
      let closestEnemy: HeroBase | null = null;
      let closestEnemyDist = Infinity;
      let lowestAlly: HeroBase | null = null;
      let lowestAllyHpPct = 1.0;

      for (const other of allHeroes) {
        if (!other.isAlive || other === bot) continue;

        const dist = bot.position.distanceTo(other.position);
        if (other.team !== bot.team) {
          if (dist < closestEnemyDist) {
            closestEnemyDist = dist;
            closestEnemy = other;
          }
        } else {
          const hpPct = other.health / other.maxHealth;
          if (hpPct < lowestAllyHpPct) {
            lowestAllyHpPct = hpPct;
            lowestAlly = other;
          }
        }
      }

      // 2. Determine target position
      let targetMovePos = objectivePos.clone();

      // Check if low on health and should seek a medkit
      if (bot.health < bot.maxHealth * 0.45) {
        let closestPackDist = Infinity;
        let bestPackPos: THREE.Vector3 | null = null;
        for (const p of this.pickups.pickups) {
          if (!p.active) continue;
          const pDist = bot.position.distanceTo(p.position);
          if (pDist < closestPackDist) {
            closestPackDist = pDist;
            bestPackPos = p.position;
          }
        }
        if (bestPackPos) {
          targetMovePos = bestPackPos.clone();
        }
      } else if (bot.heroType === 'remedy' && lowestAlly && lowestAllyHpPct < 0.8) {
        // Remedy follows lowest ally
        targetMovePos = lowestAlly.position.clone();
      } else if (bot.heroType === 'specter' && closestEnemy && closestEnemyDist < 18) {
        // Sniper retreats to maintain distance
        const retreatDir = bot.position.clone().sub(closestEnemy.position).setY(0).normalize();
        targetMovePos = bot.position.clone().add(retreatDir.multiplyScalar(15));
      } else if (closestEnemy && closestEnemyDist < 30) {
        // Move into combat range with jitter/strafe
        const strafeOffset = new THREE.Vector3(
          Math.sin(Date.now() * 0.003 + bot.position.x) * 4.0,
          0,
          Math.cos(Date.now() * 0.003 + bot.position.z) * 4.0
        );
        targetMovePos = closestEnemy.position.clone().add(strafeOffset);
      }

      // 3. Movement execution
      const moveVec = targetMovePos.clone().sub(bot.position).setY(0);
      const distToTarget = moveVec.length();

      if (distToTarget > 1.2) {
        moveVec.normalize();
        bot.velocity.x = moveVec.x * bot.moveSpeed;
        bot.velocity.z = moveVec.z * bot.moveSpeed;
      } else {
        bot.velocity.x = 0;
        bot.velocity.z = 0;
      }

      // Physics integration
      const physRes = this.physics.movePlayer(bot.position, bot.velocity, 0.45, 1.8, dt);
      bot.isGrounded = physRes.onGround;

      // Jump if obstacle ahead or random jump in fight
      if (bot.isGrounded && Math.random() < 0.015) {
        bot.velocity.y = bot.jumpSpeed;
      }

      // Check health pickups
      const healed = this.pickups.checkPlayer(bot.position, bot.health, bot.maxHealth);
      if (healed > 0) {
        bot.heal(healed);
      }

      // 4. Combat & Aiming
      let aimTarget: THREE.Vector3 | null = null;
      if (bot.heroType === 'remedy' && lowestAlly && lowestAllyHpPct < 0.9) {
        aimTarget = lowestAlly.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      } else if (closestEnemy && closestEnemyDist < 45) {
        aimTarget = closestEnemy.position.clone().add(new THREE.Vector3(0, 1.3, 0));
      }

      if (aimTarget) {
        const eyePos = bot.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        const aimDir = aimTarget.clone().sub(eyePos).normalize();

        // Face target
        bot.rotation.y = Math.atan2(-aimDir.x, -aimDir.z);

        // Fire weapon
        if (closestEnemy && closestEnemyDist < 40) {
          // Add humanized aim imperfection
          const aimImperfect = aimDir.clone().add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.08,
              (Math.random() - 0.5) * 0.06,
              (Math.random() - 0.5) * 0.08
            )
          ).normalize();

          bot.firePrimary(aimImperfect, eyePos);

          // Ability usage logic
          this.handleBotAbilities(bot, aimDir, eyePos, closestEnemyDist, allHeroes);
        }
      } else {
        // Face movement direction
        if (moveVec.lengthSq() > 0.1) {
          bot.rotation.y = Math.atan2(-moveVec.x, -moveVec.z);
        }
      }
    }
  }

  private handleBotAbilities(
    bot: HeroBase,
    aimDir: THREE.Vector3,
    eyePos: THREE.Vector3,
    enemyDist: number,
    allHeroes: HeroBase[]
  ): void {
    // Ultimate check
    if (bot.ultimateCharge >= 100 && enemyDist < 25) {
      bot.useUltimate();
    }

    if (bot instanceof Striker) {
      if (enemyDist < 25 && bot.secondaryAbility.currentCooldown <= 0) {
        bot.fireSecondary(aimDir, eyePos);
      }
      if (bot.health < 110 && bot.abilityE.currentCooldown <= 0) {
        bot.useAbilityE(aimDir);
      }
    } else if (bot instanceof Vanguard) {
      if (bot.health < 260 && !bot.isShieldActive) {
        bot.setShieldActive(true);
      } else if (bot.isShieldActive && Math.random() < 0.02) {
        bot.setShieldActive(false);
      }
      if (enemyDist > 10 && enemyDist < 22 && bot.abilityShift.currentCooldown <= 0) {
        bot.useAbilityShift(aimDir);
      }
      if (enemyDist < 7 && bot.abilityE.currentCooldown <= 0) {
        bot.useAbilityE(aimDir);
      }
    } else if (bot instanceof Specter) {
      if (enemyDist > 18 && !bot.isScoped) {
        bot.setScoped(true);
      } else if (enemyDist < 12 && bot.isScoped) {
        bot.setScoped(false);
        if (bot.abilityShift.currentCooldown <= 0) {
          bot.useAbilityShift(aimDir.clone().negate()); // Blink backwards
        }
      }
    } else if (bot instanceof Remedy) {
      if (bot.secondaryAbility.currentCooldown <= 0) {
        bot.fireSecondary(aimDir, eyePos);
      }
      if (bot.health < 130 && bot.abilityE.currentCooldown <= 0) {
        bot.useAbilityE(aimDir);
      }
    }
  }
}
