import * as THREE from 'three';
import { HeroBase, Team } from './HeroBase';
import { PhysicsWorld } from '../core/Physics';
import { sounds } from '../audio/SoundManager';

export class Specter extends HeroBase {
  public isScoped: boolean = false;
  public scopeCharge: number = 0; // 0 to 100%

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
      'specter',
      team,
      isLocalPlayer,
      physics,
      scene,
      175, // Health
      0,   // Shield
      30,  // Ammo
      0.09, // Unscoped fire rate
      {
        name: 'RAILGUN SCOPE',
        cooldown: 0.5,
        currentCooldown: 0,
        description: '정밀 저격 모드로 전환하고 충전하여 치명적인 관통 사격을 가합니다.',
      },
      {
        name: 'PHASE BLINK',
        cooldown: 5.5,
        currentCooldown: 0,
        description: '시선 방향으로 즉시 공간을 도약하여 이동합니다.',
      },
      {
        name: 'VENOM MINE',
        cooldown: 11.0,
        currentCooldown: 0,
        description: '표면에 부착되는 독성 지뢰를 투척하여 은폐 및 지속 독 피해를 입힙니다.',
      }
    );
  }

  protected createThirdPersonModel(): void {
    const isRed = this.team === 'red';
    const primaryColor = isRed ? 0xff2244 : 0x3377ff;
    const emissiveColor = isRed ? 0xcc0022 : 0x1144cc;
    const lensColor = isRed ? 0xff0033 : 0x00f0ff;

    const suitMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      emissive: emissiveColor,
      emissiveIntensity: 0.4,
      metalness: 0.5,
      roughness: 0.3,
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xf5f7fb, // Clean silver/white armor plates
      metalness: 0.5,
      roughness: 0.2,
    });

    // Slender Body
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.38), suitMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    this.model3D.add(torso);
    this.bodyMesh = torso;

    // Sniper chest harness
    const harness = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.15), trimMat);
    harness.position.set(0, 1.25, 0.18);
    this.model3D.add(harness);

    // Slender Legs
    const legGeo = new THREE.BoxGeometry(0.24, 0.8, 0.26);
    const leftLeg = new THREE.Mesh(legGeo, suitMat);
    leftLeg.position.set(-0.18, 0.4, 0);
    const rightLeg = new THREE.Mesh(legGeo, suitMat);
    rightLeg.position.set(0.18, 0.4, 0);
    this.model3D.add(leftLeg);
    this.model3D.add(rightLeg);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), trimMat);
    head.position.y = 1.8;
    head.castShadow = true;

    // Red/Cyan Monocle / Sniper Visor
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.12, 12),
      new THREE.MeshBasicMaterial({ color: lensColor })
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0.1, 0.05, 0.2);
    head.add(lens);

    this.model3D.add(head);
    this.headMesh = head;

    // Long Sniper Railgun in hands
    const rifle = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.18, 1.45),
      suitMat
    );
    rifle.position.set(0.38, 1.05, 0.5);
    rifle.castShadow = true;
    this.model3D.add(rifle);

    // Enemy Red Aura ring
    if (isRed) {
      const aura = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.85, 16),
        new THREE.MeshBasicMaterial({ color: 0xff0022, side: THREE.DoubleSide })
      );
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = 0.05;
      this.model3D.add(aura);
    }
  }

  protected createFirstPersonWeapon(): void {
    const matStealth = new THREE.MeshStandardMaterial({
      color: 0x181824,
      metalness: 0.8,
      roughness: 0.25,
    });
    const matGlow = new THREE.MeshBasicMaterial({ color: 0xaa00ff });

    // Long sniper barrel
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.9), matStealth);
    body.position.set(0, 0, -0.4);
    this.fpWeaponMesh.add(body);

    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.25, 8), matStealth);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.09, -0.35);
    this.fpWeaponMesh.add(scope);

    const glowRail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.5), matGlow);
    glowRail.position.set(0, -0.04, -0.4);
    this.fpWeaponMesh.add(glowRail);

    this.fpWeaponMesh.position.set(0.22, -0.25, -0.45);
  }

  public override update(dt: number): void {
    super.update(dt);

    // Charge sniper power while scoped
    if (this.isScoped) {
      const chargeRate = this.ultimateActive ? 150 : 80;
      this.scopeCharge = Math.min(100, this.scopeCharge + chargeRate * dt);
      this.moveSpeed = 4.0; // Slower while scoped
    } else {
      this.scopeCharge = 0;
      this.moveSpeed = 8.2;
    }
  }

  public setScoped(scoped: boolean): void {
    this.isScoped = scoped;
    if (this.isLocalPlayer && this.fpWeaponMesh) {
      this.fpWeaponMesh.visible = !this.isScoped;
    }
  }

  public firePrimary(direction: THREE.Vector3, origin: THREE.Vector3): void {
    if (!this.isAlive || this.fireTimer > 0 || this.isReloading) return;

    if (this.isScoped) {
      // Scoped Railgun shot consumes 3 ammo
      if (this.ammo < 3) {
        this.reload();
        return;
      }
      this.ammo -= 3;
      this.fireTimer = 0.6; // Scoped recovery time

      if (this.isLocalPlayer) {
        sounds.playRailgun();
      }

      // High damage based on charge (40 to 120 base, up to 300 on headshot)
      const chargeRatio = Math.max(0.2, this.scopeCharge / 100);
      const hitscanDmg = 40 + 80 * chargeRatio;

      // Heavy neon tracer beam
      const raycast = this.physics.raycastWorld(origin, direction, 200);
      this.createRailgunTracer(origin, raycast.point);
      this.scopeCharge = 0;
    } else {
      // Unscoped rapid SMG fire
      if (this.ammo <= 0) {
        this.reload();
        return;
      }
      this.ammo--;
      this.fireTimer = this.fireRate;

      if (this.isLocalPlayer) {
        sounds.playPulseShot();
      }

      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05
      );
      const fireDir = direction.clone().add(spread).normalize();
      const raycast = this.physics.raycastWorld(origin, fireDir, 80);
      this.createSMGTracer(origin, raycast.point);
    }

    this.triggerWeaponRecoil();
  }

  private createRailgunTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({
      color: 0xff0077,
      linewidth: 3,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    setTimeout(() => {
      this.scene.remove(line);
      geo.dispose();
      mat.dispose();
    }, 180);
  }

  private createSMGTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color: 0xcc66ff });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    setTimeout(() => {
      this.scene.remove(line);
      geo.dispose();
      mat.dispose();
    }, 40);
  }

  public fireSecondary(direction: THREE.Vector3, origin: THREE.Vector3): void {
    // Toggle scope
    this.setScoped(!this.isScoped);
  }

  public useAbilityShift(direction: THREE.Vector3): void {
    if (!this.isAlive || this.abilityShift.currentCooldown > 0) return;
    this.abilityShift.currentCooldown = this.abilityShift.cooldown;

    // Phase Blink teleport 8.5m in look direction
    const blinkDir = direction.clone().setY(0).normalize();
    const targetPos = this.position.clone().add(blinkDir.multiplyScalar(8.5));

    // Collision check to not blink through world walls
    const raycast = this.physics.raycastWorld(this.position, blinkDir, 8.5);
    if (raycast.hit && raycast.distance < 8.5) {
      this.position.copy(raycast.point).sub(blinkDir.clone().normalize().multiplyScalar(0.8));
    } else {
      this.position.copy(targetPos);
    }

    if (this.isLocalPlayer) {
      sounds.playBlink();
    }
  }

  public useAbilityE(direction: THREE.Vector3): void {
    if (!this.isAlive || this.abilityE.currentCooldown > 0) return;
    this.abilityE.currentCooldown = this.abilityE.cooldown;

    // Throw Venom Mine
    const mineGeo = new THREE.OctahedronGeometry(0.2);
    const mineMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff });
    const mine = new THREE.Mesh(mineGeo, mineMat);
    mine.position.copy(this.position).add(direction.clone().multiplyScalar(1.5));
    this.scene.add(mine);

    setTimeout(() => this.scene.remove(mine), 10000);

    if (this.isLocalPlayer) {
      sounds.playRocketLaunch();
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
