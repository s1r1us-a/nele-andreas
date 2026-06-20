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
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = !this.lowQ;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.mount.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';

    this.scene = new THREE.Scene();
    // Helle, freundliche Halle (kein dunkler Hintergrund)
    this.scene.background = new THREE.Color(0xeaf1fb);
    this.scene.fog = new THREE.Fog(0xeaf1fb, 36, 72);

    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 200);

    // Helles, einladendes Licht: kräftiges Himmel-/Boden-Ambient + warmes Deckenlicht
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xf3e2c8, 1.05));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const ceiling = new THREE.DirectionalLight(0xfff4e6, 1.25);
    ceiling.position.set(3, 18, 0);
    ceiling.castShadow = !this.lowQ;
    if (ceiling.shadow) {
      ceiling.shadow.mapSize.set(this.lowQ ? 1024 : 2048, this.lowQ ? 1024 : 2048);
      ceiling.shadow.camera.near = 2; ceiling.shadow.camera.far = 44;
      ceiling.shadow.camera.left = -4; ceiling.shadow.camera.right = 4;
      ceiling.shadow.camera.top = 22; ceiling.shadow.camera.bottom = -6;
      ceiling.shadow.bias = -0.0005;
    }
    this.scene.add(ceiling);
    this.scene.add(ceiling.target);
    ceiling.target.position.set(0, 0, 10);

    // Weicher Spot übers Pin-Deck (Akzent, unter der Decke)
    const deckSpot = new THREE.SpotLight(0xffffff, this.lowQ ? 0.9 : 1.4, 30, 0.7, 0.6, 1.0);
    deckSpot.position.set(0, 4.6, HEAD_PIN_Z - 1.5);
    deckSpot.target.position.set(0, 0, HEAD_PIN_Z + 1);
    deckSpot.castShadow = !this.lowQ;
    if (deckSpot.shadow) deckSpot.shadow.mapSize.set(1024, 1024);
    this.scene.add(deckSpot);
    this.scene.add(deckSpot.target);

    // Warmes Fülllicht vorne für die Kugel
    const fill = new THREE.PointLight(0xfff0e0, 0.4, 22);
    fill.position.set(0, 4.5, BALL_START_Z - 1);
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
    g.addColorStop(0, '#fde4ef'); g.addColorStop(1, '#e7dcff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128);
    // freundliche Chevron-Streifen in Rosé/Lavendel
    ctx.strokeStyle = 'rgba(232,115,138,0.4)'; ctx.lineWidth = 6;
    for (let x = -128; x < 256; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 128); ctx.lineTo(x + 64, 0); ctx.stroke();
    }
    ctx.fillStyle = '#c85070';
    ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('STRIKE', 128, 80);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _buildAlley() {
    const len = LANE_Z1 - LANE_Z0;
    const cz = (LANE_Z0 + LANE_Z1) / 2;

    // Heller Hallenboden (freundlicher, warmer Holz-/Teppichton)
    this._staticBox(0, -1.0, cz, 24, 0.4, len + 28, { color: 0xe7d6b6, roughness: 0.95, receiveShadow: true });

    // Bahn (lackiertes helles Ahorn)
    this._staticBox(0, -0.15, cz, LANE_W, 0.3, len, {
      map: this._laneTexture(), color: 0xe7c389, roughness: 0.3, metalness: 0.12,
      physMat: this.matLane, receiveShadow: true,
    });

    // Rinnen (mittlerer Grauton, nicht schwarz) + helle Bahnrand-Leisten
    const gx = LANE_W / 2 + GUTTER_W / 2;
    for (const s of [-1, 1]) {
      this._staticBox(s * gx, -0.30, cz, GUTTER_W, 0.3, len, {
        color: 0x8e98ac, roughness: 0.5, metalness: 0.25, physMat: this.matLane, receiveShadow: true,
      });
      this._staticBox(s * (LANE_W / 2 + GUTTER_W + 0.06), 0.12, cz, 0.12, 0.5, len, {
        color: 0xc49a5f, roughness: 0.55, physMat: this.matLane,
      });
    }

    // Foul-Linie (roter Streifen quer)
    this._staticBox(0, 0.011, FOUL_Z, LANE_W, 0.02, 0.08, { color: 0xc23b3b, roughness: 0.5 });

    // Ziel-Pfeile (dunkleres Holz-Inlay)
    for (const a of ARROWS) {
      const tri = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.22, 3),
        new THREE.MeshStandardMaterial({ color: 0x9c6a32, roughness: 0.5 })
      );
      tri.rotation.x = -Math.PI / 2;
      tri.position.set(a.x, 0.012, a.z);
      this.scene.add(tri);
    }
    for (let i = -2; i <= 2; i++) {
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.04, 12),
        new THREE.MeshStandardMaterial({ color: 0x9c6a32, roughness: 0.5 })
      );
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(i * 0.22, 0.012, FOUL_Z - 1.0);
      this.scene.add(dot);
    }

    // Pin-Deck (heller Belag hinter der Bahn)
    this._staticBox(0, -0.14, HEAD_PIN_Z + 1.2, LANE_W + 0.02, 0.3, 3.0, {
      color: 0xf6efe0, roughness: 0.5, metalness: 0.05, physMat: this.matLane, receiveShadow: true,
    });

    // Grube hinter den Pins (Auffang)
    this._staticBox(0, -0.9, LANE_Z1 + 0.4, LANE_W + GUTTER_W * 2, 0.3, 2.2, {
      color: 0x59606e, roughness: 0.9, physMat: this.matLane,
    });

    // ── Freundliche, helle Bowling-Halle ──
    // Maskenwand hinter dem Pin-Deck (heller Pastell-Panel)
    const masking = new THREE.Mesh(
      new THREE.PlaneGeometry(LANE_W + GUTTER_W * 2 + 0.6, 3.4),
      new THREE.MeshStandardMaterial({ map: this._maskingTexture(), roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.16 })
    );
    masking.position.set(0, 1.5, LANE_Z1 + 1.4);
    this.scene.add(masking);

    // Kickback-Seitenwände am Deck (zartes Lavendel, niedrig gehalten,
    // damit die Pins frei lesbar bleiben)
    for (const s of [-1, 1]) {
      this._staticBox(s * (LANE_W / 2 + GUTTER_W + 0.18), 0.45, HEAD_PIN_Z + 1.4, 0.12, 1.0, 3.4,
        { color: 0xe8def5, roughness: 0.7 });
    }

    // Statt hoher Seitenwände (Sichttunnel) nur eine niedrige Bodenkante
    // weit außen – weiche Begrenzung, blockiert die Bahn nicht.
    for (const s of [-1, 1]) {
      this._staticBox(s * 3.2, -0.05, cz, 0.16, 0.3, len, { color: 0xe2d2b8, roughness: 0.85 });
    }

    // Niedrige, freundliche Rückwand hinter dem Spieler (kein Tunnel)
    this._staticBox(0, 0.55, LANE_Z0 - 1.2, 6.4, 1.6, 0.25, { color: 0xfaf2e6, roughness: 0.95 });

    // Ball-Return-Schiene (hell-metallisch)
    this._staticBox(LANE_W / 2 + GUTTER_W + 0.4, 0.18, FOUL_Z - 0.5, 0.5, 0.4, 2.4,
      { color: 0xbcc4d4, roughness: 0.4, metalness: 0.5 });

    // Sitzbank hinter dem Spieler (helles Holz)
    this._staticBox(0, 0.25, LANE_Z0 - 2.4, 2.6, 0.5, 0.5, { color: 0xc8a877, roughness: 0.8 });
    this._staticBox(0, 0.7, LANE_Z0 - 2.7, 2.6, 0.9, 0.12, { color: 0xb7935f, roughness: 0.85 });

    // Helle Decke mit eingelassenen Lichtpaneelen
    this._staticBox(0, 5.2, cz, 6.6, 0.3, len, { color: 0xf6f6fb, roughness: 1 });
    for (let z = LANE_Z0 + 3; z < LANE_Z1; z += 5) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 2.4),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 0.85 })
      );
      panel.rotation.x = Math.PI / 2;
      panel.position.set(0, 5.04, z);
      this.scene.add(panel);
    }

    // ── Deko: Teppich, Topfpflanzen, Staffelei-Bilder, Festschmuck ──
    // Alles liegt entweder hoch (oberer Bildrand) oder weit außen am Boden –
    // die Bahn und die Pins bleiben frei.
    this._addRug();
    for (const s of [-1, 1]) {
      this._addPlant(s * 2.6, LANE_Z0 + 1.4, 1.15);
      this._addPlant(s * 2.7, 6.0, 0.95);
      this._addPlant(s * 2.8, 11.5, 1.05);
      this._addPicture(s, 4.0, 0);
      this._addPicture(s, 12.0, 2);
      this._addBunting(s, cz, len);
      this._addBalloons(s * 2.7, LANE_Z0 + 0.2);
    }
    this._addFairyLights(len);
    this._addNeonHeart();
  }

  // Wimpelkette längs der Bahn, hoch über der Sichtlinie (y≈3.6)
  _addBunting(s, cz, len) {
    const x = s * 2.5;
    const y = 3.6;
    const z0 = LANE_Z0 + 1, z1 = LANE_Z1 - 2;
    // Hängelinie
    const cord = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.03, z1 - z0),
      new THREE.MeshStandardMaterial({ color: 0x8a7f9c, roughness: 0.8 })
    );
    cord.position.set(x, y + 0.18, (z0 + z1) / 2);
    this.scene.add(cord);
    const cols = [0xf6a8c0, 0xb9a3f0, 0xf6d27a, 0x8fd6c8];
    const step = 0.85;
    for (let z = z0, i = 0; z <= z1; z += step, i++) {
      const tri = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.34, 3),
        new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.7, side: THREE.DoubleSide })
      );
      tri.rotation.x = Math.PI;            // Spitze nach unten
      tri.rotation.y = Math.PI / 2;        // flache Seite zur Bahn
      tri.position.set(x, y, z);
      this.scene.add(tri);
    }
  }

  // Lichterkette in sanften Bögen unter der Decke
  _addFairyLights(len) {
    const z0 = LANE_Z0 + 1, z1 = LANE_Z1 - 1;
    const bulbGeo = new THREE.SphereGeometry(0.06, 8, 8);
    for (const s of [-1, 1]) {
      const x = s * 1.9;
      const n = this.lowQ ? 14 : 22;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const z = z0 + (z1 - z0) * f;
        const sag = Math.sin(f * Math.PI * 5) * 0.18;        // Durchhang-Bögen
        const hue = (i * 0.13) % 1;
        const col = new THREE.Color().setHSL(hue, 0.7, 0.62);
        const bulb = new THREE.Mesh(
          bulbGeo,
          new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9 })
        );
        bulb.position.set(x, 4.7 - Math.abs(sag), z);
        this.scene.add(bulb);
      }
    }
  }

  // Glühendes Neon-Herz auf der Maskenwand hinter den Pins
  _addNeonHeart() {
    const shape = new THREE.Shape();
    const x = 0, y = 0;
    shape.moveTo(x, y + 0.18);
    shape.bezierCurveTo(x + 0.26, y + 0.46, x + 0.5, y + 0.1, x, y - 0.28);
    shape.bezierCurveTo(x - 0.5, y + 0.1, x - 0.26, y + 0.46, x, y + 0.18);
    const geo = new THREE.ShapeGeometry(shape);
    const heart = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0xff5e8a, emissive: 0xff5e8a, emissiveIntensity: 1.1, side: THREE.DoubleSide })
    );
    heart.position.set(0, 2.7, LANE_Z1 + 1.36);
    this.scene.add(heart);
  }

  // Ballon-Cluster am Boden weit außen (steigt bis y≈2.6)
  _addBalloons(x, z) {
    const grp = new THREE.Group();
    const cols = [0xf6a8c0, 0xb9a3f0, 0xf6d27a, 0x8fd6c8, 0xffffff];
    const offsets = [[0, 2.4], [0.28, 2.05], [-0.26, 2.15], [0.12, 1.78]];
    for (let i = 0; i < offsets.length; i++) {
      const [ox, oy] = offsets[i];
      const col = cols[i % cols.length];
      const balloon = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 12, 12),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, emissive: col, emissiveIntensity: 0.08 })
      );
      balloon.scale.y = 1.2;
      balloon.position.set(ox, oy, 0);
      grp.add(balloon);
      // Schnur
      const string = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, oy, 5),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 })
      );
      string.position.set(ox * 0.4, oy / 2, 0);
      grp.add(string);
    }
    grp.position.set(x, -0.8, z);
    this.scene.add(grp);
  }

  // Weicher Teppich im Anlaufbereich hinter der Foul-Linie
  _addRug() {
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(LANE_W + GUTTER_W * 2 + 1.8, 3.4),
      new THREE.MeshStandardMaterial({ color: 0xf3c6d6, roughness: 0.95 })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, -0.79, LANE_Z0 - 1.2);
    rug.receiveShadow = !this.lowQ;
    this.scene.add(rug);
    // Ziernaht
    const border = new THREE.Mesh(
      new THREE.RingGeometry((LANE_W + GUTTER_W * 2) / 2 + 0.7, (LANE_W + GUTTER_W * 2) / 2 + 0.78, 4),
      new THREE.MeshStandardMaterial({ color: 0xe89ab4, roughness: 0.9, side: THREE.DoubleSide })
    );
    border.rotation.x = -Math.PI / 2; border.rotation.z = Math.PI / 4;
    border.position.set(0, -0.785, LANE_Z0 - 1.2);
    this.scene.add(border);
  }

  // Topfpflanze (Terrakotta-Topf + Blattwerk)
  _addPlant(x, z, scale = 1) {
    const FLOOR_Y = -0.8;
    const grp = new THREE.Group();
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14 * scale, 0.18 * scale, 0.5 * scale, 14),
      new THREE.MeshStandardMaterial({ color: 0xcf7f5c, roughness: 0.85 })
    );
    pot.position.y = FLOOR_Y + 0.25 * scale;
    pot.castShadow = !this.lowQ;
    grp.add(pot);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16 * scale, 0.16 * scale, 0.08 * scale, 14),
      new THREE.MeshStandardMaterial({ color: 0xe8a07e, roughness: 0.8 })
    );
    rim.position.y = FLOOR_Y + 0.5 * scale;
    grp.add(rim);
    const leafMats = [
      new THREE.MeshStandardMaterial({ color: 0x4f9d3f, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: 0x66bb55, roughness: 0.85 }),
    ];
    const blobs = this.lowQ ? 4 : 7;
    for (let i = 0; i < blobs; i++) {
      const r = (0.16 + Math.random() * 0.12) * scale;
      const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), leafMats[i % 2]);
      blob.position.set(
        (Math.random() - 0.5) * 0.4 * scale,
        FLOOR_Y + (0.7 + Math.random() * 0.6) * scale,
        (Math.random() - 0.5) * 0.4 * scale
      );
      blob.scale.y = 1.3;
      blob.castShadow = !this.lowQ;
      grp.add(blob);
    }
    grp.position.set(x, 0, z);
    this.scene.add(grp);
  }

  // Motiv-Textur für ein Wandbild (Pastell, freundlich)
  _pictureTexture(variant) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 96;
    const ctx = c.getContext('2d');
    const palettes = [['#fde4ef', '#f4a6c0'], ['#e7dcff', '#b9a3f0'], ['#fff1cf', '#f6c453']];
    const pal = palettes[variant % palettes.length];
    ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, 128, 96);
    ctx.fillStyle = pal[1];
    if (variant % 3 === 0) {            // Herz
      const cx = 64, cy = 46;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 22);
      ctx.bezierCurveTo(cx + 30, cy - 6, cx + 10, cy - 30, cx, cy - 12);
      ctx.bezierCurveTo(cx - 10, cy - 30, cx - 30, cy - 6, cx, cy + 22);
      ctx.fill();
    } else if (variant % 3 === 1) {     // Kreise
      for (let i = 0; i < 5; i++) { ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(20 + i * 22, 30 + (i % 2) * 30, 12, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    } else {                            // sanfte Hügel
      ctx.beginPath(); ctx.moveTo(0, 96);
      ctx.lineTo(0, 60); ctx.quadraticCurveTo(40, 30, 70, 55); ctx.quadraticCurveTo(100, 75, 128, 50); ctx.lineTo(128, 96); ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // Freistehendes gerahmtes Bild auf einer Staffelei am Boden,
  // seitlich der Bahn (s = -1 links, +1 rechts). Niedrig → blockiert nicht.
  _addPicture(s, z, variant) {
    const FLOOR_Y = -0.8;
    const w = 0.8, h = 0.56;
    const grp = new THREE.Group();
    const cy = FLOOR_Y + 1.0;            // Bildmitte ~1.0 über dem Boden
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, h + 0.12, w + 0.12),
      new THREE.MeshStandardMaterial({ color: 0xf3e2bd, roughness: 0.5, metalness: 0.3 })
    );
    frame.position.set(0, cy, 0);
    grp.add(frame);
    const pic = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: this._pictureTexture(variant), roughness: 0.8 })
    );
    pic.position.set(-s * 0.03, cy, 0);
    pic.rotation.y = -s * Math.PI / 2;
    grp.add(pic);
    // Drei Holzbeine als Staffelei
    const legMat = new THREE.MeshStandardMaterial({ color: 0xb7935f, roughness: 0.85 });
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6);
    for (const [lz, tilt] of [[0.18, 0.18], [-0.18, -0.18], [0, 0]]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lz === 0 ? -s * 0.12 : 0, FLOOR_Y + 0.72, lz);
      leg.rotation.x = lz === 0 ? 0 : tilt;
      leg.rotation.z = lz === 0 ? s * 0.2 : 0;
      grp.add(leg);
    }
    grp.position.set(s * 2.55, 0, z);
    grp.rotation.y = s < 0 ? 0.25 : -0.25;     // leicht zur Bahn gedreht
    this.scene.add(grp);
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
