// ============================================================
//  MINIGOLF · ENGINE  🎮
//  Three.js-Rendering (Neon/Bloom) + cannon-es-Physik.
//  Baut pro Loch Szene UND Physik-Welt aus den HOLES-Daten auf,
//  simuliert NUR den aktiven Ball lokal und meldet das Ergebnis
//  per Callback zurück. Kennt Firebase nicht (isoliert testbar).
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import * as CANNON from 'cannon-es';

// ── Konstanten / Tuning ─────────────────────────────────────
const BALL_R = 0.35;
const WALL_H = 1.3;
const WALL_T = 0.6;
const GRAVITY = -22;
const REST_SPEED = 0.28;       // Geschwindigkeit, ab der Ball als "ruhend" gilt
const REST_FRAMES = 22;        // so viele Frames unter REST_SPEED → Stillstand
const SHOT_TIMEOUT = 13;       // s, danach Zwangs-Stillstand
const MAX_SPEED = 30;          // Schussgeschwindigkeit bei voller Power
const MAX_PULL = 6.5;          // Welt-Distanz für volle Power beim Ziehen
const CUP_R = 0.55;
const CAPTURE_SPEED = 5.5;     // max. Tempo, um eingelocht zu werden
const SAND_DAMPING = 0.92;     // starke Bremsung im Sand
const BASE_DAMPING = 0.32;     // etwas weniger Rollwiderstand → harte Schläge tragen weiter

export const PLAYER_COLORS = {
  andreas: 0xe8738a,
  nele: 0xa78bfa,
  solo: 0x4ecdc4,
};

export class MinigolfEngine {
  constructor(mountEl, callbacks = {}) {
    this.mount = mountEl;
    this.cb = callbacks;            // { onShotStart, onShotComplete, onAim, onReady }
    this.balls = {};                // key → { mesh, trail, holed, color }
    this.active = null;             // { key, body }
    this.holeObjects = [];          // { mesh, body? } pro Loch (zum Aufräumen)
    this.hole = null;
    this.shotInProgress = false;
    this.holedAnim = null;
    this.inputEnabled = false;
    this.aiming = false;
    this.aimDir = new THREE.Vector3();
    this.aimRatio = 0;
    this.restCounter = 0;
    this.shotClock = 0;
    this.preShotPos = new CANNON.Vec3();
    this.camYaw = 0;
    this.camPitch = 0.62;
    this.camDist = 17;
    this.camTarget = new THREE.Vector3();
    this.cupPos = new THREE.Vector3();
    this.club = null;
    this.clubHead = null;
    this._swing = null;
    this.dynObstacles = [];
    this.isMobile = window.matchMedia('(max-width:600px)').matches;
    this._raf = null;
    this._clock = new THREE.Clock();
    this._initThree();
    this._initPhysics();
    this._initInput();
    this._buildClub();
    this._onResize = this._resize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  // ── Setup ─────────────────────────────────────────────────
  _initThree() {
    const w = this.mount.clientWidth || 800;
    const h = this.mount.clientHeight || 500;

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.isMobile, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
    this.renderer.setSize(w, h);
    this.mount.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1c2446);
    this.scene.fog = new THREE.Fog(0x1c2446, 44, 95);

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);

    // Licht: hellerer Grundton, Bloom trägt zusätzlich den Neon-Glow
    this.scene.add(new THREE.AmbientLight(0xaab4ff, 1.05));
    this.scene.add(new THREE.HemisphereLight(0xc4d2ff, 0x2c365e, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(8, 22, 6);
    this.scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0x9fb4ff, 0.4);
    dir2.position.set(-10, 12, -8);
    this.scene.add(dir2);

    // Postprocessing (Neon-Glow)
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      this.isMobile ? 0.55 : 0.85, // strength (dezenter, Szene ist heller)
      0.5,                         // radius
      0.2                          // threshold: nur kräftige Neon-Kanten glühen
    );
    this.composer.addPass(this.bloom);

    // Ziel-/Bahnlinie (leuchtend)
    this.aimLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
    );
    this.aimLine.visible = false;
    this.scene.add(this.aimLine);

    this._ray = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  _initPhysics() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = false;

    this.matGround = new CANNON.Material('ground');
    this.matWall = new CANNON.Material('wall');
    this.matBall = new CANNON.Material('ball');
    this.matBumper = new CANNON.Material('bumper');

    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.matBall, this.matGround, { friction: 0.55, restitution: 0.15 }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.matBall, this.matWall, { friction: 0.1, restitution: 0.55 }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.matBall, this.matBumper, { friction: 0.05, restitution: 1.15 }));
  }

  _initInput() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    el.addEventListener('pointermove', (e) => this._onPointerMove(e));
    window.addEventListener('pointerup', (e) => this._onPointerUp(e));
  }

  // Sichtbarer Putter (Schaft + Griff + Kopf). Lokales +Z = Schlagrichtung.
  _buildClub() {
    const club = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({
      color: 0xeef2ff, emissive: 0x3a4d80, emissiveIntensity: 0.6,
      roughness: 0.25, metalness: 0.85,
    });
    const grip = new THREE.MeshStandardMaterial({
      color: 0x202840, emissive: 0x101830, emissiveIntensity: 0.3,
      roughness: 0.6, metalness: 0.2,
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.2, 12), metal);
    shaft.position.set(0, 1.05, -0.62);
    shaft.rotation.x = 0.34;            // nach hinten-oben geneigt
    club.add(shaft);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 12), grip);
    handle.position.set(0, 2.0, -0.82);
    handle.rotation.x = 0.34;
    club.add(handle);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.26), metal);
    head.position.set(0, 0.16, -0.4);   // hinter dem Ball
    club.add(head);
    this.clubHead = head;
    club.visible = false;
    this.scene.add(club);
    this.club = club;
  }

  _easeOut(p) { return 1 - Math.pow(1 - p, 3); }

  _updateClub(dt) {
    if (!this.club || !this.active) { if (this.club) this.club.visible = false; return; }
    // Sichtbar bei Ruhe/Zielen oder während des kurzen Schwungs; aus, während der Ball rollt
    if (this.shotInProgress && !this._swing) { this.club.visible = false; return; }

    const ballPos = this.balls[this.active.key].mesh.position;
    let dir;
    if (this.aiming && this.aimRatio > 0.001) {
      dir = this.aimDir;
    } else {
      dir = new THREE.Vector3(this.cupPos.x - ballPos.x, 0, this.cupPos.z - ballPos.z);
      if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
      dir.normalize();
    }
    this.club.position.set(ballPos.x, 0, ballPos.z);
    this.club.rotation.y = Math.atan2(dir.x, dir.z);
    this.club.visible = true;

    let headZ;
    if (this._swing) {
      this._swing.t += dt;
      const p = Math.min(this._swing.t / this._swing.dur, 1);
      headZ = THREE.MathUtils.lerp(-(0.4 + this._swing.cock * 0.85), 0.2, this._easeOut(p));
      if (p >= 1) { this._swing = null; this.club.visible = false; }
    } else {
      const cock = this.aiming ? this.aimRatio : 0;
      headZ = -(0.4 + cock * 0.85);     // Ausholen proportional zur Power
    }
    this.clubHead.position.z = headZ;
  }

  // ── Loch laden ────────────────────────────────────────────
  loadHole(holeDef, ballsState) {
    this._clearHole();
    this.hole = holeDef;
    this.cupPos.set(holeDef.cup.x, holeDef.cup.y || 0, holeDef.cup.z);
    const g = holeDef.ground;

    // Boden
    this._addBox(0, -0.5, 0, g.w, 1, g.l, {
      color: 0x2c3a72, emissive: 0x16356f, emissiveIntensity: 0.45,
      physMat: this.matGround,
    });

    // Neon-Bodenraster (nur Optik)
    this._addGrid(g.w, g.l);

    // Perimeter-Banden
    const hw = g.w / 2, hl = g.l / 2;
    this._addWall(0, hl + WALL_T / 2, g.w + WALL_T * 2, WALL_T);
    this._addWall(0, -hl - WALL_T / 2, g.w + WALL_T * 2, WALL_T);
    this._addWall(-hw - WALL_T / 2, 0, WALL_T, g.l, true);
    this._addWall(hw + WALL_T / 2, 0, WALL_T, g.l, true);

    // Innere Wände
    (holeDef.walls || []).forEach(wl =>
      this._addWall(wl.x, wl.z, wl.w, wl.l, false, wl.h || WALL_H));

    // Plateaus (erhöhte Plattformen)
    (holeDef.plateaus || []).forEach(p =>
      this._addBox(p.x, p.h / 2, p.z, p.w, p.h, p.l, {
        color: 0x2c3a72, emissive: 0x16356f, emissiveIntensity: 0.5,
        physMat: this.matGround,
      }));

    // Rampen (geneigte Flächen)
    (holeDef.ramps || []).forEach(r => this._addRamp(r));

    // Bumper (runde Abpraller)
    (holeDef.bumpers || []).forEach(b => this._addBumper(b.x, b.z, b.r || 0.6));

    // Rotierende Hindernisse (Rotor / "Windmühle")
    (holeDef.spinners || []).forEach(s => this._addSpinner(s));
    // Bewegliche Schiebe-Gatter
    (holeDef.movers || []).forEach(m => this._addMover(m));

    // Hazards (nur Optik + Zonen-Check im Loop)
    (holeDef.water || []).forEach(z => this._addHazardPad(z, 0x14e0e0));
    (holeDef.sand || []).forEach(z => this._addHazardPad(z, 0xe0a030));

    // Loch + Fahne
    this._addCup(holeDef.cup);

    // Bälle
    this.balls = {};
    for (const key of Object.keys(ballsState)) {
      const s = ballsState[key];
      this._addBall(key, s);
    }

    // Kamera initial hinter dem Tee Richtung Loch ausrichten
    const dx = holeDef.cup.x - holeDef.tee.x;
    const dz = holeDef.cup.z - holeDef.tee.z;
    this.camYaw = Math.atan2(-dx, -dz);
    const firstKey = Object.keys(ballsState)[0];
    if (firstKey) this.camTarget.copy(this.balls[firstKey].mesh.position);
    this._updateCamera(true);

    if (this.cb.onReady) this.cb.onReady();
  }

  _clearHole() {
    this.shotInProgress = false;
    this.holedAnim = null;
    this._swing = null;
    this.dynObstacles = [];
    if (this.club) this.club.visible = false;
    if (this.active && this.active.body) this.world.removeBody(this.active.body);
    this.active = null;
    for (const o of this.holeObjects) {
      if (o.mesh) { this.scene.remove(o.mesh); o.mesh.geometry?.dispose?.(); o.mesh.material?.dispose?.(); }
      if (o.body) this.world.removeBody(o.body);
    }
    this.holeObjects = [];
    for (const key of Object.keys(this.balls)) {
      const b = this.balls[key];
      this.scene.remove(b.mesh);
      if (b.trail) this.scene.remove(b.trail);
    }
    this.balls = {};
  }

  // ── Geometrie-Helfer ──────────────────────────────────────
  _addBox(x, y, z, sx, sy, sz, opt = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      new THREE.MeshStandardMaterial({
        color: opt.color ?? 0x1a2348,
        emissive: opt.emissive ?? 0x000000,
        emissiveIntensity: opt.emissiveIntensity ?? 1,
        roughness: 0.6, metalness: 0.2,
      })
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    let body = null;
    if (opt.physMat !== undefined) {
      body = new CANNON.Body({
        mass: 0, material: opt.physMat,
        shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
      });
      body.position.set(x, y, z);
      this.world.addBody(body);
    }
    this.holeObjects.push({ mesh, body });
    return mesh;
  }

  _addWall(x, z, sx, sz, alongZ = false, h = WALL_H) {
    const w = alongZ ? sx : sx;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, sz),
      new THREE.MeshStandardMaterial({
        color: 0x2a3a6e, emissive: 0x3a7bff, emissiveIntensity: 1.3,
        roughness: 0.4, metalness: 0.3,
      })
    );
    mesh.position.set(x, h / 2, z);
    this.scene.add(mesh);
    const body = new CANNON.Body({
      mass: 0, material: this.matWall,
      shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, sz / 2)),
    });
    body.position.set(x, h / 2, z);
    this.world.addBody(body);
    this.holeObjects.push({ mesh, body });
  }

  _addGrid(w, l) {
    const grid = new THREE.GridHelper(Math.max(w, l), Math.max(w, l), 0x5b8bff, 0x32508f);
    grid.position.y = 0.02;
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    this.scene.add(grid);
    this.holeObjects.push({ mesh: grid });
  }

  _addRamp(r) {
    const angle = Math.atan2(r.h, r.l);
    const len = Math.hypot(r.h, r.l);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(r.w, 0.4, len),
      new THREE.MeshStandardMaterial({
        color: 0x10162e, emissive: 0x2266ff, emissiveIntensity: 0.7,
        roughness: 0.5, metalness: 0.2,
      })
    );
    mesh.position.set(r.x, r.h / 2, r.z);
    mesh.rotation.x = -angle;
    this.scene.add(mesh);
    const body = new CANNON.Body({
      mass: 0, material: this.matGround,
      shape: new CANNON.Box(new CANNON.Vec3(r.w / 2, 0.2, len / 2)),
    });
    body.position.set(r.x, r.h / 2, r.z);
    body.quaternion.setFromEuler(-angle, 0, 0);
    this.world.addBody(body);
    this.holeObjects.push({ mesh, body });
  }

  _addBumper(x, z, radius) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, WALL_H, 20),
      new THREE.MeshStandardMaterial({
        color: 0x200a2e, emissive: 0xff3df0, emissiveIntensity: 2.0,
        roughness: 0.3, metalness: 0.4,
      })
    );
    mesh.position.set(x, WALL_H / 2, z);
    this.scene.add(mesh);
    // Kollision als Kugel auf Ballhöhe → runder, orientierungs-freier Abprall
    const body = new CANNON.Body({
      mass: 0, material: this.matBumper,
      shape: new CANNON.Sphere(radius),
    });
    body.position.set(x, BALL_R, z);
    this.world.addBody(body);
    this.holeObjects.push({ mesh, body });
  }

  // Rotor: waagerechte Stange, die um die Y-Achse rotiert und den Ball wegfegt
  _addSpinner(s) {
    const len = s.length || 5;
    const speed = s.speed || 1.8;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.55, 0.4),
      new THREE.MeshStandardMaterial({
        color: 0x2a0a3a, emissive: 0xff4df0, emissiveIntensity: 2.0,
        roughness: 0.3, metalness: 0.4,
      })
    );
    mesh.position.set(s.x, 0.45, s.z);
    this.scene.add(mesh);
    // Nabe in der Mitte
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0x140a2e, emissive: 0x7a3dff, emissiveIntensity: 1.6 })
    );
    hub.position.set(s.x, 0.45, s.z);
    this.scene.add(hub);

    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: this.matWall });
    body.addShape(new CANNON.Box(new CANNON.Vec3(len / 2, 0.275, 0.2)));
    body.position.set(s.x, 0.45, s.z);
    body.angularVelocity.set(0, speed, 0);
    this.world.addBody(body);

    this.holeObjects.push({ mesh, body });
    this.holeObjects.push({ mesh: hub });
    this.dynObstacles.push({ kind: 'spin', mesh, body });
  }

  // Beweglicher Block, der entlang einer Achse hin- und herfährt
  _addMover(m) {
    const h = m.h || WALL_H;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(m.w, h, m.l),
      new THREE.MeshStandardMaterial({
        color: 0x0a2a2a, emissive: 0x18e0e0, emissiveIntensity: 1.6,
        roughness: 0.4, metalness: 0.3,
      })
    );
    mesh.position.set(m.x, h / 2, m.z);
    this.scene.add(mesh);

    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: this.matWall });
    body.addShape(new CANNON.Box(new CANNON.Vec3(m.w / 2, h / 2, m.l / 2)));
    body.position.set(m.x, h / 2, m.z);
    this.world.addBody(body);

    const axis = m.axis === 'z' ? 'z' : 'x';
    const center = axis === 'z' ? m.z : m.x;
    this.holeObjects.push({ mesh, body });
    this.dynObstacles.push({
      kind: 'move', mesh, body, axis,
      min: center - (m.range || 3), max: center + (m.range || 3),
      speed: m.speed || 3, dir: 1,
    });
  }

  _addHazardPad(zone, color) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(zone.w, zone.l),
      new THREE.MeshStandardMaterial({
        color: 0x05080f, emissive: color, emissiveIntensity: 0.9,
        transparent: true, opacity: 0.85, roughness: 0.2,
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(zone.x, 0.04, zone.z);
    this.scene.add(mesh);
    this.holeObjects.push({ mesh });
  }

  _addCup(cup) {
    const y = (cup.y || 0) + 0.05;
    // Loch-Senke
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(CUP_R, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(cup.x, y, cup.z);
    this.scene.add(hole);
    // Pulsierender Glow-Ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(CUP_R + 0.08, 0.08, 12, 32),
      new THREE.MeshStandardMaterial({ color: 0x113322, emissive: 0x33ff99, emissiveIntensity: 2.2 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cup.x, y + 0.02, cup.z);
    this.scene.add(ring);
    this.cupRing = ring;
    // Neon-Fahne
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x222244, emissive: 0x6688ff, emissiveIntensity: 1.2 })
    );
    pole.position.set(cup.x, (cup.y || 0) + 1.2, cup.z);
    this.scene.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x330022, emissive: 0xff33aa, emissiveIntensity: 1.8, side: THREE.DoubleSide })
    );
    flag.position.set(cup.x + 0.37, (cup.y || 0) + 2.1, cup.z);
    this.scene.add(flag);
    this.holeObjects.push({ mesh: hole });
    this.holeObjects.push({ mesh: ring });
    this.holeObjects.push({ mesh: pole });
    this.holeObjects.push({ mesh: flag });
  }

  _addBall(key, state) {
    const color = PLAYER_COLORS[key] || PLAYER_COLORS.solo;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: color, emissiveIntensity: 1.6,
        roughness: 0.25, metalness: 0.1,
      })
    );
    const y = state.y ?? BALL_R;
    mesh.position.set(state.x, y, state.z);
    mesh.visible = !state.holed;
    this.scene.add(mesh);

    // Trail
    const trailGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(30 * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.5,
    }));
    trail.visible = false;
    this.scene.add(trail);

    this.balls[key] = { mesh, trail, holed: !!state.holed, color, trailPts: [] };
  }

  // ── Aktiver Ball / Zug ────────────────────────────────────
  setActive(key) {
    // vorherigen Body entfernen
    if (this.active && this.active.body) this.world.removeBody(this.active.body);
    this.active = null;
    this.aiming = false;
    this.aimLine.visible = false;
    this.shotInProgress = false;
    if (!key || !this.balls[key]) { this.inputEnabled = false; return; }

    const ball = this.balls[key];
    const p = ball.mesh.position;
    const body = new CANNON.Body({
      mass: 1, material: this.matBall,
      shape: new CANNON.Sphere(BALL_R),
      linearDamping: BASE_DAMPING, angularDamping: 0.5,
    });
    body.position.set(p.x, p.y, p.z);
    this.world.addBody(body);
    this.active = { key, body };
    this.inputEnabled = true;
    ball.trailPts = [];
  }

  setInputEnabled(v) { this.inputEnabled = v; }

  // Position eines (nicht aktiven) Balls setzen
  updateBallGhost(key, pos) {
    const b = this.balls[key];
    if (!b) return;
    b.holed = !!pos.holed;
    b.mesh.visible = !b.holed;
    b.mesh.position.set(pos.x, pos.y ?? BALL_R, pos.z);
  }

  // Gegner-Schuss als sanfte Animation nachspielen (kein eigenes Physik-Sim)
  replayShot(key, from, to) {
    const b = this.balls[key];
    if (!b) return;
    const start = new THREE.Vector3(from.x, from.y ?? BALL_R, from.z);
    const end = new THREE.Vector3(to.x, to.y ?? BALL_R, to.z);
    b.mesh.visible = true;
    this._replay = { ball: b, start, end, t: 0, dur: 0.9 };
  }

  // ── Eingabe (Slingshot) ───────────────────────────────────
  _ndc(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
  }

  _groundPoint(e, y) {
    this._ray.setFromCamera(this._ndc(e), this.camera);
    this._groundPlane.constant = -(y || 0);
    const pt = new THREE.Vector3();
    return this._ray.ray.intersectPlane(this._groundPlane, pt) ? pt : null;
  }

  _onPointerDown(e) {
    if (!this.inputEnabled || !this.active || this.shotInProgress) return;
    const ballY = this.active.body.position.y;
    const gp = this._groundPoint(e, ballY);
    if (!gp) return;
    this.aiming = true;
    this._aimStart = gp;
    this._pointerId = e.pointerId;
  }

  _onPointerMove(e) {
    if (!this.aiming) return;
    const ballY = this.active.body.position.y;
    const gp = this._groundPoint(e, ballY);
    if (!gp) return;
    const pull = new THREE.Vector3().subVectors(this._aimStart, gp);
    pull.y = 0;
    const dist = Math.min(pull.length(), MAX_PULL);
    if (dist < 0.001) { this.aimRatio = 0; this.aimLine.visible = false; return; }
    this.aimDir.copy(pull).normalize();
    this.aimRatio = dist / MAX_PULL;
    this._updateAimLine();
    if (this.cb.onAim) this.cb.onAim(this.aimRatio, true);
  }

  _onPointerUp() {
    if (!this.aiming) return;
    this.aiming = false;
    this.aimLine.visible = false;
    if (this.cb.onAim) this.cb.onAim(0, false);
    if (this.aimRatio > 0.06 && this.active && !this.shotInProgress) {
      this._shoot(this.aimDir.clone(), this.aimRatio);
    }
    this.aimRatio = 0;
  }

  _updateAimLine() {
    const p = this.active.body.position;
    const len = 1 + this.aimRatio * 6;
    const a = new THREE.Vector3(p.x, 0.1, p.z);
    const b = new THREE.Vector3(p.x + this.aimDir.x * len, 0.1, p.z + this.aimDir.z * len);
    this.aimLine.geometry.setFromPoints([a, b]);
    const col = new THREE.Color().setHSL(0.33 - this.aimRatio * 0.33, 1, 0.55); // grün→rot
    this.aimLine.material.color = col;
    this.aimLine.visible = true;
  }

  _shoot(dir, ratio) {
    const body = this.active.body;
    // Sanfte Power-Kurve mit Mindest-Anstoß: feine Putts + weiches Hochregeln
    const speed = MAX_SPEED * (0.12 + 0.88 * Math.pow(ratio, 1.4));
    body.wakeUp();
    body.velocity.set(dir.x * speed, 0, dir.z * speed);
    body.angularVelocity.set(0, 0, 0);
    this.preShotPos.copy(body.position);
    this.shotInProgress = true;
    this.restCounter = 0;
    this.shotClock = 0;
    this.balls[this.active.key].trailPts = [];
    this.balls[this.active.key].trail.visible = true;
    this._swing = { t: 0, dur: 0.16, cock: ratio };
    if (this.cb.onShotStart) this.cb.onShotStart(this.active.key);
  }

  // ── Kamera ────────────────────────────────────────────────
  rotateCamera(deltaYaw) { this.camYaw += deltaYaw; }

  _updateCamera(instant = false) {
    const off = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch)
    ).multiplyScalar(this.camDist);
    const desired = new THREE.Vector3().addVectors(this.camTarget, off);
    if (instant) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, 0.08);
    this.camera.lookAt(this.camTarget);
  }

  // ── Loop ──────────────────────────────────────────────────
  start() {
    if (this._raf) return;
    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      this._update();
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  _update() {
    const dt = Math.min(this._clock.getDelta(), 0.05);
    this._updateObstacles(dt);
    this.world.step(1 / 60, dt, 6);
    this._syncObstacles();

    // Aktiven Ball-Mesh aus Physik übernehmen
    if (this.active) {
      const b = this.balls[this.active.key];
      const p = this.active.body.position;
      b.mesh.position.set(p.x, p.y, p.z);
      this.active.body.quaternion && b.mesh.quaternion.copy(this.active.body.quaternion);
      if (this.shotInProgress) {
        this._followTrail(b, p);
        this._checkPhysics(dt);
      }
      this.camTarget.lerp(b.mesh.position, 0.1);
    }

    // Replay (Gegner)
    if (this._replay) {
      const r = this._replay;
      r.t += dt;
      const k = Math.min(r.t / r.dur, 1);
      r.ball.mesh.position.lerpVectors(r.start, r.end, k);
      this._followTrail(r.ball, r.ball.mesh.position);
      this.camTarget.lerp(r.ball.mesh.position, 0.1);
      if (k >= 1) { r.ball.trail.visible = false; this._replay = null; }
    }

    // Loch-Ring pulsieren
    if (this.cupRing) {
      const s = 1 + Math.sin(performance.now() * 0.004) * 0.12;
      this.cupRing.scale.set(s, s, 1);
    }

    // Versenk-Animation
    if (this.holedAnim) {
      const h = this.holedAnim;
      h.mesh.position.y -= dt * 2.5;
      h.mesh.scale.multiplyScalar(1 - dt * 1.5);
      h.t += dt;
      if (h.t > 0.5) { h.mesh.visible = false; this.holedAnim = null; }
    }

    this._updateClub(dt);
    this._updateCamera();
    this.composer.render();
  }

  _updateObstacles(dt) {
    for (const o of this.dynObstacles) {
      if (o.kind === 'move') {
        const p = o.body.position[o.axis];
        if (p >= o.max && o.dir > 0) o.dir = -1;
        else if (p <= o.min && o.dir < 0) o.dir = 1;
        o.body.velocity.set(0, 0, 0);
        o.body.velocity[o.axis] = o.speed * o.dir;
      }
      // Spinner: konstante angularVelocity bleibt gesetzt
    }
  }

  _syncObstacles() {
    for (const o of this.dynObstacles) {
      o.mesh.position.copy(o.body.position);
      o.mesh.quaternion.copy(o.body.quaternion);
    }
  }

  _followTrail(ball, p) {
    ball.trailPts.push(new THREE.Vector3(p.x, p.y, p.z));
    if (ball.trailPts.length > 30) ball.trailPts.shift();
    const arr = ball.trail.geometry.attributes.position.array;
    for (let i = 0; i < 30; i++) {
      const pt = ball.trailPts[i] || ball.trailPts[0] || p;
      arr[i * 3] = pt.x; arr[i * 3 + 1] = pt.y; arr[i * 3 + 2] = pt.z;
    }
    ball.trail.geometry.attributes.position.needsUpdate = true;
  }

  _checkPhysics(dt) {
    const body = this.active.body;
    const pos = body.position;
    const speed = body.velocity.length();
    this.shotClock += dt;

    // Sand: extra bremsen
    let inSand = false;
    for (const s of (this.hole.sand || [])) {
      if (this._inZone(pos, s)) { inSand = true; break; }
    }
    body.linearDamping = inSand ? SAND_DAMPING : BASE_DAMPING;

    // Wasser → Strafschlag, zurück auf Vorschuss-Position
    for (const wz of (this.hole.water || [])) {
      if (this._inZone(pos, wz) && pos.y < 0.6) {
        this._settle({ holed: false, penalty: true, reset: true });
        return;
      }
    }

    // Abgrund / aus der Welt gefallen
    if (pos.y < -8) { this._settle({ holed: false, penalty: true, reset: true }); return; }

    // Einlochen mit "Loch-Magnet" für zuverlässiges Fallen
    const cup = this.hole.cup;
    const dx = pos.x - cup.x, dz = pos.z - cup.z;
    const horiz = Math.hypot(dx, dz);
    const heightOk = Math.abs(pos.y - (cup.y || 0)) < 0.7;
    if (heightOk && horiz < CUP_R * 2.6) {
      // Sanfter Sog zur Lochmitte, solange das Tempo nicht zu hoch ist
      if (speed < CAPTURE_SPEED * 1.7) {
        const pull = 11;
        body.velocity.x -= dx * pull * dt;
        body.velocity.z -= dz * pull * dt;
      }
      // Fallen: nah & beherrschbar – oder Volltreffer mitten ins Loch
      if ((horiz < CUP_R && speed < CAPTURE_SPEED) || horiz < CUP_R * 0.55) {
        this._settle({ holed: true, penalty: false });
        return;
      }
    }

    // Stillstand
    if (speed < REST_SPEED) this.restCounter++; else this.restCounter = 0;
    if (this.restCounter > REST_FRAMES || this.shotClock > SHOT_TIMEOUT) {
      this._settle({ holed: false, penalty: false });
    }
  }

  _inZone(pos, z) {
    return pos.x > z.x - z.w / 2 && pos.x < z.x + z.w / 2 &&
           pos.z > z.z - z.l / 2 && pos.z < z.z + z.l / 2;
  }

  _settle({ holed, penalty, reset }) {
    const body = this.active.body;
    const ball = this.balls[this.active.key];
    this.shotInProgress = false;
    this.restCounter = 0;
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.linearDamping = BASE_DAMPING;
    ball.trail.visible = false;

    if (reset) {
      body.position.copy(this.preShotPos);
      ball.mesh.position.set(this.preShotPos.x, this.preShotPos.y, this.preShotPos.z);
    }

    if (holed) {
      ball.holed = true;
      const cup = this.hole.cup;
      body.position.set(cup.x, (cup.y || 0), cup.z);
      ball.mesh.position.set(cup.x, (cup.y || 0), cup.z);
      this.holedAnim = { mesh: ball.mesh, t: 0 };
    }

    const p = body.position;
    if (this.cb.onShotComplete) {
      this.cb.onShotComplete({
        key: this.active.key,
        position: { x: p.x, y: p.y, z: p.z },
        holed, penalty: !!penalty,
      });
    }
  }

  _resize() {
    const w = this.mount.clientWidth, h = this.mount.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this._clearHole();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
