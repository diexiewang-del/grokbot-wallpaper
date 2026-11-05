// Per-team decor for the open floor. The theme comes from the group name (web/lib/themes.js), not from who sits here.
// Props are low-poly boxes merged into one mesh per material, plus one screen texture and a floor sign.
// Built once per theme and cloned onto the open floor (geometries and materials stay shared).
// Zones that stay clear of desks (x -7..3, z -4.5..4) and of the lounge seats (~x 4..8, z ~0):
//   back wall z <= -5.45, and the front-right corner x >= 5.4, z >= 3.15.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { themeAccent, THEME_LABELS } from '../lib/themes.js';

const STOCK = [
  'sofa', 'armchair_1', 'armchair_2', 'coffee_table', 'coffee_bar', 'bar_stools',
  'style_sofa', 'style_media', 'style_library', 'style_meeting',
  'table_1', 'table_2', 'poufs', 'laptops', 'mugs', 'pendants', 'tree_1', 'tree_2', 'tree_3',
];
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

function screen(parent, x, y, z, w, h, drawn, name, rotY = 0) {
  const tex = new THREE.CanvasTexture(drawn);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
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

function rowDesks(k, z, top, screen, n = 6) {
  const xs = [-5.6, -4.0, -2.4, -0.8, 0.8, 2.4].slice(0, n);
  for (const x of xs) {
    k.box(top, x, 0, z, 1.15, 0.74, 0.62);
    k.box('#1A1D24', x, 0.74, z - 0.22, 0.5, 0.42, 0.04);
    k.box(screen, x, 0.78, z - 0.18, 0.42, 0.32, 0.02, true);
    k.box('#2A2E38', x, 0, z + 0.55, 0.42, 0.42, 0.42);
  }
}

const BUILD = {
  boss(k) {
    const towers = [[-6.2, 1.7], [-5.1, 1.05], [-4.0, 2.15], [-2.8, 1.35], [-1.6, 1.9], [-0.4, 0.85], [0.8, 1.55], [2.0, 1.15]];
    for (const [x, h] of towers) {
      k.box('#1B2838', x, 0.15, -5.55, 0.85, h, 0.16);
      k.box('#F6E2A8', x, 0.4 + h * 0.35, -5.42, 0.16, 0.12, 0.04, true);
      k.box('#F6E2A8', x + 0.22, 0.55 + h * 0.2, -5.42, 0.1, 0.1, 0.04, true);
    }
    k.box('#6B4226', -1.4, 0, -1.1, 2.6, 0.76, 1.15);
    k.box('#C4A574', -1.4, 0.76, -1.1, 2.7, 0.06, 1.22);
    k.box('#2C241C', -1.4, 0, 0.15, 0.7, 0.48, 0.7);
    k.box('#8C4A3A', 2.4, 0.12, 2.2, 2.4, 0.42, 0.9);
    k.box('#8C4A3A', 2.4, 0.42, 2.55, 2.4, 0.55, 0.22);
    k.box('#C4A574', 2.4, 0.12, 1.35, 0.9, 0.32, 0.9);
    k.box('#2F6B3A', -4.6, 0.2, 2.4, 0.55, 0.9, 0.55);
    k.box('#F4F1EA', -4.6, 0, 2.4, 0.4, 0.22, 0.4);
    const light = new THREE.PointLight(0xFFC58A, 1.1, 9, 2);
    light.position.set(-1.4, 2.3, -1.1);
    k.extra(light);
  },
  ops(k) {
    k.box('#1C2430', -1.2, 0, -3.5, 7.2, 0.78, 0.7);
    k.box('#1C2430', -4.6, 0, -0.8, 0.7, 0.78, 4.6);
    k.box('#1C2430', 2.2, 0, -0.8, 0.7, 0.78, 4.6);
    for (let i = 0; i < 8; i++) {
      const x = -4.2 + i * 0.85;
      k.box(i % 5 === 0 ? '#E23B4A' : '#3DDC97', x, 0.82, -3.15, 0.55, 0.36, 0.04, true);
    }
    k.box('#12151C', -1.2, 0.95, -5.45, 8.4, 1.55, 0.08);
    k.box('#2A2E38', 5.6, 0, 1.2, 0.7, 1.8, 0.5);
    k.box('#2A2E38', 6.5, 0, 1.2, 0.7, 1.8, 0.5);
    for (let i = 0; i < 4; i++) k.box('#3DDC97', 5.85, 0.35 + i * 0.35, 1.48, 0.1, 0.1, 0.04, true);
  },
  trading(k) {
    rowDesks(k, -2.5, '#1A120F', '#E23B4A');
    rowDesks(k, 1.6, '#10140F', '#3DDC97');
    k.box('#0E1210', -1.2, 1.15, -5.45, 9.2, 0.42, 0.08);
    k.box('#E23B4A', -3.2, 1.22, -5.38, 2.2, 0.22, 0.02, true);
    k.box('#3DDC97', 0.6, 1.22, -5.38, 2.4, 0.22, 0.02, true);
    k.box('#E2B657', 3.4, 1.22, -5.38, 1.4, 0.22, 0.02, true);
  },
  video(k) {
    k.box('#17A34A', -1.5, 0.35, -5.15, 6.4, 2.15, 0.12, true);
    k.box('#15181E', -1.5, 0.2, -5.35, 6.8, 0.12, 0.12);
    k.box('#F7F4EE', -5.2, 0.4, -1.2, 0.7, 1.3, 0.18, true);
    k.box('#F7F4EE', 2.4, 0.4, -1.2, 0.7, 1.3, 0.18, true);
    k.box('#2A2E38', 0.2, 0.95, 0.4, 0.42, 0.32, 0.55);
    k.box('#111111', 0.2, 1.15, 0.05, 0.22, 0.22, 0.22);
    k.box('#3A3E48', -0.05, 0, 0.4, 0.05, 1.05, 0.05);
    k.box('#3A3E48', 0.45, 0, 0.4, 0.05, 1.05, 0.05);
    k.box('#1C2330', 3.6, 0.72, 2.4, 1.3, 0.06, 0.7);
    k.box('#7C6BF0', 3.6, 0.78, 2.4, 1.15, 0.5, 0.04);
  },
  marketing(k) {
    k.box('#E7D3B0', -1.2, 0, -0.4, 5.4, 0.74, 2.0);
    k.box('#F6E7C8', -1.2, 0.74, -0.4, 5.5, 0.06, 2.1);
    const bags = [[-4.6, -2.2, '#E23B4A'], [-4.4, 1.4, '#F2B84B'], [2.2, -2.3, '#7C6BF0'], [2.4, 1.6, '#F2784B'], [0.2, 2.6, '#3DDC97']];
    for (const [x, z, c] of bags) k.box(c, x, 0.05, z, 0.7, 0.42, 0.7);
    k.box('#F7F4EE', -1.6, 0.7, -5.4, 4.2, 1.6, 0.06);
    const notes = [[-2.8, 1.5, '#F6E27A'], [-1.8, 1.7, '#F7A1C4'], [-0.7, 1.4, '#9FD4F0'], [-2.4, 1.0, '#B6E3A8']];
    for (const [x, y, c] of notes) k.box(c, x, y, -5.32, 0.42, 0.32, 0.03);
    k.box('#F2784B', 2.6, 0.85, -5.35, 1.1, 1.4, 0.04);
    k.box('#7C6BF0', 4.0, 1.0, -5.35, 0.9, 1.1, 0.04);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 8), material('#F2784B', false));
    cone.position.set(3.2, 0.9, 1.8); cone.rotation.x = Math.PI / 2;
    k.extra(cone);
  },
  support(k) {
    for (const x of [-4.8, -2.6, -0.4, 1.8]) {
      k.box('#E7EEF8', x, 0, -1.6, 1.5, 1.15, 0.08);
      k.box('#4C8DFF', x, 0, -0.7, 1.15, 0.74, 0.55);
      k.box('#1A1D24', x, 0.78, -0.95, 0.55, 0.28, 0.04);
      k.box('#D7E6FF', x, 0.82, -0.9, 0.42, 0.18, 0.02, true);
      k.box('#2A2E38', x + 0.35, 0.74, -0.45, 0.22, 0.1, 0.16);
    }
    k.box('#F4F0E8', 5.2, 0.7, -2.4, 0.08, 1.5, 2.4);
    k.box('#4C8DFF', 5.28, 1.85, -2.4, 0.04, 0.12, 2.2);
    k.box('#C4785A', 4.2, 0.12, 2.5, 1.8, 0.36, 0.7);
    k.box('#C4785A', 4.2, 0.4, 2.78, 1.8, 0.42, 0.18);
  },
  eng(k) {
    for (const x of [-4.8, -2.4, 0.0, 2.4]) {
      k.box('#3A3E46', x, 0, -1.5, 1.35, 1.05, 0.6);
      k.box('#1A1B26', x - 0.28, 1.05, -1.75, 0.04, 0.42, 0.55);
      k.box('#62D26F', x - 0.24, 1.12, -1.7, 0.02, 0.28, 0.4, true);
      k.box('#1A1B26', x + 0.28, 1.05, -1.75, 0.04, 0.42, 0.55);
      k.box('#7C6BF0', x + 0.32, 1.12, -1.7, 0.02, 0.28, 0.4, true);
    }
    k.box('#242830', 5.8, 0, -1.2, 0.7, 1.9, 2.2);
    for (let i = 0; i < 5; i++) k.box(i === 2 ? '#E2B657' : '#62D26F', 6.18, 0.3 + i * 0.3, -1.2, 0.06, 0.1, 0.1, true);
    const duck = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), material('#F6D34A', false));
    duck.position.set(0.35, 1.16, -1.2);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 6), material('#E23B4A', false));
    beak.position.set(0.35, 1.16, -1.02); beak.rotation.x = Math.PI / 2;
    k.extra(duck); k.extra(beak);
  },
  default(k) {
    k.box('#F7F4EE', -2.2, 0.85, -5.4, 2.6, 1.25, 0.06);
    k.box('#C9B59A', -2.2, 0.75, -5.48, 2.8, 0.08, 0.08);
    k.box('#2F6B3A', 4.8, 0.22, 2.6, 0.45, 0.7, 0.45);
    k.box('#F2EFE8', 4.8, 0, 2.6, 0.36, 0.24, 0.36);
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
  ops: [-1.2, 1.75, -5.36, 8.0, 1.35],
  trading: [-1.2, 2.05, -5.32, 8.4, 1.15],
  video: [3.6, 1.15, 2.36, 1.15, 0.42],
  eng: [0, 1.35, -1.68, 0.5, 0.28],
  support: [5.12, 1.5, -2.4, 2.15, 1.25, Math.PI / 2],
  marketing: [-1.6, 1.5, -5.32, 3.9, 1.4],
};

function template(id) {
  let root = templates.get(id);
  if (root) return root;
  const k = new Kit();
  const accent = themeAccent(id);
  if (id !== 'default') k.box(accent, -0.8, 0.006, -0.15, 13.6, 0.018, 10.2);
  (BUILD[id] || BUILD.default)(k);
  root = k.done();
  root.name = `theme_${id}`;
  const paint = PAINT[id];
  const at = SCREEN_AT[id];
  if (paint && at) screen(root, at[0], at[1], at[2], at[3], at[4], canvas(512, 288, paint), 'theme_screen', at[5] || 0);
  if (id === 'trading') screen(root, -1.2, 1.28, -5.34, 8.8, 0.32, canvas(1024, 128, (g, w, h) => {
    g.fillStyle = '#10140F'; g.fillRect(0, 0, w, h);
    let x = 0;
    for (let i = 0; i < 28; i++) {
      g.fillStyle = i % 3 === 0 ? '#E23B4A' : '#3DDC97';
      const bw = 18 + (i % 5) * 6;
      g.fillRect(x, 18, bw, h - 36);
      x += bw + 10;
    }
  }), 'theme_ticker');
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
  group.position.set(0.2, 0, 5.15);
  group.rotation.y = -0.55;
  group.scale.set(1.85, 1.85, 1.85);
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
