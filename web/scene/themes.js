// Per-team decor for the open floor. The theme comes from the group name (web/lib/themes.js), not from who sits here.
// Props are low-poly boxes merged into one mesh per material, plus one screen texture and a floor sign.
// Built once per theme and cloned onto the open floor (geometries and materials stay shared).
// Zones that stay clear of desks (x -7..3, z -4.5..4) and of the lounge seats (~x 4..8, z ~0):
//   back wall z <= -5.45, and the front-right corner x >= 5.4, z >= 3.15.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { themeAccent, THEME_LABELS } from '../lib/themes.js';

const STOCK = ['sofa', 'armchair_1', 'armchair_2', 'coffee_table', 'style_sofa', 'style_media', 'style_library', 'style_meeting'];
const mats = new Map();
const templates = new Map();

function material(color, emissive) {
  const key = `${color}|${emissive ? 1 : 0}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: emissive ? 0.4 : 0.62,
      metalness: emissive ? 0.04 : 0.08,
      emissive: new THREE.Color(emissive ? color : '#000000'),
      emissiveIntensity: emissive ? 0.9 : 0,
    });
    mats.set(key, m);
  }
  return m;
}

class Kit {
  constructor() { this.parts = []; this.extras = []; }
  box(color, x, y, z, w, h, d, emissive = false) {
    this.parts.push({ color, emissive: !!emissive, x, y: y + h / 2, z, w, h, d });
    return this;
  }
  extra(obj) { this.extras.push(obj); return this; }
  done() {
    const bins = new Map();
    for (const p of this.parts) {
      const key = `${p.color}|${p.emissive ? 1 : 0}`;
      const g = new THREE.BoxGeometry(p.w, p.h, p.d);
      g.translate(p.x, p.y, p.z);
      const list = bins.get(key);
      if (list) list.push(g); else bins.set(key, [g]);
    }
    const root = new THREE.Group();
    for (const [key, geos] of bins) {
      const [color, em] = key.split('|');
      const mesh = new THREE.Mesh(mergeGeometries(geos, false), material(color, em === '1'));
      mesh.name = 'theme_mesh';
      root.add(mesh);
    }
    for (const o of this.extras) root.add(o);
    return root;
  }
}

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

function screen(parent, x, y, z, w, h, drawn, name) {
  const tex = new THREE.CanvasTexture(drawn);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  mesh.position.set(x, y, z);
  mesh.name = name || 'theme_screen';
  parent.add(mesh);
  return mesh;
}

function monitorWall(g, w, h) {
  g.fillStyle = '#12151C'; g.fillRect(0, 0, w, h);
  const cols = 6, rows = 3, pad = 10;
  const cw = (w - pad * (cols + 1)) / cols, ch = (h - pad * (rows + 1)) / rows;
  const colors = ['#3DDC97', '#3DDC97', '#E2B657', '#3DDC97', '#E23B4A', '#3DDC97'];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = pad + c * (cw + pad), y = pad + r * (ch + pad);
    g.fillStyle = '#1C2330'; g.fillRect(x, y, cw, ch);
    g.fillStyle = colors[(r * cols + c) % colors.length];
    g.fillRect(x + 8, y + ch - 16, cw - 16, 6);
    g.globalAlpha = 0.35; g.fillRect(x + 8, y + 10, cw * 0.55, 4); g.globalAlpha = 1;
  }
}

function candles(g, w, h) {
  g.fillStyle = '#10140F'; g.fillRect(0, 0, w, h);
  const n = 18, slot = w / n;
  let price = h * 0.55;
  for (let i = 0; i < n; i++) {
    const up = ((i * 7) % 5) > 1;
    const body = 18 + ((i * 13) % 28);
    const wick = body + 10 + (i % 4) * 4;
    price += up ? -6 : 8;
    price = Math.max(36, Math.min(h - 36, price));
    g.strokeStyle = g.fillStyle = up ? '#3DDC97' : '#E23B4A';
    g.lineWidth = 2;
    const x = slot * i + slot / 2;
    g.beginPath(); g.moveTo(x, price - wick / 2); g.lineTo(x, price + wick / 2); g.stroke();
    g.fillRect(x - 5, up ? price - body / 2 : price - body / 4, 10, body / 2);
  }
}

function chart(g, w, h) {
  g.fillStyle = '#161A22'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, (h / 4) * i); g.lineTo(w, (h / 4) * i); g.stroke(); }
  g.strokeStyle = '#E23B4A'; g.lineWidth = 3;
  g.beginPath();
  const pts = [0.72, 0.6, 0.64, 0.4, 0.48, 0.52, 0.33, 0.38, 0.22];
  pts.forEach((p, i) => { const x = 16 + i * ((w - 32) / (pts.length - 1)), y = 16 + p * (h - 32); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
}

function code(g, w, h) {
  g.fillStyle = '#1A1B26'; g.fillRect(0, 0, w, h);
  const rows = [['#7C6BF0', 0.55], ['#8E9DB1', 0.35], ['#62D26F', 0.62], ['#E2B657', 0.28], ['#8E9DB1', 0.48], ['#7C6BF0', 0.4], ['#62D26F', 0.7]];
  rows.forEach((r, i) => {
    g.fillStyle = r[0];
    g.fillRect(18 + (i % 3) * 14, 16 + i * 16, (w - 48) * r[1], 7);
  });
}

function tickets(g, w, h) {
  g.fillStyle = '#F4F0E8'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#4C8DFF'; g.fillRect(0, 0, w, 28);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i === 1 ? '#E23B4A' : i === 3 ? '#E2B657' : '#3DDC97';
    g.beginPath(); g.arc(22, 52 + i * 28, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2A2E38'; g.fillRect(40, 46 + i * 28, w * (0.45 + (i % 3) * 0.12), 8);
  }
}

function board(g, w, h) {
  g.fillStyle = '#F7F4EE'; g.fillRect(0, 0, w, h);
  const notes = [['#F6E27A', 24, 24], ['#F7A1C4', 120, 36], ['#9FD4F0', 210, 20], ['#B6E3A8', 40, 110], ['#F6C48A', 150, 120]];
  for (const [c, x, y] of notes) { g.fillStyle = c; g.fillRect(x, y, 70, 52); }
}

const BUILD = {
  boss(k) {
    // Skyline in the window, an executive desk in the front corner, a plant, warm light.
    const towers = [[-5.2, 1.5], [-4.2, 0.9], [-3.3, 1.9], [-2.2, 1.15], [-1.2, 1.6], [-0.2, 0.7], [0.8, 1.35]];
    for (const [x, h] of towers) {
      k.box('#243044', x, 0.35, -5.62, 0.7, h, 0.18);
      k.box('#E2B657', x, 0.55 + h * 0.45, -5.5, 0.12, 0.1, 0.04, true);
    }
    k.box('#6B4226', 6.15, 0, 3.55, 1.7, 0.08, 0.85);
    k.box('#8A5A34', 6.15, 0.08, 3.55, 1.7, 0.06, 0.85);
    k.box('#3A312C', 5.45, 0, 3.55, 0.08, 0.72, 0.08);
    k.box('#3A312C', 6.85, 0, 3.55, 0.08, 0.72, 0.08);
    k.box('#2C2622', 6.15, 0, 4.15, 0.55, 0.5, 0.5);
    k.box('#E2B657', 6.15, 0.74, 3.35, 0.46, 0.06, 0.16);
    k.box('#EFE6D4', 6.15, 0.8, 3.35, 0.42, 0.02, 0.12);
    k.box('#F2EFE8', 4.55, 0, 4.15, 0.32, 0.22, 0.32);
    k.box('#2F6B3A', 4.55, 0.22, 4.15, 0.36, 0.55, 0.36);
    k.box('#E2B657', 7.35, 0.9, 3.55, 0.08, 0.7, 1.3);
    const light = new THREE.PointLight(0xFFC58A, 0.7, 6, 2);
    light.position.set(6.15, 2.15, 3.55);
    k.extra(light);
  },
  ops(k) {
    k.box('#1A1E28', -1.1, 0.85, -5.58, 5.4, 0.08, 0.12);
    k.box('#12151C', -1.1, 0.93, -5.58, 5.4, 1.35, 0.08);
    k.box('#3DDC97', -1.1, 0.78, -5.5, 5.2, 0.035, 0.04, true);
    for (const x of [6.35, 7.15]) {
      k.box('#2A2E38', x, 0, 3.55, 0.62, 1.7, 0.42);
      for (let i = 0; i < 5; i++) k.box(i === 3 ? '#E23B4A' : '#3DDC97', x + 0.16, 0.25 + i * 0.28, 3.78, 0.08, 0.08, 0.04, true);
    }
  },
  trading(k) {
    k.box('#161A14', 0.2, 1.05, -5.58, 3.4, 1.15, 0.06);
    k.box('#1A120F', -3.6, 1.15, -5.58, 2.2, 0.95, 0.06);
    k.box('#12110F', 6.2, 0.9, 3.45, 1.8, 0.08, 0.35);
    k.box('#2A241C', 6.2, 0, 3.45, 1.8, 0.9, 0.08);
    k.box('#10140F', 5.55, 0.98, 3.28, 0.02, 0.42, 0.7);
    k.box('#10140F', 6.85, 0.98, 3.28, 0.02, 0.42, 0.7);
    k.box('#E23B4A', 5.3, 1.55, 3.5, 0.1, 0.1, 0.1, true);
    k.box('#3DDC97', 7.1, 1.55, 3.5, 0.1, 0.1, 0.1, true);
  },
  video(k) {
    k.box('#1FA85A', -1.4, 0.55, -5.55, 3.1, 1.7, 0.06, true);
    k.box('#202228', -1.4, 0.45, -5.62, 3.3, 0.08, 0.1);
    k.box('#F4F1EA', 4.7, 1.15, 3.7, 0.55, 0.4, 0.12, true);
    k.box('#F4F1EA', 7.3, 1.15, 3.55, 0.55, 0.4, 0.12, true);
    k.box('#2A2E38', 6.05, 0.85, 3.35, 0.28, 0.22, 0.38);
    k.box('#111111', 6.05, 0.95, 3.12, 0.16, 0.16, 0.16);
    k.box('#3A3E48', 5.85, 0, 3.35, 0.04, 0.9, 0.04);
    k.box('#3A3E48', 6.25, 0, 3.35, 0.04, 0.9, 0.04);
    k.box('#1C2330', 6.9, 0.85, 4.15, 0.7, 0.45, 0.06);
  },
  marketing(k) {
    k.box('#F7F4EE', -1.2, 0.7, -5.55, 3.2, 1.45, 0.06);
    k.box('#C9B59A', -1.2, 0.62, -5.62, 3.4, 0.08, 0.08);
    const notes = [[-2.3, 1.55, '#F6E27A'], [-1.5, 1.7, '#F7A1C4'], [-0.6, 1.45, '#9FD4F0'], [-2.1, 1.05, '#B6E3A8'], [-1.0, 1.0, '#F6C48A']];
    for (const [x, y, c] of notes) k.box(c, x, y, -5.48, 0.28, 0.22, 0.02);
    k.box('#F2784B', 2.4, 0.9, -5.55, 0.9, 1.15, 0.04);
    k.box('#7C6BF0', 3.5, 1.05, -5.55, 0.7, 0.9, 0.04);
    k.box('#E23B4A', 5.7, 0.15, 3.7, 0.7, 0.45, 0.7);
    k.box('#F2B84B', 7.05, 0.12, 4.05, 0.62, 0.4, 0.62);
    k.box('#F2784B', 6.4, 0.55, 3.35, 0.28, 0.16, 0.16);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 8), material('#F2784B', false));
    cone.position.set(6.4, 0.9, 3.22); cone.rotation.x = Math.PI / 2;
    k.extra(cone);
  },
  support(k) {
    k.box('#F4F0E8', -1.3, 0.75, -5.55, 2.8, 1.35, 0.06);
    k.box('#4C8DFF', -1.3, 2.02, -5.55, 2.8, 0.08, 0.08);
    k.box('#D7CBBC', 6.15, 0, 3.4, 1.5, 0.72, 0.55);
    k.box('#2A2E38', 5.7, 0.74, 3.25, 0.22, 0.08, 0.16);
    k.box('#2A2E38', 5.55, 0.78, 3.25, 0.08, 0.1, 0.1);
    k.box('#2A2E38', 5.85, 0.78, 3.25, 0.08, 0.1, 0.1);
    k.box('#C4785A', 6.3, 0.15, 4.2, 1.35, 0.32, 0.6);
    k.box('#C4785A', 6.3, 0.47, 4.42, 1.35, 0.36, 0.16);
    k.box('#E7D3C4', 4.7, 0.2, 4.15, 0.45, 0.28, 0.45);
  },
  eng(k) {
    k.box('#3A3E46', 6.2, 0, 3.45, 1.35, 1.02, 0.5);
    k.box('#1A1B26', 5.85, 1.02, 3.22, 0.02, 0.38, 0.55);
    k.box('#1A1B26', 6.55, 1.02, 3.22, 0.02, 0.38, 0.55);
    k.box('#2A2E38', 7.25, 0, 3.7, 0.4, 1.15, 0.32);
    k.box('#62D26F', 7.25, 0.3, 3.88, 0.06, 0.06, 0.03, true);
    k.box('#62D26F', 7.25, 0.55, 3.88, 0.06, 0.06, 0.03, true);
    const duck = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), material('#F6D34A', false));
    duck.position.set(6.2, 1.12, 3.55);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 6), material('#E23B4A', false));
    beak.position.set(6.2, 1.12, 3.42); beak.rotation.x = Math.PI / 2;
    k.extra(duck); k.extra(beak);
  },
  default(k) {
    k.box('#F7F4EE', -1.5, 0.85, -5.55, 2.2, 1.2, 0.05);
    k.box('#C9B59A', -1.5, 0.78, -5.6, 2.35, 0.06, 0.06);
    k.box('#F2EFE8', 6.4, 0, 3.7, 0.34, 0.24, 0.34);
    k.box('#2F6B3A', 6.4, 0.24, 3.7, 0.4, 0.6, 0.4);
  },
};

const PAINT = {
  ops: (g, w, h) => monitorWall(g, w, h),
  trading: (g, w, h) => candles(g, w, h),
  video: (g, w, h) => { g.fillStyle = '#10141C'; g.fillRect(0, 0, w, h); g.fillStyle = '#7C6BF0'; g.fillRect(12, h * 0.72, w - 24, 10); g.fillStyle = '#E2B657'; g.fillRect(40, h * 0.72, 36, 10); },
  eng: (g, w, h) => code(g, w, h),
  support: (g, w, h) => tickets(g, w, h),
  marketing: (g, w, h) => board(g, w, h),
};

// Where the hero screen sits, in floor space. Trading also gets the big chart.
const SCREEN_AT = {
  ops: [-1.1, 1.62, -5.22, 5.15, 1.2],
  trading: [0.2, 1.62, -5.22, 3.15, 1.0],
  video: [6.9, 1.12, 4.12, 0.66, 0.38],
  eng: [6.2, 1.22, 3.18, 0.7, 0.32],
  support: [-1.3, 1.45, -5.22, 2.6, 1.15],
  marketing: [-1.2, 1.45, -5.22, 3.0, 1.3],
};

function template(id) {
  let root = templates.get(id);
  if (root) return root;
  const k = new Kit();
  const accent = themeAccent(id);
  k.box(accent, 6.35, 0.012, 3.55, 2.6, 0.02, 2.35);
  (BUILD[id] || BUILD.default)(k);
  root = k.done();
  root.name = `theme_${id}`;
  const paint = PAINT[id];
  const at = SCREEN_AT[id];
  if (paint && at) screen(root, at[0], at[1], at[2], at[3], at[4], canvas(512, 288, paint), 'theme_screen');
  if (id === 'trading') screen(root, -3.6, 1.62, -5.22, 2.0, 0.85, canvas(384, 216, chart), 'theme_chart');
  templates.set(id, root);
  return root;
}

const FONT = '700 56px "Noto Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", "WenQuanYi Micro Hei", "Droid Sans Fallback", sans-serif';
const FONT_SM = '600 28px "Noto Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", "WenQuanYi Micro Hei", "Droid Sans Fallback", sans-serif';

function makeSign(accent) {
  const drawn = canvas(512, 200, () => {});
  const tex = new THREE.CanvasTexture(drawn);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.28, 0.5),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  face.position.set(0, 1.05, 0.03);
  const group = new THREE.Group();
  group.name = 'floor_sign';
  group.position.set(1.2, 0, 5.05);
  group.rotation.y = -0.5;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), material('#2A2E38', false));
  post.position.y = 0.4;
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.56, 0.05), material('#F7F4EE', false));
  board.position.y = 1.05;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.56, 0.06), material(accent, true));
  stripe.position.set(-0.64, 1.05, 0.01);
  group.add(post, board, stripe, face);
  let last = '';
  function setText(name, themeId) {
    const label = THEME_LABELS[themeId] || THEME_LABELS.default;
    group.userData.pending = [name || '', themeId];
    if (document.fonts && !group.userData.fontHook) {
      group.userData.fontHook = true;
      document.fonts.ready.then(() => { last = ''; const p = group.userData.pending; if (p) setText(p[0], p[1]); });
    }
    const sig = `${name}|${label}`;
    if (sig === last) return;
    last = sig;
    const g = drawn.getContext('2d');
    g.clearRect(0, 0, 512, 200);
    g.fillStyle = '#F7F4EE'; g.fillRect(0, 0, 512, 200);
    g.fillStyle = accent; g.fillRect(0, 0, 18, 200);
    g.fillStyle = '#1D1D1F'; g.font = FONT; g.textBaseline = 'middle';
    const title = fit(g, name || label, 460);
    g.fillText(title, 36, 78);
    g.font = FONT_SM; g.fillStyle = '#6E6E73';
    g.fillText(label, 36, 142);
    tex.needsUpdate = true;
  }
  return { group, setText, material: face.material };
}

function fit(g, text, maxW) {
  let s = String(text || '');
  if (g.measureText(s).width <= maxW) return s;
  while (s.length > 1 && g.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

function hideStock(root, hide) {
  if (!hide) return;
  for (const n of STOCK) {
    const o = root.getObjectByName(n);
    if (o) o.visible = false;
  }
}

function dropTheme(host) {
  const sign = host.userData.signMat;
  if (sign) { sign.map?.dispose(); sign.dispose(); }
  host.removeFromParent();
}

/** Show `themeId` on an open-floor object. Safe to call every style refresh. */
export function applyOfficeTheme(root, themeId, label) {
  const id = BUILD[themeId] ? themeId : 'default';
  let host = root.getObjectByName('office_theme');
  if (!host || host.userData.theme !== id) {
    if (host) dropTheme(host);
    host = template(id).clone(true);
    host.name = 'office_theme';
    host.userData.theme = id;
    const sign = makeSign(themeAccent(id));
    host.userData.signMat = sign.material;
    host.userData.setSign = sign.setText;
    host.add(sign.group);
    root.add(host);
  }
  host.userData.setSign(label || '', id);
  hideStock(root, id !== 'default');
}
