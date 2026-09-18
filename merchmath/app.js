/* MerchMath app: hash router, localStorage state, eight screens. Calculations live in math.js. */
(function () {
  'use strict';
  const MM = window.MM;
  const KEY = 'merchmath.v1';

  // ---------- state ----------
  const defaultSetup = () => ({
    season: 'Fall ’26',
    dept: 'Women’s',
    classes: [
      { name: 'Women’s Tops', target: 66 },
      { name: 'Women’s Bottoms', target: 68 },
      { name: 'Dresses', target: 70 },
      { name: 'Outerwear', target: 62 },
    ],
    freightPct: 6, dutyPct: 16, promoFloor: 55, promoOff: 30, seasonWeeks: 14, casePack: 50,
    reorderST: 50, markdownGap: 2,
  });
  const sampleItems = () => {
    const t = Date.now();
    const A = (i, name, style, cls, d) => ({ id: 'smp' + i, kind: 'assess', name, style, cls, savedAt: t - i * 3600e3, ...d });
    const N = (i, name, style, cls, d) => ({ id: 'smp' + i, kind: 'new', name, style, cls, mode: 'imu', savedAt: t - i * 3600e3, ...d });
    return [
      A(1, 'Textured knit cardigan', '30244', 'Women’s Tops', { received: 1800, landed: 15.4, retail: 49.5, weeks: 8, sold: 504, onHand: 720, aur: 41.2, weeksLeft: 6 }),
      A(2, 'Linen-blend camp shirt', '30177', 'Women’s Tops', { received: 2400, landed: 11.8, retail: 44.5, weeks: 8, sold: 1560, onHand: 840, aur: 39.6, weeksLeft: 6 }),
      A(3, 'Ribbed tank, 3-pack', '29910', 'Women’s Tops', { received: 3000, landed: 6.1, retail: 24.5, weeks: 8, sold: 1410, onHand: 1234, aur: 21.9, weeksLeft: 6 }),
      A(4, 'Pleated midi skirt', '41655', 'Women’s Bottoms', { received: 1200, landed: 17.9, retail: 59.5, weeks: 8, sold: 372, onHand: 456, aur: 49.8, weeksLeft: 6 }),
      A(5, 'Rib-knit henley', '30301', 'Women’s Tops', { received: 2000, landed: 9.4, retail: 34.5, weeks: 8, sold: 1160, onHand: 740, aur: 31.2, weeksLeft: 6 }),
      A(6, 'Utility cargo pant', '41901', 'Women’s Bottoms', { received: 1500, landed: 19.6, retail: 69.5, weeks: 8, sold: 660, onHand: 545, aur: 58.4, weeksLeft: 6 }),
      N(7, 'Ponte wide-leg trouser', '41822', 'Women’s Bottoms', { fob: 14.2, retail: 59.5 }),
      N(8, 'Faux-leather moto jacket', '41790', 'Outerwear', { fob: 42, retail: 129 }),
    ];
  };
  const emptyNew = () => ({ name: '', style: '', cls: '', mode: 'imu', fob: '', freightPct: '', dutyPct: '', retail: '', targetImu: '', id: null, compare: false, b: { fob: '', retail: '' } });
  const emptyAssess = () => ({ name: '', style: '', cls: '', received: '', landed: '', retail: '', weeks: '', sold: '', onHand: '', aur: '', weeksLeft: '', id: null, off: 0, lift: 1.5 });

  let state = load();
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
    if (!s || !s.setup) s = { setup: defaultSetup(), items: sampleItems(), drafts: { new: emptyNew(), assess: emptyAssess() }, ui: { filter: 'All', q: '' } };
    s.drafts = s.drafts || {};
    s.drafts.new = Object.assign(emptyNew(), s.drafts.new || {});
    s.drafts.new.b = Object.assign({ fob: '', retail: '' }, s.drafts.new.b || {});
    s.drafts.assess = Object.assign(emptyAssess(), s.drafts.assess || {});
    s.ui = Object.assign({ filter: 'All', q: '' }, s.ui || {});
    s.setup = Object.assign(defaultSetup(), s.setup);
    if (!s.setup.classes.length) s.setup.classes = defaultSetup().classes;
    s.items = Array.isArray(s.items) ? s.items : [];
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable: app still works for the session */ } }

  // ---------- helpers ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (x, d = 1) => (isFinite(x) ? (x * 100).toFixed(d) + '%' : '—');
  const money = (x, d = 2) => (isFinite(x) ? (x < 0 ? '−$' : '$') + Math.abs(x).toFixed(d) : '—');
  const int = (x) => (isFinite(x) ? Math.round(x).toLocaleString('en-US') : '—');
  const num1 = (x, d = 1) => (isFinite(x) ? x.toFixed(d) : '—');
  const signed = (x, d = 1, unit = ' pts') => (isFinite(x) ? (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d) + unit : '—');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const get = (path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state);
  const set = (path, v) => { const ks = path.split('.'); let o = state; for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; };
  const setup = () => state.setup;
  const verdictTone = { reorder: 'good', hold: 'warn', markdown: 'bad' };
  const verdictLabel = { reorder: 'Reorder', hold: 'Hold', markdown: 'Markdown' };

  let toastT;
  function toast(msg) { const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1800); }
  function share(text) {
    if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard'), () => toast('Could not copy'));
    else toast('Sharing not available');
  }

  // ---------- icons ----------
  const svg = (p, size = 24) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const I = {
    home: svg('<path d="M4 11.5 12 5l8 6.5"></path><path d="M6 10.5V19h12v-8.5"></path>'),
    tag: svg('<path d="M4 4h7l9 9-7 7-9-9V4z"></path><circle cx="8.5" cy="8.5" r="1.25"></circle>'),
    chart: svg('<path d="M4 19h16"></path><path d="M7 15v-4"></path><path d="M12 15V7"></path><path d="M17 15v-7"></path>'),
    sliders: svg('<path d="M5 7h14"></path><path d="M5 12h14"></path><path d="M5 17h14"></path><circle cx="9" cy="7" r="1.75" fill="currentColor"></circle><circle cx="15" cy="12" r="1.75" fill="currentColor"></circle><circle cx="8" cy="17" r="1.75" fill="currentColor"></circle>'),
    back: svg('<path d="M14.5 6 8.5 12l6 6"></path>'),
    chev: svg('<path d="m9.5 6 6 6-6 6"></path>', 20),
    check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"></path>', 18),
    alert: svg('<path d="M12 8v5"></path><circle cx="12" cy="16.5" r="0.75" fill="currentColor"></circle><path d="M10.3 4.5 3.5 17a2 2 0 0 0 1.7 3h13.6a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0z"></path>', 18),
    pause: svg('<path d="M9 6v12"></path><path d="M15 6v12"></path>', 18),
    share: svg('<path d="M12 4v11"></path><path d="m8 8 4-4 4 4"></path><path d="M5 13v6h14v-6"></path>', 20),
    book: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"></path><path d="M4 18a2.5 2.5 0 0 1 2.5-2.5H20"></path>', 20),
    plus: svg('<path d="M12 5v14"></path><path d="M5 12h14"></path>', 20),
    x: svg('<path d="M6 6l12 12"></path><path d="M18 6 6 18"></path>', 18),
    search: svg('<circle cx="11" cy="11" r="6"></circle><path d="m20 20-4.5-4.5"></path>', 20),
  };

  // ---------- pieces ----------
  const tabbar = (active) => {
    const items = [['home', '#/', 'Home', I.home], ['new', '#/new', 'New item', I.tag], ['items', '#/items', 'Items', I.chart], ['setup', '#/setup', 'Setup', I.sliders]];
    return `<nav class="tabbar">${items.map(([k, h, l, ic]) => `<a class="tab${k === active ? ' active' : ''}" href="${h}">${ic}<span>${l}</span></a>`).join('')}</nav>`;
  };
  const header = ({ title, eyebrow, back, action }) => `<header class="head">
    ${back ? `<a class="back" href="${back.href}"${back.action ? ` data-action="${back.action}"` : ''}>${I.back}<span>${esc(back.label)}</span></a>` : ''}
    ${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}
    <div class="row"><h1>${esc(title)}</h1>${action || ''}</div>
  </header>`;
  const iconBtn = (icon, attrs, label) => `<button class="icon-btn" ${attrs} aria-label="${esc(label)}" title="${esc(label)}">${icon}</button>`;
  const iconLink = (icon, href, label) => `<a class="icon-btn" href="${href}" aria-label="${esc(label)}" title="${esc(label)}">${icon}</a>`;
  const page = ({ head, body, foot, tab }) => `${head}<main class="body${foot ? ' has-foot' : ''}">${body}</main>${foot ? `<div class="foot">${foot}</div>` : ''}${tabbar(tab)}`;
  const card = (inner) => `<div class="card">${inner}</div>`;
  const section = (t, right) => `<div class="section"><span>${t}</span>${right || ''}</div>`;
  const pill = (t, tone) => `<span class="pill ${tone}">${t}</span>`;
  const field = ({ label, bind, value, pre, post, hint, placeholder, computed, text, out, id }) => {
    const inner = computed
      ? `<span class="val"><span ${out ? `data-out="${out}"` : ''}>${value}</span></span>`
      : `<span class="val">${pre ? `<span class="unit">${pre}</span>` : ''}<input ${id ? `id="${id}"` : ''} class="${text ? 'text' : ''}" type="text" inputmode="${text ? 'text' : 'decimal'}" ${text ? '' : 'autocomplete="off"'} data-bind="${bind}" data-type="${text ? 'text' : 'num'}" value="${esc(value)}" placeholder="${esc(placeholder || '')}">${post ? `<span class="unit">${post}</span>` : ''}</span>`;
    return `<label class="field${computed ? ' computed' : ''}"><span class="lab"><span>${label}</span>${hint !== undefined ? `<span class="hint" ${out ? `data-out="${out}-hint"` : ''}>${hint}</span>` : ''}</span>${inner}</label>`;
  };
  const selectField = ({ label, bind, value, options, hint, out }) => `<label class="field"><span class="lab"><span>${label}</span>${hint !== undefined ? `<span class="hint" ${out ? `data-out="${out}"` : ''}>${hint}</span>` : ''}</span><span class="val"><select data-bind="${bind}" data-type="text">${options.map((o) => `<option value="${esc(o)}"${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></span></label>`;
  const button = (label, attrs, cls = '') => `<button class="btn ${cls}" ${attrs}>${label}</button>`;
  const segmented = (opts, active, action) => `<div class="segmented">${opts.map(([k, l]) => `<button class="${k === active ? 'active' : ''}" data-action="${action}" data-value="${k}">${l}</button>`).join('')}</div>`;
  const itemRow = ({ id, name, style, meta, pill: p }) => `<button class="item" data-action="open" data-id="${id}"><span class="l"><span class="name">${esc(name || 'Untitled')}</span><span class="meta">${esc(style ? style + ' · ' : '')}${meta}</span></span><span class="r">${p}${I.chev}</span></button>`;
  const stat = ({ label, value, sub, tone }) => `<div class="stat"><small>${label}</small><b class="${tone || ''}">${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;

  // Summaries of a saved item for lists.
  function summarize(it) {
    if (it.kind === 'assess') {
      const a = MM.assess(it, setup());
      return { meta: `ST ${pct(a.st, 0)} · WOS ${num1(a.wos)}`, pill: pill(verdictLabel[a.verdict], verdictTone[a.verdict]), verdict: a.verdict, a };
    }
    const p = MM.priceNewItem(it, setup());
    const on = p.delta >= 0;
    return { meta: `${money(p.retail)} · IMU ${pct(p.imu)}`, pill: pill(on ? 'On target' : 'Below target', on ? 'good' : 'bad'), verdict: 'priced', p };
  }

  // ---------- screens ----------
  const views = {};

  views['/'] = () => {
    const items = state.items.slice().sort((a, b) => b.savedAt - a.savedAt);
    const decisions = items.filter((i) => i.kind === 'assess').map((i) => ({ i, s: summarize(i) })).filter((x) => x.s.verdict !== 'hold').slice(0, 3);
    const recent = items.filter((i) => i.kind === 'new').slice(0, 2);
    const s = setup();
    return page({
      tab: 'home',
      head: header({ eyebrow: [s.season, s.dept].filter(Boolean).join(' · '), title: 'Today' }),
      body: `
        <div class="entry">
          <a class="dark" href="#/new" data-action="fresh-new"><span class="ico">${I.tag}</span><span class="t"><b>New item math</b><small>Landed cost → retail → IMU</small></span></a>
          <a href="#/assess" data-action="fresh-assess"><span class="ico">${I.chart}</span><span class="t"><b>Assess an item</b><small>Sell-through, WOS → verdict</small></span></a>
        </div>
        ${section('Needs a decision', `<a class="link" href="#/items">All items</a>`)}
        ${card(decisions.length ? decisions.map(({ i, s }) => itemRow({ id: i.id, name: i.name, style: i.style, meta: s.meta, pill: s.pill })).join('') : `<div class="empty">Nothing waiting on you. Assess an item to get a verdict.</div>`)}
        ${section('Recent math')}
        ${card(recent.length ? recent.map((i) => { const s = summarize(i); return itemRow({ id: i.id, name: i.name, style: i.style, meta: s.meta, pill: s.pill }); }).join('') : `<div class="empty">No priced items yet.</div>`)}
      `,
    });
  };

  // New item · inputs
  function newStrip(p) {
    if (!p.ok) return `<div class="strip idle"><div><span class="k">IMU</span><br><span class="v">—</span></div><button class="go" disabled>Full math</button></div>`;
    const bad = p.delta < 0;
    return `<div class="strip${bad ? ' bad' : ''}"><div><span class="k">IMU · ${signed(p.delta)} vs target</span><br><span class="v">${pct(p.imu)}</span></div><a class="go" href="#/new/math">Full math ${I.chev}</a></div>`;
  }
  views['/new'] = () => {
    const d = state.drafts.new, s = setup();
    const p = MM.priceNewItem(d, s);
    const classes = s.classes.map((c) => c.name);
    if (!d.cls) d.cls = classes[0];
    const v = {
      update() {
        const p = MM.priceNewItem(state.drafts.new, setup());
        const o = (k, t) => { const el = document.querySelector(`[data-out="${k}"]`); if (el) el.textContent = t; };
        o('landed', p.ok || isFinite(p.landed) ? money(p.landed) : '—');
        o('freight-hint', isFinite(p.freight) ? `${money(p.freight)} per unit` : `Default ${s.freightPct}% of FOB`);
        o('duty-hint', isFinite(p.duty) ? `${money(p.duty)} per unit · override by HTS` : `Default ${s.dutyPct}% of FOB`);
        o('cls-hint', `target IMU ${p.target}%`);
        o('retail', isFinite(p.retail) ? money(p.retail) : '—');
        o('retail-hint', isFinite(p.retail) ? `Rounded up to the next .50 for ${num1(p.solveImu, 0)}% IMU` : `Enter FOB and target IMU`);
        const strip = document.getElementById('strip'); if (strip) strip.innerHTML = newStrip(p);
      },
      html: page({
        tab: 'new',
        head: header({ back: { href: '#/', label: 'Today' }, title: d.id ? 'Edit item' : 'New item', action: iconLink(I.book, '#/formulas', 'Formulas') }),
        body: `
          ${card(`
            ${field({ label: 'Item', bind: 'drafts.new.name', value: d.name, text: true, placeholder: 'Style name' })}
            ${field({ label: 'Style #', bind: 'drafts.new.style', value: d.style, text: true, placeholder: 'Optional' })}
            ${selectField({ label: 'Class', bind: 'drafts.new.cls', value: d.cls, options: classes, hint: `target IMU ${p.target}%`, out: 'cls-hint' })}
          `)}
          ${section('Solve for')}
          ${segmented([['imu', 'IMU from retail'], ['retail', 'Retail from IMU']], d.mode, 'mode')}
          ${section('Cost')}
          ${card(`
            ${field({ label: 'FOB cost', bind: 'drafts.new.fob', value: d.fob, pre: '$', placeholder: '0.00', id: 'first' })}
            ${field({ label: 'Freight', bind: 'drafts.new.freightPct', value: d.freightPct, post: '%', placeholder: String(s.freightPct), hint: isFinite(p.freight) ? `${money(p.freight)} per unit` : `Default ${s.freightPct}% of FOB`, out: 'freight' })}
            ${field({ label: 'Duty', bind: 'drafts.new.dutyPct', value: d.dutyPct, post: '%', placeholder: String(s.dutyPct), hint: isFinite(p.duty) ? `${money(p.duty)} per unit · override by HTS` : `Default ${s.dutyPct}% of FOB`, out: 'duty' })}
            ${field({ label: 'Landed cost', computed: true, value: isFinite(p.landed) ? money(p.landed) : '—', out: 'landed' })}
          `)}
          ${section('Retail')}
          ${card(d.mode === 'retail'
            ? `${field({ label: 'Target IMU', bind: 'drafts.new.targetImu', value: d.targetImu, post: '%', placeholder: String(p.target) })}
               ${field({ label: 'Ticket price', computed: true, value: isFinite(p.retail) ? money(p.retail) : '—', out: 'retail', hint: isFinite(p.retail) ? `Rounded up to the next .50 for ${num1(p.solveImu, 0)}% IMU` : 'Enter FOB and target IMU' })}`
            : field({ label: 'Ticket price', bind: 'drafts.new.retail', value: d.retail, pre: '$', placeholder: '0.00' }))}
        `,
        foot: `<div id="strip">${newStrip(p)}</div>`,
      }),
    };
    return v;
  };

  // New item · math
  views['/new/math'] = () => {
    const d = state.drafts.new, s = setup();
    const p = MM.priceNewItem(d, s);
    if (!p.ok) { location.hash = '#/new'; return ''; }
    const bad = p.delta < 0;
    const costPct = Math.min(100, Math.max(0, (p.landed / p.retail) * 100));
    const depthPct = p.promoDepth * 100;
    const gaugeMax = 60;
    const knob = Math.min(100, (depthPct / gaugeMax) * 100);
    const promoTxt = depthPct <= 0.05 ? `Already under the ${s.promoFloor}% floor at ticket` : `Holds the ${s.promoFloor}% floor down to`;
    const compareBlock = () => {
      const b = MM.priceNewItem({ ...d, fob: d.b.fob === '' ? d.fob : d.b.fob, retail: d.b.retail === '' ? d.retail : d.b.retail, mode: 'imu', targetImu: '' }, s);
      const dl = (b.imu - p.imu) * 100;
      return `
        <div class="compare head"><span></span><span>A · this</span><span>B</span></div>
        <div class="compare"><span>FOB</span><span>${money(p.fob)}</span><input type="text" inputmode="decimal" data-bind="drafts.new.b.fob" data-type="num" value="${esc(d.b.fob)}" placeholder="${p.fob.toFixed(2)}"></div>
        <div class="compare"><span>Retail</span><span>${money(p.retail)}</span><input type="text" inputmode="decimal" data-bind="drafts.new.b.retail" data-type="num" value="${esc(d.b.retail)}" placeholder="${p.retail.toFixed(2)}"></div>
        <div class="compare"><span>Landed</span><span>${money(p.landed)}</span><span data-out="b-landed">${money(b.landed)}</span></div>
        <div class="compare"><span>IMU</span><span>${pct(p.imu)}</span><span data-out="b-imu">${pct(b.imu)}</span><span class="d ${dl >= 0 ? 'good' : 'bad'}" data-out="b-delta">${signed(dl)} vs A</span></div>
        <div class="compare"><span>Markup per unit</span><span>${money(p.markup)}</span><span data-out="b-markup">${money(b.markup)}</span></div>
        <div class="compare"><span>Promo depth</span><span>${num1(depthPct, 0)}% off</span><span data-out="b-depth">${num1(b.promoDepth * 100, 0)}% off</span></div>`;
    };
    return {
      update() {
        const el = document.getElementById('compare'); if (el) {
          const b = MM.priceNewItem({ ...d, fob: d.b.fob === '' ? d.fob : d.b.fob, retail: d.b.retail === '' ? d.retail : d.b.retail, mode: 'imu', targetImu: '' }, s);
          const o = (k, t) => { const e = el.querySelector(`[data-out="${k}"]`); if (e) e.textContent = t; };
          o('b-landed', money(b.landed)); o('b-imu', pct(b.imu)); o('b-markup', money(b.markup)); o('b-depth', `${num1(b.promoDepth * 100, 0)}% off`);
          const dl = (b.imu - p.imu) * 100; const de = el.querySelector('[data-out="b-delta"]'); if (de) { de.textContent = `${signed(dl)} vs A`; de.className = `d ${dl >= 0 ? 'good' : 'bad'}`; }
        }
      },
      html: page({
        tab: 'new',
        head: header({ back: { href: '#/new', label: 'New item' }, title: d.name || 'New item', action: iconBtn(I.share, 'data-action="share-new"', 'Share') }),
        body: `
          <div class="hero">
            <div><div class="lab">Initial markup</div><div class="big${bad ? ' bad' : ''}">${pct(p.imu)}</div></div>
            <div class="side">${pill(`${signed(p.delta)} vs ${p.target}%`, bad ? 'bad' : 'good')}<small>${money(p.markup)} markup per unit</small></div>
          </div>
          <div>
            <div class="bar"><div class="cost" style="width:${costPct.toFixed(1)}%"></div><div class="mu${bad ? ' bad' : ''}"></div></div>
            <div class="bar-lab"><span>Landed ${money(p.landed)}</span><span>Retail ${money(p.retail)}</span></div>
          </div>
          ${section('Price ladder')}
          ${card(`<div class="ladder head"><span>Retail</span><span>IMU</span><span>At ${s.promoOff}% off</span></div>${p.ladder.map((r) => `<div class="ladder${r.active ? ' active' : ''}"><span>${money(r.retail)}</span><span>${pct(r.imu)}</span><span>${pct(r.promo)}</span></div>`).join('')}`)}
          ${section('Promo depth')}
          ${card(`<div class="gauge">
            <div class="top"><span>${promoTxt}</span><b>${num1(depthPct, 0)}% off</b></div>
            <div class="track"><div class="fill" style="width:${knob.toFixed(1)}%"></div><div class="knob" style="left:${knob.toFixed(1)}%"></div></div>
            <div class="lab"><span>0%</span><span>Deepest promo before margin breaks</span><span>${gaugeMax}%</span></div>
          </div>`)}
          ${d.compare ? section('Compare', `<button class="link" data-action="compare-off">Close</button>`) + card(`<div id="compare">${compareBlock()}</div>`) : ''}
          ${d.id ? `<div class="note" style="text-align:center">Saved ${new Date(state.items.find((i) => i.id === d.id)?.savedAt || Date.now()).toLocaleDateString()} · <button class="link" data-action="remove-new" style="color:var(--neg);font-weight:500">Remove from items</button></div>` : ''}
        `,
        foot: `<div class="btns">${button(d.id ? 'Update item' : 'Save to items', 'data-action="save-new"')}${d.compare ? '' : button('Compare', 'data-action="compare-on"', 'secondary')}</div>`,
      }),
    };
  };

  // Assess · inputs
  views['/assess'] = () => {
    const d = state.drafts.assess, s = setup();
    const classes = s.classes.map((c) => c.name);
    if (!d.cls) d.cls = classes[0];
    const a = MM.assess(d, s);
    return {
      update() {
        const a = MM.assess(state.drafts.assess, setup());
        const b = document.getElementById('assess-btn'); if (b) b.disabled = !a.ok;
        const el = document.querySelector('[data-out="weeksLeft-hint"]'); if (el) el.textContent = weeksHint(a);
      },
      html: page({
        tab: 'items',
        head: header({ back: { href: '#/', label: 'Today' }, title: d.id ? 'Reassess item' : 'Assess item', action: iconLink(I.book, '#/formulas', 'Formulas') }),
        body: `
          ${card(`
            ${field({ label: 'Item', bind: 'drafts.assess.name', value: d.name, text: true, placeholder: 'Style name', id: 'first' })}
            ${field({ label: 'Style #', bind: 'drafts.assess.style', value: d.style, text: true, placeholder: 'Optional' })}
            ${selectField({ label: 'Class', bind: 'drafts.assess.cls', value: d.cls, options: classes })}
          `)}
          ${section('Bought')}
          ${card(`
            ${field({ label: 'Units received', bind: 'drafts.assess.received', value: d.received, placeholder: '0' })}
            ${field({ label: 'Landed cost', bind: 'drafts.assess.landed', value: d.landed, pre: '$', placeholder: '0.00' })}
            ${field({ label: 'Original retail', bind: 'drafts.assess.retail', value: d.retail, pre: '$', placeholder: '0.00' })}
          `)}
          ${section('Selling')}
          ${card(`
            ${field({ label: 'Weeks on floor', bind: 'drafts.assess.weeks', value: d.weeks, placeholder: '0' })}
            ${field({ label: 'Units sold', bind: 'drafts.assess.sold', value: d.sold, placeholder: '0' })}
            ${field({ label: 'On hand', bind: 'drafts.assess.onHand', value: d.onHand, placeholder: '0' })}
            ${field({ label: 'Average unit retail', bind: 'drafts.assess.aur', value: d.aur, pre: '$', placeholder: '0.00', hint: 'Net of promos' })}
            ${field({ label: 'Weeks left in season', bind: 'drafts.assess.weeksLeft', value: d.weeksLeft, placeholder: String(Math.max(0, s.seasonWeeks - (MM.num(d.weeks) || 0))), hint: weeksHint(a), out: 'weeksLeft' })}
          `)}
        `,
        foot: `<div class="btns">${button('Assess', `id="assess-btn" data-action="assess" ${a.ok ? '' : 'disabled'}`)}</div>`,
      }),
    };
    function weeksHint(a) { return `${setup().seasonWeeks}-week season from Setup`; }
  };

  // Assess · verdict
  views['/assess/verdict'] = () => {
    const d = state.drafts.assess, s = setup();
    const a = MM.assess(d, s);
    if (!a.ok) { location.hash = '#/assess'; return ''; }
    const tone = verdictTone[a.verdict];
    const icon = a.verdict === 'reorder' ? I.check : a.verdict === 'markdown' ? I.alert : I.pause;
    // coverage strip: sold weeks, covered weeks, then either uncovered gap or excess supply beyond the season
    const weeks = [];
    for (let w = 1; w <= a.weeks; w++) weeks.push(['sold', w]);
    const cov = isFinite(a.wos) ? Math.min(a.weeksLeft, a.cover) : a.weeksLeft;
    for (let w = 1; w <= cov; w++) weeks.push(['cover', a.weeks + w]);
    for (let w = 1; w <= a.uncovered; w++) weeks.push(['gap', a.weeks + cov + w]);
    const excessWeeks = isFinite(a.excess) && a.excess > 0 ? Math.min(6, Math.ceil(a.excess)) : (!isFinite(a.wos) ? 3 : 0);
    for (let w = 1; w <= excessWeeks; w++) weeks.push(['excess', a.season + w]);
    const shown = weeks.length > 26 ? weeks.slice(0, 26) : weeks;
    const wi = MM.whatIf(a, d.off / 100, d.lift);
    const stTone = a.st > (s.reorderST / 100) ? 'good' : a.st < 0.3 ? 'bad' : '';
    return page({
      tab: 'items',
      head: header({ back: { href: '#/assess', label: 'Assess' }, title: d.name || 'Assessment', action: iconBtn(I.share, 'data-action="share-assess"', 'Share') }),
      body: `
        <div class="verdict ${a.verdict}"><div class="badge">${icon}</div><div class="t"><b>${verdictLabel[a.verdict]}</b><span>${esc(a.reason)}</span></div></div>
        <div class="stats">
          ${stat({ label: 'Sell-through', value: pct(a.st, 0), sub: `wk ${a.weeks} of ${a.season}`, tone: stTone })}
          ${stat({ label: 'Rate of sale', value: int(a.ros), sub: 'units / wk' })}
          ${stat({ label: 'WOS', value: isFinite(a.wos) ? num1(a.wos) : '∞', sub: `${a.weeksLeft} wks left`, tone: a.verdict === 'markdown' ? 'bad' : '' })}
          ${stat({ label: 'MMU', value: pct(a.mmu), sub: `IMU ${pct(a.imu)}`, tone: a.mmu < 0 ? 'bad' : '' })}
          ${stat({ label: 'AUR vs ticket', value: pct(a.aurVsTicket, 0), sub: money(a.aur) })}
          ${stat({ label: 'GMROI', value: num1(a.gmroi), sub: 'to date', tone: a.gmroi < 1 ? 'bad' : '' })}
        </div>
        ${section('Coverage by week')}
        ${card(`<div class="stack">
          <div class="weeks">${shown.map(([t, n]) => `<div class="wk ${t}"><i></i><small>${n}</small></div>`).join('')}</div>
          <div class="legend"><span><i style="background:var(--line-strong)"></i>Sold</span><span><i style="background:var(--accent)"></i>On hand covers</span>${a.uncovered ? `<span><i style="background:var(--neg-tint);border:1px dashed var(--neg)"></i>Uncovered</span>` : ''}${excessWeeks ? `<span><i style="background:var(--warn-tint);border:1px dashed var(--warn)"></i>Past season end</span>` : ''}</div>
          ${a.verdict === 'reorder' ? `<div class="kv"><span>Suggested reorder</span><b>${int(a.reorderQty)} units</b></div><span class="note">${a.uncovered} uncovered ${a.uncovered === 1 ? 'week' : 'weeks'} × ${int(a.ros)} per week, rounded up to ${a.casePack}-unit case pack. Must land by wk ${a.selloutWeek}.</span>` : ''}
          ${a.verdict === 'markdown' ? `<div class="kv"><span>Units left at season end</span><b>${int(Math.max(0, a.onHand - a.ros * a.weeksLeft))}</b></div><span class="note">On hand less ${int(a.ros)} per week for ${a.weeksLeft} weeks at the current rate.</span>` : ''}
        </div>`)}
        ${section('What if')}
        ${card(`<div class="stack">
          <span class="note">Markdown off the ${money(a.retail)} ticket for the ${int(a.onHand)} on hand.</span>
          ${segmented([[0, 'No promo'], [15, '15% off'], [25, '25% off'], [40, '40% off']], d.off, 'off')}
          <span class="note">Expected lift in rate of sale</span>
          ${segmented([[1, '1×'], [1.5, '1.5×'], [2, '2×'], [3, '3×']], d.lift, 'lift')}
          <div class="stats" style="margin-top:4px">
            ${stat({ label: 'Price', value: money(wi.price), sub: `MMU ${pct(wi.mmu)}`, tone: wi.mmu < s.promoFloor / 100 ? 'bad' : '' })}
            ${stat({ label: 'WOS', value: isFinite(wi.wos) ? num1(wi.wos) : '∞', sub: `${int(wi.ros)} / wk`, tone: wi.clears ? 'good' : 'bad' })}
            ${stat({ label: wi.clears ? 'Clears by' : 'Left over', value: wi.clears ? `wk ${a.weeks + Math.ceil(wi.wos)}` : int(wi.leftover), sub: wi.clears ? 'season end' : 'units', tone: wi.clears ? 'good' : 'bad' })}
          </div>
          <span class="note">Lift is your assumption; the app does not know demand elasticity. Margin on the remaining units at this price: ${money(wi.margin, 0)}.</span>
        </div>`)}
        ${d.id ? `<div class="note" style="text-align:center"><button class="link" data-action="remove-assess" style="color:var(--neg);font-weight:500">Remove from items</button></div>` : ''}
      `,
      foot: `<div class="btns">${button(d.id ? 'Update verdict' : 'Save verdict', 'data-action="save-assess"')}${button('Edit inputs', 'data-nav="#/assess"', 'secondary')}</div>`,
    });
  };

  // Items
  views['/items'] = () => {
    const f = state.ui.filter, q = (state.ui.q || '').trim().toLowerCase();
    const all = state.items.map((i) => ({ i, s: summarize(i) })).sort((a, b) => b.i.savedAt - a.i.savedAt);
    const groups = [['markdown', 'Markdown candidates'], ['reorder', 'Reorder'], ['hold', 'Hold'], ['priced', 'Priced, not yet bought']];
    const filters = ['All', 'Reorder', 'Hold', 'Markdown', 'Priced'];
    const match = (x) => (f === 'All' || x.s.verdict === f.toLowerCase()) && (!q || `${x.i.name} ${x.i.style} ${x.i.cls}`.toLowerCase().includes(q));
    const shown = all.filter(match);
    return page({
      tab: 'items',
      head: header({ title: 'Items', action: iconBtn(I.search, 'data-action="search-toggle"', 'Search') }),
      body: `
        <div class="search" id="search" ${q || state.ui.searchOpen ? '' : 'hidden'}>${I.search}<input type="search" placeholder="Search name, style, class" data-bind="ui.q" data-type="text" value="${esc(state.ui.q || '')}" id="search-input"></div>
        <div class="chips">${filters.map((c) => `<button class="chip${c === f ? ' active' : ''}" data-action="filter" data-value="${c}">${c}</button>`).join('')}</div>
        ${shown.length ? groups.map(([k, label]) => { const g = shown.filter((x) => x.s.verdict === k); return g.length ? section(label) + card(g.map((x) => itemRow({ id: x.i.id, name: x.i.name, style: x.i.style, meta: x.s.meta, pill: x.s.pill })).join('')) : ''; }).join('') : card(`<div class="empty">${state.items.length ? 'Nothing matches.' : 'No items yet. Price a new item or assess one to start the list.'}</div>`)}
        <div class="btns" style="display:flex;gap:10px">${button('New item', 'data-action="fresh-new"', 'secondary')}${button('Assess an item', 'data-action="fresh-assess"', 'secondary')}</div>
      `,
    });
  };

  // Setup
  views['/setup'] = () => {
    const s = setup();
    return {
      update() {},
      html: page({
        tab: 'setup',
        head: header({ title: 'Setup', action: iconLink(I.book, '#/formulas', 'Formulas') }),
        body: `
          ${card(`
            ${field({ label: 'Season', bind: 'setup.season', value: s.season, text: true, placeholder: 'Fall ’26' })}
            ${field({ label: 'Department', bind: 'setup.dept', value: s.dept, text: true, placeholder: 'Optional' })}
          `)}
          ${section('Target IMU by class', `<button class="link" data-action="add-class">${I.plus} Add</button>`)}
          ${card(s.classes.map((c, i) => `<div class="class-row"><input class="name" type="text" data-bind="setup.classes.${i}.name" data-type="text" value="${esc(c.name)}" placeholder="Class name"><span class="val"><input type="text" inputmode="decimal" data-bind="setup.classes.${i}.target" data-type="num" value="${esc(c.target)}"><span class="unit">%</span></span><button class="x" data-action="remove-class" data-index="${i}" aria-label="Remove ${esc(c.name)}">${I.x}</button></div>`).join(''))}
          ${section('Assumptions')}
          ${card(`
            ${field({ label: 'Freight', bind: 'setup.freightPct', value: s.freightPct, post: '%', hint: 'Of FOB' })}
            ${field({ label: 'Duty default', bind: 'setup.dutyPct', value: s.dutyPct, post: '%', hint: 'Override per item by HTS' })}
            ${field({ label: 'Promo IMU floor', bind: 'setup.promoFloor', value: s.promoFloor, post: '%', hint: 'Lowest acceptable markup on promo' })}
            ${field({ label: 'Ladder promo', bind: 'setup.promoOff', value: s.promoOff, post: '% off', hint: 'Promo shown on the price ladder' })}
            ${field({ label: 'Season length', bind: 'setup.seasonWeeks', value: s.seasonWeeks, post: 'wks' })}
            ${field({ label: 'Case pack', bind: 'setup.casePack', value: s.casePack, post: 'units', hint: 'Reorders round up to this' })}
          `)}
          ${section('Verdict rules')}
          ${card(`
            ${field({ label: 'Reorder when', bind: 'setup.reorderST', value: s.reorderST, post: '%', hint: 'WOS < weeks left and sell-through above this' })}
            ${field({ label: 'Markdown when', bind: 'setup.markdownGap', value: s.markdownGap, post: 'wks', hint: 'WOS exceeds weeks left by this many weeks' })}
            ${field({ label: 'Otherwise', computed: true, value: 'Hold' })}
          `)}
          ${section('Data')}
          ${card(`
            <button class="row-btn" data-action="export"><span>Copy all data as JSON</span>${I.share}</button>
            <button class="row-btn" data-action="load-sample"><span>Load sample items</span>${I.plus}</button>
            <button class="row-btn danger" data-action="clear-items"><span>Remove all items</span>${I.x}</button>
            <button class="row-btn danger" data-action="reset"><span>Reset setup to defaults</span>${I.x}</button>
          `)}
          <span class="note" style="text-align:center">Everything is stored in this browser only. Nothing is sent anywhere.</span>
        `,
      }),
    };
  };

  // Formulas
  views['/formulas'] = () => {
    const s = setup();
    const f = (name, expr, note) => `<div class="formula"><b>${name}</b><code>${expr}</code>${note ? `<small>${note}</small>` : ''}</div>`;
    return page({
      tab: 'setup',
      head: header({ back: { href: '#/setup', label: 'Back', action: 'back' }, title: 'Formulas' }),
      body: `
        ${section('Pricing')}
        ${card(`
          ${f('Landed cost', 'FOB + freight + duty', 'Freight and duty as % of FOB')}
          ${f('IMU %', '(Retail − Landed) ÷ Retail')}
          ${f('Retail for target IMU', 'Landed ÷ (1 − target IMU)', 'Rounded up to the nearest .50 price point')}
          ${f('Markup after promo', '(Retail × (1 − off) − Landed) ÷ (Retail × (1 − off))', `Ladder shows ${s.promoOff}% off`)}
          ${f('Promo depth', '1 − Landed ÷ (Retail × (1 − floor))', `Deepest promo that still holds the ${s.promoFloor}% floor`)}
        `)}
        ${section('Selling')}
        ${card(`
          ${f('Sell-through %', 'Sold ÷ Received')}
          ${f('Rate of sale', 'Sold ÷ Weeks on floor')}
          ${f('Weeks of supply', 'On hand ÷ Rate of sale')}
          ${f('Maintained markup', '(AUR − Landed) ÷ AUR')}
          ${f('AUR vs ticket', 'AUR ÷ Original retail')}
          ${f('GMROI', 'Gross margin $ ÷ Average inventory at cost', 'Gross margin = Sold × (AUR − Landed). Average inventory = (Received + On hand) ÷ 2 × Landed')}
          ${f('Suggested reorder', 'Uncovered weeks × Rate of sale', `Uncovered weeks = weeks left − WOS, rounded up. Quantity rounded up to the ${s.casePack}-unit case pack`)}
        `)}
        ${section('Verdict')}
        ${card(`
          ${f('Reorder', `WOS < weeks left  and  ST > ${s.reorderST}%`)}
          ${f('Markdown', `WOS − weeks left ≥ ${s.markdownGap}`)}
          ${f('Hold', 'Everything else')}
        `)}
      `,
    });
  };

  // ---------- actions ----------
  function openItem(id) {
    const it = state.items.find((i) => i.id === id); if (!it) return;
    if (it.kind === 'assess') { state.drafts.assess = Object.assign(emptyAssess(), it); location.hash = '#/assess/verdict'; }
    else { state.drafts.new = Object.assign(emptyNew(), it, { b: { fob: '', retail: '' }, compare: false }); location.hash = '#/new/math'; }
    save();
  }
  function persist(kind) {
    const d = state.drafts[kind];
    const rec = { ...d, kind, id: d.id || uid(), savedAt: Date.now() };
    delete rec.b; delete rec.compare;
    if (!rec.name) rec.name = kind === 'new' ? 'Unnamed style' : 'Unnamed item';
    const ix = state.items.findIndex((i) => i.id === rec.id);
    if (ix >= 0) state.items[ix] = rec; else state.items.push(rec);
    d.id = rec.id; d.name = rec.name;
    save();
    toast(ix >= 0 ? 'Updated' : 'Saved to items');
  }
  const actions = {
    'fresh-new'() { state.drafts.new = Object.assign(emptyNew(), { cls: setup().classes[0]?.name }); save(); location.hash = '#/new'; },
    'fresh-assess'() { state.drafts.assess = Object.assign(emptyAssess(), { cls: setup().classes[0]?.name }); save(); location.hash = '#/assess'; },
    open(el) { openItem(el.dataset.id); },
    mode(el) { state.drafts.new.mode = el.dataset.value; save(); render(); },
    off(el) { state.drafts.assess.off = parseFloat(el.dataset.value); save(); render(); },
    lift(el) { state.drafts.assess.lift = parseFloat(el.dataset.value); save(); render(); },
    filter(el) { state.ui.filter = el.dataset.value; save(); render(); },
    'search-toggle'() { state.ui.searchOpen = !state.ui.searchOpen; if (!state.ui.searchOpen) state.ui.q = ''; save(); render(); if (state.ui.searchOpen) document.getElementById('search-input')?.focus(); },
    'compare-on'() { state.drafts.new.compare = true; save(); render(); },
    'compare-off'() { state.drafts.new.compare = false; save(); render(); },
    'save-new'() { persist('new'); render(); },
    'save-assess'() { persist('assess'); render(); },
    assess() { if (MM.assess(state.drafts.assess, setup()).ok) location.hash = '#/assess/verdict'; },
    'remove-new'() { removeItem(state.drafts.new.id); state.drafts.new.id = null; save(); location.hash = '#/items'; },
    'remove-assess'() { removeItem(state.drafts.assess.id); state.drafts.assess.id = null; save(); location.hash = '#/items'; },
    'share-new'() {
      const d = state.drafts.new, p = MM.priceNewItem(d, setup());
      share(`${d.name || 'New item'}${d.style ? ' · ' + d.style : ''}\nFOB ${money(p.fob)} · freight ${p.freightPct}% · duty ${p.dutyPct}% → landed ${money(p.landed)}\nRetail ${money(p.retail)} · IMU ${pct(p.imu)} (${signed(p.delta)} vs ${p.target}% target)\nHolds ${setup().promoFloor}% floor to ${num1(p.promoDepth * 100, 0)}% off\n— MerchMath`);
    },
    'share-assess'() {
      const d = state.drafts.assess, a = MM.assess(d, setup());
      share(`${d.name || 'Item'}${d.style ? ' · ' + d.style : ''}\n${verdictLabel[a.verdict]}: ${a.reason}\nST ${pct(a.st, 0)} · ROS ${int(a.ros)}/wk · WOS ${num1(a.wos)} · MMU ${pct(a.mmu)} · AUR ${pct(a.aurVsTicket, 0)} of ticket · GMROI ${num1(a.gmroi)}${a.reorderQty ? `\nSuggested reorder ${int(a.reorderQty)} units` : ''}\n— MerchMath`);
    },
    'add-class'() { state.setup.classes.push({ name: '', target: 65 }); save(); render(); const inputs = document.querySelectorAll('.class-row input.name'); inputs[inputs.length - 1]?.focus(); },
    'remove-class'(el) { if (state.setup.classes.length <= 1) { toast('Keep at least one class'); return; } state.setup.classes.splice(parseInt(el.dataset.index, 10), 1); save(); render(); },
    back() { if (history.length > 1) history.back(); else location.hash = '#/setup'; },
    export() { share(JSON.stringify({ setup: state.setup, items: state.items }, null, 2)); },
    'load-sample'() { const have = new Set(state.items.map((i) => i.id)); let n = 0; sampleItems().forEach((i) => { if (!have.has(i.id)) { state.items.push(i); n++; } }); save(); toast(n ? `Added ${n} sample items` : 'Sample items already loaded'); render(); },
    'clear-items'() { if (!state.items.length) { toast('No items'); return; } if (confirm(`Remove all ${state.items.length} items? This cannot be undone.`)) { state.items = []; state.drafts.new.id = null; state.drafts.assess.id = null; save(); toast('Items removed'); render(); } },
    reset() { if (confirm('Reset setup to defaults? Items are kept.')) { state.setup = defaultSetup(); save(); toast('Setup reset'); render(); } },
  };
  function removeItem(id) { state.items = state.items.filter((i) => i.id !== id); toast('Removed'); }

  // ---------- router ----------
  const app = document.getElementById('app');
  let current = null;
  function route() { const h = (location.hash || '#/').replace(/^#/, ''); return views[h] ? h : '/'; }
  function render() {
    const v = views[route()]();
    if (v === '') return; // view redirected
    current = typeof v === 'string' ? { html: v } : v;
    app.innerHTML = current.html;
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);

  app.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]'); if (nav) { e.preventDefault(); location.hash = nav.dataset.nav; return; }
    const el = e.target.closest('[data-action]'); if (!el) return;
    const fn = actions[el.dataset.action]; if (!fn) return;
    if (el.tagName === 'A') e.preventDefault();
    fn(el);
  });
  app.addEventListener('input', (e) => {
    const el = e.target; if (!el.dataset || !el.dataset.bind) return;
    const raw = el.value;
    let v = raw;
    if (el.dataset.type === 'num') { const t = raw.trim(); v = t === '' ? '' : (isFinite(MM.num(t)) ? MM.num(t) : ''); if (v !== '' && el.dataset.bind.startsWith('setup.')) v = Math.max(0, v); }
    set(el.dataset.bind, v);
    save();
    if (current && current.update) current.update();
    if (el.dataset.bind === 'ui.q') { render(); const q = document.getElementById('search-input'); if (q) { q.focus(); const n = q.value.length; try { q.setSelectionRange(n, n); } catch (err) { /* not all input types allow it */ } } }
  });
  app.addEventListener('change', (e) => { const el = e.target; if (el.tagName === 'SELECT' && el.dataset.bind) { set(el.dataset.bind, el.value); save(); if (current && current.update) current.update(); } });
  app.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      const inputs = [...app.querySelectorAll('input:not([type=search])')]; const i = inputs.indexOf(e.target);
      if (i >= 0 && i < inputs.length - 1) inputs[i + 1].focus(); else e.target.blur();
    }
  });

  render();
})();
