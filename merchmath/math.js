// MerchMath calculations. Plain functions, no DOM. Loaded in the browser as
// window.MM and usable from Node for tests (node -e "require('./math.js')").
(function (root) {
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const ceilTo = (x, step) => (step > 0 ? Math.ceil(x / step - 1e-9) * step : Math.ceil(x));

  // ---- pricing ----
  function landed(fob, freightPct, dutyPct) {
    const f = fob * (freightPct / 100);
    const d = fob * (dutyPct / 100);
    return { freight: f, duty: d, landed: fob + f + d };
  }
  const imu = (retail, landedCost) => (retail > 0 ? (retail - landedCost) / retail : NaN);
  // Retail that hits a target IMU, rounded up to the next .50 price point.
  const retailForIMU = (landedCost, targetImu) => {
    if (targetImu >= 1 || landedCost <= 0) return NaN;
    return Math.ceil(landedCost / (1 - targetImu) * 2) / 2;
  };
  const markupAfterPromo = (retail, landedCost, off) => imu(retail * (1 - off), landedCost);
  // Deepest promo (as a fraction off) that still holds the floor markup.
  const promoDepth = (retail, landedCost, floor) => {
    if (retail <= 0 || floor >= 1) return NaN;
    return clamp(1 - landedCost / (retail * (1 - floor)), 0, 1);
  };
  const ladderStep = (retail) => (retail >= 40 ? 5 : retail >= 15 ? 2 : 1);

  function priceNewItem(d, setup) {
    const fob = num(d.fob);
    const freightPct = d.freightPct == null || d.freightPct === '' ? setup.freightPct : num(d.freightPct);
    const dutyPct = d.dutyPct == null || d.dutyPct === '' ? setup.dutyPct : num(d.dutyPct);
    const cls = (setup.classes || []).find((c) => c.name === d.cls) || setup.classes[0] || { name: '', target: 65 };
    const target = cls.target / 100;
    const L = landed(fob, freightPct, dutyPct);
    let retail;
    let solveImu = num(d.targetImu);
    if (d.mode === 'retail') {
      if (!isFinite(solveImu)) solveImu = cls.target;
      retail = retailForIMU(L.landed, solveImu / 100);
    } else {
      retail = num(d.retail);
    }
    const i = imu(retail, L.landed);
    const step = ladderStep(retail);
    const ladder = isFinite(retail)
      ? [retail - step, retail, retail + step]
          .filter((r) => r > 0)
          .map((r) => ({ retail: r, imu: imu(r, L.landed), promo: markupAfterPromo(r, L.landed, setup.promoOff / 100), active: r === retail }))
      : [];
    const depth = promoDepth(retail, L.landed, setup.promoFloor / 100);
    return {
      fob, freightPct, dutyPct, freight: L.freight, duty: L.duty, landed: L.landed,
      retail, imu: i, markup: retail - L.landed, target: cls.target, cls: cls.name,
      delta: i * 100 - cls.target, ladder, promoDepth: depth, solveImu,
      ok: isFinite(fob) && fob > 0 && isFinite(retail) && retail > 0,
    };
  }

  // ---- selling ----
  function assess(d, setup) {
    const received = num(d.received), landedCost = num(d.landed), retail = num(d.retail);
    const weeks = num(d.weeks), sold = num(d.sold), onHand = num(d.onHand), aur = num(d.aur);
    const weeksLeft = d.weeksLeft == null || d.weeksLeft === '' ? Math.max(0, setup.seasonWeeks - weeks) : num(d.weeksLeft);
    const casePack = setup.casePack || 1;
    const st = received > 0 ? sold / received : NaN;
    const ros = weeks > 0 ? sold / weeks : NaN;
    const wos = ros > 0 ? onHand / ros : onHand > 0 ? Infinity : 0;
    const mmu = aur > 0 ? (aur - landedCost) / aur : NaN;
    const initial = imu(retail, landedCost);
    const aurVsTicket = retail > 0 ? aur / retail : NaN;
    const gm = sold * (aur - landedCost);
    const avgInv = ((received + onHand) / 2) * landedCost;
    const gmroi = avgInv > 0 ? gm / avgInv : NaN;
    const season = weeks + weeksLeft;

    let verdict = 'hold';
    const stMin = (setup.reorderST ?? 50) / 100;
    const gap = setup.markdownGap ?? 2;
    if (isFinite(wos) && wos < weeksLeft && st > stMin) verdict = 'reorder';
    else if (wos - weeksLeft >= gap) verdict = 'markdown';

    const uncovered = isFinite(wos) ? Math.ceil(Math.max(0, weeksLeft - wos) - 1e-9) : 0;
    const cover = Math.max(0, weeksLeft - uncovered);
    const selloutWeek = weeks + cover;
    const excess = isFinite(wos) ? wos - weeksLeft : Infinity;
    const reorderQty = verdict === 'reorder' ? ceilTo(uncovered * ros, casePack) : 0;

    let reason;
    const wk = (n) => `wk ${n}`;
    if (verdict === 'reorder') {
      const before = weeksLeft - cover;
      reason = `Sells out in ${wk(selloutWeek)} at current rate, ${plural(before, 'week')} before season end.`;
    } else if (verdict === 'markdown') {
      reason = !isFinite(wos)
        ? `No sales in ${plural(weeks, 'week')} with ${fmtInt(onHand)} on hand.`
        : `${wos.toFixed(1)} weeks of supply against ${plural(weeksLeft, 'week')} left. ${excess.toFixed(1)} weeks of excess at current rate.`;
    } else if (isFinite(wos) && wos < weeksLeft) {
      reason = `Would sell out in ${wk(selloutWeek)}, but sell-through of ${(st * 100).toFixed(0)}% is under the ${(stMin * 100).toFixed(0)}% reorder bar.`;
    } else {
      reason = `Covers the ${plural(weeksLeft, 'week')} left with ${excess.toFixed(1)} weeks to spare, under the ${gap}-week markdown gap.`;
    }

    return {
      received, landed: landedCost, retail, weeks, sold, onHand, aur, weeksLeft, season,
      st, ros, wos, mmu, imu: initial, aurVsTicket, gm, avgInv, gmroi,
      verdict, reason, uncovered, cover, selloutWeek, excess, reorderQty, casePack,
      ok: received > 0 && weeks > 0 && landedCost > 0 && retail > 0 && isFinite(sold) && isFinite(onHand) && aur > 0,
    };
  }

  // What-if markdown on the remaining units: price off the original ticket,
  // rate of sale lifted by a multiplier the merchant chooses.
  function whatIf(a, off, lift) {
    const price = a.retail * (1 - off);
    const mmu = imu(price, a.landed);
    const ros = a.ros * lift;
    const wos = ros > 0 ? a.onHand / ros : Infinity;
    const clears = isFinite(wos) && wos <= a.weeksLeft;
    const leftover = clears ? 0 : Math.max(0, a.onHand - ros * a.weeksLeft);
    return { price, mmu, ros, wos, clears, leftover, margin: (price - a.landed) * a.onHand };
  }

  // ---- helpers ----
  function num(v) {
    if (v == null || v === '') return NaN;
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v).replace(/[$,%\s]/g, ''));
    return isFinite(n) ? n : NaN;
  }
  const fmtInt = (x) => (isFinite(x) ? Math.round(x).toLocaleString('en-US') : '—');
  const plural = (n, w) => `${isFinite(n) ? (Number.isInteger(n) ? n : n.toFixed(1)) : '—'} ${w}${n === 1 ? '' : 's'}`;

  const MM = { landed, imu, retailForIMU, markupAfterPromo, promoDepth, ladderStep, priceNewItem, assess, whatIf, num, ceilTo, clamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = MM;
  else root.MM = MM;
})(typeof window !== 'undefined' ? window : globalThis);
