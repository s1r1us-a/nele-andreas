// ============================================================
//  BOWLING · ENGINE  🎳
//  Three.js-Rendering (realistische, abgedunkelte Bowling-Halle)
//  + cannon-es-Physik (Kugel, 10 Pins, Bahn, Rinnen).
//  Simuliert lokal den eigenen Wurf, verfolgt die Kugel mit der
//  Kamera und meldet das Ergebnis (umgeworfene Pins) per Callback.
//  Kennt weder Firebase noch Score-Regeln (isoliert testbar).
//  Aufbau & API angelehnt an minigolf-engine.js.
// ============================================================

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  BALL_R, PIN_R, PIN_H, LANE_W, GUTTER_W,
  LANE_Z0, LANE_Z1, FOUL_Z, BALL_START_Z, HEAD_PIN_Z,
  PINS, DECK_CENTER, ARROWS, fullRack,
} from './bowling-lane.js';

const GRAVITY = -19;
const MAX_BALL_SPEED = 21;     // Wurfgeschwindigkeit bei voller Power
const MIN_BALL_SPEED = 8;      // Mindesttempo, damit die Kugel die Pins erreicht
const MAX_PULL = 9;            // Welt-Distanz für volle Power beim Ziehen
const CURVE_ACC = 9.5;         // Stärke des Hooks (seitliche Beschleunigung)
const REST_SPEED = 0.45;       // ab hier gilt ein Körper als (fast) ruhend
const REST_FRAMES = 26;        // so viele ruhige Frames → Stillstand
const SHOT_TIMEOUT = 6.5;      // s – danach Zwangs-Auswertung
const TILT_DOWN = 0.78;        // dot(up, worldUp) darunter → Pin gilt als umgefallen
const PIN_MOVE = 0.32;         // horizontale Verschiebung darüber → Pin umgeworfen

export const PLAYER_COLORS = {
  andreas: 0xe8738a,
  nele: 0xa78bfa,
  solo: 0x39c5c9,
};

export class BowlingEngine {
  constructor(mountEl, callbacks = {}) {
    this.mount = mountEl;
    this.cb = callbacks;        // { onShotStart, onShotComplete, onAim, onShotTick, onAimModeChange, onReady }
    this.isMobile = window.matchMedia('(max-width:600px)').matches;
    this.lowQ = this.isMobile;  // Qualitätsstufe (Mobile = reduziert)

    this.phase = 'idle';        // 'idle' | 'aim' | 'rolling' | 'settled'
    this.inputEnabled = false;
    this.aiming = false;
    this.aimMode = false;       // Touch: false = Finger dreht Kamera, true = zielen/schießen
    this.aimDir = new THREE.Vector3(0, 0, 1);
    this.aimRatio = 0;
    this.curve = 0;             // Hook/Effet [-1..1]
    this.ballColor = PLAYER_COLORS.solo;

    this.restCounter = 0;
    this.shotClock = 0;
    this.pins = [];             // { mesh, body, home:{x,z}, inWorld }
    this.ball = null;           // { mesh, body }

    // Kamera
    this.camYaw = Math.PI;      // hinter dem Spieler, Blick Richtung +Z (Pins)
    this.camPitch = 0.34;
    this.camDist = 7.2;
    this.camTarget = new THREE.Vector3(0, BALL_R, BALL_START_Z);
    this.focusPins = false;

    // Live (Zuschauer-Modus: Gegnerwurf wird gestreamt)
    this.liveMode = false;
    this._liveBall = new THREE.Vector3();
    this._livePins = [];        // {pos:Vector3, quat:Quaternion}

    // Eingabe
    this._pointers = new Map();
    this._camMouseId = null;
    this._camTouchId = null;
    this._camPinch = null;
    this._lastTick = 0;

    this._raf = null;
    this._clock = new THREE.Clock();

    this._initThree();
    this._initPhysics();
    this._buildAlley();
    this._buildBall();
    this._buildPins();
    this._initAim();
    this._initInput();

    this._onResize = this._resize.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
  }

  // ── Three-Setup ───────────────────────────────────────────
  _initThree() {
    const w = this.mount.clientWidth || 800;
    const h = this.mount.clientHeight || 500;

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowQ, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.lowQ ? 1.5 : 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.lowQ;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.mount.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d12);
    this.scene.fog = new THREE.Fog(0x0a0d12, 22, 46);

    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 200);

    // Indoor-Licht: gedämpftes Ambient + warmes Deckenlicht, Spots auf Bahn & Pins
    this.scene.add(new THREE.HemisphereLight(0x55617a, 0x0a0d12, 0.55));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.16));

    const ceiling = new THREE.DirectionalLight(0xfff1d8, 0.9);
    ceiling.position.set(2, 16, 2);
    ceiling.castShadow = !this.lowQ;
    if (ceiling.shadow) {
      ceiling.shadow.mapSize.set(this.lowQ ? 1024 : 2048, this.lowQ ? 1024 : 2048);
      ceiling.shadow.camera.near = 2; ceiling.shadow.camera.far = 40;
      ceiling.shadow.camera.left = -4; ceiling.shadow.camera.right = 4;
      ceiling.shadow.camera.top = 22; ceiling.shadow.camera.bottom = -6;
      ceiling.shadow.bias = -0.0005;
    }
    this.scene.add(ceiling);
    this.scene.add(ceiling.target);
    ceiling.target.position.set(0, 0, 10);

    // Heller Spot übers Pin-Deck (Deck-Beleuchtung)
    const deckSpot = new THREE.SpotLight(0xfff6e6, this.lowQ ? 1.6 : 2.4, 28, 0.6, 0.5, 1.2);
    deckSpot.position.set(0, 9, HEAD_PIN_Z - 1.5);
    deckSpot.target.position.set(0, 0, HEAD_PIN_Z + 1);
    deckSpot.castShadow = !this.lowQ;
    if (deckSpot.shadow) deckSpot.shadow.mapSize.set(1024, 1024);
    this.scene.add(deckSpot);
    this.scene.add(deckSpot.target);

    // Kühles Akzentlicht von vorne für die Kugel
    const fill = new THREE.PointLight(0x88aaff, 0.5, 18);
    fill.position.set(0, 5, BALL_START_Z - 1);
    this.scene.add(fill);

    this._ray = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  _initPhysics() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = false;
    this.world.defaultContactMaterial.friction = 0.3;

    this.matLane = new CANNON.Material('lane');
    this.matBall = new CANNON.Material('ball');
    this.matPin = new CANNON.Material('pin');

    const cm = (a, b, friction, restitution) =>
      this.world.addContactMaterial(new CANNON.ContactMaterial(a, b, { friction, restitution }));
    cm(this.matBall, this.matLane, 0.16, 0.05);
    cm(this.matBall, this.matPin, 0.22, 0.45);
    cm(this.matPin, this.matLane, 0.35, 0.2);
    cm(this.matPin, this.matPin, 0.28, 0.35);
  }

  // ── Bahn & Halle (persistent) ─────────────────────────────
  _staticBox(x, y, z, sx, sy, sz, opt = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      new THREE.MeshStandardMaterial({
        color: opt.color ?? 0x222831, map: opt.map ?? null,
        roughness: opt.roughness ?? 0.9, metalness: opt.metalness ?? 0.05,
        emissive: opt.emissive ?? 0x000000, emissiveIntensity: opt.emissiveIntensity ?? 0,
      })
    );
    mesh.position.set(x, y, z);
    if (opt.receiveShadow && !this.lowQ) mesh.receiveShadow = true;
    if (opt.castShadow && !this.lowQ) mesh.castShadow = true;
    this.scene.add(mesh);
    if (opt.physMat) {
      const body = new CANNON.Body({
        mass: 0, material: opt.physMat,
        shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
      });
      body.position.set(x, y, z);
      this.world.addBody(body);
    }
    return mesh;
  }

  _laneTexture() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 512;
    const ctx = c.getContext('2d');
    // Lackiertes helles Ahorn-Holz mit Dielenfugen
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, '#caa06a'); g.addColorStop(0.5, '#e0bd86'); g.addColorStop(1, '#c79c63');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 512);
    for (let i = 0; i <= 8; i++) {            // Dielenfugen längs
      ctx.strokeStyle = 'rgba(90,60,30,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(i * 8, 0); ctx.lineTo(i * 8, 512); ctx.stroke();
    }
    for (let i = 0; i < 240; i++) {           // Maserung
      ctx.fillStyle = `rgba(120,80,40,${0.04 + Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * 64, Math.random() * 512, 1, 4 + Math.random() * 18);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 14);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _maskingTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#2a1a4a'); g.addColorStop(1, '#120a26');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128);
    // dezente Chevron-Streifen
    ctx.strokeStyle = 'rgba(120,90,200,0.35)'; ctx.lineWidth = 6;
    for (let x = -128; x < 256; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 128); ctx.lineTo(x + 64, 0); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,220,120,0.9)';
    ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('STRIKE', 128, 80);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _buildAlley() {
    const len = LANE_Z1 - LANE_Z0;
    const cz = (LANE_Z0 + LANE_Z1) / 2;

    // Untergrund-Boden der Halle (dunkler Teppich)
    this._staticBox(0, -1.0, cz, 22, 0.4, len + 24, { color: 0x14110f, roughness: 1, receiveShadow: true });

    // Bahn (lackiertes Holz)
    this._staticBox(0, -0.15, cz, LANE_W, 0.3, len, {
      map: this._laneTexture(), color: 0xe0bd86, roughness: 0.35, metalness: 0.15,
      physMat: this.matLane, receiveShadow: true,
    });

    // Rinnen (tiefer, dunkel) + Außenwände
    const gx = LANE_W / 2 + GUTTER_W / 2;
    for (const s of [-1, 1]) {
      this._staticBox(s * gx, -0.30, cz, GUTTER_W, 0.3, len, {
        color: 0x10141b, roughness: 0.6, metalness: 0.2, physMat: this.matLane, receiveShadow: true,
      });
      // Bahnrand-Leiste
      this._staticBox(s * (LANE_W / 2 + GUTTER_W + 0.06), 0.12, cz, 0.12, 0.5, len, {
        color: 0x2a2018, roughness: 0.7, physMat: this.matLane,
      });
    }

    // Foul-Linie (heller Streifen quer)
    this._staticBox(0, 0.011, FOUL_Z, LANE_W, 0.02, 0.08, {
      color: 0xfff2cc, roughness: 0.4, emissive: 0x554420, emissiveIntensity: 0.4,
    });

    // Ziel-Pfeile (eingelegte Chevrons)
    for (const a of ARROWS) {
      const tri = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.22, 3),
        new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.5 })
      );
      tri.rotation.x = -Math.PI / 2;
      tri.position.set(a.x, 0.012, a.z);
      this.scene.add(tri);
    }
    // Anlauf-Punkte vor der Foul-Linie
    for (let i = -2; i <= 2; i++) {
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.04, 12),
        new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.5 })
      );
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(i * 0.22, 0.012, FOUL_Z - 1.0);
      this.scene.add(dot);
    }

    // Pin-Deck (heller Belag hinter der Bahn)
    this._staticBox(0, -0.14, HEAD_PIN_Z + 1.2, LANE_W + 0.02, 0.3, 3.0, {
      color: 0xf2ead8, roughness: 0.5, metalness: 0.1, physMat: this.matLane, receiveShadow: true,
    });

    // Grube hinter den Pins (Auffang, damit die Kugel nicht ins Leere fällt)
    this._staticBox(0, -0.9, LANE_Z1 + 0.4, LANE_W + GUTTER_W * 2, 0.3, 2.2, {
      color: 0x05070a, roughness: 1, physMat: this.matLane,
    });

    // ── Deko-Hintergrund: Bowling-Halle ──
    // Maskenwand (Masking Unit) hinter dem Pin-Deck
    const masking = new THREE.Mesh(
      new THREE.PlaneGeometry(LANE_W + GUTTER_W * 2 + 0.4, 3.2),
      new THREE.MeshStandardMaterial({ map: this._maskingTexture(), roughness: 0.8,
        emissive: 0x2a1a4a, emissiveIntensity: 0.35 })
    );
    masking.position.set(0, 1.4, LANE_Z1 + 1.4);
    this.scene.add(masking);
    // Kickback-Seitenwände am Deck
    for (const s of [-1, 1]) {
      this._staticBox(s * (LANE_W / 2 + GUTTER_W + 0.18), 0.8, HEAD_PIN_Z + 1.4, 0.12, 1.8, 3.4,
        { color: 0x1b1430, roughness: 0.7, metalness: 0.2 });
    }
    // Seitliche Hallen-/Trennwände entlang der Bahn
    for (const s of [-1, 1]) {
      this._staticBox(s * 2.1, 1.4, cz, 0.2, 3.4, len, { color: 0x171a22, roughness: 0.85 });
    }
    // Ball-Return-Schiene rechts neben der Foul-Linie
    this._staticBox(LANE_W / 2 + GUTTER_W + 0.4, 0.18, FOUL_Z - 0.5, 0.5, 0.4, 2.4,
      { color: 0x2b3340, roughness: 0.4, metalness: 0.5 });
    // Angedeutete Sitzbank hinter dem Spieler
    this._staticBox(0, 0.25, LANE_Z0 - 2.4, 2.4, 0.5, 0.5, { color: 0x3a2c22, roughness: 0.8 });
    this._staticBox(0, 0.7, LANE_Z0 - 2.7, 2.4, 0.9, 0.12, { color: 0x2c2018, roughness: 0.85 });
    // Decke (dunkel, fängt Spotlicht)
    this._staticBox(0, 6.2, cz, 6, 0.3, len, { color: 0x0c0e14, roughness: 1 });
  }

  // Profil-Form eines Bowling-Pins (Lathe), zentriert um die eigene Höhe
  _pinGeometry() {
    const pts = [];
    const prof = [ // [radius, höhe 0..1]
      [0.10, 0.00], [0.118, 0.05], [0.105, 0.10], [0.075, 0.24],
      [0.052, 0.42], [0.05, 0.50], [0.083, 0.62], [0.088, 0.70],
      [0.06, 0.82], [0.035, 0.92], [0.012, 1.0],
    ];
    for (const [r, hy] of prof) pts.push(new THREE.Vector2(r * (PIN_H / 0.62), hy * PIN_H - PIN_H / 2));
    const geo = new THREE.LatheGeometry(pts, this.lowQ ? 12 : 20);
    geo.computeVertexNormals();
    return geo;
  }

  _buildPins() {
    const pinGeo = this._pinGeometry();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xfdfdfa, roughness: 0.35, metalness: 0.05 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xd2342f, roughness: 0.4 });
    for (let i = 0; i < PINS.length; i++) {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(pinGeo, bodyMat);
      body.castShadow = !this.lowQ; body.receiveShadow = !this.lowQ;
      grp.add(body);
      // zwei rote Halsringe
      for (const hy of [0.52, 0.60]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.052 * (PIN_H / 0.62), 0.013, 8, 18),
          ringMat
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = hy * PIN_H - PIN_H / 2;
        grp.add(ring);
      }
      this.scene.add(grp);

      const cbody = new CANNON.Body({
        mass: 1.5, material: this.matPin,
        linearDamping: 0.22, angularDamping: 0.4,
      });
      // cannon-es Cylinder ist Y-orientiert → passt zur Lathe ohne Rotation
      cbody.addShape(new CANNON.Cylinder(PIN_R, PIN_R * 1.1, PIN_H, 10));
      this.pins.push({ mesh: grp, body: cbody, home: PINS[i], inWorld: false });
    }
    this.newRack(fullRack());
  }

  _buildBall() {
    const grp = new THREE.Group();
    this.ballMat = new THREE.MeshStandardMaterial({
      color: this.ballColor, roughness: 0.12, metalness: 0.35,
      emissive: this.ballColor, emissiveIntensity: 0.08,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, this.lowQ ? 20 : 32, this.lowQ ? 20 : 32), this.ballMat);
    sphere.castShadow = !this.lowQ;
    grp.add(sphere);
    // drei Grifflöcher
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const holePos = [[0, 0.06], [-0.05, -0.03], [0.05, -0.03]];
    for (const [hx, hy] of holePos) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 8), holeMat);
      hole.position.set(hx, hy, BALL_R - 0.01);
      hole.rotation.x = Math.PI / 2;
      grp.add(hole);
    }
    this.scene.add(grp);

    const body = new CANNON.Body({
      mass: 6, material: this.matBall,
      shape: new CANNON.Sphere(BALL_R),
      linearDamping: 0.12, angularDamping: 0.15,
    });
    body.position.set(0, BALL_R, BALL_START_Z);
    this.ball = { mesh: grp, body };
    this._ballHome();
  }

  setBallColor(key) {
    this.ballColor = PLAYER_COLORS[key] || PLAYER_COLORS.solo;
    if (this.ballMat) { this.ballMat.color.setHex(this.ballColor); this.ballMat.emissive.setHex(this.ballColor); }
  }

  _ballHome() {
    const b = this.ball.body;
    b.velocity.setZero(); b.angularVelocity.setZero();
    b.position.set(0, BALL_R, BALL_START_Z);
    b.quaternion.set(0, 0, 0, 1);
    if (!b.world) this.world.addBody(b);
    this.ball.mesh.position.copy(b.position);
    this.ball.mesh.quaternion.set(0, 0, 0, 1);
    this.ball.mesh.visible = true;
  }

  // ── Pins setzen (mask = 10 Booleans, true = steht) ────────
  newRack(mask) {
    for (let i = 0; i < this.pins.length; i++) {
      const p = this.pins[i];
      if (mask[i]) {
        p.body.velocity.setZero(); p.body.angularVelocity.setZero();
        p.body.quaternion.set(0, 0, 0, 1);
        p.body.position.set(p.home.x, PIN_H / 2, p.home.z);
        if (!p.inWorld) { this.world.addBody(p.body); p.inWorld = true; }
        p.mesh.visible = true;
        p.mesh.position.copy(p.body.position);
        p.mesh.quaternion.set(0, 0, 0, 1);
      } else {
        if (p.inWorld) { this.world.removeBody(p.body); p.inWorld = false; }
        p.mesh.visible = false;
      }
    }
  }

  // Kugel scharf machen: bereit zum Zielen/Werfen
  armBall() {
    this.liveMode = false;
    this._ballHome();
    this.phase = 'aim';
    this.inputEnabled = true;
    this.aiming = false;
    this.aimMode = false;
    this.focusPins = false;
    this.camYaw = Math.PI; this.camPitch = 0.34;
    this.camTarget.set(0, BALL_R, BALL_START_Z);
    if (this.cb.onAimModeChange) this.cb.onAimModeChange(false);
    this._updateCamera(true);
  }

  // Zuschauer / fremder Zug: keine Eingabe, Kugel ruht
  disarm() {
    this.inputEnabled = false;
    this.aiming = false;
    this.phase = 'idle';
    this._hideAim();
    this._ballHome();
  }

  setInputEnabled(v) { this.inputEnabled = v; }
  setCurve(v) { this.curve = Math.max(-1, Math.min(1, v)); if (this.aiming) this._updateAimLine(); }

  setAimMode(v) {
    this.aimMode = !!v;
    if (!this.aimMode && this.aiming) {
      this.aiming = false; this._hideAim(); this.aimRatio = 0;
      if (this.cb.onAim) this.cb.onAim(0, false);
    }
    if (this.cb.onAimModeChange) this.cb.onAimModeChange(this.aimMode);
  }

  // ── Ziel-Visualisierung ───────────────────────────────────
  _initAim() {
    this.aimGroup = new THREE.Group();
    this.aimGroup.visible = false;
    this.aimGroup.renderOrder = 999;
    this.aimDots = [];
    const dotGeo = new THREE.SphereGeometry(0.05, 8, 8);
    for (let i = 0; i < 22; i++) {
      const d = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.92, depthTest: false, fog: false,
      }));
      d.renderOrder = 1000; d.visible = false;
      this.aimDots.push(d); this.aimGroup.add(d);
    }
    this.aimMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.24, 22),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false, fog: false, side: THREE.DoubleSide })
    );
    this.aimMarker.rotation.x = -Math.PI / 2;
    this.aimMarker.renderOrder = 1000;
    this.aimGroup.add(this.aimMarker);
    this.scene.add(this.aimGroup);
  }
  _hideAim() { if (this.aimGroup) this.aimGroup.visible = false; }

  _updateAimLine() {
    const p = this.ball.body.position;
    const y = BALL_R * 0.6;
    const len = 3 + this.aimRatio * 13;
    // perpendikulär zur Zielrichtung (für die Hook-Vorschau)
    const perp = new THREE.Vector3(this.aimDir.z, 0, -this.aimDir.x);
    const col = new THREE.Color().setHSL(0.33 - this.aimRatio * 0.33, 1, 0.58);
    const count = Math.min(this.aimDots.length, Math.max(4, Math.round(len / 0.9)));
    for (let i = 0; i < this.aimDots.length; i++) {
      const dot = this.aimDots[i];
      if (i >= count) { dot.visible = false; continue; }
      const f = (i + 1) / (count + 1);
      const bend = this.curve * f * f * len * 0.18;   // gekrümmte Vorschau
      dot.position.set(
        p.x + this.aimDir.x * len * f + perp.x * bend,
        y,
        p.z + this.aimDir.z * len * f + perp.z * bend
      );
      dot.material.color.copy(col);
      dot.visible = true;
    }
    const fEnd = 1;
    const bendEnd = this.curve * fEnd * len * 0.18;
    this.aimMarker.position.set(
      p.x + this.aimDir.x * len + perp.x * bendEnd, y + 0.005, p.z + this.aimDir.z * len + perp.z * bendEnd);
    this.aimMarker.material.color.copy(col);
    this.aimGroup.visible = true;
  }

  // ── Eingabe ───────────────────────────────────────────────
  _initInput() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    el.addEventListener('pointermove', (e) => this._onPointerMove(e));
    window.addEventListener('pointerup', (e) => this._onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this._onPointerUp(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  _ndc(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  _groundPoint(e, y) {
    this._ray.setFromCamera(this._ndc(e), this.camera);
    this._groundPlane.constant = -(y || 0);
    const pt = new THREE.Vector3();
    return this._ray.ray.intersectPlane(this._groundPlane, pt) ? pt : null;
  }
  _pinchMid() {
    const pts = [...this._pointers.values()];
    return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  }

  _onPointerDown(e) {
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.button === 2) { this._camMouseId = e.pointerId; return; }
    if (this._pointers.size >= 2) {
      this._camTouchId = null;
      if (this.aiming) { this.aiming = false; this._hideAim(); this.aimRatio = 0; if (this.cb.onAim) this.cb.onAim(0, false); }
      this._camPinch = this._pinchMid(); return;
    }
    if (e.pointerType === 'touch' && !this.aimMode) { this._camTouchId = e.pointerId; return; }
    if (!this.inputEnabled || this.phase !== 'aim') return;
    const gp = this._groundPoint(e, this.ball.body.position.y);
    if (!gp) return;
    this.aiming = true;
    this._aimStart = gp;
  }

  _onPointerMove(e) {
    const prev = this._pointers.get(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._camMouseId === e.pointerId || this._camTouchId === e.pointerId) {
      if (prev) {
        this.camYaw -= (e.clientX - prev.x) * 0.005;
        this.camPitch = Math.max(0.1, Math.min(1.2, this.camPitch - (e.clientY - prev.y) * 0.005));
      }
      return;
    }
    if (this._pointers.size >= 2) {
      if (!this._camPinch) this._camPinch = this._pinchMid();
      const mid = this._pinchMid();
      this.camYaw -= (mid.x - this._camPinch.x) * 0.008;
      this.camPitch = Math.max(0.1, Math.min(1.2, this.camPitch - (mid.y - this._camPinch.y) * 0.008));
      this._camPinch = mid; return;
    }
    if (!this.aiming) return;
    const gp = this._groundPoint(e, this.ball.body.position.y);
    if (!gp) return;
    const pull = new THREE.Vector3().subVectors(this._aimStart, gp); pull.y = 0;
    const dist = Math.min(pull.length(), MAX_PULL);
    if (dist < 0.001) { this.aimRatio = 0; this._hideAim(); return; }
    // Richtung nur in die Halbebene nach vorne (+Z) erlauben
    this.aimDir.copy(pull).normalize();
    if (this.aimDir.z < 0.15) { this.aimDir.z = 0.15; this.aimDir.normalize(); }
    this.aimRatio = dist / MAX_PULL;
    this._updateAimLine();
    if (this.cb.onAim) this.cb.onAim(this.aimRatio, true);
  }

  _onPointerUp(e) {
    this._pointers.delete(e.pointerId);
    if (this._camMouseId === e.pointerId) { this._camMouseId = null; return; }
    if (this._camTouchId === e.pointerId) { this._camTouchId = null; return; }
    if (this._pointers.size < 2) this._camPinch = null;
    if (this._pointers.size >= 1 && this._camPinch) return;
    if (!this.aiming) return;
    this.aiming = false; this._hideAim();
    if (this.cb.onAim) this.cb.onAim(0, false);
    if (this.aimRatio > 0.06 && this.phase === 'aim') {
      this._shoot(this.aimDir.clone(), this.aimRatio);
      this.setAimMode(false);
    }
    this.aimRatio = 0;
  }

  // ── Wurf ──────────────────────────────────────────────────
  _shoot(dir, ratio) {
    const body = this.ball.body;
    const speed = MIN_BALL_SPEED + (MAX_BALL_SPEED - MIN_BALL_SPEED) * Math.pow(ratio, 1.25);
    body.wakeUp();
    body.velocity.set(dir.x * speed, 0, dir.z * speed);
    // Vorwärts-Roll (visuell + physikalisch): ω = (up × v) / R
    const up = new CANNON.Vec3(0, 1, 0);
    const v = body.velocity;
    body.angularVelocity.set(
      (up.y * v.z - up.z * v.y) / BALL_R,
      (up.z * v.x - up.x * v.z) / BALL_R,
      (up.x * v.y - up.y * v.x) / BALL_R
    );
    this.phase = 'rolling';
    this.restCounter = 0;
    this.shotClock = 0;
    this._shotCurve = this.curve;
    if (this.cb.onShotStart) this.cb.onShotStart();
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

    if (this.liveMode) {
      this._applyLive(dt);
    } else {
      // Hook: seitliche Beschleunigung, solange die Kugel rollt
      if (this.phase === 'rolling' && Math.abs(this._shotCurve) > 0.01) {
        const b = this.ball.body;
        const sp = Math.hypot(b.velocity.x, b.velocity.z);
        if (sp > 1.5) {
          const tx = b.velocity.x / sp, tz = b.velocity.z / sp;
          const px = tz, pz = -tx;                 // perpendikulär
          const k = this._shotCurve * CURVE_ACC * dt;
          b.velocity.x += px * k; b.velocity.z += pz * k;
        }
      }
      this.world.step(1 / 60, dt, 6);
      this._syncMeshes();
      if (this.phase === 'rolling') {
        this._checkSettle(dt);
        const now = performance.now();
        if (this.cb.onShotTick && now - this._lastTick > 70) {
          this._lastTick = now;
          this.cb.onShotTick(this.getLiveSnapshot());
        }
      }
    }

    // Kamera: der Kugel folgen bzw. nach dem Wurf aufs Deck schwenken
    if (this.focusPins) {
      this.camTarget.lerp(new THREE.Vector3(DECK_CENTER.x, 0.5, DECK_CENTER.z), 0.05);
    } else if (this.ball) {
      this.camTarget.lerp(this.ball.mesh.position, 0.12);
    }
    this._updateCamera();
    this.renderer.render(this.scene, this.camera);
  }

  _syncMeshes() {
    const b = this.ball;
    b.mesh.position.copy(b.body.position);
    b.mesh.quaternion.copy(b.body.quaternion);
    for (const p of this.pins) {
      if (!p.inWorld) continue;
      p.mesh.position.copy(p.body.position);
      p.mesh.quaternion.copy(p.body.quaternion);
    }
  }

  _checkSettle(dt) {
    this.shotClock += dt;
    const b = this.ball.body;
    const ballSlow = b.velocity.length() < REST_SPEED;
    let pinsSlow = true;
    for (const p of this.pins) {
      if (!p.inWorld) continue;
      if (p.body.velocity.length() > REST_SPEED || p.body.angularVelocity.length() > REST_SPEED) { pinsSlow = false; break; }
    }
    const fellAway = b.position.y < -0.6 || b.position.z > LANE_Z1 + 0.5;
    if ((ballSlow && pinsSlow) || fellAway) this.restCounter++; else this.restCounter = 0;

    if (this.restCounter > REST_FRAMES || this.shotClock > SHOT_TIMEOUT) {
      this._settle();
    }
  }

  // Welche Pins stehen noch? (Index-Array von Booleans)
  _standingMask() {
    const up = new CANNON.Vec3(0, 1, 0);
    return this.pins.map((p) => {
      if (!p.inWorld) return false;                    // war schon weg
      const q = p.body.quaternion;
      const ly = up.clone(); q.vmult(up, ly);          // lokale Hoch-Achse in Weltkoord.
      const tilt = ly.y;                                // dot mit Welt-Up
      const dx = p.body.position.x - p.home.x;
      const dz = p.body.position.z - p.home.z;
      const moved = Math.hypot(dx, dz);
      const fell = p.body.position.y < PIN_H / 2 - 0.18;
      return tilt > TILT_DOWN && moved < PIN_MOVE && !fell;
    });
  }

  _settle() {
    this.phase = 'settled';
    this.inputEnabled = false;
    this.focusPins = true;
    const standing = this._standingMask();
    if (this.cb.onShotComplete) this.cb.onShotComplete({ standing });
  }

  // ── Live-Übertragung (Gegnerwurf) ─────────────────────────
  getLiveSnapshot() {
    const r3 = (n) => Math.round(n * 1000) / 1000;
    const bb = this.ball.body.position;
    const pins = this.pins.map((p) => {
      if (!p.inWorld) return null;
      const q = p.body.quaternion, pp = p.body.position;
      return [r3(pp.x), r3(pp.y), r3(pp.z), r3(q.x), r3(q.y), r3(q.z), r3(q.w)];
    });
    return { b: [r3(bb.x), r3(bb.y), r3(bb.z)], p: pins };
  }

  applyLiveSnapshot(snap) {
    if (!snap || !snap.b) return;
    this.liveMode = true;
    this.focusPins = false;
    this._liveBall.set(snap.b[0], snap.b[1], snap.b[2]);
    for (let i = 0; i < this.pins.length; i++) {
      const d = snap.p && snap.p[i];
      const t = this._livePins[i] || (this._livePins[i] = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), active: false });
      if (d) { t.pos.set(d[0], d[1], d[2]); t.quat.set(d[3], d[4], d[5], d[6]); t.active = true; }
      else t.active = false;
    }
  }

  _applyLive(dt) {
    this.ball.mesh.visible = true;
    this.ball.mesh.position.lerp(this._liveBall, 0.3);
    this.camTarget.lerp(this.ball.mesh.position, 0.1);
    for (let i = 0; i < this.pins.length; i++) {
      const p = this.pins[i], t = this._livePins[i];
      if (t && t.active) { p.mesh.visible = true; p.mesh.position.lerp(t.pos, 0.3); p.mesh.quaternion.slerp(t.quat, 0.3); }
    }
  }

  clearLive() { this.liveMode = false; this.focusPins = true; }

  // ── Kamera ────────────────────────────────────────────────
  _updateCamera(instant = false) {
    const off = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch)
    ).multiplyScalar(this.camDist);
    const desired = new THREE.Vector3().addVectors(this.camTarget, off);
    if (instant) this.camera.position.copy(desired); else this.camera.position.lerp(desired, 0.09);
    this.camera.lookAt(this.camTarget);
  }

  _resize() {
    const w = this.mount.clientWidth, h = this.mount.clientHeight;
    if (!w || !h) { requestAnimationFrame(this._onResize); return; }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
  }
}
