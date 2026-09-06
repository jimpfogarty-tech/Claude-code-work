// Generates the MerchMath design artboards (*.dc.html) and canvas.json.
// Run: node build.mjs
import { writeFileSync } from 'node:fs';

// ---------- tokens ----------
const T = {
  bg: '#f6f3ee',
  surface: '#ffffff',
  ink: '#1b1a17',
  muted: '#6b665c',
  faint: '#9a948a',
  line: '#e4dfd6',
  lineStrong: '#cfc8bc',
  accent: '#1f7a5c',
  accentTint: '#e6f2ec',
  accentInk: '#145843',
  warn: '#b7791f',
  warnTint: '#fbf1dc',
  neg: '#b33a2f',
  negTint: '#f9e6e3',
  serif: "'Instrument Serif', Georgia, 'Times New Roman', serif",
  sans: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
};

const W = 390, H = 844;

// ---------- icons (stroke, 24 grid) ----------
const svg = (paths, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const I = {
  home: svg('<path d="M4 11.5 12 5l8 6.5"></path><path d="M6 10.5V19h12v-8.5"></path>'),
  tag: svg('<path d="M4 4h7l9 9-7 7-9-9V4z"></path><circle cx="8.5" cy="8.5" r="1.25"></circle>'),
  chart: svg('<path d="M4 19h16"></path><path d="M7 15v-4"></path><path d="M12 15V7"></path><path d="M17 15v-7"></path>'),
  sliders: svg('<path d="M5 7h14"></path><path d="M5 12h14"></path><path d="M5 17h14"></path><circle cx="9" cy="7" r="1.75" fill="currentColor"></circle><circle cx="15" cy="12" r="1.75" fill="currentColor"></circle><circle cx="8" cy="17" r="1.75" fill="currentColor"></circle>'),
  back: svg('<path d="M14.5 6 8.5 12l6 6"></path>'),
  chev: svg('<path d="m9.5 6 6 6-6 6"></path>', 20),
  scan: svg('<path d="M4 8V5h3"></path><path d="M20 8V5h-3"></path><path d="M4 16v3h3"></path><path d="M20 16v3h-3"></path><path d="M8 9v6"></path><path d="M11 9v6"></path><path d="M14 9v6"></path><path d="M16.5 9v6"></path>', 20),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"></path>', 18),
  alert: svg('<path d="M12 8v5"></path><circle cx="12" cy="16.5" r="0.75" fill="currentColor"></circle><path d="M10.3 4.5 3.5 17a2 2 0 0 0 1.7 3h13.6a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0z"></path>', 18),
  pause: svg('<path d="M9 6v12"></path><path d="M15 6v12"></path>', 18),
  share: svg('<path d="M12 4v11"></path><path d="m8 8 4-4 4 4"></path><path d="M5 13v6h14v-6"></path>', 20),
  book: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"></path><path d="M4 18a2.5 2.5 0 0 1 2.5-2.5H20"></path>', 20),
  plus: svg('<path d="M12 5v14"></path><path d="M5 12h14"></path>', 20),
  calc: svg('<rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 7h8"></path><path d="M8.5 12h.01"></path><path d="M12 12h.01"></path><path d="M15.5 12h.01"></path><path d="M8.5 16h.01"></path><path d="M12 16h.01"></path><path d="M15.5 16h.01"></path>'),
  search: svg('<circle cx="11" cy="11" r="6"></circle><path d="m20 20-4.5-4.5"></path>', 20),
};

// ---------- shared css ----------
const helmet = `<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&amp;family=Instrument+Serif&amp;display=swap">
  <style>
    body { margin: 0; background: ${T.bg}; color: ${T.ink}; font-family: ${T.sans}; font-size: 15px; line-height: 1.4; -webkit-font-smoothing: antialiased; font-variant-numeric: tabular-nums; }
    a { color: ${T.accent}; } a:hover { color: ${T.accentInk}; }
    * { box-sizing: border-box; }
  </style>
</helmet>`;

// ---------- primitives ----------
const s = (obj) => Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('; ');

const tabbar = (active) => {
  const items = [
    ['home', 'Home', I.home],
    ['new', 'New item', I.tag],
    ['assess', 'Assess', I.chart],
    ['setup', 'Setup', I.sliders],
  ];
  return `<div style="${s({ display: 'flex', 'flex-direction': 'row', 'justify-content': 'space-around', 'align-items': 'flex-start', padding: '10px 8px 28px', 'border-top': `1px solid ${T.line}`, background: T.surface, 'flex-shrink': '0' })}">
${items.map(([k, label, icon]) => `      <div style="${s({ display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '3px', width: '72px', 'min-height': '44px', color: k === active ? T.accent : T.faint })}">${icon}<span style="${s({ 'font-size': '11px', 'font-weight': k === active ? '600' : '500', 'letter-spacing': '0.01em' })}">${label}</span></div>`).join('\n')}
    </div>`;
};

const header = ({ title, eyebrow, back, action }) => `<div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '6px', padding: '58px 20px 14px', 'flex-shrink': '0' })}">
      ${back ? `<div style="${s({ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', 'justify-content': 'space-between', 'min-height': '44px', 'margin-left': '-8px' })}"><div style="${s({ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', gap: '2px', color: T.accent, 'font-weight': '500', 'font-size': '15px' })}">${I.back}<span>${back}</span></div>${action || '<span></span>'}</div>` : ''}
      ${eyebrow ? `<div style="${s({ 'font-size': '12px', 'font-weight': '600', 'letter-spacing': '0.08em', 'text-transform': 'uppercase', color: T.muted })}">${eyebrow}</div>` : ''}
      <div style="${s({ 'font-family': T.serif, 'font-size': '34px', 'line-height': '1.05', 'font-weight': '400', 'letter-spacing': '-0.01em' })}">${title}</div>
    </div>`;

const screen = ({ head, body, tab, foot }) => `<div style="${s({ width: `${W}px`, height: `${H}px`, display: 'flex', 'flex-direction': 'column', background: T.bg, overflow: 'hidden', position: 'relative' })}">
    ${head}
    <div style="${s({ display: 'flex', 'flex-direction': 'column', 'flex-grow': '1', overflow: 'hidden' })}">
      <div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '12px', padding: '4px 20px 12px', 'flex-shrink': '0' })}">
${body}
      </div>
    </div>
    ${foot || ''}
    ${tab ? tabbar(tab) : ''}
  </div>`;

const card = (inner, extra = {}) => `<div style="${s({ display: 'flex', 'flex-direction': 'column', background: T.surface, border: `1px solid ${T.line}`, 'border-radius': '14px', overflow: 'hidden', ...extra })}">
${inner}
</div>`;

const sectionLabel = (t, right = '') => `<div style="${s({ display: 'flex', 'flex-direction': 'row', 'justify-content': 'space-between', 'align-items': 'baseline', padding: '4px 2px 0' })}"><span style="${s({ 'font-size': '12px', 'font-weight': '600', 'letter-spacing': '0.08em', 'text-transform': 'uppercase', color: T.muted })}">${t}</span>${right ? `<span style="${s({ 'font-size': '13px', color: T.accent, 'font-weight': '500' })}">${right}</span>` : ''}</div>`;

// Input row: label left, value right (as if a numeric field)
const field = ({ label, value, unit, hint, computed, text, last }) => `<div style="${s({ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', 'justify-content': 'space-between', gap: '12px', 'min-height': '46px', padding: '5px 16px', 'border-bottom': last ? 'none' : `1px solid ${T.line}`, background: computed ? T.bg : 'transparent', 'flex-shrink': '0' })}">
    <div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '1px', 'flex-shrink': '0' })}"><span style="${s({ 'font-size': '15px', 'font-weight': computed ? '600' : '400' })}">${label}</span>${hint ? `<span style="${s({ 'font-size': '12px', color: T.muted })}">${hint}</span>` : ''}</div>
    <div style="${s({ display: 'flex', 'flex-direction': 'row', 'align-items': 'baseline', gap: '4px', 'min-width': '0' })}">${unit && unit.pre ? `<span style="${s({ color: T.faint, 'font-size': '15px' })}">${unit.pre}</span>` : ''}<span style="${s({ 'font-size': text ? '15px' : '18px', 'font-weight': computed ? '600' : '500', 'min-width': text ? '0' : '64px', 'text-align': 'right', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis', 'border-bottom': computed ? 'none' : `1.5px solid ${T.lineStrong}`, 'padding-bottom': '2px' })}">${value}</span>${unit && unit.post ? `<span style="${s({ color: T.faint, 'font-size': '14px' })}">${unit.post}</span>` : ''}</div>
  </div>`;

const pill = (text, tone) => {
  const map = { good: [T.accentTint, T.accentInk, I.check], warn: [T.warnTint, T.warn, I.pause], bad: [T.negTint, T.neg, I.alert] };
  const [bg, fg, icon] = map[tone];
  return `<span style="${s({ display: 'inline-flex', 'flex-direction': 'row', 'align-items': 'center', gap: '4px', padding: '3px 9px 3px 6px', 'border-radius': '999px', background: bg, color: fg, 'font-size': '12px', 'font-weight': '600', 'white-space': 'nowrap' })}">${icon}<span>${text}</span></span>`;
};

const button = (label, { primary = true, icon = '' } = {}) => `<div style="${s({ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', 'justify-content': 'center', gap: '8px', 'min-height': '50px', 'border-radius': '12px', background: primary ? T.ink : 'transparent', color: primary ? '#ffffff' : T.ink, border: primary ? 'none' : `1.5px solid ${T.lineStrong}`, 'font-weight': '600', 'font-size': '16px', 'flex-grow': '1' })}">${icon}<span>${label}</span></div>`;

const segmented = (opts, active) => `<div style="${s({ display: 'flex', 'flex-direction': 'row', gap: '4px', padding: '4px', background: '#ecE7df', 'border-radius': '10px' })}">
${opts.map((o) => `    <div style="${s({ 'flex-grow': '1', 'text-align': 'center', 'min-height': '36px', 'line-height': '36px', 'border-radius': '8px', 'font-size': '14px', 'font-weight': o === active ? '600' : '500', background: o === active ? T.surface : 'transparent', color: o === active ? T.ink : T.muted, 'box-shadow': o === active ? '0 1px 2px rgba(27,26,23,0.08)' : 'none' })}">${o}</div>`).join('\n')}
</div>`;

const chips = (items, active) => `<div style="${s({ display: 'flex', 'flex-direction': 'row', gap: '8px', 'flex-wrap': 'wrap' })}">
${items.map((c) => `    <span style="${s({ padding: '8px 12px', 'min-height': '36px', 'border-radius': '999px', border: `1.5px solid ${c === active ? T.ink : T.lineStrong}`, background: c === active ? T.ink : 'transparent', color: c === active ? '#ffffff' : T.ink, 'font-size': '13px', 'font-weight': '500', 'white-space': 'nowrap' })}">${c}</span>`).join('\n')}
</div>`;

const itemRow = ({ name, style, metric, pill: p, last }) => `<div style="${s({ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', 'justify-content': 'space-between', gap: '12px', padding: '12px 16px', 'min-height': '64px', 'border-bottom': last ? 'none' : `1px solid ${T.line}` })}">
    <div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '2px', 'min-width': '0' })}"><span style="${s({ 'font-weight': '500', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' })}">${name}</span><span style="${s({ 'font-size': '12px', color: T.muted })}">${style} · ${metric}</span></div>
    <div style="${s({ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', gap: '6px', 'flex-shrink': '0' })}">${p}<span style="${s({ color: T.faint })}">${I.chev}</span></div>
  </div>`;

const stat = ({ label, value, sub, tone }) => `<div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '2px', padding: '10px 12px', background: T.surface, border: `1px solid ${T.line}`, 'border-radius': '12px' })}"><span style="${s({ 'font-size': '12px', color: T.muted, 'white-space': 'nowrap' })}">${label}</span><span style="${s({ 'font-size': '21px', 'font-weight': '600', 'line-height': '1.1', color: tone === 'good' ? T.accentInk : tone === 'bad' ? T.neg : T.ink })}">${value}</span>${sub ? `<span style="${s({ 'font-size': '12px', color: T.muted, 'white-space': 'nowrap' })}">${sub}</span>` : ''}</div>`;

const wrap = (title, inner) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
${helmet}
${inner}
</x-dc>
<script data-dc-script data-props='{"$preview":{"width":${W},"height":${H}}}'>
class Component extends DCLogic {}
</script>
</body>
</html>
`;

// ---------- screens ----------
const screens = {};

// 1. Home
screens.Main = screen({
  head: header({ eyebrow: 'Fall ’26 · Women’s', title: 'Today' }),
  tab: 'home',
  body: `
    <div style="${s({ display: 'grid', 'grid-template-columns': 'repeat(2, minmax(0, 1fr))', gap: '12px' })}">
      <div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '10px', padding: '16px', 'min-height': '128px', background: T.ink, color: '#ffffff', 'border-radius': '14px' })}">
        <span style="${s({ color: '#c7e3d6' })}">${I.tag}</span>
        <div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '2px', 'margin-top': 'auto' })}"><span style="${s({ 'font-weight': '600', 'font-size': '16px' })}">New item math</span><span style="${s({ 'font-size': '12px', color: '#b9b4a8' })}">Landed cost → retail → IMU</span></div>
      </div>
      <div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '10px', padding: '16px', 'min-height': '128px', background: T.surface, border: `1px solid ${T.line}`, 'border-radius': '14px' })}">
        <span style="${s({ color: T.accent })}">${I.chart}</span>
        <div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '2px', 'margin-top': 'auto' })}"><span style="${s({ 'font-weight': '600', 'font-size': '16px' })}">Assess an item</span><span style="${s({ 'font-size': '12px', color: T.muted })}">Sell-through, WOS → verdict</span></div>
      </div>
    </div>
    ${sectionLabel('Needs a decision', 'All items')}
    ${card(`
${itemRow({ name: 'Textured knit cardigan', style: '30244', metric: 'ST 28% · WOS 11.4', pill: pill('Markdown', 'bad') })}
${itemRow({ name: 'Linen-blend camp shirt', style: '30177', metric: 'ST 65% · WOS 4.3', pill: pill('Reorder', 'good') })}
${itemRow({ name: 'Ribbed tank, 3-pack', style: '29910', metric: 'ST 47% · WOS 7.0', pill: pill('Hold', 'warn'), last: true })}
    `)}
    ${sectionLabel('Recent math')}
    ${card(`
${itemRow({ name: 'Ponte wide-leg trouser', style: '41822', metric: '$59.50 · IMU 70.9%', pill: pill('On target', 'good') })}
${itemRow({ name: 'Faux-leather moto jacket', style: '41790', metric: '$129.00 · IMU 60.3%', pill: pill('Below target', 'bad'), last: true })}
    `)}
  `,
});

// 2. New item inputs
screens.NewItem = screen({
  head: header({ back: 'Today', title: 'New item', action: `<span style="${s({ color: T.faint })}">${I.book}</span>` }),
  tab: 'new',
  body: `
    ${card(`
${itemRow({ name: 'Ponte wide-leg trouser', style: 'Women’s Bottoms', metric: 'target IMU 68%', pill: '', last: true })}
    `)}
    ${sectionLabel('Solve for')}
    ${segmented(['IMU from retail', 'Retail from IMU'], 'IMU from retail')}
    ${sectionLabel('Cost')}
    ${card(`
${field({ label: 'FOB cost', value: '14.20', unit: { pre: '$' } })}
${field({ label: 'Freight', value: '6.0', unit: { post: '%' }, hint: '$0.85 per unit' })}
${field({ label: 'Duty', value: '16.0', unit: { post: '%' }, hint: '$2.27 · HTS 6204.63' })}
${field({ label: 'Landed cost', value: '$17.32', computed: true, last: true })}
    `)}
    ${sectionLabel('Retail')}
    ${card(`
${field({ label: 'Ticket price', value: '59.50', unit: { pre: '$' }, last: true })}
    `)}
  `,
  foot: `<div style="${s({ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', 'justify-content': 'space-between', gap: '12px', margin: '0 20px 12px', padding: '12px 12px 12px 16px', background: T.accentTint, border: `1px solid #c9e2d6`, 'border-radius': '14px' })}">
      <div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '0' })}"><span style="${s({ 'font-size': '12px', color: T.accentInk, 'font-weight': '600' })}">IMU · +2.9 pts vs target</span><span style="${s({ 'font-size': '28px', 'font-weight': '600', 'line-height': '1.1', color: T.accentInk })}">70.9%</span></div>
      <div style="${s({ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', gap: '6px', 'min-height': '44px', padding: '0 14px 0 16px', 'border-radius': '10px', background: T.ink, color: '#ffffff', 'font-weight': '600', 'font-size': '15px' })}"><span>Full math</span>${I.chev}</div>
    </div>`,
});

// 3. New item result
const ladderRow = (retail, imu, mmu, active, last) => `<div style="${s({ display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '8px', padding: '11px 16px', 'border-bottom': last ? 'none' : `1px solid ${T.line}`, background: active ? T.bg : 'transparent', 'font-weight': active ? '600' : '400' })}"><span>${retail}</span><span style="${s({ 'text-align': 'right' })}">${imu}</span><span style="${s({ 'text-align': 'right', color: T.muted })}">${mmu}</span></div>`;

screens.NewItemResult = screen({
  head: header({ back: 'New item', title: 'Ponte wide-leg trouser', action: `<span style="${s({ color: T.faint })}">${I.share}</span>` }),
  tab: 'new',
  body: `
    <div style="${s({ display: 'flex', 'flex-direction': 'row', 'align-items': 'flex-end', 'justify-content': 'space-between', gap: '12px' })}">
      <div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '2px' })}"><span style="${s({ 'font-size': '12px', 'font-weight': '600', 'letter-spacing': '0.08em', 'text-transform': 'uppercase', color: T.muted })}">Initial markup</span><span style="${s({ 'font-family': T.serif, 'font-size': '64px', 'line-height': '0.95', color: T.accentInk })}">70.9%</span></div>
      <div style="${s({ display: 'flex', 'flex-direction': 'column', 'align-items': 'flex-end', gap: '4px', 'padding-bottom': '6px' })}">${pill('+2.9 pts vs 68%', 'good')}<span style="${s({ 'font-size': '13px', color: T.muted })}">$42.18 markup per unit</span></div>
    </div>
    <div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '6px' })}">
      <div style="${s({ display: 'flex', 'flex-direction': 'row', height: '14px', 'border-radius': '7px', overflow: 'hidden', background: T.line })}"><div style="${s({ width: '29.1%', background: T.lineStrong })}"></div><div style="${s({ 'flex-grow': '1', background: T.accent })}"></div></div>
      <div style="${s({ display: 'flex', 'flex-direction': 'row', 'justify-content': 'space-between', 'font-size': '12px', color: T.muted })}"><span>Landed $17.32</span><span>Retail $59.50</span></div>
    </div>
    ${sectionLabel('Price ladder', 'Edit')}
    ${card(`
<div style="${s({ display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '8px', padding: '10px 16px', 'font-size': '12px', 'font-weight': '600', color: T.muted, 'border-bottom': `1px solid ${T.line}` })}"><span>Retail</span><span style="${s({ 'text-align': 'right' })}">IMU</span><span style="${s({ 'text-align': 'right' })}">At 30% off</span></div>
${ladderRow('$54.50', '68.2%', '54.6%')}
${ladderRow('$59.50', '70.9%', '58.4%', true)}
${ladderRow('$64.50', '73.1%', '61.6%', false, true)}
    `)}
    ${sectionLabel('Promo depth')}
    ${card(`
<div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '10px', padding: '14px 16px' })}">
  <div style="${s({ display: 'flex', 'flex-direction': 'row', 'justify-content': 'space-between', 'align-items': 'baseline' })}"><span style="${s({ 'font-weight': '500' })}">Holds the 55% floor down to</span><span style="${s({ 'font-size': '20px', 'font-weight': '600' })}">35% off</span></div>
  <div style="${s({ position: 'relative', height: '6px', 'border-radius': '3px', background: T.line })}"><div style="${s({ position: 'absolute', left: '0', top: '0', height: '6px', width: '58%', 'border-radius': '3px', background: T.accent })}"></div><div style="${s({ position: 'absolute', left: 'calc(58% - 9px)', top: '-6px', width: '18px', height: '18px', 'border-radius': '9px', background: T.surface, border: `2px solid ${T.accent}` })}"></div></div>
  <div style="${s({ display: 'flex', 'flex-direction': 'row', 'justify-content': 'space-between', 'font-size': '12px', color: T.muted })}"><span>0%</span><span>Deepest promo before margin breaks</span><span>60%</span></div>
</div>
    `)}
  `,
  foot: `<div style="${s({ display: 'flex', 'flex-direction': 'row', gap: '10px', margin: '0 20px 12px' })}">${button('Save to items')}${button('Compare', { primary: false })}</div>`,
});

// 4. Assess inputs
screens.Assess = screen({
  head: header({ back: 'Today', title: 'Assess item', action: `<span style="${s({ color: T.faint })}">${I.scan}</span>` }),
  tab: 'assess',
  body: `
    ${card(`
${itemRow({ name: 'Linen-blend camp shirt', style: '30177', metric: 'Women’s Tops', pill: '', last: true })}
    `)}
    ${sectionLabel('Bought')}
    ${card(`
${field({ label: 'Units received', value: '2,400' })}
${field({ label: 'Landed cost', value: '11.80', unit: { pre: '$' } })}
${field({ label: 'Original retail', value: '44.50', unit: { pre: '$' }, last: true })}
    `)}
    ${sectionLabel('Selling')}
    ${card(`
${field({ label: 'Weeks on floor', value: '8' })}
${field({ label: 'Units sold', value: '1,560' })}
${field({ label: 'On hand', value: '840' })}
${field({ label: 'Average unit retail', value: '39.60', unit: { pre: '$' }, hint: 'Net of promos' })}
${field({ label: 'Weeks left in season', value: '6', last: true })}
    `)}
  `,
  foot: `<div style="${s({ display: 'flex', 'flex-direction': 'row', margin: '0 20px 12px' })}">${button('Assess')}</div>`,
});

// 5. Verdict
const wk = (n, tone) => `<div style="${s({ display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '4px', 'flex-grow': '1' })}"><div style="${s({ width: '100%', height: '28px', 'border-radius': '4px', background: tone === 'sold' ? T.lineStrong : tone === 'cover' ? T.accent : tone === 'gap' ? T.negTint : T.line, border: tone === 'gap' ? `1px dashed ${T.neg}` : 'none' })}"></div><span style="${s({ 'font-size': '10px', color: T.faint })}">${n}</span></div>`;

screens.Verdict = screen({
  head: header({ back: 'Assess', title: 'Linen-blend camp shirt', action: `<span style="${s({ color: T.faint })}">${I.share}</span>` }),
  tab: 'assess',
  body: `
    <div style="${s({ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', gap: '14px', padding: '16px', background: T.accentTint, border: '1px solid #c9e2d6', 'border-radius': '14px' })}">
      <div style="${s({ display: 'flex', 'align-items': 'center', 'justify-content': 'center', width: '44px', height: '44px', 'border-radius': '22px', background: T.accent, color: '#ffffff', 'flex-shrink': '0' })}">${I.check}</div>
      <div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '2px' })}"><span style="${s({ 'font-family': T.serif, 'font-size': '28px', 'line-height': '1', color: T.accentInk })}">Reorder</span><span style="${s({ 'font-size': '13px', color: T.accentInk })}">Sells out in wk 12 at current rate, two weeks before season end.</span></div>
    </div>
    <div style="${s({ display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '8px' })}">
      ${stat({ label: 'Sell-through', value: '65%', sub: 'wk 8 of 14', tone: 'good' })}
      ${stat({ label: 'Rate of sale', value: '195', sub: 'units / wk' })}
      ${stat({ label: 'WOS', value: '4.3', sub: '6 wks left' })}
      ${stat({ label: 'Maintained MU', value: '70.2%', sub: 'IMU 73.5%' })}
      ${stat({ label: 'AUR vs ticket', value: '89%', sub: '$39.60' })}
      ${stat({ label: 'GMROI', value: '2.3', sub: 'to date' })}
    </div>
    ${sectionLabel('Coverage by week')}
    ${card(`
<div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '10px', padding: '14px 16px' })}">
  <div style="${s({ display: 'flex', 'flex-direction': 'row', gap: '3px' })}">${[1,2,3,4,5,6,7,8].map((n) => wk(n, 'sold')).join('')}${[9,10,11,12].map((n) => wk(n, 'cover')).join('')}${[13,14].map((n) => wk(n, 'gap')).join('')}</div>
  <div style="${s({ display: 'flex', 'flex-direction': 'row', gap: '14px', 'font-size': '12px', color: T.muted, 'flex-wrap': 'wrap' })}"><span style="${s({ display: 'inline-flex', 'align-items': 'center', gap: '5px' })}"><span style="${s({ width: '10px', height: '10px', 'border-radius': '2px', background: T.lineStrong })}"></span>Sold</span><span style="${s({ display: 'inline-flex', 'align-items': 'center', gap: '5px' })}"><span style="${s({ width: '10px', height: '10px', 'border-radius': '2px', background: T.accent })}"></span>On hand covers</span><span style="${s({ display: 'inline-flex', 'align-items': 'center', gap: '5px' })}"><span style="${s({ width: '10px', height: '10px', 'border-radius': '2px', background: T.negTint, border: `1px dashed ${T.neg}` })}"></span>Uncovered</span></div>
  <div style="${s({ display: 'flex', 'flex-direction': 'row', 'justify-content': 'space-between', 'align-items': 'baseline', 'padding-top': '8px', 'border-top': `1px solid ${T.line}` })}"><span style="${s({ 'font-weight': '500' })}">Suggested reorder</span><span style="${s({ 'font-size': '20px', 'font-weight': '600' })}">400 units</span></div>
  <span style="${s({ 'font-size': '12px', color: T.muted, 'margin-top': '-6px' })}">2 uncovered weeks × 195 per week, rounded to case pack. Must land by wk 12.</span>
</div>
    `)}
  `,
  foot: `<div style="${s({ display: 'flex', 'flex-direction': 'row', gap: '10px', margin: '0 20px 12px' })}">${button('Save verdict')}${button('What if 25% off', { primary: false })}</div>`,
});

// 6. Items list
screens.Items = screen({
  head: header({ back: 'Today', title: 'Items', action: `<span style="${s({ color: T.faint })}">${I.search}</span>` }),
  tab: 'assess',
  body: `
    ${chips(['All', 'Reorder 3', 'Hold 6', 'Markdown 5'], 'All')}
    ${sectionLabel('Markdown candidates')}
    ${card(`
${itemRow({ name: 'Textured knit cardigan', style: '30244', metric: 'ST 28% · WOS 11.4', pill: pill('Markdown', 'bad') })}
${itemRow({ name: 'Pleated midi skirt', style: '41655', metric: 'ST 31% · WOS 9.8', pill: pill('Markdown', 'bad'), last: true })}
    `)}
    ${sectionLabel('Reorder')}
    ${card(`
${itemRow({ name: 'Linen-blend camp shirt', style: '30177', metric: 'ST 65% · WOS 4.3', pill: pill('Reorder', 'good') })}
${itemRow({ name: 'Ponte wide-leg trouser', style: '41822', metric: 'ST 58% · WOS 5.1', pill: pill('Reorder', 'good'), last: true })}
    `)}
    ${sectionLabel('Hold')}
    ${card(`
${itemRow({ name: 'Ribbed tank, 3-pack', style: '29910', metric: 'ST 47% · WOS 7.0', pill: pill('Hold', 'warn') })}
${itemRow({ name: 'Utility cargo pant', style: '41901', metric: 'ST 44% · WOS 6.6', pill: pill('Hold', 'warn'), last: true })}
    `)}
  `,
});

// 7. Setup
const targetRow = (cls, target, last) => `<div style="${s({ display: 'flex', 'flex-direction': 'row', 'justify-content': 'space-between', 'align-items': 'center', padding: '12px 16px', 'min-height': '48px', 'border-bottom': last ? 'none' : `1px solid ${T.line}` })}"><span>${cls}</span><span style="${s({ 'font-weight': '600', 'font-size': '16px' })}">${target}</span></div>`;

screens.Setup = screen({
  head: header({ title: 'Setup' }),
  tab: 'setup',
  body: `
    ${sectionLabel('Target IMU by class', 'Edit')}
    ${card(`
${targetRow('Women’s Tops', '66%')}
${targetRow('Women’s Bottoms', '68%')}
${targetRow('Dresses', '70%', true)}
    `)}
    ${sectionLabel('Assumptions')}
    ${card(`
${field({ label: 'Freight', value: '6.0', unit: { post: '%' }, hint: 'Of FOB, ocean' })}
${field({ label: 'Duty default', value: '16.0', unit: { post: '%' }, hint: 'Override per item by HTS' })}
${field({ label: 'Promo IMU floor', value: '55', unit: { post: '%' } })}
${field({ label: 'Season length', value: '14', unit: { post: 'wks' }, last: true })}
    `)}
    ${sectionLabel('Verdict rules')}
    ${card(`
${field({ label: 'Reorder when', value: 'WOS < weeks left', hint: 'and sell-through above 50%' })}
${field({ label: 'Markdown when', value: 'WOS > weeks left', hint: 'by 2 or more weeks', last: true })}
    `)}
    ${card(`
<div style="${s({ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', 'justify-content': 'space-between', padding: '10px 16px', 'min-height': '48px' })}"><div style="${s({ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', gap: '10px' })}"><span style="${s({ color: T.accent })}">${I.book}</span><span style="${s({ 'font-weight': '500' })}">Formula reference</span></div><span style="${s({ color: T.faint })}">${I.chev}</span></div>
    `)}
  `,
});

// 8. Formulas
const formula = (name, expr, note, last) => `<div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '4px', padding: '12px 16px', 'border-bottom': last ? 'none' : `1px solid ${T.line}` })}"><span style="${s({ 'font-weight': '600' })}">${name}</span><span style="${s({ 'font-family': "'IBM Plex Mono', Menlo, Consolas, monospace", 'font-size': '13px', color: T.accentInk })}">${expr}</span>${note ? `<span style="${s({ 'font-size': '12px', color: T.muted })}">${note}</span>` : ''}</div>`;

screens.Formulas = screen({
  head: header({ back: 'Setup', title: 'Formulas' }),
  tab: 'setup',
  body: `
    ${sectionLabel('Pricing')}
    ${card(`
${formula('Landed cost', 'FOB + freight + duty', 'Freight and duty as % of FOB unless entered in $')}
${formula('IMU %', '(Retail − Landed) ÷ Retail')}
${formula('Retail for target IMU', 'Landed ÷ (1 − target IMU)', 'Rounded up to the nearest .50 price point')}
${formula('Markup after promo', '(Retail × (1 − off) − Landed) ÷ (Retail × (1 − off))', '', true)}
    `)}
    ${sectionLabel('Selling')}
    ${card(`
${formula('Sell-through %', 'Sold ÷ Received')}
${formula('Rate of sale', 'Sold ÷ Weeks on floor')}
${formula('Weeks of supply', 'On hand ÷ Rate of sale')}
${formula('Maintained markup', '(AUR − Landed) ÷ AUR')}
${formula('GMROI', 'Gross margin $ ÷ Average inventory at cost', 'Average inventory = (Received + On hand) ÷ 2 × Landed', true)}
    `)}
  `,
});

// ---------- low-fi alternates ----------
const sketchHelmet = `<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Patrick+Hand&amp;display=swap">
  <style>
    body { margin: 0; background: #fbfaf7; color: #333; font-family: 'Patrick Hand', 'Comic Sans MS', cursive; font-size: 16px; }
    a { color: #1f7a5c; } a:hover { color: #145843; }
    * { box-sizing: border-box; }
  </style>
</helmet>`;
const box = (label, h, extra = {}) => `<div style="${s({ display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'min-height': `${h}px`, border: '2px solid #555', 'border-radius': '6px', color: '#555', 'text-align': 'center', padding: '6px', ...extra })}">${label}</div>`;
const sketch = (title, note, body) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
${sketchHelmet}
<div style="${s({ width: `${W}px`, height: `${H}px`, display: 'flex', 'flex-direction': 'column', gap: '12px', padding: '56px 20px 24px', background: '#fbfaf7', overflow: 'hidden' })}">
  <div style="${s({ 'font-size': '26px', 'font-weight': '700' })}">${title}</div>
  <div style="${s({ 'font-size': '14px', color: '#777' })}">${note}</div>
${body}
</div>
</x-dc>
<script data-dc-script data-props='{"$preview":{"width":${W},"height":${H}}}'>
class Component extends DCLogic {}
</script>
</body>
</html>
`;

const gridRow = (a, b, c, d, head) => `<div style="${s({ display: 'grid', 'grid-template-columns': 'repeat(4, minmax(0, 1fr))', gap: '0', 'border-bottom': '1px solid #999', 'font-weight': head ? '700' : '400', background: head ? '#eee' : 'transparent' })}"><span style="${s({ padding: '6px', 'border-right': '1px solid #999' })}">${a}</span><span style="${s({ padding: '6px', 'border-right': '1px solid #999', 'text-align': 'right' })}">${b}</span><span style="${s({ padding: '6px', 'border-right': '1px solid #999', 'text-align': 'right' })}">${c}</span><span style="${s({ padding: '6px', 'text-align': 'right' })}">${d}</span></div>`;

const alternates = {};
alternates.AltLedger = sketch('Alt A · Ledger grid', 'Everything on one dense sheet. Fastest for a merchant who thinks in columns; hardest to use one-handed.', `
  <div style="${s({ display: 'flex', 'flex-direction': 'column', border: '2px solid #555', 'border-radius': '6px', overflow: 'hidden' })}">
${gridRow('Style', 'Cost', 'Retail', 'IMU', true)}
${gridRow('41822', '17.32', '59.50', '70.9')}
${gridRow('41790', '51.20', '129.00', '60.3')}
${gridRow('41655', '12.10', '39.50', '69.4')}
${gridRow('+ add row', '', '', '')}
  </div>
  <div style="${s({ display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '8px' })}">${box('Σ IMU 68.8%', 56)}${box('Σ units 6,400', 56)}${box('Σ margin $', 56)}</div>
  ${box('Swipe a row → assess it', 44, { 'border-style': 'dashed' })}
  <div style="${s({ display: 'flex', 'flex-direction': 'column', gap: '8px', padding: '12px', border: '2px solid #555', 'border-radius': '6px', 'margin-top': 'auto' })}">
    <div style="${s({ 'font-weight': '700' })}">41822 · Ponte wide-leg trouser</div>
    <div style="${s({ display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '8px' })}">${box('ST 58%', 48)}${box('WOS 5.1', 48)}${box('Reorder', 48, { background: '#dfeee7' })}</div>
    ${box('Row detail drawer slides up over the sheet', 36, { 'border-style': 'dashed', 'font-size': '14px' })}
  </div>
  ${box('Tab bar: Sheet · Items · Setup', 44)}
`);

alternates.AltGuided = sketch('Alt B · One question at a time', 'Conversational flow, big numeric keypad. Friendliest for a first-timer; slow for an experienced buyer pricing 40 styles.', `
  ${box('Step 2 of 5', 32, { border: 'none', color: '#999' })}
  <div style="${s({ 'font-size': '30px', 'line-height': '1.1' })}">What does it cost you landed?</div>
  ${box('$ 17.32', 72, { 'font-size': '32px' })}
  ${box('Not sure? Build it from FOB + freight + duty →', 44, { 'border-style': 'dashed', 'font-size': '14px' })}
  <div style="${s({ display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '8px', 'margin-top': 'auto' })}">${['1','2','3','4','5','6','7','8','9','.','0','⌫'].map((k) => box(k, 56)).join('')}</div>
  ${box('Next →', 52, { background: '#333', color: '#fff', border: 'none' })}
`);

// ---------- write files ----------
const order = ['Main', 'NewItem', 'NewItemResult', 'Assess', 'Verdict', 'Items', 'Setup', 'Formulas'];
const titles = { Main: 'Home', NewItem: 'New item · inputs', NewItemResult: 'New item · math', Assess: 'Assess · inputs', Verdict: 'Assess · verdict', Items: 'Items', Setup: 'Setup', Formulas: 'Formulas' };
for (const k of order) writeFileSync(`${k}.dc.html`, wrap(k, screens[k]));
for (const k of Object.keys(alternates)) writeFileSync(`${k}.dc.html`, alternates[k]);

const GAP = 110;
const canvas = {
  pages: [
    { id: 'page-1', name: 'Screens' },
    { id: 'page-2', name: 'Alternates' },
  ],
  artboards: [
    ...order.map((k, i) => ({ file: `${k}.dc.html`, title: titles[k], x: i * (W + GAP), y: 0, w: W, h: H, page: 'page-1' })),
    { file: 'AltLedger.dc.html', title: 'Alt A · Ledger grid', x: 0, y: 0, w: W, h: H, page: 'page-2' },
    { file: 'AltGuided.dc.html', title: 'Alt B · Guided', x: W + GAP, y: 0, w: W, h: H, page: 'page-2' },
  ],
  annotations: [
    { id: 'flow', x: 0, y: -260, w: 520, page: 'page-1', text: 'MerchMath — flow\n\nHome → New item (inputs) → New item math (IMU, price ladder, promo depth) → Save to Items\nHome → Assess item (inputs) → Verdict (sell-through, WOS, GMROI, coverage, reorder qty) → Save\nSetup holds target IMU by class, freight/duty defaults, promo floor, and the verdict rules. Formulas shows every calculation the app uses.\n\nSample values are illustrative: duty rates, class targets and the season calendar come from the merchant\'s own setup.' },
    { id: 'direction', x: 1000, y: -260, w: 460, page: 'page-1', text: 'Direction: paper ledger\n\nWarm paper ground, ink type, one green accent reserved for margin and go decisions. Serif only for screen titles and the one big number per screen; IBM Plex Sans with tabular figures everywhere numbers line up.\n\nStatic mockups. The live result strip on New item and the verdict banner are the two moments the app should feel instant.' },
    { id: 'alts', x: 0, y: -200, w: 520, page: 'page-2', text: 'Two directions not taken, kept for comparison. Alt A trades one-handed use for density; Alt B trades speed for hand-holding. The main direction sits between them: one form per task, live result pinned at the bottom.' },
  ],
  launch: { view: 'canvas', page: 'page-1' },
};
writeFileSync('canvas.json', JSON.stringify(canvas, null, 2) + '\n');
console.log('wrote', order.length + Object.keys(alternates).length, 'artboards + canvas.json');
