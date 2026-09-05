import * as THREE from 'three';
import { PhysicsWorld } from '../core/Physics';
import { PickupManager } from './Pickups';

export class ArenaMap {
  public scene: THREE.Scene;
  public physics: PhysicsWorld;
  public pickups: PickupManager;

  // Materials
  private floorMat: THREE.MeshStandardMaterial;
  private wallMat: THREE.MeshStandardMaterial;
  private accentMatBlue: THREE.MeshStandardMaterial;
  private accentMatRed: THREE.MeshStandardMaterial;
  private neonMatCyan: THREE.MeshBasicMaterial;
  private neonMatOrange: THREE.MeshBasicMaterial;
  private glassMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, physics: PhysicsWorld, pickups: PickupManager) {
    this.scene = scene;
    this.physics = physics;
    this.pickups = pickups;

    // Initialize materials
    this.floorMat = new THREE.MeshStandardMaterial({
      color: 0x141a29,
      roughness: 0.6,
      metalness: 0.3,
    });

    this.wallMat = new THREE.MeshStandardMaterial({
      color: 0x1f2638,
      roughness: 0.5,
      metalness: 0.4,
    });

    this.accentMatBlue = new THREE.MeshStandardMaterial({
      color: 0x0f3460,
      roughness: 0.3,
      metalness: 0.7,
    });

    this.accentMatRed = new THREE.MeshStandardMaterial({
      color: 0x5a1827,
      roughness: 0.3,
      metalness: 0.7,
    });

    this.neonMatCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.neonMatOrange = new THREE.MeshBasicMaterial({ color: 0xff7700 });

    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.3,
      roughness: 0.1,
      metalness: 0.9,
    });

    this.buildMap();
  }

  private buildMap(): void {
    // 1. Main Ground Floor (100 x 100)
    this.createSolidBox(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(100, 2, 100),
      this.floorMat
    );

    // Grid accent lines on floor
    const grid = new THREE.GridHelper(100, 50, 0x00f0ff, 0x1a2640);
    grid.position.y = 0.01;
    this.scene.add(grid);

    // 2. Outer Perimeter Boundary Walls (100m size, 12m height)
    const wallH = 12;
    // North (Red side back)
    this.createSolidBox(new THREE.Vector3(0, wallH / 2, -50), new THREE.Vector3(100, wallH, 4), this.wallMat);
    // South (Blue side back)
    this.createSolidBox(new THREE.Vector3(0, wallH / 2, 50), new THREE.Vector3(100, wallH, 4), this.wallMat);
    // West
    this.createSolidBox(new THREE.Vector3(-50, wallH / 2, 0), new THREE.Vector3(4, wallH, 100), this.wallMat);
    // East
    this.createSolidBox(new THREE.Vector3(50, wallH / 2, 0), new THREE.Vector3(4, wallH, 100), this.wallMat);

    // 3. Central Objective Podium (slightly raised 0.5m)
    this.createSolidBox(new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(18, 0.5, 18), this.accentMatBlue);

    // 4. Blue Spawn Base Platform (South side, z = 38)
    this.createSolidBox(new THREE.Vector3(0, 1.5, 38), new THREE.Vector3(26, 3, 16), this.accentMatBlue);
    this.createSolidBox(new THREE.Vector3(0, 0.75, 27), new THREE.Vector3(14, 1.5, 6), this.floorMat); // Step ramp

    // 5. Red Spawn Base Platform (North side, z = -38)
    this.createSolidBox(new THREE.Vector3(0, 1.5, -38), new THREE.Vector3(26, 3, 16), this.accentMatRed);
    this.createSolidBox(new THREE.Vector3(0, 0.75, -27), new THREE.Vector3(14, 1.5, 6), this.floorMat); // Step ramp

    // 6. High-Ground Bridges & Sniper Towers
    // West Tower & Balcony (x = -26, z = 0, y = 4)
    this.createSolidBox(new THREE.Vector3(-26, 2.5, 0), new THREE.Vector3(12, 5, 28), this.wallMat);
    this.createSolidBox(new THREE.Vector3(-26, 5.2, 0), new THREE.Vector3(14, 0.4, 30), this.floorMat);
    // Railings
    this.createSolidBox(new THREE.Vector3(-20, 5.8, 0), new THREE.Vector3(0.4, 1.2, 28), this.glassMat);

    // East Tower & Balcony (x = 26, z = 0, y = 4)
    this.createSolidBox(new THREE.Vector3(26, 2.5, 0), new THREE.Vector3(12, 5, 28), this.wallMat);
    this.createSolidBox(new THREE.Vector3(26, 5.2, 0), new THREE.Vector3(14, 0.4, 30), this.floorMat);
    // Railings
    this.createSolidBox(new THREE.Vector3(20, 5.8, 0), new THREE.Vector3(0.4, 1.2, 28), this.glassMat);

    // 7. Tactical Cover Barricades & Pillars
    const coverPositions = [
      // Near Center Point
      { pos: new THREE.Vector3(-7, 1.5, -7), size: new THREE.Vector3(2, 3, 4) },
      { pos: new THREE.Vector3(7, 1.5, -7), size: new THREE.Vector3(4, 3, 2) },
      { pos: new THREE.Vector3(-7, 1.5, 7), size: new THREE.Vector3(4, 3, 2) },
      { pos: new THREE.Vector3(7, 1.5, 7), size: new THREE.Vector3(2, 3, 4) },

      // Mid-choke Barricades Blue side
      { pos: new THREE.Vector3(-12, 1.2, 18), size: new THREE.Vector3(6, 2.4, 2) },
      { pos: new THREE.Vector3(12, 1.2, 18), size: new THREE.Vector3(6, 2.4, 2) },

      // Mid-choke Barricades Red side
      { pos: new THREE.Vector3(-12, 1.2, -18), size: new THREE.Vector3(6, 2.4, 2) },
      { pos: new THREE.Vector3(12, 1.2, -18), size: new THREE.Vector3(6, 2.4, 2) },

      // Flank pillars
      { pos: new THREE.Vector3(-38, 3, 14), size: new THREE.Vector3(3, 6, 3) },
      { pos: new THREE.Vector3(-38, 3, -14), size: new THREE.Vector3(3, 6, 3) },
      { pos: new THREE.Vector3(38, 3, 14), size: new THREE.Vector3(3, 6, 3) },
      { pos: new THREE.Vector3(38, 3, -14), size: new THREE.Vector3(3, 6, 3) },
    ];

    for (const c of coverPositions) {
      this.createSolidBox(c.pos, c.size, this.wallMat);
    }

    // 8. Jump Pads (Launch players into the air!)
    this.createJumpPad(new THREE.Vector3(-16, 0.1, 16));
    this.createJumpPad(new THREE.Vector3(16, 0.1, 16));
    this.createJumpPad(new THREE.Vector3(-16, 0.1, -16));
    this.createJumpPad(new THREE.Vector3(16, 0.1, -16));

    // 9. Health Pickups
    // Mega Health in high-risk side rooms (x = -36, z = 0) & (x = 36, z = 0)
    this.pickups.spawnPickup(new THREE.Vector3(-36, 0, 0), 'mega');
    this.pickups.spawnPickup(new THREE.Vector3(36, 0, 0), 'mega');

    // Mini Health packs along spawn approach corridors
    this.pickups.spawnPickup(new THREE.Vector3(-16, 0, 24), 'mini');
    this.pickups.spawnPickup(new THREE.Vector3(16, 0, 24), 'mini');
    this.pickups.spawnPickup(new THREE.Vector3(-16, 0, -24), 'mini');
    this.pickups.spawnPickup(new THREE.Vector3(16, 0, -24), 'mini');
  }

  private createSolidBox(
    center: THREE.Vector3,
    size: THREE.Vector3,
    material: THREE.Material
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.copy(center);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const half = size.clone().multiplyScalar(0.5);
    const min = center.clone().sub(half);
    const max = center.clone().add(half);

    this.physics.addBoxCollider(min, max, mesh);
    return mesh;
  }

  private createJumpPad(pos: THREE.Vector3): void {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Circular pad base
    const baseGeo = new THREE.CylinderGeometry(2.0, 2.2, 0.2, 24);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.8,
      roughness: 0.2,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.1;
    group.add(base);

    // Glowing launch arrow ring
    const ringGeo = new THREE.RingGeometry(1.2, 1.8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.21;
    group.add(ring);

    // Upward beam glow
    const beamGeo = new THREE.CylinderGeometry(0.8, 1.4, 4, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.2,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 2;
    group.add(beam);

    this.scene.add(group);
    this.physics.addJumpPad(pos, 2.2, 22.0);
  }
}
