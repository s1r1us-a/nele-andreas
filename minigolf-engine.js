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
const MAX_SPEED = 40;          // Schussgeschwindigkeit bei voller Power (kräftigere Schläge)
const MAX_PULL = 11;           // Welt-Distanz für volle Power beim Ziehen (längerer Ziehbereich)
const CUP_R = 0.55;
const CAPTURE_SPEED = 5.5;     // max. Tempo, um eingelocht zu werden
const SAND_DAMPING = 0.92;     // starke Bremsung im Sand
const BASE_DAMPING = 0.40;     // Rollwiderstand → Bälle laufen trotz harter Schläge nicht endlos
const CUP_MAGNET_R = CUP_R * 1.9;  // Reichweite des Loch-Sogs (entschärft, war 2.6×)
const CUP_MAGNET_PULL = 8;         // Stärke des Loch-Sogs (entschärft, war 11)
const CUP_HEIGHT_TOL = 0.45;       // erlaubte Höhendifferenz zur Lochebene (war 0.7)

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
    this.camDist = 22;
    this.camTarget = new THREE.Vector3();
    this.cupPos = new THREE.Vector3();
    this.club = null;
    this.clubHead = null;
    this._swing = null;
    this.dynObstacles = [];
    this.isMobile = window.matchMedia('(max-width:600px)').matches;
    this._pointers = new Map();
    this._camPinch = null;
    this._camMouseId = null;
    this._liveTargets = {};          // key → Vector3 (Echtzeit-Ziel des Gegnerballs)
    this._raf = null;
    this._clock = new THREE.Clock();
    this._initThree();
    this._initPhysics();
    this._initInput();
    this._buildClub();
    this._onResize = this._resize.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
  }

  // ── Setup ─────────────────────────────────────────────────
  _initThree() {
    const w = this.mount.clientWidth || 800;
    const h = this.mount.clientHeight || 500;

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.isMobile, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
    this.renderer.setSize(w, h);
    // Filmisches Tonemapping → satter Neon-Glow, ohne dass Details absaufen
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    this.mount.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';

    this.scene = new THREE.Scene();
    // Wärmerer, satter Nachthimmel-Ton statt flachem Dunkelblau
    this.scene.background = new THREE.Color(0x2a1f52);
    this.scene.fog = new THREE.Fog(0x2a1f52, 62, 150);

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 260);

    // Licht: deutlich heller + warmer Akzent für ein liebevolleres Setting
    this.scene.add(new THREE.AmbientLight(0xbcc6ff, 1.4));
    this.scene.add(new THREE.HemisphereLight(0xd6dcff, 0x3a3068, 1.05));
    const dir = new THREE.DirectionalLight(0xffffff, 1.15);
    dir.position.set(8, 24, 6);
    this.scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0x9fb4ff, 0.5);
    dir2.position.set(-10, 12, -8);
    this.scene.add(dir2);
    // Warmes Rosé-Akzentlicht (Andreas/Nele-Palette)
    const warm = new THREE.PointLight(0xff9ecb, 0.9, 120, 2);
    warm.position.set(-6, 14, 10);
    this.scene.add(warm);

    // Stimmungsvoller Sternenhimmel (persistent, lochunabhängig)
    this._addStarfield();

    // Postprocessing (Neon-Glow)
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      this.isMobile ? 0.5 : 0.72, // strength (Szene ist jetzt heller)
      0.6,                        // radius (weicher, liebevoller Glow)
      0.22                        // threshold: nur kräftige Neon-Kanten glühen
    );
    this.composer.addPass(this.bloom);

    // Ziel-System (dickes Glow-Band + Punkte + Ziel-Marker)
    this._initAim();

    this._ray = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  // Sternenhimmel als Punktwolke auf einer großen Kuppel
  _addStarfield() {
    const N = this.isMobile ? 320 : 600;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const tint = [
      [1.0, 0.85, 0.95], // rosé
      [0.8, 0.85, 1.0],  // blau
      [0.95, 0.9, 1.0],  // lavendel
      [1.0, 1.0, 0.95],  // warmweiß
    ];
    for (let i = 0; i < N; i++) {
      const r = 90 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5; // obere Hälfte
      pos[i * 3]     = Math.cos(theta) * Math.cos(phi) * r;
      pos[i * 3 + 1] = Math.sin(phi) * r + 8;
      pos[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r;
      const t = tint[(Math.random() * tint.length) | 0];
      col[i * 3] = t[0]; col[i * 3 + 1] = t[1]; col[i * 3 + 2] = t[2];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 1.1, sizeAttenuation: true, vertexColors: true,
      transparent: true, opacity: 0.9, depthWrite: false,
    });
    this.stars = new THREE.Points(geo, mat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  // Ziel-System: kräftiges Glow-Band + Punktespur + Ziel-Marker am Ende.
  // Liegt knapp über dem Boden und ignoriert depthTest, damit es nie vom
  // Boden/Grid verdeckt wird (das alte 1px-Linchen war kaum sichtbar).
  _initAim() {
    this.aimGroup = new THREE.Group();
    this.aimGroup.visible = false;
    this.aimGroup.renderOrder = 999;

    // Hauptband (leuchtender Balken in Schlagrichtung, Einheitslänge in +Z)
    this.aimBand = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.05, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthTest: false, depthWrite: false, fog: false })
    );
    this.aimBand.renderOrder = 999;
    this.aimGroup.add(this.aimBand);

    // Heller Kern für extra Kontrast auf jedem Untergrund
    this.aimCore = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.06, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, fog: false })
    );
    this.aimCore.renderOrder = 1000;
    this.aimGroup.add(this.aimCore);

    // Punktespur entlang der Zielrichtung
    this.aimDots = [];
    const dotGeo = new THREE.SphereGeometry(0.13, 10, 10);
    for (let i = 0; i < 18; i++) {
      const dot = new THREE.Mesh(
        dotGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, fog: false })
      );
      dot.renderOrder = 1001;
      dot.visible = false;
      this.aimDots.push(dot);
      this.aimGroup.add(dot);
    }

    // Ziel-Marker (leuchtender Ring am Endpunkt)
    this.aimMarker = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.08, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, fog: false })
    );
    this.aimMarker.rotation.x = -Math.PI / 2;
    this.aimMarker.renderOrder = 1001;
    this.aimGroup.add(this.aimMarker);

    this.scene.add(this.aimGroup);
  }

  _hideAim() { if (this.aimGroup) this.aimGroup.visible = false; }

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
    el.addEventListener('pointerdown',  (e) => this._onPointerDown(e));
    el.addEventListener('pointermove',  (e) => this._onPointerMove(e));
    window.addEventListener('pointerup',     (e) => this._onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this._onPointerUp(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _pinchMid() {
    const pts = [...this._pointers.values()];
    return {
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    };
  }

  // Sichtbarer Putter (Schaft + Griff + Kopf). Lokales +Z = Schlagrichtung.
  _buildClub() {
    const club = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({
      color: 0xf4f7ff, emissive: 0x4a5fa0, emissiveIntensity: 0.7,
      roughness: 0.18, metalness: 0.92,
    });
    const grip = new THREE.MeshStandardMaterial({
      color: 0x1a2038, emissive: 0x141a36, emissiveIntensity: 0.4,
      roughness: 0.55, metalness: 0.25,
    });
    // Neon-Akzent (wird pro Spieler eingefärbt) – verleiht dem Putter Leuchtkraft
    this.clubAccentMat = new THREE.MeshStandardMaterial({
      color: 0x111426, emissive: 0x4ecdc4, emissiveIntensity: 2.2,
      roughness: 0.3, metalness: 0.5,
    });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.052, 2.2, 16), metal);
    shaft.position.set(0, 1.05, -0.62);
    shaft.rotation.x = 0.34;            // nach hinten-oben geneigt
    club.add(shaft);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 16), grip);
    handle.position.set(0, 2.0, -0.82);
    handle.rotation.x = 0.34;
    club.add(handle);
    // Griff-Endkappe mit Glow
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 14), this.clubAccentMat);
    cap.position.set(0, 2.28, -0.92);
    club.add(cap);
    // Hals/Hosel als Übergang zum Kopf
    const hosel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 12), metal);
    hosel.position.set(0, 0.34, -0.46);
    hosel.rotation.x = 0.18;
    club.add(hosel);
    // Abgerundeter Putterkopf
    const head = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.62, 20, 1, false, 0, Math.PI),
      metal
    );
    head.rotation.z = Math.PI / 2;
    head.rotation.y = Math.PI / 2;
    head.position.set(0, 0.15, -0.4);   // hinter dem Ball
    club.add(head);
    // Leuchtender Streifen auf dem Kopf (Schlagfläche)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.05), this.clubAccentMat);
    stripe.position.set(0, 0.15, -0.28);
    club.add(stripe);
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

    // Schläger-Akzent in der Farbe des aktiven Spielers
    if (this.clubAccentMat) {
      this.clubAccentMat.emissive.setHex(PLAYER_COLORS[this.active.key] || PLAYER_COLORS.solo);
    }

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
    this._replay = null;
    this._liveTargets = {};
    this.hole = holeDef;
    this.cupPos.set(holeDef.cup.x, holeDef.cup.y || 0, holeDef.cup.z);
    const g = holeDef.ground;

    // Boden (sattes Violett-Blau, passend zum Nachthimmel)
    this._addBox(0, -0.5, 0, g.w, 1, g.l, {
      color: 0x35316e, emissive: 0x241f5e, emissiveIntensity: 0.5,
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
        color: 0x35316e, emissive: 0x2a2466, emissiveIntensity: 0.55,
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
    this.cupRing = null;
    this.cupFlag = null;
    this._hideAim();
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
    // Feineres, dezenteres Neon-Raster: kräftige Mittelachsen, zarte Linien
    const span = Math.max(w, l);
    const divs = Math.round(span / 1.3);
    const grid = new THREE.GridHelper(span, divs, 0x7aa0ff, 0x3a5aa8);
    grid.position.y = 0.02;
    grid.material.transparent = true;
    grid.material.opacity = 0.32;
    grid.material.depthWrite = false;
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
    // Einladender, weicher Boden-Halo um das Loch
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(CUP_R + 0.2, CUP_R + 1.1, 40),
      new THREE.MeshBasicMaterial({ color: 0x33ff99, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(cup.x, y + 0.01, cup.z);
    this.scene.add(halo);
    // Neon-Fahne
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x222244, emissive: 0x6688ff, emissiveIntensity: 1.4 })
    );
    pole.position.set(cup.x, (cup.y || 0) + 1.2, cup.z);
    this.scene.add(pole);
    // Wimpel (Dreieck) – leuchtet und weht sanft
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0); flagShape.lineTo(0.8, -0.18); flagShape.lineTo(0, -0.45); flagShape.lineTo(0, 0);
    const flag = new THREE.Mesh(
      new THREE.ShapeGeometry(flagShape),
      new THREE.MeshStandardMaterial({ color: 0x330022, emissive: 0xff5fb0, emissiveIntensity: 1.9, side: THREE.DoubleSide })
    );
    flag.position.set(cup.x + 0.02, (cup.y || 0) + 2.3, cup.z);
    this.scene.add(flag);
    this.cupFlag = flag;
    this.holeObjects.push({ mesh: hole });
    this.holeObjects.push({ mesh: ring });
    this.holeObjects.push({ mesh: halo });
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
    this._hideAim();
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

  // Echtzeit-Position des Gegnerballs setzen (sanft interpoliert in _update)
  updateBallLive(key, pos) {
    const b = this.balls[key];
    if (!b) return;
    b.holed = false;
    b.trail.visible = true;
    const target = this._liveTargets[key] || new THREE.Vector3();
    target.set(pos.x, pos.y ?? BALL_R, pos.z);
    this._liveTargets[key] = target;
  }

  clearLiveTarget(key) {
    if (key) { delete this._liveTargets[key]; const b = this.balls[key]; if (b) b.trail.visible = false; }
    else this._liveTargets = {};
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
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Rechtsklick (PC): Kamera-Drag
    if (e.button === 2) { this._camMouseId = e.pointerId; return; }

    // Zweiter Finger (Handy): Kamera-Pinch, laufendes Zielen abbrechen
    if (this._pointers.size >= 2) {
      if (this.aiming) {
        this.aiming = false;
        this._hideAim();
        this.aimRatio = 0;
        if (this.cb.onAim) this.cb.onAim(0, false);
      }
      this._camPinch = this._pinchMid();
      return;
    }

    // Einfacher Klick / Touch: Zielen
    if (!this.inputEnabled || !this.active || this.shotInProgress) return;
    const ballY = this.active.body.position.y;
    const gp = this._groundPoint(e, ballY);
    if (!gp) return;
    this.aiming = true;
    this._aimStart = gp;
    this._pointerId = e.pointerId;
  }

  _onPointerMove(e) {
    const prev = this._pointers.get(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Rechtsklick-Kamera-Drag (PC)
    if (this._camMouseId === e.pointerId) {
      if (prev) {
        this.camYaw  -= (e.clientX - prev.x) * 0.005;
        this.camPitch = Math.max(0.1, Math.min(1.4, this.camPitch - (e.clientY - prev.y) * 0.005));
      }
      return;
    }

    // Zwei-Finger-Kamera (Handy)
    if (this._pointers.size >= 2) {
      if (!this._camPinch) this._camPinch = this._pinchMid();
      const mid = this._pinchMid();
      this.camYaw  -= (mid.x - this._camPinch.x) * 0.008;
      this.camPitch = Math.max(0.1, Math.min(1.4, this.camPitch - (mid.y - this._camPinch.y) * 0.008));
      this._camPinch = mid;
      return;
    }

    if (!this.aiming) return;
    const ballY = this.active.body.position.y;
    const gp = this._groundPoint(e, ballY);
    if (!gp) return;
    const pull = new THREE.Vector3().subVectors(this._aimStart, gp);
    pull.y = 0;
    const dist = Math.min(pull.length(), MAX_PULL);
    if (dist < 0.001) { this.aimRatio = 0; this._hideAim(); return; }
    this.aimDir.copy(pull).normalize();
    this.aimRatio = dist / MAX_PULL;
    this._updateAimLine();
    if (this.cb.onAim) this.cb.onAim(this.aimRatio, true);
  }

  _onPointerUp(e) {
    this._pointers.delete(e.pointerId);

    if (this._camMouseId === e.pointerId) { this._camMouseId = null; return; }
    if (this._pointers.size < 2) this._camPinch = null;
    if (this._pointers.size >= 1 && this._camPinch) return;

    if (!this.aiming) return;
    this.aiming = false;
    this._hideAim();
    if (this.cb.onAim) this.cb.onAim(0, false);
    if (this.aimRatio > 0.06 && this.active && !this.shotInProgress) {
      this._shoot(this.aimDir.clone(), this.aimRatio);
    }
    this.aimRatio = 0;
  }

  _updateAimLine() {
    const p = this.active.body.position;
    const y = BALL_R * 0.7;
    // Längerer Ziel-/Vorschaubereich, der mit der Power wächst
    const len = 2 + this.aimRatio * 13;
    const ang = Math.atan2(this.aimDir.x, this.aimDir.z);
    const cx = p.x + this.aimDir.x * len / 2;
    const cz = p.z + this.aimDir.z * len / 2;
    const ex = p.x + this.aimDir.x * len;
    const ez = p.z + this.aimDir.z * len;
    const col = new THREE.Color().setHSL(0.33 - this.aimRatio * 0.33, 1, 0.58); // grün→rot

    // Band + Kern
    this.aimBand.position.set(cx, y, cz);
    this.aimBand.rotation.y = ang;
    this.aimBand.scale.z = len;
    this.aimBand.material.color.copy(col);
    this.aimCore.position.set(cx, y + 0.01, cz);
    this.aimCore.rotation.y = ang;
    this.aimCore.scale.z = len;

    // Punktespur (Dichte wächst mit Länge)
    const count = Math.min(this.aimDots.length, Math.max(3, Math.round(len / 1.1)));
    for (let i = 0; i < this.aimDots.length; i++) {
      const dot = this.aimDots[i];
      if (i >= count) { dot.visible = false; continue; }
      const f = (i + 1) / (count + 1);
      dot.position.set(p.x + this.aimDir.x * len * f, y + 0.02, p.z + this.aimDir.z * len * f);
      dot.material.color.copy(col);
      dot.visible = true;
    }

    // Ziel-Marker am Endpunkt
    this.aimMarker.position.set(ex, y + 0.02, ez);
    this.aimMarker.material.color.copy(col);

    this.aimGroup.visible = true;
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
        // Live-Position des eigenen Schusses an Gegner streamen
        if (this.cb.onShotTick) this.cb.onShotTick(this.active.key, p);
      }
      this.camTarget.lerp(b.mesh.position, 0.1);
    }

    // Echtzeit-Ghost (Gegnerball während dessen Schuss)
    for (const key in this._liveTargets) {
      const b = this.balls[key];
      if (!b) continue;
      b.mesh.visible = true;
      b.mesh.position.lerp(this._liveTargets[key], 0.25);
      this._followTrail(b, b.mesh.position);
      if (!this.active || this.active.key !== key) this.camTarget.lerp(b.mesh.position, 0.08);
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
    // Wimpel sanft wehen lassen
    if (this.cupFlag) {
      this.cupFlag.rotation.y = Math.sin(performance.now() * 0.0022) * 0.35;
    }
    // Sternenhimmel ganz langsam drehen
    if (this.stars) this.stars.rotation.y += dt * 0.006;

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
    const heightOk = Math.abs(pos.y - (cup.y || 0)) < CUP_HEIGHT_TOL;
    if (heightOk && horiz < CUP_MAGNET_R) {
      // Sanfter Sog zur Lochmitte, solange das Tempo nicht zu hoch ist
      if (speed < CAPTURE_SPEED * 1.4) {
        body.velocity.x -= dx * CUP_MAGNET_PULL * dt;
        body.velocity.z -= dz * CUP_MAGNET_PULL * dt;
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
    // Layout noch nicht fertig (z.B. direkt nach Fullscreen-Umschaltung) → nächster Frame
    if (!w || !h) { requestAnimationFrame(this._onResize); return; }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    this._clearHole();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
