// ============================================================
//  BILLIARD · ENGINE  🎱
//  Three.js (realistisch, KEIN Neon/Bloom) + cannon-es-Physik.
//  Baut den Tisch einmalig, rackt die Kugeln pro Spiel, simuliert
//  NUR auf dem aktiven Client und liefert pro Stoß ein Ergebnis
//  (versenkte Kugeln, zuerst getroffene Kugel, Scratch, Bande).
//  Kennt Firebase nicht (isoliert).
// ============================================================

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TABLE, BALLS, BALL_R, ballInfo } from './billiard-table.js';

const MAX_SPEED = 30;          // Stoßgeschwindigkeit bei voller Power
const MAX_PULL = 5.5;          // Zug-Distanz für volle Power
const REST_SPEED = 0.22;       // darunter gilt eine Kugel als ruhend (etwas toleranter)
const REST_FRAMES = 14;        // so viele Frames müssen ALLE ruhen
const SHOT_TIMEOUT = 12;       // s, danach Zwangsende
const LIN_DAMP = 0.42;
const ANG_DAMP = 0.5;
const CLOTH = 0x1f7a44;

export class BilliardEngine {
  constructor(mountEl, callbacks = {}) {
    this.mount = mountEl;
    this.cb = callbacks;            // { onShotStart, onShotComplete, onAim }
    this.balls = {};                // id → { mesh, body, info, pocketed }
    this.cueReady = false;
    this.inputEnabled = false;
    this.shotInProgress = false;
    this.aiming = false;
    this.aimDir = new THREE.Vector3();
    this.aimRatio = 0;
    this.restCounter = 0;
    this.shotClock = 0;
    this.shotInfo = null;
    this._swing = null;
    this.camYaw = Math.PI;   // hinter der weißen Kugel, Blick Richtung Rack
    this.camPitch = 0.85;
    this.camDist = 20;
    this.camTarget = new THREE.Vector3();
    this.isMobile = window.matchMedia('(max-width:600px)').matches;
    this._pointers = new Map();
    this._camPinch = null;
    this._camMouseId = null;
    this._liveActive = false;        // Gegnerstoß wird gerade live gestreamt
    this._liveTargets = {};          // id → { x, z, pocketed }
    this._raf = null;
    this._clock = new THREE.Clock();
    this._initThree();
    this._initPhysics();
    this._buildTable();
    this._buildCue();
    this._initInput();
    this._onResize = this._resize.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
  }

  // ── Setup ─────────────────────────────────────────────────
  _initThree() {
    const w = this.mount.clientWidth || 800;
    const h = this.mount.clientHeight || 500;
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.isMobile });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = !this.isMobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.mount.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a2620);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 300);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const hemi = new THREE.HemisphereLight(0xfff4e0, 0x3a2e22, 0.5);
    this.scene.add(hemi);
    const lamp = new THREE.DirectionalLight(0xfff2d8, 1.0);
    lamp.position.set(0, 26, 4);
    lamp.castShadow = !this.isMobile;
    if (lamp.shadow) {
      lamp.shadow.mapSize.set(1024, 1024);
      lamp.shadow.camera.near = 5; lamp.shadow.camera.far = 60;
      lamp.shadow.camera.left = -16; lamp.shadow.camera.right = 16;
      lamp.shadow.camera.top = 16; lamp.shadow.camera.bottom = -16;
    }
    this.scene.add(lamp);
    const fill = new THREE.DirectionalLight(0xbfd0ff, 0.25);
    fill.position.set(-12, 10, -10);
    this.scene.add(fill);

    // Ziel-/Stoßlinie auf dem Tuch: deutlich sichtbares Band + Punktespur.
    this.aimGroup = new THREE.Group();
    this.aimGroup.visible = false;
    this.aimGroup.renderOrder = 998;
    // Leuchtendes Hauptband (Einheitslänge in +Z)
    this.aimBand = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.02, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, fog: false })
    );
    this.aimBand.renderOrder = 998;
    this.aimGroup.add(this.aimBand);
    // Punktespur entlang der Zielrichtung
    this.aimDots = [];
    const bdot = new THREE.SphereGeometry(0.06, 8, 8);
    for (let i = 0; i < 16; i++) {
      const dot = new THREE.Mesh(
        bdot,
        new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, fog: false })
      );
      dot.renderOrder = 999;
      dot.visible = false;
      this.aimDots.push(dot);
      this.aimGroup.add(dot);
    }
    // Ziel-Marker am Ende
    this.aimMarker = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.035, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, fog: false })
    );
    this.aimMarker.rotation.x = -Math.PI / 2;
    this.aimMarker.renderOrder = 999;
    this.aimGroup.add(this.aimMarker);
    this.scene.add(this.aimGroup);

    this._ray = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BALL_R);
  }

  _initPhysics() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = false;

    this.matCloth = new CANNON.Material('cloth');
    this.matRail = new CANNON.Material('rail');
    this.matBall = new CANNON.Material('ball');
    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.matBall, this.matCloth, { friction: 0.22, restitution: 0.2 }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.matBall, this.matRail, { friction: 0.12, restitution: 0.62 }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.matBall, this.matBall, { friction: 0.04, restitution: 0.93 }));
  }

  // ── Tisch (einmalig) ──────────────────────────────────────
  _buildTable() {
    const { play, cushion, pocketR } = TABLE;
    const hw = play.w / 2, hl = play.l / 2;

    // Tischbett (Tuch)
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(play.w + 0.2, 1, play.l + 0.2),
      new THREE.MeshStandardMaterial({ color: CLOTH, roughness: 0.95, metalness: 0.02 })
    );
    bed.position.y = -0.5;
    bed.receiveShadow = true;
    this.scene.add(bed);
    const bedBody = new CANNON.Body({ mass: 0, material: this.matCloth, shape: new CANNON.Box(new CANNON.Vec3(play.w / 2 + 0.1, 0.5, play.l / 2 + 0.1)) });
    bedBody.position.set(0, -0.5, 0);
    this.world.addBody(bedBody);

    // Holzrahmen rund um den Tisch
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3416, roughness: 0.5, metalness: 0.15 });
    const frameH = 0.8, fw = 1.4;
    const frameSpecs = [
      [0, hl + fw / 2 + cushion.t / 2, play.w + fw * 2 + cushion.t * 2, fw],
      [0, -(hl + fw / 2 + cushion.t / 2), play.w + fw * 2 + cushion.t * 2, fw],
      [hw + fw / 2 + cushion.t / 2, 0, fw, play.l + cushion.t * 2],
      [-(hw + fw / 2 + cushion.t / 2), 0, fw, play.l + cushion.t * 2],
    ];
    frameSpecs.forEach(([x, z, sx, sz]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, frameH, sz), wood);
      m.position.set(x, frameH / 2 - 0.1, z);
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
    });

    // Banden (mit Lücken an den Taschen)
    const railMat = new THREE.MeshStandardMaterial({ color: 0x1a6b3a, roughness: 0.8 });
    const g = pocketR + 0.15; // Lückenbreite an Taschen
    const addRail = (x, z, sx, sz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, cushion.h, sz), railMat);
      m.position.set(x, cushion.h / 2, z);
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
      const body = new CANNON.Body({ mass: 0, material: this.matRail, shape: new CANNON.Box(new CANNON.Vec3(sx / 2, cushion.h / 2, sz / 2)) });
      body.position.set(x, cushion.h / 2, z);
      body.userRail = true;
      this.world.addBody(body);
    };
    // Lange Seiten (x = ±hw), je 2 Segmente, Lücke an Seitentasche (z=0) & Ecken
    const segLen = (hl - g) - g; // von g..hl-g
    const segCz = (g + (hl - g)) / 2;
    [-1, 1].forEach(sx => {
      addRail(sx * (hw + cushion.t / 2), segCz, cushion.t, segLen);
      addRail(sx * (hw + cushion.t / 2), -segCz, cushion.t, segLen);
    });
    // Kurze Enden (z = ±hl), Lücke an den Ecken
    const endLen = (hw - g) * 2;
    [-1, 1].forEach(sz => {
      addRail(0, sz * (hl + cushion.t / 2), endLen, cushion.t);
    });

    // Taschen (dunkle Senken)
    const pocketMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1 });
    TABLE.pockets.forEach(p => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(pocketR, 24), pocketMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.x, 0.02, p.z);
      this.scene.add(m);
    });

    // Kopf-/Fußpunkt-Markierung
    const spotMat = new THREE.MeshBasicMaterial({ color: 0x0a3a22 });
    [TABLE.headSpot, TABLE.footSpot].forEach(s => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), spotMat);
      m.rotation.x = -Math.PI / 2; m.position.set(s.x, 0.03, s.z);
      this.scene.add(m);
    });

    // Boden unter dem Tisch
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x241c14, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2; floor.position.y = -2.2; floor.receiveShadow = true;
    this.scene.add(floor);
  }

  _buildCue() {
    const cue = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0xc98a3a, roughness: 0.4, metalness: 0.1 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x2a5a8a, roughness: 0.6 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 5.2, 14), wood);
    shaft.rotation.x = Math.PI / 2;     // entlang lokaler +Z legen
    shaft.position.z = -2.9;            // hinter dem Ball
    cue.add(shaft);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 14), tipMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = -0.35;
    cue.add(tip);
    cue.visible = false;
    this.scene.add(cue);
    this.cue = cue;
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

  // ── Kugeln racken / setzen ────────────────────────────────
  rack(ballsState) {
    // alte Kugeln entfernen
    for (const id of Object.keys(this.balls)) {
      const b = this.balls[id];
      this.scene.remove(b.mesh);
      if (b.body) this.world.removeBody(b.body);
    }
    this.balls = {};
    for (const s of ballsState) this._addBall(s);
    this.shotInProgress = false;
    this.clearLive();
    this._setCamTargetToCue(true);
  }

  _addBall(state) {
    const info = ballInfo(state.id);
    const tex = this._ballTexture(info);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 28, 28),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.18, metalness: 0.05 })
    );
    mesh.castShadow = true;
    mesh.position.set(state.x, BALL_R, state.z);
    mesh.visible = !state.pocketed;
    this.scene.add(mesh);

    let body = null;
    if (!state.pocketed) body = this._addBallBody(state.id, state.x, state.z);
    this.balls[state.id] = { mesh, body, info, pocketed: !!state.pocketed };
  }

  _addBallBody(id, x, z) {
    const body = new CANNON.Body({
      mass: 0.17, material: this.matBall,
      shape: new CANNON.Sphere(BALL_R),
      linearDamping: LIN_DAMP, angularDamping: ANG_DAMP,
    });
    body.position.set(x, BALL_R, z);
    body.ballId = id;
    body.addEventListener('collide', (e) => this._onCollide(id, e));
    this.world.addBody(body);
    return body;
  }

  _onCollide(id, e) {
    if (!this.shotInProgress || !this.shotInfo) return;
    const other = e.body;
    if (id === 0 && other.ballId !== undefined && this.shotInfo.firstContact === null) {
      this.shotInfo.firstContact = other.ballId;
    }
    if (other.userRail && this.shotInfo.firstContact !== null) {
      this.shotInfo.railHit = true;
    }
  }

  // Kugel-Textur (Vollfarbe / Streifen + Nummernkreis) per Canvas
  _ballTexture(info) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const hex = '#' + info.color.toString(16).padStart(6, '0');
    if (info.type === 'cue') {
      ctx.fillStyle = '#f7f4ec'; ctx.fillRect(0, 0, 128, 128);
    } else if (info.type === 'eight') {
      ctx.fillStyle = '#161616'; ctx.fillRect(0, 0, 128, 128);
    } else if (info.type === 'stripe') {
      ctx.fillStyle = '#f5f1e6'; ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = hex; ctx.fillRect(0, 38, 128, 52); // Band
    } else {
      ctx.fillStyle = hex; ctx.fillRect(0, 0, 128, 128);
    }
    if (info.id > 0) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(64, 64, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(info.id), 64, 66);
    }
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  // Positionen aus State übernehmen (Spectator / nach Remote-Stoß)
  setBallsState(ballsState) {
    for (const s of ballsState) {
      const b = this.balls[s.id];
      if (!b) { this._addBall(s); continue; }
      b.pocketed = !!s.pocketed;
      b.mesh.visible = !b.pocketed;
      b.mesh.position.set(s.x, BALL_R, s.z);
      if (b.pocketed && b.body) { this.world.removeBody(b.body); b.body = null; }
      else if (!b.pocketed) {
        if (!b.body) b.body = this._addBallBody(s.id, s.x, s.z);
        b.body.position.set(s.x, BALL_R, s.z);
        b.body.velocity.setZero(); b.body.angularVelocity.setZero();
      }
    }
    this._setCamTargetToCue(false);
  }

  currentBallsState() {
    return Object.keys(this.balls).map(id => {
      const b = this.balls[id];
      const p = b.body ? b.body.position : b.mesh.position;
      return { id: +id, x: p.x, z: p.z, pocketed: b.pocketed };
    }).sort((a, b) => a.id - b.id);
  }

  // Echtzeit-Kugelpositionen des Gegnerstoßes (Spectator) übernehmen
  updateBallsLive(arr) {
    this._liveActive = true;
    for (const s of arr) this._liveTargets[s.id] = { x: s.x, z: s.z, pocketed: !!s.p };
  }
  clearLive() { this._liveActive = false; this._liveTargets = {}; }

  // ── Aktiver Zug ───────────────────────────────────────────
  setActive(canShoot) {
    this.inputEnabled = !!canShoot;
    this.cueReady = !!canShoot;
    this.aiming = false;
    this._hideAim();
    if (canShoot) this.clearLive();   // eigener Zug: keine Live-Übernahme mehr
  }
  setInputEnabled(v) { this.inputEnabled = v; this.cueReady = v; }

  // Weiße neu setzen (Scratch / Ball-in-Hand vereinfacht: Kopfpunkt)
  resetCue(x = TABLE.headSpot.x, z = TABLE.headSpot.z) {
    const b = this.balls[0];
    if (!b) return;
    b.pocketed = false; b.mesh.visible = true;
    b.mesh.position.set(x, BALL_R, z);
    if (!b.body) b.body = this._addBallBody(0, x, z);
    b.body.position.set(x, BALL_R, z);
    b.body.velocity.setZero(); b.body.angularVelocity.setZero();
  }

  // ── Eingabe (Slingshot) ───────────────────────────────────
  _ndc(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  _groundPoint(e) {
    this._ray.setFromCamera(this._ndc(e), this.camera);
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
    if (!this.inputEnabled || this.shotInProgress) return;
    const gp = this._groundPoint(e);
    if (!gp) return;
    this.aiming = true; this._aimStart = gp;
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
    const gp = this._groundPoint(e);
    if (!gp) return;
    const pull = new THREE.Vector3().subVectors(this._aimStart, gp); pull.y = 0;
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
    this.aiming = false; this._hideAim();
    if (this.cb.onAim) this.cb.onAim(0, false);
    if (this.aimRatio > 0.05 && !this.shotInProgress) this._shoot(this.aimDir.clone(), this.aimRatio);
    this.aimRatio = 0;
  }
  _hideAim() { if (this.aimGroup) this.aimGroup.visible = false; }

  _updateAimLine() {
    const cue = this.balls[0]; if (!cue || !cue.body) return;
    const p = cue.body.position;
    const y = BALL_R;
    const len = 2 + this.aimRatio * 9;
    const ang = Math.atan2(this.aimDir.x, this.aimDir.z);
    const cx = p.x + this.aimDir.x * len / 2;
    const cz = p.z + this.aimDir.z * len / 2;

    this.aimBand.position.set(cx, y, cz);
    this.aimBand.rotation.y = ang;
    this.aimBand.scale.z = len;

    const count = Math.min(this.aimDots.length, Math.max(3, Math.round(len / 1.2)));
    for (let i = 0; i < this.aimDots.length; i++) {
      const dot = this.aimDots[i];
      if (i >= count) { dot.visible = false; continue; }
      const f = (i + 1) / (count + 1);
      dot.position.set(p.x + this.aimDir.x * len * f, y, p.z + this.aimDir.z * len * f);
      dot.visible = true;
    }

    this.aimMarker.position.set(p.x + this.aimDir.x * len, y, p.z + this.aimDir.z * len);
    this.aimGroup.visible = true;
  }

  _shoot(dir, ratio) {
    const cue = this.balls[0]; if (!cue || !cue.body) return;
    const speed = MAX_SPEED * (0.1 + 0.9 * Math.pow(ratio, 1.4));
    cue.body.wakeUp();
    cue.body.velocity.set(dir.x * speed, 0, dir.z * speed);
    cue.body.angularVelocity.setZero();
    this.shotInProgress = true;
    this.restCounter = 0; this.shotClock = 0;
    this.shotInfo = { firstContact: null, railHit: false, pocketed: [] };
    this._swing = { t: 0, dur: 0.14, cock: ratio, dir: dir.clone() };
    this.inputEnabled = false;
    if (this.cb.onShotStart) this.cb.onShotStart();
  }

  // ── Kamera ────────────────────────────────────────────────
  rotateCamera(d) { this.camYaw += d; }
  _setCamTargetToCue(instant) {
    const cue = this.balls[0];
    if (cue) this.camTarget.set(cue.mesh.position.x, 0, cue.mesh.position.z);
    if (instant) this._updateCamera(true);
  }
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
    const tick = () => { this._raf = requestAnimationFrame(tick); this._update(); };
    this._raf = requestAnimationFrame(tick);
  }
  stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; }

  _update() {
    const dt = Math.min(this._clock.getDelta(), 0.05);
    this.world.step(1 / 60, dt, 6);

    if (this._liveActive) {
      // Spectator: Kugel-Meshes weich auf die gestreamten Positionen ziehen
      this._applyLiveMeshes();
    } else {
      // Mesh-Positionen aus Physik
      let maxSpeed = 0;
      for (const id of Object.keys(this.balls)) {
        const b = this.balls[id];
        if (b.body && !b.pocketed) {
          b.mesh.position.copy(b.body.position);
          b.mesh.quaternion.copy(b.body.quaternion);
          const s = b.body.velocity.length();
          if (s > maxSpeed) maxSpeed = s;
        }
      }

      if (this.shotInProgress) {
        this._checkPockets();
        this.shotClock += dt;
        if (maxSpeed < REST_SPEED) this.restCounter++; else this.restCounter = 0;
        if (this.restCounter > REST_FRAMES || this.shotClock > SHOT_TIMEOUT) this._settle();
        // Kamera dem Geschehen folgen (schnellste Kugel grob)
        const cue = this.balls[0];
        if (cue && cue.body) this.camTarget.lerp(new THREE.Vector3(cue.mesh.position.x, 0, cue.mesh.position.z), 0.04);
        // Eigene Live-Position an den Gegner streamen (Drossel in JS)
        if (this.cb.onShotTick) this.cb.onShotTick();
      }
    }

    this._updateCue(dt);
    this._updateCamera();
    this.renderer.render(this.scene, this.camera);
  }

  // Spectator-Interpolation: Meshes sanft zu den Live-Zielen, Kamera folgt der Weißen
  _applyLiveMeshes() {
    for (const id in this._liveTargets) {
      const b = this.balls[id];
      if (!b) continue;
      const t = this._liveTargets[id];
      if (t.pocketed) {
        if (!b.pocketed) { b.pocketed = true; b.mesh.visible = false; if (b.body) { this.world.removeBody(b.body); b.body = null; } }
        continue;
      }
      b.pocketed = false; b.mesh.visible = true;
      b.mesh.position.x += (t.x - b.mesh.position.x) * 0.3;
      b.mesh.position.z += (t.z - b.mesh.position.z) * 0.3;
    }
    const cue = this.balls[0];
    if (cue && !cue.pocketed) this.camTarget.lerp(new THREE.Vector3(cue.mesh.position.x, 0, cue.mesh.position.z), 0.04);
  }

  _checkPockets() {
    for (const id of Object.keys(this.balls)) {
      const b = this.balls[id];
      if (b.pocketed || !b.body) continue;
      const p = b.body.position;
      // Sicherheitsnetz: unter den Tisch gefallene Kugel als versenkt behandeln
      if (p.y < -5) {
        b.pocketed = true;
        b.mesh.visible = false;
        this.world.removeBody(b.body); b.body = null;
        if (this.shotInfo) this.shotInfo.pocketed.push(+id);
        continue;
      }
      for (const pk of TABLE.pockets) {
        const dx = p.x - pk.x, dz = p.z - pk.z;
        if (dx * dx + dz * dz < TABLE.pocketR * TABLE.pocketR) {
          b.pocketed = true;
          b.mesh.visible = false;
          this.world.removeBody(b.body); b.body = null;
          if (this.shotInfo) this.shotInfo.pocketed.push(+id);
          break;
        }
      }
    }
  }

  _settle() {
    this.shotInProgress = false;
    for (const id of Object.keys(this.balls)) {
      const b = this.balls[id];
      if (b.body) { b.body.velocity.setZero(); b.body.angularVelocity.setZero(); }
    }
    const result = this.shotInfo || { firstContact: null, railHit: false, pocketed: [] };
    result.cueScratched = result.pocketed.includes(0);
    this.shotInfo = null;
    if (this.cb.onShotComplete) {
      this.cb.onShotComplete(result, this.currentBallsState());
    }
  }

  _updateCue(dt) {
    if (!this.cue) return;
    const cue = this.balls[0];
    const canShow = cue && cue.body && this.cueReady && !this.shotInProgress;
    if (this._swing) {
      this._swing.t += dt;
      const p = Math.min(this._swing.t / this._swing.dur, 1);
      const back = -(0.5 + this._swing.cock * 1.2);
      const through = 0.25;
      const z = THREE.MathUtils.lerp(back, through, 1 - Math.pow(1 - p, 3));
      this.cue.position.set(cue ? cue.mesh.position.x : 0, BALL_R, cue ? cue.mesh.position.z : 0);
      this.cue.rotation.y = Math.atan2(this._swing.dir.x, this._swing.dir.z);
      this.cue.children.forEach(ch => {});
      this.cue.userData.offset = z;
      this.cue.visible = true;
      this._applyCueOffset(z);
      if (p >= 1) { this._swing = null; this.cue.visible = false; }
      return;
    }
    if (!canShow) { this.cue.visible = false; return; }
    const p = cue.body.position;
    let dir;
    if (this.aiming && this.aimRatio > 0.001) dir = this.aimDir;
    else { dir = new THREE.Vector3(0, 0, 1); }
    this.cue.position.set(p.x, BALL_R, p.z);
    this.cue.rotation.y = Math.atan2(dir.x, dir.z);
    this.cue.visible = true;
    this._applyCueOffset(-(0.5 + (this.aiming ? this.aimRatio : 0) * 1.2));
  }
  _applyCueOffset(z) {
    // Verschiebt Queue entlang seiner lokalen -Z (hinter den Ball), Spitze Richtung Ball
    this.cue.children.forEach(ch => {
      if (ch.userData.baseZ === undefined) ch.userData.baseZ = ch.position.z;
      ch.position.z = ch.userData.baseZ + z;
    });
  }

  _resize() {
    const w = this.mount.clientWidth, h = this.mount.clientHeight;
    // Layout noch nicht fertig (z.B. direkt nach Fullscreen-Umschaltung) → nächster Frame
    if (!w || !h) { requestAnimationFrame(this._onResize); return; }
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    this.stop();
    this.clearLive();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
  }
}
