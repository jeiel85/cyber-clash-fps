import * as THREE from 'three';
import { HeroBase, Team } from './HeroBase';
import { PhysicsWorld, Projectile } from '../core/Physics';
import { sounds } from '../audio/SoundManager';

export class Striker extends HeroBase {
  private isSprinting: boolean = false;
  private bioticFieldMesh: THREE.Group | null = null;
  private bioticFieldTimer: number = 0;

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
      'striker',
      team,
      isLocalPlayer,
      physics,
      scene,
      200, // Health
      0,   // Shield
      25,  // Ammo
      0.11, // Fire Rate
      {
        name: 'HELIX ROCKET',
        cooldown: 7.0,
        currentCooldown: 0,
        description: '3연장 나선 로켓을 발사하여 강력한 범위 폭발 피해를 입힙니다.',
      },
      {
        name: 'SPRINT',
        cooldown: 0,
        currentCooldown: 0,
        description: '이동 속도를 크게 증가시켜 전장을 빠르게 이동합니다.',
      },
      {
        name: 'BIOTIC FIELD',
        cooldown: 14.0,
        currentCooldown: 0,
        description: '바닥에 생체장을 설치하여 범위 내 아군과 자신을 치유합니다.',
      }
    );
  }

  protected createThirdPersonModel(): void {
    const teamColor = this.team === 'blue' ? 0x00aaff : 0xff3344;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: teamColor,
      metalness: 0.6,
      roughness: 0.4,
    });
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1a2233,
      metalness: 0.8,
      roughness: 0.2,
    });

    // Body (Torso)
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.4);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    this.model3D.add(torso);
    this.bodyMesh = torso;

    // Head
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const head = new THREE.Mesh(headGeo, armorMat);
    head.position.y = 1.75;
    head.castShadow = true;

    // Visor glow
    const visorGeo = new THREE.BoxGeometry(0.35, 0.1, 0.15);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.05, 0.18);
    head.add(visor);

    this.model3D.add(head);
    this.headMesh = head;

    // Weapon in hand
    const gunGeo = new THREE.BoxGeometry(0.15, 0.2, 0.9);
    const gun = new THREE.Mesh(gunGeo, armorMat);
    gun.position.set(0.45, 1.0, 0.35);
    gun.castShadow = true;
    this.model3D.add(gun);
  }

  protected createFirstPersonWeapon(): void {
    const matMetal = new THREE.MeshStandardMaterial({
      color: 0x222a38,
      metalness: 0.8,
      roughness: 0.3,
    });
    const matGlow = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // Gun body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.6), matMetal);
    body.position.set(0, 0, -0.3);
    this.fpWeaponMesh.add(body);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), matMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.65);
    this.fpWeaponMesh.add(barrel);

    // Neon accent strip
    const neon = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.4), matGlow);
    neon.position.set(0.051, 0.04, -0.3);
    this.fpWeaponMesh.add(neon);

    this.fpWeaponMesh.position.set(0.25, -0.25, -0.4);
  }

  public override update(dt: number): void {
    super.update(dt);

    // Biotic Field healing logic
    if (this.bioticFieldMesh) {
      this.bioticFieldTimer -= dt;
      // Pulse animation
      const ring = this.bioticFieldMesh.children[0];
      if (ring) {
        ring.rotation.z += 1.5 * dt;
      }

      // Check distance for self heal
      const dist = this.position.distanceTo(this.bioticFieldMesh.position);
      if (dist < 4.5 && this.isAlive) {
        this.heal(35 * dt, this);
      }

      if (this.bioticFieldTimer <= 0) {
        this.scene.remove(this.bioticFieldMesh);
        this.bioticFieldMesh = null;
      }
    }
  }

  public setSprinting(sprinting: boolean): void {
    this.isSprinting = sprinting;
    this.moveSpeed = this.isSprinting ? 12.5 : 8.0;
  }

  public firePrimary(direction: THREE.Vector3, origin: THREE.Vector3): void {
    if (!this.isAlive || this.fireTimer > 0 || this.isReloading) return;
    if (this.ammo <= 0 && !this.ultimateActive) {
      this.reload();
      return;
    }

    if (!this.ultimateActive) {
      this.ammo--;
    }

    this.fireTimer = this.ultimateActive ? 0.06 : this.fireRate;
    this.triggerWeaponRecoil();

    if (this.isLocalPlayer) {
      sounds.playPulseShot();
    }

    // Hitscan bullet tracer
    const raycast = this.physics.raycastWorld(origin, direction, 100);
    this.createBulletTracer(origin, raycast.point);
  }

  private createBulletTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({
      color: this.ultimateActive ? 0xff3300 : 0x00f0ff,
      linewidth: 2,
    });
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
      sounds.playRocketLaunch();
    }

    // Spawn Helix Rocket projectile
    const rocketGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8);
    const rocketMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const rocketMesh = new THREE.Mesh(rocketGeo, rocketMat);
    rocketMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());

    const proj: Projectile = {
      id: `helix_${Math.random().toString(36).substring(2, 8)}`,
      ownerId: this.id,
      team: this.team,
      position: origin.clone(),
      velocity: direction.clone().normalize().multiplyScalar(45.0),
      radius: 0.3,
      damage: 120,
      splashRadius: 3.5,
      lifetime: 3.0,
      mesh: rocketMesh,
    };

    this.physics.addProjectile(proj);
  }

  public useAbilityShift(direction: THREE.Vector3): void {
    this.setSprinting(true);
  }

  public useAbilityE(direction: THREE.Vector3): void {
    if (!this.isAlive || this.abilityE.currentCooldown > 0) return;
    this.abilityE.currentCooldown = this.abilityE.cooldown;

    // Drop Biotic Field beacon
    if (this.bioticFieldMesh) {
      this.scene.remove(this.bioticFieldMesh);
    }

    const group = new THREE.Group();
    group.position.set(this.position.x, 0.05, this.position.z);

    // Glowing circle
    const ringGeo = new THREE.RingGeometry(3.8, 4.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    // Center emitter beacon
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00 })
    );
    beacon.position.y = 0.25;
    group.add(beacon);

    this.scene.add(group);
    this.bioticFieldMesh = group;
    this.bioticFieldTimer = 5.0;

    if (this.isLocalPlayer) {
      sounds.playHealthPickup();
    }
  }

  public useUltimate(): void {
    if (!this.isAlive || this.ultimateCharge < 100) return;
    this.ultimateCharge = 0;
    this.ultimateActive = true;
    this.ultimateTimer = 6.0;
    this.ammo = this.maxAmmo;

    if (this.isLocalPlayer) {
      sounds.playUltimateActivate();
    }
  }
}
