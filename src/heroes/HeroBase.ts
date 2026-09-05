import * as THREE from 'three';
import { sounds } from '../audio/SoundManager';
import { PhysicsWorld } from '../core/Physics';

export type Team = 'blue' | 'red';
export type HeroType = 'striker' | 'vanguard' | 'specter' | 'remedy';

export interface AbilityInfo {
  name: string;
  cooldown: number;
  currentCooldown: number;
  description: string;
}

export abstract class HeroBase {
  public id: string;
  public name: string;
  public heroType: HeroType;
  public team: Team;
  public isLocalPlayer: boolean;

  // Stats
  public maxHealth: number;
  public health: number;
  public maxShield: number;
  public shield: number;
  public moveSpeed: number = 8.0;
  public jumpSpeed: number = 10.5;

  // Weapon Stats
  public ammo: number;
  public maxAmmo: number;
  public reloadTime: number = 1.5;
  public reloadTimer: number = 0;
  public isReloading: boolean = false;
  public fireRate: number = 0.1; // Seconds between shots
  public fireTimer: number = 0;

  // Ultimate
  public ultimateCharge: number = 0; // 0 to 100%
  public ultimateActive: boolean = false;
  public ultimateDuration: number = 6.0;
  public ultimateTimer: number = 0;

  // Abilities
  public secondaryAbility: AbilityInfo;
  public abilityShift: AbilityInfo;
  public abilityE: AbilityInfo;

  // State & Transform
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public rotation: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  public isGrounded: boolean = false;
  public isAlive: boolean = true;
  public respawnTimer: number = 0;

  // 3D Objects
  public model3D: THREE.Group; // Third-person representation
  public fpWeaponMesh: THREE.Group; // First-person viewmodel
  protected headMesh?: THREE.Mesh;
  protected bodyMesh?: THREE.Mesh;

  // Physics & World reference
  public physics: PhysicsWorld;
  public scene: THREE.Scene;

  // Scoring
  public kills: number = 0;
  public deaths: number = 0;
  public damageDealt: number = 0;
  public healingDone: number = 0;

  constructor(
    id: string,
    name: string,
    heroType: HeroType,
    team: Team,
    isLocalPlayer: boolean,
    physics: PhysicsWorld,
    scene: THREE.Scene,
    maxHealth: number,
    maxShield: number,
    maxAmmo: number,
    fireRate: number,
    secondaryInfo: AbilityInfo,
    shiftInfo: AbilityInfo,
    eInfo: AbilityInfo
  ) {
    this.id = id;
    this.name = name;
    this.heroType = heroType;
    this.team = team;
    this.isLocalPlayer = isLocalPlayer;
    this.physics = physics;
    this.scene = scene;

    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.maxShield = maxShield;
    this.shield = maxShield;

    this.maxAmmo = maxAmmo;
    this.ammo = maxAmmo;
    this.fireRate = fireRate;

    this.secondaryAbility = secondaryInfo;
    this.abilityShift = shiftInfo;
    this.abilityE = eInfo;

    this.model3D = new THREE.Group();
    this.fpWeaponMesh = new THREE.Group();

    this.createThirdPersonModel();
    if (this.isLocalPlayer) {
      this.createFirstPersonWeapon();
    } else {
      this.scene.add(this.model3D);
    }
  }

  protected abstract createThirdPersonModel(): void;
  protected abstract createFirstPersonWeapon(): void;

  public abstract firePrimary(direction: THREE.Vector3, origin: THREE.Vector3): void;
  public abstract fireSecondary(direction: THREE.Vector3, origin: THREE.Vector3): void;
  public abstract useAbilityShift(direction: THREE.Vector3): void;
  public abstract useAbilityE(direction: THREE.Vector3): void;
  public abstract useUltimate(): void;

  public update(dt: number): void {
    if (!this.isAlive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    // Ability cooldowns
    if (this.secondaryAbility.currentCooldown > 0) {
      this.secondaryAbility.currentCooldown = Math.max(0, this.secondaryAbility.currentCooldown - dt);
    }
    if (this.abilityShift.currentCooldown > 0) {
      this.abilityShift.currentCooldown = Math.max(0, this.abilityShift.currentCooldown - dt);
    }
    if (this.abilityE.currentCooldown > 0) {
      this.abilityE.currentCooldown = Math.max(0, this.abilityE.currentCooldown - dt);
    }

    // Fire timer
    if (this.fireTimer > 0) {
      this.fireTimer -= dt;
    }

    // Reload timer
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.ammo = this.maxAmmo;
        this.isReloading = false;
      }
    }

    // Ultimate timer
    if (this.ultimateActive) {
      this.ultimateTimer -= dt;
      if (this.ultimateTimer <= 0) {
        this.ultimateActive = false;
      }
    } else {
      // Passive ult charge (1% every 3s)
      this.ultimateCharge = Math.min(100, this.ultimateCharge + (100 / 180) * dt);
    }

    // Shield auto-recharge if unhit for 4s
    if (this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + 20 * dt);
    }

    // Update 3D Model position & orientation
    this.model3D.position.copy(this.position);
    this.model3D.rotation.y = this.rotation.y;
  }

  public reload(): void {
    if (this.isReloading || this.ammo === this.maxAmmo) return;
    this.isReloading = true;
    this.reloadTimer = this.reloadTime;
    if (this.isLocalPlayer) {
      sounds.playReload();
    }
  }

  public takeDamage(
    amount: number,
    isHeadshot: boolean = false,
    attacker?: HeroBase
  ): { damageTaken: number; killed: boolean } {
    if (!this.isAlive) return { damageTaken: 0, killed: false };

    let dmg = amount * (isHeadshot ? 2.0 : 1.0);

    // Absorb with shield first
    if (this.shield > 0) {
      const shieldDmg = Math.min(this.shield, dmg);
      this.shield -= shieldDmg;
      dmg -= shieldDmg;
    }

    this.health -= dmg;

    if (attacker) {
      attacker.damageDealt += amount;
      attacker.ultimateCharge = Math.min(100, attacker.ultimateCharge + amount * 0.15);
    }

    if (this.health <= 0) {
      this.health = 0;
      this.die(attacker);
      return { damageTaken: amount, killed: true };
    }

    return { damageTaken: amount, killed: false };
  }

  public heal(amount: number, healer?: HeroBase): number {
    if (!this.isAlive) return 0;
    const missing = this.maxHealth - this.health;
    const actualHeal = Math.min(missing, amount);
    this.health += actualHeal;

    if (healer && healer !== this) {
      healer.healingDone += actualHeal;
      healer.ultimateCharge = Math.min(100, healer.ultimateCharge + actualHeal * 0.12);
    }

    return actualHeal;
  }

  protected die(killer?: HeroBase): void {
    this.isAlive = false;
    this.deaths++;
    this.respawnTimer = 6.0;
    this.model3D.visible = false;

    if (killer) {
      killer.kills++;
    }
  }

  public respawn(): void {
    this.isAlive = true;
    this.health = this.maxHealth;
    this.shield = this.maxShield;
    this.ammo = this.maxAmmo;
    this.isReloading = false;
    this.model3D.visible = !this.isLocalPlayer;

    // Respawn position
    const spawnZ = this.team === 'blue' ? 38 : -38;
    const spawnX = (Math.random() - 0.5) * 12;
    this.position.set(spawnX, 2.0, spawnZ);
    this.velocity.set(0, 0, 0);
  }

  // Visual helper: Weapon recoil jerk
  protected triggerWeaponRecoil(): void {
    if (!this.isLocalPlayer || !this.fpWeaponMesh) return;
    this.fpWeaponMesh.position.z += 0.08;
    this.fpWeaponMesh.rotation.x += 0.05;
  }

  public updateWeaponBobbing(isMoving: boolean, dt: number): void {
    if (!this.isLocalPlayer || !this.fpWeaponMesh) return;
    // Return to resting position
    this.fpWeaponMesh.position.z += (0 - this.fpWeaponMesh.position.z) * 10 * dt;
    this.fpWeaponMesh.rotation.x += (0 - this.fpWeaponMesh.rotation.x) * 10 * dt;

    if (isMoving && this.isGrounded) {
      const time = Date.now() * 0.008;
      this.fpWeaponMesh.position.x = 0.25 + Math.sin(time) * 0.015;
      this.fpWeaponMesh.position.y = -0.25 + Math.abs(Math.cos(time)) * 0.02;
    } else {
      this.fpWeaponMesh.position.x += (0.25 - this.fpWeaponMesh.position.x) * 5 * dt;
      this.fpWeaponMesh.position.y += (-0.25 - this.fpWeaponMesh.position.y) * 5 * dt;
    }
  }
}
