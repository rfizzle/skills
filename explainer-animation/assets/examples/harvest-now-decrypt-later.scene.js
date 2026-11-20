/* Harvest now, decrypt later, as a custom scene (--pattern custom --scene): the "deadline that has already started"
   pattern. Encrypted data copied today cannot be read today; if it must stay secret longer than a capable quantum
   computer takes to arrive, it is exposed already. One time axis shows how long each kind of data must stay secret (a
   lane with a bar from now), how long migrating takes (a bracket) and when today's public-key encryption could be broken
   (a window with soft edges, a range and never a date). A playhead sweeps the axis; where it passes into the window the
   part of each bar beyond it turns to the warning colour. The honest ending: migration protects data created from then
   on, not what was already copied. Only the drawing and choreography live here; the stage, chrome, step timing, chip and
   window.anim come from the kit through ctx.

   Story blocks that drive it:  axis      one record  { span, step }          figure keys: the axis length and the label spacing
                                datasets  { id, name, secrecy }               four or five kinds of data; secrecy is a figure key (years)
                                migration one record  { lower, upper }        figure keys: the fastest and slowest migration
                                threat    one record  { earliest, latest }    figure keys: the window, explicitly a range
                                plan      { dataset, completes }              the order data moves; completes is a figure key
   Every number is a figure key in the block and a `figures` entry with a `source`; the scene reads them with ctx.figure.
   Nothing shown is typed: exposure, years, deadlines and counts are computed from the blocks.

   Exposed, safe and already-harvested read without colour: a possible exposure (the part of a bar inside the window) is a
   sparse diagonal hatch with a dashed edge, a certain one (beyond the window's far end) a dense cross hatch with a solid
   edge, protected new data a dotted bar with a numbered badge, the safe lanes a check and the word "Safe", a copy a padlock.

   Pure helpers (no DOM; loaded under Node by scripts/exposure.test.mjs through EXK.exposure):
     ticks(span, step, unit)                  axis labels: "now", then "+5 years" and so on (never a calendar year)
     exposure(dataset, threat)                { exposedEarliest, exposedLatest, yearsEarliest, yearsLatest, kind } for data copied now:
                                              exposed if its secrecy ends after the earliest year; kind 'safe' | 'edge' | 'exposed'
     exposedCount(datasets, threat, end)      how many are exposed at the 'earliest' or the 'latest' end of the window
     lastStart(migration, threat)             { lo, hi }: the last moment to start, earliest arrival minus the slowest
                                              migration, and latest arrival minus the fastest (years from now)
     deadlines(datasets, migration, threat)   per dataset { startBy, passed }: the start that finishes in time for data created
                                              from then on; passed when it is before now
     startNote(exposure, deadline, unit)      { kind, text } the lane's second line: 'safe' "Safe without migrating", 'late' "Already
                                              copied: exposed" (exposed now and the start date has passed), else 'start' "Start within N years"
     afterPlan(datasets, plan, threat)        per dataset { completes, protectedFrom, harvestedExposed }: migration protects what
                                              is created from `completes` on; data already copied is exposed exactly as before
     check(data)                              throws a clear message unless the data tells the story (see below)
     layout(span, step, count, box)           x(year), the label ticks and the lane tops, filling box
   Drawing helpers:
     harvest(ctx, t0, r)   padlocks land at "now" on each lane            sweep(ctx, t0, r)   the playhead; bars turn as it passes
     bracket(ctx, t0, r)   the migration and the last safe start          migrate(ctx, t0, r) the plan: protected new data, in order
   Build-time checks (check): four or five datasets; at least one exposed and one not at the earliest end; one that is on the
   edge (exposed at the earliest end, not at the latest); the window is a range; the plan covers every dataset, longest-lived
   first, each completing inside the migration range; at least one dataset is still exposed after the plan; at least one start
   date has passed and one has not; every figure key in the blocks exists and every figure is used.
   Headline measure, fixed in one place: "Data types exposed if harvested today: N of M" (ctx.count). A second:
   "Years left to start in time", a range from lastStart(). */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};
  EXK.scenes = EXK.scenes || {};

  /* =============================== pure exposure functions =============================== */
  function unitOf(n, unit) { return n === 1 && /s$/.test(unit) ? unit.slice(0, -1) : unit; }
  function ticks(span, step, unit) {
    var out = [];
    for (var at = 0; at <= span + 1e-9; at += step) out.push({ at: at, text: at === 0 ? 'now' : '+' + at + ' ' + unitOf(at, unit) });
    return out;
  }
  function exposure(d, threat) {
    var e = d.secrecy > threat.earliest, l = d.secrecy > threat.latest;
    return {
      id: d.id, exposedEarliest: e, exposedLatest: l,
      yearsEarliest: Math.max(0, d.secrecy - threat.earliest), yearsLatest: Math.max(0, d.secrecy - threat.latest),
      kind: !e ? 'safe' : l ? 'exposed' : 'edge'
    };
  }
  function exposedCount(list, threat, end) {
    return list.filter(function (d) { var x = exposure(d, threat); return end === 'latest' ? x.exposedLatest : x.exposedEarliest; }).length;
  }
  function lastStart(m, threat) { return { lo: threat.earliest - m.upper, hi: threat.latest - m.lower }; }
  /* data created at year s with secrecy L is out of reach at the earliest arrival only if it is protected from s on, so the
     migration for it must finish by earliest - L, and start by that minus the slowest migration */
  function deadlines(list, m, threat) {
    return list.map(function (d) { var s = threat.earliest - d.secrecy - m.upper; return { id: d.id, startBy: s, passed: s < 0 }; });
  }
  /* the second line of a lane, by case: data that stays secret for less than the window needs no migration; data exposed
     whose start date has passed is already lost for what was copied; the rest has a date to start by */
  function startNote(ex, dl, unit) {
    function yrs(n) { return n + ' ' + unitOf(n, unit); }
    if (!ex.exposedEarliest) return { kind: 'safe', text: 'Safe without migrating' };
    if (dl.passed) return { kind: 'late', text: 'Already copied: exposed' };
    return { kind: 'start', text: 'Start within ' + yrs(dl.startBy) };
  }
  function afterPlan(list, plan, threat) {
    var by = {};
    plan.forEach(function (p) { by[p.dataset] = p; });
    return list.map(function (d) {
      var p = by[d.id];
      return { id: d.id, completes: p ? p.completes : null, protectedFrom: p ? p.completes : null, harvestedExposed: exposure(d, threat).exposedEarliest };
    });
  }

  function check(d) {
    function fail(m) { throw new Error('exposure: ' + m); }
    var ds = d.datasets, m = d.migration, th = d.threat, ax = d.axis, plan = d.plan;
    if (!(ds.length === 4 || ds.length === 5)) fail('four or five kinds of data, not ' + ds.length);
    var seen = {};
    ds.forEach(function (x) {
      if (!x.id) fail('every dataset needs an id');
      if (seen[x.id]) fail('duplicate dataset id "' + x.id + '"');
      seen[x.id] = x;
      if (!(x.secrecy > 0)) fail('dataset "' + x.id + '" needs a secrecy lifetime above zero');
      if (x.secrecy > ax.span) fail('dataset "' + x.id + '" must stay secret longer than the axis is long');
    });
    if (!(ax.step > 0) || Math.abs(ax.span / ax.step - Math.round(ax.span / ax.step)) > 1e-9) fail('the axis span must be a whole number of label steps');
    if (!(m.lower > 0 && m.lower <= m.upper)) fail('the migration is a range: lower above zero and not above upper');
    if (!(th.earliest > 0 && th.earliest < th.latest)) fail('the threat is a window: earliest above zero and before latest, not a date');
    if (th.latest > ax.span) fail('the threat window must end inside the axis');
    var ex = ds.map(function (x) { return exposure(x, th); });
    if (!ex.some(function (x) { return x.exposedEarliest; })) fail('at least one dataset must be exposed');
    if (!ex.some(function (x) { return !x.exposedEarliest; })) fail('at least one dataset must not be exposed');
    if (!ex.some(function (x) { return x.kind === 'edge'; })) fail('one dataset must sit on the edge: exposed at the earliest end of the window and not at the latest, so the range matters');
    var ls = lastStart(m, th);
    if (!(ls.lo > 0)) fail('the last safe start is already past; the scene counts the years left, so it needs some');
    var dl = deadlines(ds, m, th);
    if (!dl.some(function (x) { return x.passed; })) fail('at least one start date must have passed');
    if (!dl.some(function (x) { return !x.passed; })) fail('at least one start date must not have passed');
    var pseen = {};
    plan.forEach(function (p, i) {
      var x = seen[p.dataset];
      if (!x) fail('the plan names dataset "' + p.dataset + '", which is not in datasets');
      if (pseen[p.dataset]) fail('the plan names "' + p.dataset + '" twice');
      pseen[p.dataset] = true;
      if (p.completes < m.lower || p.completes > m.upper) fail('"' + p.dataset + '" completes outside the migration range');
      if (i && p.completes < plan[i - 1].completes) fail('plan completion years must not go backwards');
      if (i && x.secrecy > seen[plan[i - 1].dataset].secrecy) fail('the plan must move the longest-lived data first');
    });
    ds.forEach(function (x) { if (!pseen[x.id]) fail('the plan leaves out "' + x.id + '"'); });
    if (!afterPlan(ds, plan, th).some(function (x) { return x.harvestedExposed; })) fail('at least one dataset must stay exposed after the plan: migration cannot protect what was already copied');
  }
  /* x(year) maps the axis onto box.x0..box.x1; lanes are box.pitch apart from box.top */
  function layout(span, step, count, box) {
    var ppy = (box.x1 - box.x0) / span;
    return {
      box: box, ppy: ppy, bottom: box.top + count * box.pitch,
      x: function (y) { return box.x0 + y * ppy; },
      laneTop: function (i) { return box.top + i * box.pitch; },
      ticks: function (unit) { return ticks(span, step, unit); }
    };
  }

  EXK.exposure = { ticks: ticks, exposure: exposure, exposedCount: exposedCount, lastStart: lastStart, deadlines: deadlines, startNote: startNote, afterPlan: afterPlan, check: check, layout: layout, unitOf: unitOf };
  if (typeof document === 'undefined') return;            /* under Node (the unit tests) only the pure helpers are needed */

  /* =============================== the scene =============================== */
  var BOX = { x0: 372, x1: 1856, top: 182, pitch: 78 };    /* area px: the axis and the lanes; the strip above holds the measures */
  var AXIS_Y = 172, BAR_Y = 30, BAR_H = 22, NEW_Y = 57, NEW_H = 14;
  var SWEEP = 0.26;                                        /* seconds the playhead takes per year of the axis */
  var D, W;
  var HALO = { 'paint-order': 'stroke', 'stroke-linejoin': 'round' };

  function ids(list) { return list.map(function (x) { return x.id; }); }
  function byId(list) { var m = {}; list.forEach(function (x) { m[x.id] = x; }); return m; }
  function years(n) { return n + ' ' + unitOf(n, D.unit); }

  /* every number comes from a figure; the blocks hold keys, the scene reads values */
  function derive(ctx) {
    var story = ctx.story, used = {};
    function F(k) { if (typeof k !== 'string') throw new Error('exposure: the blocks hold figure keys, not numbers (got ' + k + ')'); used[k] = true; return ctx.figure(k).value; }
    var ax = ctx.block('axis')[0], mg = ctx.block('migration')[0], th = ctx.block('threat')[0];
    var d = {
      axis: { span: F(ax.span), step: F(ax.step) },
      migration: { lower: F(mg.lower), upper: F(mg.upper) },
      threat: { earliest: F(th.earliest), latest: F(th.latest) },
      datasets: ctx.block('datasets').map(function (x) { return { id: x.id, name: x.name, secrecy: F(x.secrecy) }; }),
      plan: ctx.block('plan').map(function (p) { return { id: p.id, dataset: p.dataset, completes: F(p.completes) }; })
    };
    check(d);
    Object.keys(story.figures).forEach(function (k) { if (k.charAt(0) !== '_' && !used[k]) throw new Error('exposure: figure "' + k + '" is in the story but nothing shows it'); });
    d.keys = { axis: ax, migration: mg, threat: th, datasets: ctx.block('datasets').map(function (x) { return x.secrecy; }), plan: ctx.block('plan').map(function (p) { return p.completes; }) };
    d.unit = ctx.figure(ax.span).unit;
    d.n = d.datasets.length;
    d.ds = byId(d.datasets);
    d.ex = d.datasets.map(function (x) { return exposure(x, d.threat); });
    d.dl = deadlines(d.datasets, d.migration, d.threat);
    d.after = afterPlan(d.datasets, d.plan, d.threat);
    d.last = lastStart(d.migration, d.threat);
    d.nE = exposedCount(d.datasets, d.threat, 'earliest'); d.nL = exposedCount(d.datasets, d.threat, 'latest');
    d.notes = d.datasets.map(function (x, i) { return startNote(d.ex[i], d.dl[i], d.unit); });
    d.nLate = d.notes.filter(function (x) { return x.kind === 'late'; }).length;
    d.nStill = d.after.filter(function (x) { return x.harvestedExposed; }).length;
    d.lay = layout(d.axis.span, d.axis.step, d.n, BOX);
    d.maxSecrecy = Math.max.apply(null, d.datasets.map(function (x) { return x.secrecy; }));
    return d;
  }

  /* opacity and width, tracked per element so every tween starts from where the last one left it (build order is time order) */
  function fade(ctx, el, to, t, dur) {
    var from = el.__v === undefined ? 0 : el.__v;
    if (from === to) return;
    ctx.tl.fromTo(el, { opacity: from }, { opacity: to, duration: dur === undefined ? 0.5 : dur, ease: 'power2.out' }, t);
    el.__v = to;
  }
  function growTo(ctx, el, w, t, dur, ease) {
    var from = el.__w || 0;
    ctx.tl.fromTo(el, { attr: { width: from } }, { attr: { width: w }, duration: dur, ease: ease || 'power2.inOut' }, t);
    el.__w = w;
  }
  function halo(ctx, extra) {
    var a = { stroke: ctx.THEME.bg, 'stroke-width': 6, 'font-size': 22, 'font-weight': 650 };
    for (var k in HALO) a[k] = HALO[k];
    for (var e in extra) a[e] = extra[e];
    return a;
  }
  function checkBadge(ctx, parent, cx, cy, r) {
    ctx.el('circle', { cx: cx, cy: cy, r: r, fill: ctx.THEME.secure, stroke: ctx.THEME.bg, 'stroke-width': 2 }, parent);
    var s = r * 1.4;
    ctx.el('path', { d: 'M' + (cx - s * 0.45) + ',' + cy + ' L' + (cx - s * 0.1) + ',' + (cy + s * 0.38) + ' L' + (cx + s * 0.5) + ',' + (cy - s * 0.4), fill: 'none', stroke: ctx.THEME.bg, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
  }
  function padlock(ctx, parent, cx, cy, color) {
    ctx.el('path', { d: 'M' + (cx - 5) + ',' + (cy - 2) + ' v-4 a5,5 0 0 1 10,0 v4', fill: 'none', stroke: color, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, parent);
    ctx.el('rect', { x: cx - 8, y: cy - 2, width: 16, height: 13, rx: 3, fill: color }, parent);
  }
  function defs(ctx, parent) {
    var C = ctx.THEME, df = ctx.el('defs', {}, parent), p;
    p = ctx.el('pattern', { id: 'hndl-soft', width: 12, height: 12, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, df);
    ctx.el('rect', { width: 12, height: 12, fill: C.danger, 'fill-opacity': 0.12 }, p);
    ctx.el('path', { d: 'M0,6 H12', stroke: C.danger, 'stroke-width': 2.2, 'stroke-opacity': 0.8 }, p);
    p = ctx.el('pattern', { id: 'hndl-hard', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, df);
    ctx.el('rect', { width: 8, height: 8, fill: C.danger, 'fill-opacity': 0.4 }, p);
    ctx.el('path', { d: 'M0,4 H8 M4,0 V8', stroke: C.danger, 'stroke-width': 2.6, 'stroke-opacity': 0.95 }, p);
    p = ctx.el('pattern', { id: 'hndl-safe', width: 10, height: 10, patternUnits: 'userSpaceOnUse' }, df);
    ctx.el('rect', { width: 10, height: 10, fill: C.secure, 'fill-opacity': 0.22 }, p);
    ctx.el('circle', { cx: 5, cy: 5, r: 2.4, fill: C.secure, 'fill-opacity': 0.95 }, p);
    var g = ctx.el('linearGradient', { id: 'hndl-band', x1: 0, y1: 0, x2: 1, y2: 0 }, df);
    [[0, 0], [0.14, 0.26], [0.86, 0.26], [1, 0]].forEach(function (s) { ctx.el('stop', { offset: s[0], 'stop-color': C.danger, 'stop-opacity': s[1] }, g); });
  }

  /* ---- the legend: one row of marks (hud.legend, direction row), each shown by the step that needs it ---- */
  function legend(ctx) {
    var C = ctx.THEME, area = ctx.area;
    function box(g, b, fill, stroke, dash) { ctx.el('rect', { x: 0, y: 3, width: b.w, height: b.h - 6, rx: 5, fill: fill, stroke: stroke, 'stroke-width': 2.5, 'stroke-dasharray': dash || 'none' }, g); }
    var rows = [
      { label: 'Copied today', staged: true, swatch: function (g, b) { padlock(ctx, g, b.w / 2, b.h / 2 - 4, C.muted); } },
      { label: 'Must stay secret', staged: true, swatch: function (g, b) { box(g, b, C.accent, C.accent); g.firstChild.setAttribute('fill-opacity', 0.38); } },
      { label: 'Exposed if it arrives early', staged: true, swatch: function (g, b) { box(g, b, 'url(#hndl-soft)', C.danger, '6 4'); } },
      { label: 'Exposed whenever it arrives', staged: true, swatch: function (g, b) { box(g, b, 'url(#hndl-hard)', C.danger); } },
      { label: 'New data protected', staged: true, swatch: function (g, b) { box(g, b, 'url(#hndl-safe)', C.secure); } }
    ];
    W.leg = ctx.hud.legend(rows, { direction: 'row', rect: { x: 28, y: area.y + area.h - 58, w: 1864, h: 52 }, gap: 36 });
  }

  /* ---- build: the whole picture in its empty look, every part hidden until its step ---- */
  function build(ctx) {
    D = derive(ctx);
    var C = ctx.THEME, el = ctx.el, lay = D.lay, X = lay.x, th = D.threat, S = ctx.text.add;
    W = { lanes: [], leg: null };
    W.root = el('g', {}, ctx.layers.world);
    defs(ctx, W.root);
    var L = {};
    ['bg', 'band', 'lanes', 'play', 'fx', 'labels'].forEach(function (n) { L[n] = el('g', {}, W.root); });
    W.L = L;
    var bottom = lay.bottom, x0 = BOX.x0, x1 = BOX.x1;

    /* the axis: a line, a label at each step and a faint grid down the lanes; "now" is drawn heavier */
    W.axis = el('g', { opacity: 0 }, L.bg); W.axis.__v = 0;
    el('path', { d: 'M' + x0 + ',' + AXIS_Y + ' H' + (x1 + 10), stroke: '#46536f', 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }, W.axis);
    el('path', { d: 'M' + (x1 + 6) + ',' + (AXIS_Y - 7) + ' L' + (x1 + 18) + ',' + AXIS_Y + ' L' + (x1 + 6) + ',' + (AXIS_Y + 7) + ' Z', fill: '#46536f' }, W.axis);
    lay.ticks(D.unit).forEach(function (tk) {
      var x = X(tk.at);
      el('path', { d: 'M' + x + ',' + (AXIS_Y - 6) + ' V' + (AXIS_Y + 6), stroke: '#46536f', 'stroke-width': 3, fill: 'none' }, W.axis);
      if (tk.at > 0) el('path', { d: 'M' + x + ',' + (AXIS_Y + 8) + ' V' + (bottom + 2), stroke: C.line, 'stroke-width': 2, 'stroke-dasharray': '3 9', fill: 'none' }, W.axis);
      S(W.axis, tk.text, { x: x, y: AXIS_Y - 14, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': tk.at === 0 ? 750 : 500, fill: tk.at === 0 ? C.text : C.muted }, 'tick:' + tk.at).keep();
    });
    el('path', { d: 'M' + x0 + ',' + (AXIS_Y + 8) + ' V' + (bottom + 2), stroke: C.text, 'stroke-width': 3.5, 'stroke-opacity': 0.8, fill: 'none' }, W.axis);

    /* lanes: a backing row, the lane's own shapes (one group that emphasis can dim) and its texts */
    D.datasets.forEach(function (d, i) {
      var T = lay.laneTop(i), ex = D.ex[i], dl = D.dl[i], af = D.after[i], cy = T + BAR_Y + BAR_H / 2, ln = { T: T, cy: cy };
      var bg = el('rect', { x: 28, y: T + 2, width: x1 + 30 - 28, height: BOX.pitch - 4, rx: 12, fill: i % 2 ? '#0f1522' : C.panel, 'fill-opacity': i % 2 ? 0.5 : 0.6, opacity: 0 }, L.bg);
      bg.__v = 0; ln.bg = bg;
      var g = el('g', {}, L.lanes);
      ln.track = el('path', { d: 'M' + x0 + ',' + cy + ' H' + x1, stroke: C.line, 'stroke-width': 2, 'stroke-dasharray': '2 8', 'stroke-linecap': 'round', fill: 'none', opacity: 0 }, g); ln.track.__v = 0;
      var bw = (d.secrecy) * lay.ppy;
      ln.base = el('rect', { x: x0, y: T + BAR_Y, width: 0, height: BAR_H, rx: 6, fill: C.accent, 'fill-opacity': 0.38, stroke: C.accent, 'stroke-width': 2.5 }, g);
      ln.bw = bw;
      if (ex.exposedEarliest) {
        var pe = X(th.earliest), pw = (Math.min(d.secrecy, th.latest) - th.earliest) * lay.ppy;
        ln.possible = el('rect', { x: pe, y: T + BAR_Y, width: 0, height: BAR_H, rx: 3, fill: 'url(#hndl-soft)', stroke: C.danger, 'stroke-width': 2.5, 'stroke-dasharray': '7 4' }, g);
        ln.pw = pw;
        if (ex.exposedLatest) {
          ln.certain = el('rect', { x: X(th.latest), y: T + BAR_Y, width: 0, height: BAR_H, rx: 3, fill: 'url(#hndl-hard)', stroke: C.danger, 'stroke-width': 3.5 }, g);
          ln.cw = (d.secrecy - th.latest) * lay.ppy;
        }
      }
      ln.lock = el('g', { opacity: 0 }, g); ln.lock.__v = 0;
      padlock(ctx, ln.lock, x0 + 15, cy - 3, C.text);
      ln.pulse = el('circle', { cx: x0 + 15, cy: cy, r: 8, fill: 'none', stroke: C.muted, 'stroke-width': 3, opacity: 0 }, g);
      if (!ex.exposedEarliest) { ln.safe = el('g', { opacity: 0 }, g); ln.safe.__v = 0; checkBadge(ctx, ln.safe, X(d.secrecy) + 20, cy, 11); }
      var c0 = X(af.completes), c1 = Math.min(X(af.completes + d.secrecy), x1);
      ln.newX = c0; ln.neww = c1 - c0;
      ln.newbar = el('rect', { x: c0, y: T + NEW_Y, width: 0, height: NEW_H, rx: 5, fill: 'url(#hndl-safe)', stroke: C.secure, 'stroke-width': 2.5 }, g);
      ln.badge = el('g', { opacity: 0 }, g); ln.badge.__v = 0;
      el('circle', { cx: c0, cy: T + NEW_Y + NEW_H / 2, r: 13, fill: C.secure, stroke: C.bg, 'stroke-width': 2.5 }, ln.badge);
      S(ln.badge, String(D.plan.map(function (p) { return p.dataset; }).indexOf(d.id) + 1), { x: c0, y: T + NEW_Y + NEW_H / 2 + 6, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, fill: C.bg }, 'order:' + d.id).keep();
      ln.ring = el('rect', { x: x0 - 5, y: T + BAR_Y - 4, width: bw + 10, height: BAR_H + 8, rx: 9, fill: 'none', stroke: C.danger, 'stroke-width': 3.5, opacity: 0 }, L.fx); ln.ring.__v = 0;
      ln.grp = ctx.group([g], 'lane:' + d.id);

      function tg(str, key, attrs) { var gg = el('g', { opacity: 0 }, L.labels); gg.__v = 0; return { g: gg, text: S(gg, str, attrs, key) }; }
      ln.name = tg(d.name, 'lane:' + d.id, halo(ctx, { x: 44, y: T + 38, 'font-size': 24, 'font-weight': 700, fill: C.text }));
      ln.secret = tg('Secret for ' + years(d.secrecy), 'secret:' + d.id, { x: x0 + 10, y: T + 19, 'font-size': 21, 'font-weight': 600, fill: C.muted });
      var lo = ex.yearsLatest, hi = ex.yearsEarliest;
      ln.exp = ex.exposedEarliest ? tg(lo === 0 ? 'Exposed up to ' + years(hi) : 'Exposed ' + lo + ' to ' + years(hi), 'exposed:' + d.id, { x: x0 + 10, y: T + 19, 'font-size': 21, 'font-weight': 700, fill: C.danger })
        : tg('Safe: secret ends before the window', 'safe:' + d.id, { x: x0 + 10, y: T + 19, 'font-size': 21, 'font-weight': 700, fill: C.secure });
      var note = D.notes[i];
      ln.dl = tg(note.text, 'start:' + d.id, { x: 44, y: T + 64, 'font-size': 20, 'font-weight': 600, fill: note.kind === 'late' ? C.danger : note.kind === 'safe' ? C.secure : C.muted });
      W.lanes.push(ln);
    });

    /* the threat window: a soft band, dashed edges, and a label that says it is a range */
    var xe = X(th.earliest), xl = X(th.latest), BY0 = AXIS_Y + 6;
    W.band = el('g', { opacity: 0 }, L.band); W.band.__v = 0;
    el('rect', { x: xe - 34, y: BY0, width: xl - xe + 68, height: bottom - BY0 + 2, fill: 'url(#hndl-band)' }, W.band);
    [xe, xl].forEach(function (x) { el('path', { d: 'M' + x + ',' + BY0 + ' V' + (bottom + 28), stroke: C.danger, 'stroke-width': 3, 'stroke-dasharray': '10 7', fill: 'none' }, W.band); });
    var lab = { 'font-size': 22, 'font-weight': 700, fill: C.danger };
    function bt(str, key, attrs) { var a = {}; for (var k in lab) a[k] = lab[k]; for (var q in attrs) a[q] = attrs[q]; return S(W.band, str, halo(ctx, a), key).keep(); }
    bt('Earliest, ' + years(th.earliest).replace(/^/, '+'), 'band-early', { x: xe - 10, y: bottom + 22, 'text-anchor': 'end' });
    bt('Latest, ' + years(th.latest).replace(/^/, '+'), 'band-late', { x: xl + 10, y: bottom + 22, 'text-anchor': 'start' });
    bt('A range, not a date', 'band-range', { x: (xe + xl) / 2, y: bottom + 22, 'text-anchor': 'middle', fill: C.text, 'font-size': 23 });

    /* the migration: a bracket ending at the earliest arrival, the last safe start marked where it begins */
    var yb = bottom + 66, xs = X(D.last.lo), xf = X(th.earliest - D.migration.lower);
    W.mig = el('g', { opacity: 0 }, L.fx); W.mig.__v = 0;
    el('path', { d: 'M' + xs + ',' + (bottom + 2) + ' V' + (yb + 8), stroke: C.identity, 'stroke-width': 3.5, 'stroke-dasharray': '10 7', fill: 'none' }, W.mig);
    W.slow = el('rect', { x: xe, y: yb - 5, width: 0, height: 10, rx: 4, fill: C.identity, 'fill-opacity': 0.3, stroke: C.identity, 'stroke-width': 2.5, 'stroke-dasharray': '6 4' }, W.mig);
    W.fast = el('rect', { x: xe, y: yb - 5, width: 0, height: 10, rx: 4, fill: C.identity }, W.mig);
    [xs, xe].forEach(function (x) { el('path', { d: 'M' + x + ',' + (yb - 13) + ' V' + (yb + 13), stroke: C.identity, 'stroke-width': 4, 'stroke-linecap': 'round' }, W.mig); });
    W.slowW = xe - xs; W.fastW = xe - xf; W.xe = xe;
    S(W.mig, 'Migration takes ' + D.migration.lower + ' to ' + years(D.migration.upper), halo(ctx, { x: (xs + xe) / 2, y: yb - 16, 'text-anchor': 'middle', fill: C.identity, 'font-weight': 700 }), 'mig-label').keep();
    S(W.mig, 'Last safe start, +' + years(D.last.lo), halo(ctx, { x: xs - 12, y: yb + 8, 'text-anchor': 'end', fill: C.text, 'font-weight': 700 }), 'mig-start').keep();

    /* the harvest: copies are taken at "now" on every lane (padlocks, a quiet pulse) */
    W.ph = el('g', { opacity: 0, transform: 'translate(' + X(0) + ',0)' }, L.play); W.ph.__v = 0;
    el('path', { d: 'M0,' + (AXIS_Y + 6) + ' V' + (bottom + 2), stroke: C.token, 'stroke-width': 4.5, 'stroke-linecap': 'round', opacity: 0.95 }, W.ph);
    el('path', { d: 'M-13,' + (AXIS_Y - 4) + ' L13,' + (AXIS_Y - 4) + ' L0,' + (AXIS_Y + 14) + ' Z', fill: C.token }, W.ph);

    /* fixed panels: the headline, the range of years left, the caption, the legend (hidden until a step shows them) */
    var ay = ctx.area.y;
    W.m1 = ctx.hud.measure({ label: 'Data types exposed if harvested today', value: ctx.count(0, D.n), color: C.danger, rect: { x: 28, y: ay + 8, w: 500, h: 118 } });
    W.m2p = ctx.hud.panel({ x: 548, y: ay + 8, w: 470, h: 118 });
    S(W.m2p.body, 'Years left to start in time', { x: 18, y: 36, 'font-size': 22, 'font-weight': 600, fill: C.muted }, 'm2-label').keep();
    function fmt2(a, b) { return Math.round(a) + ' to ' + Math.round(b) + ' ' + D.unit; }
    W.m2fmt = fmt2;
    W.m2v = S(W.m2p.body, fmt2(0, 0), { x: 18, y: 98, 'font-size': 54, 'font-weight': 750, fill: C.text }, 'm2-value').keep();
    W.m2proxy = { a: 0, b: 0 };
    W.cap = ctx.hud.caption({ x: 1038, y: ay + 8, w: 854, h: 118 });
    legend(ctx);
  }

  /* ---- choreography ---- */
  function laneItems(idx) {
    var out = [];
    idx.forEach(function (i) { var l = W.lanes[i]; out.push(l.name.text, l.secret.text, l.exp.text, l.dl.text, l.grp); });
    return out;
  }
  function allIdx() { return D.datasets.map(function (d, i) { return i; }); }
  function figs(ctx, keys, t) { keys.forEach(function (k) { ctx.figure(k).shown(t, Infinity); }); }

  /* harvest: a padlock lands at "now" on each lane, with a quiet pulse; nothing can be read yet */
  function harvest(ctx, t0, r) {
    W.lanes.forEach(function (ln, i) {
      var t = t0 + r + 0.35 * i;
      fade(ctx, ln.lock, 1, t, 0.4);
      ctx.tl.fromTo(ln.pulse, { opacity: 0.8, attr: { r: 8 } }, { opacity: 0, attr: { r: 24 }, duration: 1.1, ease: 'power1.out' }, t + 0.1);
    });
    W.leg.rows[0].show(t0 + r, 0.5);
    return r + 0.35 * (D.n - 1) + 1.2;
  }

  /* the playhead sweeps from now; where it passes into the window the part of each bar beyond it turns */
  function sweep(ctx, t0, r) {
    var th = D.threat, ppy = D.lay.ppy, tS = t0 + r, X = D.lay.x, end = D.maxSecrecy;
    fade(ctx, W.ph, 1, tS - 0.5, 0.5);
    ctx.tl.fromTo(W.ph, { x: X(0) }, { x: X(end), duration: end * SWEEP, ease: 'none' }, tS);
    W.lanes.forEach(function (ln, i) {
      var d = D.datasets[i];
      if (ln.possible) growTo(ctx, ln.possible, ln.pw, tS + th.earliest * SWEEP, (Math.min(d.secrecy, th.latest) - th.earliest) * SWEEP, 'none');
      if (ln.certain) growTo(ctx, ln.certain, ln.cw, tS + th.latest * SWEEP, (d.secrecy - th.latest) * SWEEP, 'none');
    });
    var tIn = tS + th.earliest * SWEEP, tOut = tS + th.latest * SWEEP, tEnd = tS + end * SWEEP;
    W.m1.to(ctx.count(D.nE, D.n), tIn + 0.3, ctx.timing.QUANTITY_MIN);
    fade(ctx, W.ph, 0, tEnd + 0.3, 0.6);
    return { tIn: tIn, tOut: tOut, end: tEnd + 0.9 - t0 };
  }

  /* migration: a bracket ending at the earliest arrival; its start is the last safe start; each start date is read */
  function bracket(ctx, t0, r) {
    var tb = t0 + r, Q = ctx.timing.QUANTITY_MIN;
    fade(ctx, W.mig, 1, tb, 0.5);
    ctx.tl.fromTo(W.slow, { attr: { x: W.xe, width: 0 } }, { attr: { x: W.xe - W.slowW, width: W.slowW }, duration: Q + 0.6, ease: 'power2.inOut' }, tb + 0.2);
    ctx.tl.fromTo(W.fast, { attr: { x: W.xe, width: 0 } }, { attr: { x: W.xe - W.fastW, width: W.fastW }, duration: Q + 0.2, ease: 'power2.inOut' }, tb + 0.2);
    W.m2p.show(tb, 0.5);
    ctx.tl.fromTo(W.m2proxy, { a: 0, b: 0 }, { a: D.last.lo, b: D.last.hi, duration: Q + 0.8, ease: 'power2.inOut', onUpdate: function () { W.m2v.el.textContent = W.m2fmt(W.m2proxy.a, W.m2proxy.b); } }, tb + 0.6);
    return { end: r + Q + 1.2 };
  }

  /* plan: data moves in the order the story gives; new data in each lane is protected from its year on, the copies stay */
  function migrate(ctx, t0, r) {
    var Q = ctx.timing.QUANTITY_MIN, end = r;
    W.leg.rows[4].show(t0 + r, 0.5);
    D.plan.forEach(function (p, n) {
      var i = ids(D.datasets).indexOf(p.dataset), ln = W.lanes[i], tn = t0 + r + 0.4 + n * 1.0;
      fade(ctx, ln.badge, 1, tn, 0.4);
      growTo(ctx, ln.newbar, ln.neww, tn + 0.2, Q + 0.2);
      end = r + 0.4 + n * 1.0 + 0.2 + Q + 0.2;
    });
    return { end: end };
  }

  var ACT = {
    today: function (ctx, st, t0) {
      var C = ctx.THEME;
      fade(ctx, W.axis, 1, t0 + 0.3, 0.6);
      W.lanes.forEach(function (ln, i) {
        fade(ctx, ln.bg, 1, t0 + 0.4 + i * 0.12, 0.4); fade(ctx, ln.name.g, 1, t0 + 0.5 + i * 0.12, 0.4); fade(ctx, ln.track, 1, t0 + 0.6 + i * 0.12, 0.4);
      });
      figs(ctx, [D.keys.axis.span, D.keys.axis.step], t0 + 0.3);
      var tEnd = harvest(ctx, t0, 1.6);
      W.leg.show(t0 + 1.4, 0.5);
      var c = W.cap.say('Copies are taken and held. None can be read yet.', t0 + 1.8, { head: 'Copied today', last: true });
      return { end: Math.max(tEnd, c.visible - t0), first: 0.3, hold: c.hold };
    },
    secret: function (ctx, st, t0) {
      var Q = ctx.timing.QUANTITY_MIN, end = 0;
      W.leg.rows[1].show(t0 + 0.5, 0.5);
      W.lanes.forEach(function (ln, i) {
        var t = t0 + 0.6 + i * 0.5;
        growTo(ctx, ln.base, ln.bw, t, Q + 0.4);
        fade(ctx, ln.secret.g, 1, t + 0.3, 0.5);
        ctx.figure(D.keys.datasets[i]).shown(t, Infinity);
        end = 0.6 + i * 0.5 + Q + 0.4;
      });
      var c = W.cap.say('Card numbers fade fast. Health records and keys last.', t0 + end - 0.6, { head: 'How long each kind must stay secret', last: true });
      return { end: Math.max(end, c.visible - t0), first: 0.6, hold: c.hold };
    },
    arrives: function (ctx, st, t0) {
      var th = D.keys.threat, C = ctx.THEME;
      fade(ctx, W.band, 1, t0 + 0.4, 1.0);
      figs(ctx, [th.earliest, th.latest], t0 + 0.4);
      W.m1.show(t0 + 0.5, 0.5);
      W.leg.rows[2].show(t0 + 1.2, 0.5); W.leg.rows[3].show(t0 + 1.2, 0.5);
      var a = W.cap.say('A capable machine could arrive anywhere inside this band', t0 + 0.6, { head: 'A window, not a date' });
      var sw = sweep(ctx, t0, 1.6);
      var tb = Math.max(a.readyAt, sw.tOut + 0.4);
      W.lanes.forEach(function (ln) { fade(ctx, ln.secret.g, 0, tb - 0.4, 0.35); fade(ctx, ln.exp.g, 1, tb, 0.5); if (ln.safe) fade(ctx, ln.safe, 1, tb, 0.5); });
      var text = ctx.count(D.nE, D.n).text + ' exposed at the earliest end, ' + ctx.count(D.nL, D.n).text + ' at the latest end';
      var b = W.cap.say(text, tb + 0.1, { head: 'What is exposed', last: true });
      return { end: Math.max(sw.end, b.visible - t0), first: 0.4, hold: b.hold };
    },
    start: function (ctx, st, t0) {
      var th = D.keys.migration;
      figs(ctx, [th.lower, th.upper], t0 + 0.4);
      var a = W.cap.say('Migration has to finish before the earliest arrival', t0 + 0.5, { head: 'The last safe start' });
      var br = bracket(ctx, t0, 0.6);
      var tb = Math.max(a.readyAt, t0 + br.end + 0.2);
      W.lanes.forEach(function (ln, i) { fade(ctx, ln.dl.g, 1, tb + 0.35 * i, 0.5); });
      var text = ctx.count(D.nLate, D.n).text + ' kinds of data are already past their start date';
      var b = W.cap.say(text, tb, { head: 'Already late', last: true });
      return { end: Math.max(tb - t0 + 0.35 * (D.n - 1) + 0.5, b.visible - t0), first: 0.4, hold: b.hold };
    },
    plan: function (ctx, st, t0) {
      figs(ctx, D.keys.plan, t0 + 0.4);
      var a = W.cap.say('Longest-lived data moves first, one lane at a time', t0 + 0.4, { head: 'The order of migration' });
      var m = migrate(ctx, t0, 0.6);
      var tb = Math.max(a.readyAt, t0 + m.end + 0.3);
      var text = ctx.count(D.nStill, D.n).text + ' kinds already copied stay exposed';
      W.lanes.forEach(function (ln, i) { if (D.after[i].harvestedExposed) fade(ctx, ln.ring, 1, tb + 0.3, 0.4); });
      ctx.atStepEnd(function (e) { W.lanes.forEach(function (ln) { if (ln.ring.__v) fade(ctx, ln.ring, 0, e.t, 0.4); }); });
      var b = W.cap.say(text, tb, { head: 'New data is safe from then on', last: true });
      return { end: Math.max(tb - t0 + 4.0, b.visible - t0), first: 0.4, hold: b.hold };
    },
    ask: function (ctx, st, t0) {
      var first = ids(D.datasets).indexOf(D.plan[0].dataset), ln = W.lanes[first];
      fade(ctx, ln.ring, 1, t0 + 0.6, 0.5);
      var text = D.datasets[first].name + ' first, then work down the list';
      var c = W.cap.say(text, t0 + 0.8, { head: 'Start with the longest-lived data', last: true });
      W.m2p.border(ctx.THEME.identity, t0 + 0.8);
      return { end: Math.max(1.4, c.visible - t0), first: 0.6, hold: c.hold };
    }
  };

  /* what the step is about stays at full, the rest dims */
  function active(st) {
    if (st.act === 'arrives') return laneItems(allIdx().filter(function (i) { return D.ex[i].exposedEarliest; }));
    if (st.act === 'ask') return laneItems([ids(D.datasets).indexOf(D.plan[0].dataset)]);
    return 'all';
  }

  EXK.scenes.exposure = {
    build: build,
    step: function (ctx, st, t0) {
      ctx.emphasise(active(st), t0 + 0.1);
      var r = ACT[st.act](ctx, st, t0);
      return { end: r.end, firstMotion: r.first, hold: r.hold };
    }
  };
})();
