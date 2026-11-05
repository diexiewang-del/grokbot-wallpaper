// Speech bubbles for real {"say"} lines (and status steps that address someone). Client-side only:
// the queue never invents lines. At most two bubbles, a short gap between them, extras wait their turn.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { FLOOR_STEP } from './office.js';

const LIFE = 5.6;
const GAP = 0.8;
const MAX_ON = 2;
const QUEUE_MAX = 8;
const FRESH_S = 20;
const BOOT_KEEP = 3;

function cid(c) { return c.id || `${c.t}|${c.fromId}|${c.text}`; }

export class TalkDirector {
  constructor(scene) {
    this.scene = scene;
    this.seen = new Set();
    this.queue = [];
    this.live = [];
    this.gap = 0;
    this.booted = false;
    this.now = 0;
  }

  sync(state) {
    const chats = Array.isArray(state?.chats) ? state.chats : [];
    const now = Date.parse(state?.now) || Date.now();
    if (!this.booted) {
      const fresh = [];
      for (const c of chats) {
        const age = (now - Date.parse(c.t)) / 1000;
        if (age >= 0 && age <= FRESH_S) fresh.push(c);
        else this.seen.add(cid(c));
      }
      const keep = fresh.slice(-BOOT_KEEP);
      for (const c of fresh.slice(0, -BOOT_KEEP)) this.seen.add(cid(c));
      for (const c of keep) { this.seen.add(cid(c)); this.queue.push(c); }
      this.booted = true;
    } else {
      for (const c of chats) {
        const id = cid(c);
        if (this.seen.has(id)) continue;
        const age = (now - Date.parse(c.t)) / 1000;
        this.seen.add(id);
        if (age >= 0 && age <= FRESH_S) this.queue.push(c);
      }
    }
    if (this.queue.length > QUEUE_MAX) this.queue.splice(0, this.queue.length - QUEUE_MAX);
    this.state = state;
  }

  clearLive() {
    for (const live of this.live) this.drop(live);
    this.live = [];
  }

  tick(dt, nowSec, actors, building) {
    this.now = nowSec;
    this.building = building || null;
    this.gap -= dt;
    const state = this.state;
    if (state && actors && building && this.gap <= 0 && this.live.length < MAX_ON) {
      const idx = this.queue.findIndex((c) => this.canShow(c, actors));
      if (idx >= 0) {
        const [c] = this.queue.splice(idx, 1);
        if (this.spawn(c, actors, building, state, nowSec)) this.gap = GAP;
      }
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const live = this.live[i];
      if (!live.host.pivot?.parent) { this.drop(live); this.live.splice(i, 1); continue; }
      if (nowSec >= live.until) { this.drop(live); this.live.splice(i, 1); continue; }
      this.placeBeam(live);
    }
    this.react(actors, nowSec);
    if (actors) this.markTalking(actors);
  }

  canShow(c, actors) {
    if (actors.has(c.fromId)) return true;
    return !!(c.toId && actors.has(c.toId));
  }

  spawn(c, actors, building, state, nowSec) {
    const speaker = actors.get(c.fromId) || null;
    const listener = c.toId ? actors.get(c.toId) || null : null;
    const host = speaker || listener;
    if (!host) return false;
    const incoming = !speaker && !!listener;
    const el = document.createElement('div');
    el.className = incoming ? 'hq-say hq-say-in' : 'hq-say';
    const to = document.createElement('div');
    to.className = 'hq-say-to';
    to.textContent = c.to ? `→ ${c.to}` : '→ everyone';
    const text = document.createElement('div');
    text.className = 'hq-say-text';
    text.textContent = c.text;
    const tail = document.createElement('i');
    tail.className = 'hq-say-tail';
    el.append(to, text, tail);
    if (c.re) el.title = 'Reply';
    const obj = new CSS2DObject(el);
    obj.center.set(0.5, 1);
    obj.position.y = (host.tag?.position.y || 1.24) + (host.boss ? 0.62 : 0.46);
    host.pivot.add(obj);
    const live = { c, obj, el, host, speaker, listener, until: nowSec + LIFE, line: null, anchor: null, tip: null };
    if (speaker && c.toId && !listener) live.line = this.makeBeam(c, state);
    this.live.push(live);
    this.markTalking(actors);
    return true;
  }

  makeBeam(c, state) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xE2B657 }),
    );
    mesh.name = 'call_beam';
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    const anchor = new THREE.Object3D();
    const tip = document.createElement('div');
    tip.className = 'hq-call';
    const bot = state?.bots?.[c.toId];
    const floor = (state?.floors || []).find((f) => f.id === bot?.floor);
    const name = floor?.name || 'other floor';
    tip.textContent = `${c.to} · ${name}`;
    const label = new CSS2DObject(tip);
    anchor.add(label);
    this.scene.add(anchor);
    return { mesh, anchor, fromId: c.fromId, toFloor: bot?.floor || null, toId: c.toId };
  }

  placeBeam(live) {
    const beam = live.line;
    if (!beam || !live.speaker) return;
    const from = live.speaker.root.getWorldPosition(new THREE.Vector3());
    from.y += 1.05;
    const floors = this.building?.slots || [];
    const si = floors.findIndex((s) => s.id === live.speaker.bot?.floor);
    const li = floors.findIndex((s) => s.id === beam.toFloor);
    const dir = li < 0 || si < 0 ? 1 : Math.sign(li - si) || 1;
    const dist = Math.max(0.9, li < 0 || si < 0 ? FLOOR_STEP : Math.min(Math.abs(li - si) * FLOOR_STEP, 4.8));
    beam.mesh.scale.y = dist;
    beam.mesh.position.set(from.x, from.y + dir * dist / 2, from.z);
    beam.anchor.position.set(from.x, from.y + dir * dist, from.z);
  }

  react(actors, nowSec) {
    if (!actors) return;
    const want = new Map();
    for (const live of this.live) {
      const c = live.c;
      const speaker = actors.get(c.fromId);
      const listener = c.toId ? actors.get(c.toId) : null;
      if (speaker && listener) {
        want.set(listener.id, { x: speaker.root.position.x, z: speaker.root.position.z, until: live.until });
        want.set(speaker.id, { x: listener.root.position.x, z: listener.root.position.z, until: live.until });
      } else if (speaker && c.toId && !listener) {
        const floors = this.building?.slots || [];
        const si = floors.findIndex((s) => s.id === speaker.bot?.floor);
        const li = floors.findIndex((s) => s.id === live.line?.toFloor);
        const up = li < 0 || si < 0 ? 1 : Math.sign(li - si) || 1;
        if (!want.has(speaker.id)) want.set(speaker.id, { up, until: live.until });
      } else if (listener && !speaker) {
        want.set(listener.id, { up: 1, until: live.until });
      } else if (speaker && !c.toId) {
        let n = 0;
        for (const a of actors.values()) {
          if (a === speaker || n >= 3) continue;
          n++;
          if (!want.has(a.id)) want.set(a.id, { x: speaker.root.position.x, z: speaker.root.position.z, until: live.until });
        }
      }
    }
    for (const [id, peer] of want) actors.get(id)?.notice(peer, peer.until ?? nowSec + 1);
  }

  markTalking(actors) {
    const on = new Set(this.live.map((l) => l.host?.id).filter(Boolean));
    for (const a of actors.values()) a.setTalking?.(on.has(a.id));
  }

  drop(live) {
    live.obj.removeFromParent();
    live.el?.remove();
    if (live.line) {
      live.line.mesh.removeFromParent();
      live.line.mesh.geometry.dispose();
      live.line.mesh.material.dispose();
      live.line.anchor.removeFromParent();
    }
    live.host?.setTalking?.(false);
  }
}

// The director needs the building while reacting. scene.js sets it before tick.
TalkDirector.prototype.building = null;
