import * as THREE from 'three';

export interface HealthPickupItem {
  id: string;
  type: 'mega' | 'mini';
  healAmount: number;
  position: THREE.Vector3;
  mesh: THREE.Group;
  respawnTime: number;
  timer: number;
  active: boolean;
}

export class PickupManager {
  public pickups: HealthPickupItem[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public spawnPickup(position: THREE.Vector3, type: 'mega' | 'mini'): HealthPickupItem {
    const group = new THREE.Group();
    group.position.copy(position);

    // Pedestal
    const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.3, 16);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1a233a,
      metalness: 0.8,
      roughness: 0.3,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.15;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // Holographic glowing ring on pedestal
    const ringGeo = new THREE.RingGeometry(0.8, 1.1, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: type === 'mega' ? 0x00ff88 : 0x00f0ff,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.31;
    group.add(ringMesh);

    // Floating Medkit geometry (plus sign or capsule)
    const floatGroup = new THREE.Group();
    floatGroup.position.y = 1.4;

    const crossMat = new THREE.MeshStandardMaterial({
      color: type === 'mega' ? 0x00ff88 : 0x00e5ff,
      emissive: type === 'mega' ? 0x00aa44 : 0x0088aa,
      emissiveIntensity: 0.7,
      metalness: 0.4,
      roughness: 0.2,
    });

    const size = type === 'mega' ? 0.9 : 0.6;
    const box1 = new THREE.Mesh(new THREE.BoxGeometry(size * 1.2, size * 0.4, size * 0.4), crossMat);
    const box2 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.4, size * 1.2, size * 0.4), crossMat);
    box1.castShadow = true;
    box2.castShadow = true;
    floatGroup.add(box1);
    floatGroup.add(box2);

    group.add(floatGroup);
    this.scene.add(group);

    const pickup: HealthPickupItem = {
      id: `pickup_${Math.random().toString(36).substring(2, 8)}`,
      type,
      healAmount: type === 'mega' ? 250 : 75,
      position: position.clone(),
      mesh: group,
      respawnTime: type === 'mega' ? 12 : 8,
      timer: 0,
      active: true,
    };

    this.pickups.push(pickup);
    return pickup;
  }

  public update(dt: number): void {
    for (const p of this.pickups) {
      if (!p.active) {
        p.timer -= dt;
        if (p.timer <= 0) {
          p.active = true;
          p.mesh.children[2].visible = true; // Show floating icon
        }
      } else {
        // Rotate and bob floating icon
        const floatGroup = p.mesh.children[2];
        if (floatGroup) {
          floatGroup.rotation.y += 2.0 * dt;
          floatGroup.position.y = 1.3 + Math.sin(Date.now() * 0.004) * 0.15;
        }
      }
    }
  }

  public checkPlayer(playerPos: THREE.Vector3, currentHp: number, maxHp: number): number {
    if (currentHp >= maxHp) return 0;

    for (const p of this.pickups) {
      if (!p.active) continue;
      const dist = p.position.distanceTo(playerPos);
      if (dist < 2.0) {
        p.active = false;
        p.timer = p.respawnTime;
        p.mesh.children[2].visible = false;
        return p.healAmount;
      }
    }
    return 0;
  }
}
