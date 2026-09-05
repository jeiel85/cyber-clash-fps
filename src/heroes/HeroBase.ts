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

  // Overhead Health Bar & Nameplate Sprite
  private nameplateSprite?: THREE.Sprite;
  private nameplateCanvas?: HTMLCanvasElement;
  private nameplateTexture?: THREE.CanvasTexture;

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
    this.setupOverheadNameplate();

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

  // 3D Overhead Health Bar & Nameplate
  private setupOverheadNameplate(): void {
    if (this.isLocalPlayer) return; // Local player has screen HUD

    this.nameplateCanvas = document.createElement('canvas');
    this.nameplateCanvas.width = 256;
    this.nameplateCanvas.height = 96;

    this.nameplateTexture = new THREE.CanvasTexture(this.nameplateCanvas);
    this.nameplateTexture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.nameplateTexture,
      transparent: true,
      depthTest: false, // Visible through obstacles if targeted
    });

    this.nameplateSprite = new THREE.Sprite(spriteMat);
    this.nameplateSprite.scale.set(2.4, 0.9, 1);
    this.nameplateSprite.position.set(0, 2.5, 0);

    this.model3D.add(this.nameplateSprite);
    this.updateOverheadNameplate();
  }

  public updateOverheadNameplate(): void {
    if (!this.nameplateCanvas || !this.nameplateTexture) return;

    const ctx = this.nameplateCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 256, 96);

    const isEnemy = this.team === 'red';
    const primaryColor = isEnemy ? '#ff2244' : '#00aaff';
    const teamBadge = isEnemy ? 'RED TEAM' : 'BLUE TEAM';

    // Rounded background box
    ctx.fillStyle = 'rgba(8, 14, 26, 0.88)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 80, 8);
    ctx.fill();

    // Border
    ctx.lineWidth = 3;
    ctx.strokeStyle = primaryColor;
    ctx.stroke();

    // Name & Team label
    ctx.font = 'bold 20px Rajdhani, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${this.name.toUpperCase()} [${this.heroType.toUpperCase()}]`, 20, 36);

    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = primaryColor;
    ctx.fillText(teamBadge, 175, 36);

    // Health bar background
    ctx.fillStyle = '#222938';
    ctx.fillRect(20, 46, 216, 16);

    // Health bar fill
    const totalHp = Math.max(0, this.health + this.shield);
    const maxTotal = this.maxHealth + this.maxShield;
    const hpPct = Math.min(1, Math.max(0, totalHp / maxTotal));

    ctx.fillStyle = isEnemy ? '#ff3344' : '#00ff88';
    ctx.fillRect(20, 46, 216 * hpPct, 16);

    // HP Text
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.ceil(totalHp)} / ${maxTotal}`, 105, 59);

    this.nameplateTexture.needsUpdate = true;
  }

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
      this.updateOverheadNameplate();
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
    this.updateOverheadNameplate();

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
    this.updateOverheadNameplate();

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
    this.updateOverheadNameplate();

    // Respawn position
    const spawnZ = this.team === 'blue' ? 38 : -38;
    const spawnX = (Math.random() - 0.5) * 12;
    this.position.set(spawnX, 2.0, spawnZ);
    this.velocity.set(0, 0, 0);
  }

  protected triggerWeaponRecoil(): void {
    if (!this.isLocalPlayer || !this.fpWeaponMesh) return;
    this.fpWeaponMesh.position.z += 0.08;
    this.fpWeaponMesh.rotation.x += 0.05;
  }

  public updateWeaponBobbing(isMoving: boolean, dt: number): void {
    if (!this.isLocalPlayer || !this.fpWeaponMesh) return;
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
