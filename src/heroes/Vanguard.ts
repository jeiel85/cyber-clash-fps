import * as THREE from 'three';
import { HeroBase, Team } from './HeroBase';
import { PhysicsWorld } from '../core/Physics';
import { sounds } from '../audio/SoundManager';

export class Vanguard extends HeroBase {
  public isShieldActive: boolean = false;
  private shieldMesh: THREE.Mesh | null = null;
  public shieldHealth: number = 800;
  public maxShieldHealth: number = 800;

  public isCharging: boolean = false;
  private chargeDuration: number = 0;
  private chargeDirection: THREE.Vector3 = new THREE.Vector3();

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
      'vanguard',
      team,
      isLocalPlayer,
      physics,
      scene,
      300, // Health
      200, // Shield
      6,   // Ammo (Shotgun)
      0.65, // Fire Rate
      {
        name: 'PROJECTED BARRIER',
        cooldown: 2.0,
        currentCooldown: 0,
        description: '전방에 거대한 에너지 방벽을 전개하여 적의 공격을 차단합니다.',
      },
      {
        name: 'THRUSTER CHARGE',
        cooldown: 8.0,
        currentCooldown: 0,
        description: '부스터를 점화하여 전방으로 돌진, 경로상의 적을 들이받습니다.',
      },
      {
        name: 'SEISMIC SLAM',
        cooldown: 9.0,
        currentCooldown: 0,
        description: '지면을 강타하여 부채꼴 범위의 적들에게 피해와 둔화를 줍니다.',
      }
    );

    this.moveSpeed = 7.0; // Slightly bulkier
  }

  protected createThirdPersonModel(): void {
    const teamColor = this.team === 'blue' ? 0x0066ff : 0xcc2233;
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x2a3344,
      metalness: 0.85,
      roughness: 0.25,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: teamColor,
      metalness: 0.7,
      roughness: 0.3,
    });

    // Bulky Heavy Armor Torso
    const torsoGeo = new THREE.BoxGeometry(1.2, 1.2, 0.7);
    const torso = new THREE.Mesh(torsoGeo, armorMat);
    torso.position.y = 1.3;
    torso.castShadow = true;
    this.model3D.add(torso);
    this.bodyMesh = torso;

    // Shoulder plates
    const shoulderGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const leftShoulder = new THREE.Mesh(shoulderGeo, accentMat);
    leftShoulder.position.set(-0.75, 1.6, 0);
    const rightShoulder = new THREE.Mesh(shoulderGeo, accentMat);
    rightShoulder.position.set(0.75, 1.6, 0);
    this.model3D.add(leftShoulder);
    this.model3D.add(rightShoulder);

    // Heavy Helmet Head
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const head = new THREE.Mesh(headGeo, armorMat);
    head.position.y = 2.0;
    head.castShadow = true;

    // Glowing T-Visor
    const visorMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.2), visorMat);
    visor.position.set(0, 0, 0.2);
    head.add(visor);

    this.model3D.add(head);
    this.headMesh = head;

    // Heavy Flak Cannon
    const cannon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 1.0, 8),
      armorMat
    );
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0.65, 1.1, 0.4);
    this.model3D.add(cannon);

    // Deployable Barrier representation
    const barrierGeo = new THREE.BoxGeometry(3.2, 2.2, 0.1);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: this.team === 'blue' ? 0x00bbff : 0xff4433,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.9,
    });
    this.shieldMesh = new THREE.Mesh(barrierGeo, barrierMat);
    this.shieldMesh.position.set(0, 1.4, 1.5);
    this.shieldMesh.visible = false;
    this.model3D.add(this.shieldMesh);
  }

  protected createFirstPersonWeapon(): void {
    const matHeavy = new THREE.MeshStandardMaterial({
      color: 0x1a212d,
      metalness: 0.9,
      roughness: 0.2,
    });
    const matGlow = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    // Large Shotgun Barrel
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.7), matHeavy);
    barrel.position.set(0, 0, -0.35);
    this.fpWeaponMesh.add(barrel);

    const muzzles = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.1), matGlow);
    muzzles.position.set(0, 0, -0.72);
    this.fpWeaponMesh.add(muzzles);

    this.fpWeaponMesh.position.set(0.3, -0.3, -0.4);
  }

  public override update(dt: number): void {
    super.update(dt);

    // Charge dash physics
    if (this.isCharging) {
      this.chargeDuration -= dt;
      this.velocity.x = this.chargeDirection.x * 24.0;
      this.velocity.z = this.chargeDirection.z * 24.0;

      if (this.chargeDuration <= 0) {
        this.isCharging = false;
        this.velocity.set(0, 0, 0);
      }
    }

    // Barrier regeneration when inactive
    if (!this.isShieldActive && this.shieldHealth < this.maxShieldHealth) {
      this.shieldHealth = Math.min(this.maxShieldHealth, this.shieldHealth + 80 * dt);
    }

    // Ultimate electric discharge
    if (this.ultimateActive) {
      // Periodic pulse visual
      if (Math.random() < 0.3) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.5, 4.0, 16),
          new THREE.MeshBasicMaterial({ color: 0xffcc00, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(this.position);
        ring.position.y += 0.2;
        this.scene.add(ring);
        setTimeout(() => this.scene.remove(ring), 150);
      }
    }
  }

  public setShieldActive(active: boolean): void {
    this.isShieldActive = active && this.shieldHealth > 0;
    if (this.shieldMesh) {
      this.shieldMesh.visible = this.isShieldActive;
    }
  }

  public firePrimary(direction: THREE.Vector3, origin: THREE.Vector3): void {
    if (!this.isAlive || this.fireTimer > 0 || this.isReloading) return;
    if (this.isShieldActive) return; // Cannot shoot while holding shield
    if (this.ammo <= 0) {
      this.reload();
      return;
    }

    this.ammo--;
    this.fireTimer = this.fireRate;
    this.triggerWeaponRecoil();

    if (this.isLocalPlayer) {
      sounds.playShotgun();
    }

    // Shotgun pellet spread (8 pellets)
    const pelletCount = 8;
    for (let i = 0; i < pelletCount; i++) {
      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 0.12,
        (Math.random() - 0.5) * 0.12,
        (Math.random() - 0.5) * 0.12
      );
      const pelletDir = direction.clone().add(spread).normalize();
      const raycast = this.physics.raycastWorld(origin, pelletDir, 45);

      // Brief pellet line
      const geo = new THREE.BufferGeometry().setFromPoints([origin, raycast.point]);
      const mat = new THREE.LineBasicMaterial({ color: 0xffaa00 });
      const line = new THREE.Line(geo, mat);
      this.scene.add(line);
      setTimeout(() => {
        this.scene.remove(line);
        geo.dispose();
        mat.dispose();
      }, 40);
    }
  }

  public fireSecondary(direction: THREE.Vector3, origin: THREE.Vector3): void {
    // Toggle shield
    this.setShieldActive(!this.isShieldActive);
    if (this.isShieldActive && this.isLocalPlayer) {
      sounds.playBarrierDeploy();
    }
  }

  public useAbilityShift(direction: THREE.Vector3): void {
    if (!this.isAlive || this.abilityShift.currentCooldown > 0 || this.isCharging) return;
    this.abilityShift.currentCooldown = this.abilityShift.cooldown;

    this.isCharging = true;
    this.chargeDuration = 0.65;
    this.chargeDirection.copy(direction).setY(0).normalize();

    if (this.isLocalPlayer) {
      sounds.playJumpPad();
    }
  }

  public useAbilityE(direction: THREE.Vector3): void {
    if (!this.isAlive || this.abilityE.currentCooldown > 0) return;
    this.abilityE.currentCooldown = this.abilityE.cooldown;

    if (this.isLocalPlayer) {
      sounds.playExplosion();
    }

    // Visual ground slam shockwave ring
    const shockwave = new THREE.Mesh(
      new THREE.RingGeometry(1, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0xff7700, side: THREE.DoubleSide })
    );
    shockwave.rotation.x = -Math.PI / 2;
    shockwave.position.copy(this.position);
    shockwave.position.y = 0.1;
    this.scene.add(shockwave);
    setTimeout(() => this.scene.remove(shockwave), 300);
  }

  public useUltimate(): void {
    if (!this.isAlive || this.ultimateCharge < 100) return;
    this.ultimateCharge = 0;
    this.ultimateActive = true;
    this.ultimateTimer = 7.0;

    // Gain temporary bonus shield
    this.shield = Math.min(this.maxShield + 200, this.shield + 200);

    if (this.isLocalPlayer) {
      sounds.playUltimateActivate();
    }
  }
}
