import {
  AbstractMesh,
  Camera,
  FollowCamera,
  FreeCamera,
  Mesh,
  MeshBuilder,
  Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core';

export interface CameraConfig {
  distance: number;
  height: number;
  fov: number;
  smoothness: number;
}

export type CameraView = 'chase' | 'dash';

const DEFAULT_CHASE_CONFIG: CameraConfig = {
  distance: 8,
  height: 2.5,
  fov: 0.9,
  smoothness: 0.1,
};

const DEFAULT_DASH_CONFIG: CameraConfig = {
  distance: 0,
  height: 0.8,
  fov: 0.7,
  smoothness: 0.15,
};

export class CameraManager {
  private chaseCamera: FollowCamera;
  private dashCamera: FreeCamera;
  private target: Mesh;
  private activeCamera: Camera;
  private currentView: CameraView = 'chase';
  private transitionProgress = 1;
  private transitionFromFov = 0;
  private transitionToFov = 0;
  private transitioning = false;

  constructor(private scene: Scene) {
    // Invisible anchor mesh — FollowCamera.lockedTarget requires AbstractMesh
    this.target = MeshBuilder.CreateBox('_cameraAnchor', { size: 0.01 }, scene);
    this.target.isVisible = false;
    this.target.position = new Vector3(0, 0, 0);

    this.chaseCamera = this.createChaseCamera();
    this.dashCamera = this.createDashCamera();

    this.activeCamera = this.chaseCamera;
    // Don't attachControl — we use our own InputManager for driving
  }

  private createChaseCamera(): FollowCamera {
    const camera = new FollowCamera(
      'chaseCamera',
      new Vector3(0, DEFAULT_CHASE_CONFIG.height, -DEFAULT_CHASE_CONFIG.distance),
      this.scene
    );
    camera.radius = DEFAULT_CHASE_CONFIG.distance;
    camera.heightOffset = DEFAULT_CHASE_CONFIG.height;
    camera.rotationOffset = 0;
    camera.fov = DEFAULT_CHASE_CONFIG.fov;
    camera.cameraAcceleration = DEFAULT_CHASE_CONFIG.smoothness;
    camera.maxCameraSpeed = 50;
    camera.lockedTarget = this.target;
    return camera;
  }

  private createDashCamera(): FreeCamera {
    const camera = new FreeCamera('dashCamera', new Vector3(0, DEFAULT_DASH_CONFIG.height, 0), this.scene);
    camera.fov = DEFAULT_DASH_CONFIG.fov;
    camera.speed = DEFAULT_DASH_CONFIG.smoothness;
    camera.checkCollisions = false;
    return camera;
  }

  attach(): void {
    const cameras = this.scene.activeCameras;
    if (cameras) {
      cameras.push(this.chaseCamera);
      cameras.push(this.dashCamera);
    }
  }

  setTarget(position: Vector3, rotation?: Vector3): void {
    this.target.position = position.clone();
    if (rotation) {
      this.target.rotation = rotation.clone();
    }
  }

  switchView(view: CameraView): void {
    if (view === this.currentView) return;

    this.transitionFromFov = this.activeCamera.fov;
    this.transitionToFov = view === 'chase'
      ? this.chaseCamera.fov
      : this.dashCamera.fov;
    this.transitionProgress = 0;
    this.transitioning = true;

    this.activeCamera = view === 'chase' ? this.chaseCamera : this.dashCamera;
    this.currentView = view;
  }

  getCurrentFov(): number {
    return this.activeCamera.fov;
  }

  setFov(fov: number): void {
    this.chaseCamera.fov = fov;
    this.dashCamera.fov = fov;
  }

  update(): void {
    if (this.transitioning) {
      this.transitionProgress += 0.05;
      if (this.transitionProgress >= 1) {
        this.transitionProgress = 1;
        this.transitioning = false;
      }
      const lerped = this.transitionFromFov +
        (this.transitionToFov - this.transitionFromFov) * this.transitionProgress;
      this.activeCamera.fov = lerped;
    }

    if (this.currentView === 'dash') {
      const targetPos = this.target.position;
      const targetRot = this.target.rotation;
      const dashPos = this.dashCamera.position;

      const desiredX = targetPos.x + Math.sin(targetRot.y) * 0.3;
      const desiredY = targetPos.y + DEFAULT_DASH_CONFIG.height;
      const desiredZ = targetPos.z - Math.cos(targetRot.y) * 0.3;

      dashPos.x = this.lerp(dashPos.x, desiredX, DEFAULT_DASH_CONFIG.smoothness);
      dashPos.y = this.lerp(dashPos.y, desiredY, DEFAULT_DASH_CONFIG.smoothness);
      dashPos.z = this.lerp(dashPos.z, desiredZ, DEFAULT_DASH_CONFIG.smoothness);

      this.dashCamera.rotation.x = this.lerp(this.dashCamera.rotation.x, targetRot.x * 0.3, DEFAULT_DASH_CONFIG.smoothness);
      this.dashCamera.rotation.y = this.lerp(this.dashCamera.rotation.y, targetRot.y, DEFAULT_DASH_CONFIG.smoothness);
    }

    // FollowCamera tracks via lockedTarget — no manual update needed
  }

  getActiveCamera(): Camera {
    return this.activeCamera;
  }

  getActiveView(): CameraView {
    return this.currentView;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}
