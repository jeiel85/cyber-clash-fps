import * as THREE from 'three';
import { HeroBase, Team } from './HeroBase';
import { PhysicsWorld, Projectile } from '../core/Physics';
import { sounds } from '../audio/SoundManager';

export class Remedy extends HeroBase {
  private outOfCombatTimer: number = 0;
  private wardMesh: THREE.Group | null = null;
  private wardTimer: number = 0;
  public isGliding: boolean = false;

  constructor(
    id: string,
    name: string,
    team: Team,
    isLocalPlayer: boolean,
    physics: PhysicsWorld,
    scene: THREE.Scene
  ) {
    super(
      id,
      name,
      'remedy',
      team,
      isLocalPlayer,
      physics,
      scene,
      200, // Health
      0,   // Shield
      20,  // Ammo
      0.16, // Fire Rate
      {
        name: 'BIOTIC ORB',
        cooldown: 8.0,
        currentCooldown: 0,
        description: '지형을 튕기며 주변 아군을 연속으로 치유하는 생체 구체를 발사합니다.',
      },
      {
        name: 'ANGELIC GLIDE',
        cooldown: 4.0,
        currentCooldown: 0,
        description: '날개를 펼쳐 전방 및 상공으로 도약하며 서서히 활공합니다.',
      },
      {
        name: 'REGEN WARD',
        cooldown: 15.0,
        currentCooldown: 0,
        description: '재생 드론을 전개하여 범위 내 아군들의 체력을 급속 회복시킵니다.',
      }
    );
  }

  protected createThirdPersonModel(): void {
    const teamColor = this.team === 'blue' ? 0x00ccaa : 0xee55aa;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xddf0ee,
      metalness: 0.3,
      roughness: 0.4,
    });
    const wingMat = new THREE.MeshBasicMaterial({
      color: teamColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.35), bodyMat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    this.model3D.add(torso);
    this.bodyMesh = torso;

    // Head with halo / headset
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), bodyMat);
    head.position.y = 1.7;
    head.castShadow = true;

    // Halo
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.28, 16),
      new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.28;
    head.add(halo);

    this.model3D.add(head);
    this.headMesh = head;

    // Holographic Energy Wings
    const leftWing = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.2), wingMat);
    leftWing.position.set(-0.5, 1.4, -0.2);
    leftWing.rotation.z = -0.5;
    const rightWing = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.2), wingMat);
    rightWing.position.set(0.5, 1.4, -0.2);
    rightWing.rotation.z = 0.5;
    this.model3D.add(leftWing);
    this.model3D.add(rightWing);

    // Caduceus Staff / Blaster
    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8 })
    );
    staff.rotation.x = Math.PI / 4;
    staff.position.set(0.4, 0.9, 0.4);
    this.model3D.add(staff);
  }

  protected createFirstPersonWeapon(): void {
    const matWhite = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      metalness: 0.6,
      roughness: 0.3,
    });
    const matGlow = new THREE.MeshBasicMaterial({ color: 0x00ffaa });

    // Caduceus blaster body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.5), matWhite);
    body.position.set(0, 0, -0.25);
    this.fpWeaponMesh.add(body);

    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), matGlow);
    tip.position.set(0, 0.02, -0.55);
    this.fpWeaponMesh.add(tip);

    this.fpWeaponMesh.position.set(0.24, -0.25, -0.35);
  }

  public override update(dt: number): void {
    super.update(dt);

    // Passive self-heal when out of combat for 2.5s
    this.outOfCombatTimer += dt;
    if (this.outOfCombatTimer >= 2.5 && this.isAlive && this.health < this.maxHealth) {
      this.heal(22 * dt);
    }

    // Angelic glide physics
    if (this.isGliding && this.velocity.y < -2.0) {
      this.velocity.y = -2.0; // Slow descent rate
    }

    // Regen ward drone
    if (this.wardMesh) {
      this.wardTimer -= dt;
      this.wardMesh.rotation.y += 2.0 * dt;

      // Heal nearby
      const dist = this.position.distanceTo(this.wardMesh.position);
      if (dist < 8.0 && this.isAlive) {
        this.heal(55 * dt, this);
      }

      if (this.wardTimer <= 0) {
        this.scene.remove(this.wardMesh);
        this.wardMesh = null;
      }
    }

    // Ultimate Valkyrie active
    if (this.ultimateActive) {
      // Free vertical lift
      this.velocity.y = Math.max(this.velocity.y, 4.0);
      this.heal(60 * dt, this);
    }
  }

  public override takeDamage(amount: number, isHeadshot: boolean = false, attacker?: HeroBase) {
    this.outOfCombatTimer = 0;
    return super.takeDamage(amount, isHeadshot, attacker);
  }

  public firePrimary(direction: THREE.Vector3, origin: THREE.Vector3): void {
    if (!this.isAlive || this.fireTimer > 0 || this.isReloading) return;
    if (this.ammo <= 0) {
      this.reload();
      return;
    }

    this.ammo--;
    this.fireTimer = this.fireRate;
    this.triggerWeaponRecoil();

    if (this.isLocalPlayer) {
      sounds.playHealDart();
    }

    // Caduceus plasma bolt
    const raycast = this.physics.raycastWorld(origin, direction, 80);
    const geo = new THREE.BufferGeometry().setFromPoints([origin, raycast.point]);
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffaa, linewidth: 2 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    setTimeout(() => {
      this.scene.remove(line);
      geo.dispose();
      mat.dispose();
    }, 45);
  }

  public fireSecondary(direction: THREE.Vector3, origin: THREE.Vector3): void {
    if (!this.isAlive || this.secondaryAbility.currentCooldown > 0) return;
    this.secondaryAbility.currentCooldown = this.secondaryAbility.cooldown;

    if (this.isLocalPlayer) {
      sounds.playHealDart();
    }

    // Biotic Healing Orb Projectile
    const orbGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const orbMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const orbMesh = new THREE.Mesh(orbGeo, orbMat);

    const proj: Projectile = {
      id: `orb_${Math.random().toString(36).substring(2, 8)}`,
      ownerId: this.id,
      team: this.team,
      position: origin.clone(),
      velocity: direction.clone().normalize().multiplyScalar(16.0),
      radius: 0.5,
      damage: 0,
      splashRadius: 5.0,
      isHealing: true,
      lifetime: 8.0,
      mesh: orbMesh,
    };

    this.physics.addProjectile(proj);
  }

  public useAbilityShift(direction: THREE.Vector3): void {
    if (!this.isAlive || this.abilityShift.currentCooldown > 0) return;
    this.abilityShift.currentCooldown = this.abilityShift.cooldown;

    // Angelic leap upwards and forward
    this.velocity.y = 15.0;
    this.velocity.x += direction.x * 12.0;
    this.velocity.z += direction.z * 12.0;
    this.isGliding = true;

    if (this.isLocalPlayer) {
      sounds.playJump();
    }
  }

  public useAbilityE(direction: THREE.Vector3): void {
    if (!this.isAlive || this.abilityE.currentCooldown > 0) return;
    this.abilityE.currentCooldown = this.abilityE.cooldown;

    if (this.wardMesh) {
      this.scene.remove(this.wardMesh);
    }

    // Deploy floating drone ward
    const group = new THREE.Group();
    group.position.copy(this.position);
    group.position.y += 2.0;

    const droneGeo = new THREE.IcosahedronGeometry(0.4);
    const droneMat = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00aa88,
    });
    const drone = new THREE.Mesh(droneGeo, droneMat);
    group.add(drone);

    // Glowing aura circle on ground
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(7.5, 8.0, 32),
      new THREE.MeshBasicMaterial({ color: 0x00ffaa, side: THREE.DoubleSide })
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = -1.95;
    group.add(aura);

    this.scene.add(group);
    this.wardMesh = group;
    this.wardTimer = 6.0;

    if (this.isLocalPlayer) {
      sounds.playHealthPickup();
    }
  }

  public useUltimate(): void {
    if (!this.isAlive || this.ultimateCharge < 100) return;
    this.ultimateCharge = 0;
    this.ultimateActive = true;
    this.ultimateTimer = 8.0;

    if (this.isLocalPlayer) {
      sounds.playUltimateActivate();
    }
  }
}
