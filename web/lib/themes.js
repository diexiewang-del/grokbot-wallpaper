// Which office theme a floor gets. Matched from the published team / group name (and its id), never from bot names.
// The scene builds the props; this module stays free of three.js so the state reducer can stamp the same answer.

export const THEME_IDS = ['boss', 'ops', 'trading', 'video', 'marketing', 'support', 'eng', 'default'];

export const THEME_ACCENTS = {
  boss: '#E2B657',
  ops: '#3DDC97',
  trading: '#E23B4A',
  video: '#7C6BF0',
  marketing: '#F2784B',
  support: '#4C8DFF',
  eng: '#62D26F',
  default: '#8E9DB1',
};

export const THEME_LABELS = {
  boss: 'Boss',
  ops: 'Ops',
  trading: 'Trading',
  video: 'Video',
  marketing: 'Marketing',
  support: 'Support',
  eng: 'Eng',
  default: 'Office',
};

// First match wins. Marketing is tested before trading so "市场营销" stays marketing, while "市场" / "markets" is trading.
const RULES = [
  ['boss', /老板|管理层|总办|董事|executive|\bboss\b|\bhq\b|leadership/i],
  ['video', /视频|影视|剪辑|拍摄|video|\bfilm\b|green\s*screen/i],
  ['marketing', /营销|品牌|宣传|创意|marketing|creative|\bbrand\b|\bgrowth\b/i],
  ['trading', /交易|风控|投资|金融|复盘|trading|\bmarkets?\b|quant|\brisk\b|strateg|ticker|\bfinance\b/i],
  ['support', /客服|客户|支持|help\s*desk|support|success/i],
  ['ops', /运维|维护|协调|值班|仪表|ops|\bnoc\b|infra|\bsre\b|platform|operations|\bcoord/i],
  ['eng', /工程|开发|研发|技术|网站|engineer|\beng\b|software|\bdev\b|\bbuild\b|website/i],
];

export function themeAccent(id) {
  return THEME_ACCENTS[id] || THEME_ACCENTS.default;
}

/** Team name (the floor's label) plus its slug id. Unknown teams get "default". */
export function themeForFloor(name, id = '') {
  const blob = `${name || ''} ${id || ''}`;
  for (const [theme, re] of RULES) if (re.test(blob)) return theme;
  return 'default';
}
