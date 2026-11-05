import test from 'node:test';
import assert from 'node:assert/strict';
import { StateStore } from '../state.js';
import { parseSay, addressedStep, profilePatch, groupThreads, clipPlain } from '../../web/lib/chat.js';
import { themeForFloor, themeAccent } from '../../web/lib/themes.js';
import { feedIngest, replayOffice } from '../../web/feed.js';
import { readFileSync } from 'node:fs';

test('say lines clip text, keep CJK, and drop junk', () => {
  const say = parseSay({ from: '小萤', to: '仪表盘', text: '先把方向对齐', id: 'm1', re: 'm0' });
  assert.equal(say.from, '小萤');
  assert.equal(say.to, '仪表盘');
  assert.equal(say.text, '先把方向对齐');
  assert.equal(say.id, 'm1');
  assert.equal(say.re, 'm0');
  assert.equal(parseSay({ from: 'A', text: 'hi everyone', to: 'everyone' }).to, null);
  assert.equal(parseSay({ from: 'A', text: '  ' }), null);
  assert.equal(parseSay({ text: 'no sender' }), null);
  const long = parseSay({ from: 'A', text: '字'.repeat(90) });
  assert.ok(long.text.length <= 80);
  assert.ok(long.text.endsWith('…'));
  assert.equal(clipPlain('<b>hi</b>', 80), '<b>hi</b>');
  assert.equal(parseSay({ from: 'A', text: 'ok', id: '<script>' }).id, null);
});

test('a step that starts with an addressee is also a say', () => {
  assert.deepEqual(addressedStep('→小萤：还有两位在等工位'), { to: '小萤', text: '还有两位在等工位' });
  assert.deepEqual(addressedStep('→小萤: ping'), { to: '小萤', text: 'ping' });
  assert.deepEqual(addressedStep('->Ada: hello'), { to: 'Ada', text: 'hello' });
  assert.equal(addressedStep('drafting a post'), null);
  assert.equal(addressedStep('→小萤：'), null);
});

test('profile merges and role boss is canonical', () => {
  assert.deepEqual(profilePatch({ persona: '老板。温柔', role: 'Boss' }), { persona: '老板。温柔', role: 'boss' });
  assert.deepEqual(profilePatch({ role: '' }), { role: null });
  assert.equal(profilePatch({ color: '#fff' }), null);
});

test('themes follow the team name, not the bot', () => {
  assert.equal(themeForFloor('管理层'), 'boss');
  assert.equal(themeForFloor('运维'), 'ops');
  assert.equal(themeForFloor('交易台'), 'trading');
  assert.equal(themeForFloor('视频组'), 'video');
  assert.equal(themeForFloor('营销'), 'marketing');
  assert.equal(themeForFloor('客服'), 'support');
  assert.equal(themeForFloor('工程'), 'eng');
  assert.equal(themeForFloor('研究'), 'default');
  assert.equal(themeForFloor('市场营销'), 'marketing');
  assert.equal(themeForFloor('Markets'), 'trading');
  assert.equal(themeAccent('boss'), '#E2B657');
  assert.notEqual(themeForFloor('小萤'), 'boss');
});

test('chinese team names each get a floor, and boss / say survive next to old lines', () => {
  const store = new StateStore({ now: () => Date.parse('2026-11-05T12:00:00Z'), tz: 'UTC' });
  const t = '2026-11-05T12:00:00Z';
  store.apply({ t, bot: '小萤', status: 'working', step: '对齐方向', group: '管理层' });
  store.apply({ t, bot: '仪表盘', status: 'idle', step: '', group: '运维' });
  store.apply({ t, profile: { '小萤': { persona: '老板。温柔但果断', role: 'boss' }, '仪表盘': { persona: '爱整理' } } });
  store.apply({ t, say: { from: '小萤', to: '仪表盘', text: '先把方向对齐', id: 'a1' } });
  store.apply({ t, bot: '仪表盘', status: 'working', step: '→小萤：名单好了' });
  store.apply({ t, say: { from: '仪表盘', to: '小萤', text: '名单好了', re: 'a1' } });
  const st = store.snapshot();
  assert.equal(st.bots[st.floors.find((f) => f.name === '管理层').bots[0]].role, 'boss');
  const bossFloor = st.floors.find((f) => f.name === '管理层');
  const opsFloor = st.floors.find((f) => f.name === '运维');
  assert.ok(bossFloor && opsFloor && bossFloor.id !== opsFloor.id);
  assert.equal(bossFloor.theme, 'boss');
  assert.equal(bossFloor.boss, true);
  assert.equal(opsFloor.theme, 'ops');
  assert.equal(st.bots[bossFloor.bots[0]].persona.startsWith('老板'), true);
  assert.equal(st.chats.length, 2, 'the step and the say with the same text collapse');
  assert.equal(st.chats[0].text, '先把方向对齐');
  assert.equal(st.chats[1].to, '小萤');
  assert.equal(st.chats[1].re, 'a1');
  assert.equal(st.bots[opsFloor.bots[0]].status, 'working');
  const threads = groupThreads(st.chats);
  assert.equal(threads.length, 1);
  assert.equal(threads[0].kind, 'pair');
  assert.equal(threads[0].lines.length, 2);
});

test('feed ingest keeps looks when a profile arrives later', () => {
  const store = new StateStore({ now: () => Date.parse('2026-11-05T12:00:00Z'), tz: 'UTC' });
  const cfg = {};
  const bag = { check: null };
  const ctx = { store, cfg, routines: new Map(), bag };
  const t0 = '2026-11-05T12:00:00Z';
  feedIngest(ctx, JSON.stringify({ t: t0, roster: ['小萤'] }), 1, true);
  feedIngest(ctx, JSON.stringify({ t: t0, looks: { '小萤': { shape: 'sphere', color: '#F5C542', accessory: 'stem' } } }), 1, true);
  feedIngest(ctx, JSON.stringify({ t: t0, profile: { '小萤': { persona: '老板', role: 'BOSS' } } }), 1, true);
  feedIngest(ctx, JSON.stringify({ t: t0, say: { from: '小萤', to: 'everyone', text: '早' } }), 1, true);
  feedIngest(ctx, JSON.stringify({ t: t0, bot: '小萤', status: 'working', step: 'drafting' }), 1, true);
  const st = store.snapshot();
  const bot = Object.values(st.bots)[0];
  assert.equal(bot.look.shape, 'sphere');
  assert.equal(bot.role, 'boss');
  assert.equal(bot.persona, '老板');
  assert.equal(bot.step, 'drafting');
  assert.equal(st.chats.length, 1);
  assert.equal(st.chats[0].to, null);
});

test('mock office fixture replays every theme without a topic', () => {
  const text = readFileSync(new URL('../../web/data/mock-office.jsonl', import.meta.url), 'utf8');
  let state = null;
  replayOffice(text, (s) => { state = s; });
  const themes = new Set(state.floors.map((f) => f.theme));
  for (const id of ['boss', 'ops', 'trading', 'video', 'marketing', 'support', 'eng', 'default']) assert.ok(themes.has(id), id);
  assert.ok(state.chats.length >= 4);
  assert.equal(state.floors.filter((f) => f.boss).length, 1);
});
