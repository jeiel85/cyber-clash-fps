import * as THREE from 'three';

export type Team = 'blue' | 'red';
export type ControlState = 'neutral' | 'blue' | 'red';

export class ControlPoint {
  public position: THREE.Vector3;
  public radius: number = 7.5;
  public state: ControlState = 'neutral';
  public captureProgress: number = 0; // -100 (Red) to +100 (Blue)
  public blueScore: number = 0; // 0 to 100%
  public redScore: number = 0; // 0 to 100%
  public isContested: boolean = false;
  public isGameOver: boolean = false;
  public winner: Team | null = null;

  public mesh: THREE.Group;
  private ringMesh: THREE.Mesh;
  private discMesh: THREE.Mesh;
  private beaconLight: THREE.PointLight;

  constructor(scene: THREE.Scene, position: THREE.Vector3 = new THREE.Vector3(0, 0.05, 0)) {
    this.position = position.clone();
    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.position);

    // Flat circular floor disc
    const discGeo = new THREE.CircleGeometry(this.radius, 32);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x111c30,
      roughness: 0.4,
      metalness: 0.6,
      transparent: true,
      opacity: 0.7,
    });
    this.discMesh = new THREE.Mesh(discGeo, discMat);
    this.discMesh.rotation.x = -Math.PI / 2;
    this.discMesh.receiveShadow = true;
    this.mesh.add(this.discMesh);

    // Glowing border ring
    const ringGeo = new THREE.RingGeometry(this.radius - 0.4, this.radius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.ringMesh.rotation.x = -Math.PI / 2;
    this.ringMesh.position.y = 0.02;
    this.mesh.add(this.ringMesh);

    // Center vertical holographic beacon pillar
    const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, 12, 16);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 6;
    this.mesh.add(pillar);

    // Point Light
    this.beaconLight = new THREE.PointLight(0xffffff, 2, 20);
    this.beaconLight.position.y = 3;
    this.mesh.add(this.beaconLight);

    scene.add(this.mesh);
  }

  public update(
    dt: number,
    entities: { position: THREE.Vector3; team: Team; isAlive: boolean }[]
  ): void {
    if (this.isGameOver) return;

    let blueCount = 0;
    let redCount = 0;

    for (const e of entities) {
      if (!e.isAlive) continue;
      const distXZ = Math.hypot(e.position.x - this.position.x, e.position.z - this.position.z);
      if (distXZ <= this.radius && Math.abs(e.position.y - this.position.y) < 4.0) {
        if (e.team === 'blue') blueCount++;
        else if (e.team === 'red') redCount++;
      }
    }

    this.isContested = blueCount > 0 && redCount > 0;

    // Capture speed
    const captureSpeed = 22.0; // Pct per second

    if (!this.isContested) {
      if (blueCount > 0) {
        this.captureProgress = Math.min(100, this.captureProgress + captureSpeed * dt * Math.min(blueCount, 3));
        if (this.captureProgress >= 100) {
          this.state = 'blue';
        }
      } else if (redCount > 0) {
        this.captureProgress = Math.max(-100, this.captureProgress - captureSpeed * dt * Math.min(redCount, 3));
        if (this.captureProgress <= -100) {
          this.state = 'red';
        }
      } else {
        // Natural slight decay back toward controlled state
        if (this.state === 'neutral') {
          if (this.captureProgress > 0) this.captureProgress = Math.max(0, this.captureProgress - 8 * dt);
          if (this.captureProgress < 0) this.captureProgress = Math.min(0, this.captureProgress + 8 * dt);
        }
      }
    }

    // Accumulate scores for controlling team
    const scoreRate = 1.6; // 100% takes ~60 seconds
    if (this.state === 'blue') {
      this.blueScore = Math.min(100, this.blueScore + scoreRate * dt);
      if (this.blueScore >= 100) {
        this.isGameOver = true;
        this.winner = 'blue';
      }
    } else if (this.state === 'red') {
      this.redScore = Math.min(100, this.redScore + scoreRate * dt);
      if (this.redScore >= 100) {
        this.isGameOver = true;
        this.winner = 'red';
      }
    }

    // Update visuals
    let targetColor = 0xffffff;
    if (this.isContested) {
      targetColor = 0xffaa00; // Yellow when contested
    } else if (this.state === 'blue' || this.captureProgress > 30) {
      targetColor = 0x00aaff;
    } else if (this.state === 'red' || this.captureProgress < -30) {
      targetColor = 0xff3344;
    }

    (this.ringMesh.material as THREE.MeshBasicMaterial).color.setHex(targetColor);
    this.beaconLight.color.setHex(targetColor);
  }
}
