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
    const isRed = this.team === 'red';
    const primaryColor = isRed ? 0xff2244 : 0x0077ff;
    const emissiveColor = isRed ? 0xcc0022 : 0x0033bb;
    const visorColor = isRed ? 0xff2200 : 0x00ffff;

    const armorMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      emissive: emissiveColor,
      emissiveIntensity: 0.4,
      metalness: 0.6,
      roughness: 0.3,
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xf5f7fb, // Clean white plating
      metalness: 0.4,
      roughness: 0.2,
    });

    // Bulky Heavy Armor Torso
    const torsoGeo = new THREE.BoxGeometry(1.25, 1.25, 0.75);
    const torso = new THREE.Mesh(torsoGeo, armorMat);
    torso.position.y = 1.4;
    torso.castShadow = true;
    this.model3D.add(torso);
    this.bodyMesh = torso;

    // Heavy chest plate
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.2), trimMat);
    chest.position.set(0, 1.5, 0.38);
    this.model3D.add(chest);

    // Shoulder plates
    const shoulderGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const leftShoulder = new THREE.Mesh(shoulderGeo, trimMat);
    leftShoulder.position.set(-0.85, 1.7, 0);
    const rightShoulder = new THREE.Mesh(shoulderGeo, trimMat);
    rightShoulder.position.set(0.85, 1.7, 0);
    this.model3D.add(leftShoulder);
    this.model3D.add(rightShoulder);

    // Heavy Tank Legs
    const legGeo = new THREE.BoxGeometry(0.45, 0.85, 0.45);
    const leftLeg = new THREE.Mesh(legGeo, armorMat);
    leftLeg.position.set(-0.35, 0.45, 0);
    const rightLeg = new THREE.Mesh(legGeo, armorMat);
    rightLeg.position.set(0.35, 0.45, 0);
    this.model3D.add(leftLeg);
    this.model3D.add(rightLeg);

    // Heavy Helmet Head
    const headGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    const head = new THREE.Mesh(headGeo, trimMat);
    head.position.y = 2.15;
    head.castShadow = true;

    // Glowing T-Visor
    const visorMat = new THREE.MeshBasicMaterial({ color: visorColor });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.2), visorMat);
    visor.position.set(0, 0, 0.22);
    head.add(visor);

    this.model3D.add(head);
    this.headMesh = head;

    // Heavy Flak Cannon
    const cannon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 1.1, 8),
      armorMat
    );
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0.75, 1.2, 0.4);
    this.model3D.add(cannon);

    // Enemy Red Aura ring
    if (isRed) {
      const aura = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.25, 16),
        new THREE.MeshBasicMaterial({ color: 0xff0022, side: THREE.DoubleSide })
      );
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = 0.05;
      this.model3D.add(aura);
    }

    // Deployable Barrier representation
    const barrierGeo = new THREE.BoxGeometry(3.6, 2.4, 0.1);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: this.team === 'blue' ? 0x00c4ff : 0xff3344,
      transparent: true,
      opacity: 0.55,
      roughness: 0.1,
      metalness: 0.9,
    });
    this.shieldMesh = new THREE.Mesh(barrierGeo, barrierMat);
    this.shieldMesh.position.set(0, 1.5, 1.6);
    this.shieldMesh.visible = false;
    this.model3D.add(this.shieldMesh);
  }

  private muzzleFlash?: THREE.Group;

  protected createFirstPersonWeapon(): void {
    const matHeavy = new THREE.MeshStandardMaterial({
      color: 0x222a38,
      metalness: 0.85,
      roughness: 0.2,
    });
    const matAccent = new THREE.MeshStandardMaterial({
      color: 0xff4422,
      emissive: 0xcc2200,
      emissiveIntensity: 0.5,
    });
    const matCoreGlow = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    // Main Heavy Receiver Body
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.65), matHeavy);
    receiver.position.set(0, 0, -0.3);
    this.fpWeaponMesh.add(receiver);

    // Twin Plasma Barrels (Upper & Lower)
    const barrelGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.65, 12);
    const topBarrel = new THREE.Mesh(barrelGeo, matHeavy);
    topBarrel.rotation.x = Math.PI / 2;
    topBarrel.position.set(0, 0.06, -0.7);
    this.fpWeaponMesh.add(topBarrel);

    const bottomBarrel = new THREE.Mesh(barrelGeo, matHeavy);
    bottomBarrel.rotation.x = Math.PI / 2;
    bottomBarrel.position.set(0, -0.06, -0.7);
    this.fpWeaponMesh.add(bottomBarrel);

    // Glowing energy heat vents on side
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.35), matCoreGlow);
    vent.position.set(0, 0.04, -0.32);
    this.fpWeaponMesh.add(vent);

    // Armored Heat Shield shroud
    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.25), matAccent);
    shroud.position.set(0, 0, -0.55);
    this.fpWeaponMesh.add(shroud);

    // Muzzle Flash Effect (Normally hidden)
    this.muzzleFlash = new THREE.Group();
    const flashCenter = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const flashSparks = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, wireframe: true })
    );
    const flashLight = new THREE.PointLight(0xff7700, 3, 10);
    this.muzzleFlash.add(flashCenter);
    this.muzzleFlash.add(flashSparks);
    this.muzzleFlash.add(flashLight);
    this.muzzleFlash.position.set(0, 0, -1.05);
    this.muzzleFlash.visible = false;
    this.fpWeaponMesh.add(this.muzzleFlash);

    // Set position relative to camera
    this.fpWeaponMesh.position.set(0.32, -0.32, -0.45);
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

    // If holding shield, drop shield so player can shoot without frustration
    if (this.isShieldActive) {
      this.setShieldActive(false);
    }

    if (this.ammo <= 0) {
      this.reload();
      return;
    }

    this.ammo--;
    this.fireTimer = this.fireRate;

    // Heavy shotgun recoil kick
    if (this.isLocalPlayer && this.fpWeaponMesh) {
      this.fpWeaponMesh.position.z += 0.32;
      this.fpWeaponMesh.position.y += 0.08;
      this.fpWeaponMesh.rotation.x += 0.42;

      // Show muzzle flash
      if (this.muzzleFlash) {
        this.muzzleFlash.visible = true;
        setTimeout(() => {
          if (this.muzzleFlash) this.muzzleFlash.visible = false;
        }, 90);
      }
    }

    if (this.isLocalPlayer) {
      sounds.playShotgun();
    }

    // Spawn 8 visible glowing plasma flak pellets
    const pelletCount = 8;
    for (let i = 0; i < pelletCount; i++) {
      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 0.14,
        (Math.random() - 0.5) * 0.14,
        (Math.random() - 0.5) * 0.14
      );
      const pelletDir = direction.clone().add(spread).normalize();
      const raycast = this.physics.raycastWorld(origin, pelletDir, 50);

      // Create glowing plasma projectile tracer
      const tracerGeo = new THREE.BufferGeometry().setFromPoints([origin, raycast.point]);
      const tracerMat = new THREE.LineBasicMaterial({
        color: 0xff7700,
        linewidth: 3,
      });
      const tracerLine = new THREE.Line(tracerGeo, tracerMat);
      this.scene.add(tracerLine);

      // Impact spark sphere at impact point
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffcc00 })
      );
      spark.position.copy(raycast.point);
      this.scene.add(spark);

      setTimeout(() => {
        this.scene.remove(tracerLine);
        this.scene.remove(spark);
        tracerGeo.dispose();
        tracerMat.dispose();
      }, 160);
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
