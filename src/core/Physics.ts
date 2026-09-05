import * as THREE from 'three';

export interface BoxCollider {
  min: THREE.Vector3;
  max: THREE.Vector3;
  mesh?: THREE.Object3D;
  isRamp?: boolean;
  rampNormal?: THREE.Vector3;
}

export interface JumpPad {
  position: THREE.Vector3;
  radius: number;
  boostVelocity: number;
  cooldown: number;
}

export interface Projectile {
  id: string;
  ownerId: string;
  team: 'blue' | 'red';
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  damage: number;
  splashRadius: number;
  isHealing?: boolean;
  gravity?: number;
  lifetime: number;
  mesh: THREE.Mesh;
}

export class PhysicsWorld {
  public colliders: BoxCollider[] = [];
  public jumpPads: JumpPad[] = [];
  public projectiles: Projectile[] = [];
  public scene: THREE.Scene;

  public gravity: number = 26.0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public addBoxCollider(min: THREE.Vector3, max: THREE.Vector3, mesh?: THREE.Object3D): BoxCollider {
    const col: BoxCollider = { min, max, mesh };
    this.colliders.push(col);
    return col;
  }

  public addJumpPad(position: THREE.Vector3, radius: number = 2.5, boostVelocity: number = 24.0): JumpPad {
    const pad: JumpPad = { position, radius, boostVelocity, cooldown: 0 };
    this.jumpPads.push(pad);
    return pad;
  }

  public addProjectile(proj: Projectile): void {
    this.projectiles.push(proj);
    this.scene.add(proj.mesh);
  }

  public removeProjectile(id: string): void {
    const idx = this.projectiles.findIndex(p => p.id === id);
    if (idx !== -1) {
      const p = this.projectiles[idx];
      this.scene.remove(p.mesh);
      if (p.mesh.geometry) p.mesh.geometry.dispose();
      this.projectiles.splice(idx, 1);
    }
  }

  // Check player movement with AABB collision and sliding response
  public movePlayer(
    pos: THREE.Vector3,
    velocity: THREE.Vector3,
    halfWidth: number,
    height: number,
    dt: number
  ): { onGround: boolean; hitJumpPad: boolean } {
    let onGround = false;
    let hitJumpPad = false;

    // Apply gravity
    velocity.y -= this.gravity * dt;

    // Move X
    pos.x += velocity.x * dt;
    this.resolveCollisionAxis(pos, velocity, halfWidth, height, 'x');

    // Move Z
    pos.z += velocity.z * dt;
    this.resolveCollisionAxis(pos, velocity, halfWidth, height, 'z');

    // Move Y
    pos.y += velocity.y * dt;
    const yResult = this.resolveCollisionY(pos, velocity, halfWidth, height);
    if (yResult.hitFloor) {
      onGround = true;
      velocity.y = 0;
    }
    if (yResult.hitCeiling) {
      velocity.y = Math.min(velocity.y, 0);
    }

    // Check bottom boundary (fall out of map prevention)
    if (pos.y < -10) {
      pos.set(0, 5, 0);
      velocity.set(0, 0, 0);
    }

    // Check jump pads
    for (const pad of this.jumpPads) {
      const distXZ = Math.hypot(pos.x - pad.position.x, pos.z - pad.position.z);
      if (distXZ < pad.radius && Math.abs(pos.y - pad.position.y) < 1.5) {
        if (pad.cooldown <= 0) {
          velocity.y = pad.boostVelocity;
          pad.cooldown = 0.5;
          hitJumpPad = true;
        }
      }
      if (pad.cooldown > 0) {
        pad.cooldown -= dt;
      }
    }

    return { onGround, hitJumpPad };
  }

  private resolveCollisionAxis(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    halfWidth: number,
    height: number,
    axis: 'x' | 'z'
  ): void {
    const pMin = new THREE.Vector3(pos.x - halfWidth, pos.y, pos.z - halfWidth);
    const pMax = new THREE.Vector3(pos.x + halfWidth, pos.y + height, pos.z + halfWidth);

    for (const box of this.colliders) {
      // Check overlap
      if (
        pMin.x < box.max.x &&
        pMax.x > box.min.x &&
        pMin.y < box.max.y &&
        pMax.y > box.min.y &&
        pMin.z < box.max.z &&
        pMax.z > box.min.z
      ) {
        // Resolve on specific axis
        if (axis === 'x') {
          if (vel.x > 0) {
            pos.x = box.min.x - halfWidth - 0.001;
          } else if (vel.x < 0) {
            pos.x = box.max.x + halfWidth + 0.001;
          }
          vel.x = 0;
        } else if (axis === 'z') {
          if (vel.z > 0) {
            pos.z = box.min.z - halfWidth - 0.001;
          } else if (vel.z < 0) {
            pos.z = box.max.z + halfWidth + 0.001;
          }
          vel.z = 0;
        }
      }
    }
  }

  private resolveCollisionY(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    halfWidth: number,
    height: number
  ): { hitFloor: boolean; hitCeiling: boolean } {
    let hitFloor = false;
    let hitCeiling = false;

    const pMin = new THREE.Vector3(pos.x - halfWidth, pos.y, pos.z - halfWidth);
    const pMax = new THREE.Vector3(pos.x + halfWidth, pos.y + height, pos.z + halfWidth);

    for (const box of this.colliders) {
      if (
        pMin.x < box.max.x &&
        pMax.x > box.min.x &&
        pMin.y < box.max.y &&
        pMax.y > box.min.y &&
        pMin.z < box.max.z &&
        pMax.z > box.min.z
      ) {
        if (vel.y <= 0) {
          // Falling into top of box
          pos.y = box.max.y;
          hitFloor = true;
        } else {
          // Jumping into bottom of box
          pos.y = box.min.y - height - 0.001;
          hitCeiling = true;
        }
      }
    }

    return { hitFloor, hitCeiling };
  }

  // Raycast against scene colliders
  public raycastWorld(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number = 200): {
    hit: boolean;
    point: THREE.Vector3;
    normal: THREE.Vector3;
    distance: number;
  } {
    const ray = new THREE.Ray(origin, direction.clone().normalize());
    let closestDist = maxDistance;
    let hitPoint: THREE.Vector3 | null = null;
    let hitNormal = new THREE.Vector3(0, 1, 0);

    const box3 = new THREE.Box3();
    const targetPoint = new THREE.Vector3();

    for (const col of this.colliders) {
      box3.min.copy(col.min);
      box3.max.copy(col.max);

      const intersection = ray.intersectBox(box3, targetPoint);
      if (intersection) {
        const d = origin.distanceTo(intersection);
        if (d < closestDist) {
          closestDist = d;
          hitPoint = intersection.clone();

          // Calculate face normal
          if (Math.abs(hitPoint.y - box3.max.y) < 0.05) hitNormal.set(0, 1, 0);
          else if (Math.abs(hitPoint.y - box3.min.y) < 0.05) hitNormal.set(0, -1, 0);
          else if (Math.abs(hitPoint.x - box3.max.x) < 0.05) hitNormal.set(1, 0, 0);
          else if (Math.abs(hitPoint.x - box3.min.x) < 0.05) hitNormal.set(-1, 0, 0);
          else if (Math.abs(hitPoint.z - box3.max.z) < 0.05) hitNormal.set(0, 0, 1);
          else hitNormal.set(0, 0, -1);
        }
      }
    }

    return {
      hit: hitPoint !== null,
      point: hitPoint || origin.clone().add(direction.clone().multiplyScalar(maxDistance)),
      normal: hitNormal,
      distance: closestDist,
    };
  }

  // Update projectiles
  public updateProjectiles(
    dt: number,
    onExplode: (proj: Projectile, point: THREE.Vector3) => void
  ): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.lifetime -= dt;

      if (p.gravity) {
        p.velocity.y -= p.gravity * dt;
      }

      const moveStep = p.velocity.clone().multiplyScalar(dt);
      const nextPos = p.position.clone().add(moveStep);

      // Check collision with world
      const raycast = this.raycastWorld(p.position, p.velocity.clone().normalize(), moveStep.length());
      if (raycast.hit && raycast.distance <= moveStep.length()) {
        onExplode(p, raycast.point);
        this.removeProjectile(p.id);
        continue;
      }

      p.position.copy(nextPos);
      p.mesh.position.copy(p.position);

      if (p.lifetime <= 0) {
        if (p.splashRadius > 0) {
          onExplode(p, p.position);
        }
        this.removeProjectile(p.id);
      }
    }
  }
}
