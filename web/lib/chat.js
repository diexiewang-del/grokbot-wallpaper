// Bot-to-bot chat and personas. Pure helpers shared by the feed, the state reducer and the panels.
// Text is clipped and returned as a plain string. Callers put it in the DOM with textContent only.
import { cleanStr, hash32 } from './util.js';

export const SAY_TEXT = 80;
export const PERSONA_MAX = 160;
export const ROLE_MAX = 24;

const BIDI = /[\u202a-\u202e\u2066-\u2069\u200b-\u200f\ufeff]/g;
const BROADCAST = /^(?:\*|all|everyone|all bots|所有人|全体|大家)$/i;
const SHORT_ID = /^[A-Za-z0-9_-]{1,24}$/;
// A status step that is really a line said to someone: "→小萤：先对齐" or "->Ada: ping".
const ADDRESSED = /^(?:→|➜|->)\s*([^：:\n]{1,60}?)\s*[：:]\s*(\S[\s\S]*)$/u;

/** Plain text, control characters removed, clipped to `max` code units (ellipsis counts). Empty → ''. */
export function clipPlain(v, max) {
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  return cleanStr(String(v).replace(BIDI, ''), max) || '';
}

function shortId(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return SHORT_ID.test(s) ? s : null;
}

/**
 * {"say":{"from","to"?,"text","re"?,"id"?}} → { from, to|null, text, id|null, re|null } or null.
 * `to` omitted, empty, or a broadcast word means the whole office.
 */
export function parseSay(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const from = clipPlain(body.from, 80);
  const text = clipPlain(body.text, SAY_TEXT);
  if (!from || !text) return null;
  let to = clipPlain(body.to, 80);
  if (!to || BROADCAST.test(to)) to = '';
  return { from, to: to || null, text, id: shortId(body.id), re: shortId(body.re) };
}

/** A step aimed at another bot, or null. The status line itself is unchanged. */
export function addressedStep(step) {
  if (typeof step !== 'string') return null;
  const m = ADDRESSED.exec(step.trim());
  if (!m) return null;
  const to = clipPlain(m[1], 80);
  const text = clipPlain(m[2], SAY_TEXT);
  if (!to || BROADCAST.test(to) || !text) return null;
  return { to, text };
}

/**
 * One profile entry. Undefined field = leave the previous value. Null = clear it.
 * role "boss" (any case) is the only role the office treats specially; other short roles are kept as labels.
 */
export function profilePatch(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const patch = {};
  if ('persona' in entry) patch.persona = clipPlain(entry.persona, PERSONA_MAX) || null;
  if ('role' in entry) {
    const role = clipPlain(entry.role, ROLE_MAX);
    patch.role = !role || /^none$/i.test(role) ? null : (role.toLowerCase() === 'boss' ? 'boss' : role);
  }
  return 'persona' in patch || 'role' in patch ? patch : null;
}

export function applyProfilePatch(target, patch) {
  if (!target || !patch) return;
  if ('persona' in patch) {
    if (patch.persona) target.persona = patch.persona;
    else delete target.persona;
  }
  if ('role' in patch) {
    if (patch.role) target.role = patch.role;
    else delete target.role;
  }
}

/** Stable short id when the sender did not set one. Same line replays to the same id. */
export function sayId(say, ms) {
  if (say.id) return say.id;
  const n = hash32(`${say.from}\0${say.to || ''}\0${say.text}\0${Math.floor(ms / 1000)}`);
  return n.toString(36).slice(0, 8);
}

/**
 * Threads for the office chat panel. `chats` is chronological.
 * A pair shares one thread whichever way the line went. A line with no addressee is "<from> → everyone".
 */
export function groupThreads(chats) {
  const map = new Map();
  for (const c of chats || []) {
    if (!c || typeof c.fromId !== 'string') continue;
    const pair = c.toId ? [c.fromId, c.toId].sort() : null;
    const key = pair ? `pair|${pair[0]}|${pair[1]}` : `all|${c.fromId}`;
    let t = map.get(key);
    if (!t) {
      if (pair) {
        const aId = pair[0];
        const bId = pair[1];
        t = {
          key, kind: 'pair', aId, bId,
          a: aId === c.fromId ? c.from : c.to,
          b: bId === c.fromId ? c.from : c.to,
          lines: [], latest: 0,
        };
      } else {
        t = { key, kind: 'all', aId: c.fromId, bId: null, a: c.from, b: null, lines: [], latest: 0 };
      }
      map.set(key, t);
    }
    t.lines.push(c);
    const ms = Date.parse(c.t) || 0;
    if (ms >= t.latest) t.latest = ms;
  }
  return [...map.values()].sort((x, y) => y.latest - x.latest);
}
