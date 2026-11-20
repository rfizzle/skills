/* Roadmap with risk burn-down, as a custom scene (--pattern custom --scene). Only the roadmap's own drawing and
   choreography live here; the stage, chrome, step timing, chip and window.anim come from the kit through ctx.
   Time is the scene: initiatives sit in lanes on a time axis, a playhead sweeps it one horizon per step, a bar fills as
   the playhead crosses it, and when it lands a thin link flashes to the risks it reduces and those bars shrink, leaving a
   ghost of where they started. The headline counts the risks still above appetite.
   Reads the story's blocks horizons, lanes, initiatives, risks, dependencies and its figures; steps carry `act`
   (baseline, sweep with `horizon`, dependencies, remains). Every number comes from ctx.figure; counts from ctx.count. */
(function () {
  'use strict';
  var EXK = window.EXK;
  var GX0 = 262, UNIT = 330, LANE_T0 = 112, LANE_P = 144, BAR_Y = 46, BAR_H = 40, DEP_GAP = 106, LINK_GAP = 122;   /* area px */
  var PANEL = { x: 1274, y: 142, w: 626, h: 570 }, GUTTER_X = 1262;                                              /* risk panel, area px */
  var TRK = 36, PX = 5.2, ROW0 = 54, ROW_P = 102;                                                                 /* inside the panel */
  var SWEEP = 3.0;          /* seconds the playhead takes per horizon unit (110 px/s) */
  var D, W;                 /* derived data, drawn parts */

  function byId(list) { var m = {}; list.forEach(function (x) { m[x.id] = x; }); return m; }
  function X(p) { return GX0 + p * UNIT; }
  function laneTop(b) { return LANE_T0 + D.laneIx[b.lane] * LANE_P; }
  function barGeo(b) { var T = laneTop(b), y0 = T + BAR_Y; return { x0: X(b.start), x1: X(b.end), y0: y0, y1: y0 + BAR_H, mid: y0 + BAR_H / 2, T: T }; }
  function trackMid(riskId) { return PANEL.y + ROW0 + D.risks.indexOf(D.risk[riskId]) * ROW_P + 57; }
  function roundedPath(pts, r) {
    var d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (var i = 1; i < pts.length - 1; i++) {
      var p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
      var l1 = Math.abs(p1[0] - p0[0]) + Math.abs(p1[1] - p0[1]), l2 = Math.abs(p2[0] - p1[0]) + Math.abs(p2[1] - p1[1]);
      var rr = Math.min(r, l1 / 2, l2 / 2);
      d += ' L' + (p1[0] - Math.sign(p1[0] - p0[0]) * rr) + ',' + (p1[1] - Math.sign(p1[1] - p0[1]) * rr) +
        ' Q' + p1[0] + ',' + p1[1] + ' ' + (p1[0] + Math.sign(p2[0] - p1[0]) * rr) + ',' + (p1[1] + Math.sign(p2[1] - p1[1]) * rr);
    }
    var q = pts[pts.length - 1];
    return d + ' L' + q[0] + ',' + q[1];
  }
  /* dependency route: direct (same lane), under (a bar in the way), or up / down between lanes */
  function routeDep(d) {
    var a = D.init[d.from], b = D.init[d.to], ga = barGeo(a), gb = barGeo(b);
    if (a.lane === b.lane) {
      var blocked = D.inits.some(function (o) { return o.lane === a.lane && o !== a && o !== b && o.start < b.start && o.end > a.end; });
      if (!blocked) return [[ga.x1, ga.mid], [gb.x0 - 3, gb.mid]];
      var yy = ga.T + DEP_GAP;
      return [[ga.x1 - 28, ga.y1], [ga.x1 - 28, yy], [gb.x0 + 28, yy], [gb.x0 + 28, gb.y1 + 3]];
    }
    var xv = gb.x0 + 28, below = D.laneIx[b.lane] > D.laneIx[a.lane];
    return [[ga.x1, ga.mid], [xv, ga.mid], [xv, below ? gb.y0 - 3 : gb.y1 + 3]];
  }

  /* what the story says, computed once: landing order, values after each landing, counts above appetite */
  function derive(ctx) {
    var d = { horizons: ctx.block('horizons'), lanes: ctx.block('lanes'), inits: ctx.block('initiatives'), risks: ctx.block('risks'), deps: ctx.block('dependencies') };
    d.F = function (k) { return ctx.figure(k).value; };
    d.hz = byId(d.horizons); d.init = byId(d.inits); d.risk = byId(d.risks); d.laneIx = {};
    d.lanes.forEach(function (l, i) { d.laneIx[l.id] = i; });
    d.deps.forEach(function (x) {
      if (d.init[x.to].start < d.init[x.from].end - 1e-9) throw new Error('dependency violated: ' + x.to + ' starts before ' + x.from + ' ends');
    });
    d.landings = d.inits.slice().sort(function (p, q) { return p.end - q.end; });
    d.above = function (vals) { return d.risks.filter(function (r) { return vals[r.id] > d.F(r.appetite) + 1e-9; }).length; };
    d.val0 = {}; d.risks.forEach(function (r) { d.val0[r.id] = d.F(r.start); });
    var end = {}; for (var k in d.val0) end[k] = d.val0[k];
    d.landings.forEach(function (i) { i.reduces.forEach(function (x) { end[x.risk] -= d.F(x.by); }); });
    d.remain = d.risks.filter(function (r) { return end[r.id] > d.F(r.appetite); });
    if (!d.remain.length) throw new Error('every risk ends below appetite; this scene ends on what remains, so the story needs one that does not');
    return d;
  }

  function build(ctx) {
    D = derive(ctx);
    var C = ctx.THEME, el = ctx.el, add = ctx.text.add, F = D.F;
    var rm = el('g', { opacity: 0 }, ctx.layers.world), L = {};
    ['bg', 'shapes', 'deps', 'play', 'labels'].forEach(function (n) { L[n] = el('g', {}, rm); });
    W = { rm: rm, hz: {}, lane: {}, bar: {}, dep: [], risk: {} };
    function label(parent, s, key, x, y, size, weight, extra) {
      var a = { x: x, y: y, 'font-size': size, 'font-weight': weight };
      for (var k in extra) a[k] = extra[k];
      return add(parent, s, a, key);
    }

    /* horizon headers, grid, axis */
    D.horizons.forEach(function (h, k) {
      var x = X(h.from), span = ctx.figure(h.span), mid = { 'text-anchor': 'middle' };
      el('rect', { x: x + 4, y: 8, width: UNIT - 8, height: 90, rx: 14, fill: C.panel, stroke: C.line, 'stroke-width': 2.5 }, L.bg);
      W.hz[h.id] = [label(L.labels, h.name, 'horizon:' + h.id, x + UNIT / 2, 46, 32, 750, mid),
        label(L.labels, span.value + ' ' + span.unit, 'span:' + h.id, x + UNIT / 2, 79, 22, 500, { 'text-anchor': 'middle', fill: C.muted })];
    });
    var xe = X(D.horizons.length);
    for (var k = 0; k <= D.horizons.length; k++) el('path', { d: 'M' + X(k) + ',108 V' + (LANE_T0 + D.lanes.length * LANE_P - 2), stroke: C.line, 'stroke-width': 2.5, 'stroke-dasharray': '4 8', fill: 'none' }, L.bg);
    el('path', { d: 'M' + GX0 + ',104 H' + (xe + 8), stroke: '#46536f', 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }, L.bg);
    el('path', { d: 'M' + (xe + 4) + ',97 L' + (xe + 16) + ',104 L' + (xe + 4) + ',111 Z', fill: '#46536f' }, L.bg);
    D.lanes.forEach(function (ln, i) {
      var T = LANE_T0 + i * LANE_P;
      el('rect', { x: 28, y: T + 2, width: xe - 28, height: LANE_P - 4, rx: 14, fill: i % 2 ? '#0f1522' : C.panel, 'fill-opacity': i % 2 ? 0.7 : 0.8 }, L.bg);
      W.lane[ln.id] = ln.lines.map(function (s, j) { return label(L.labels, s, 'lane:' + ln.id + j, 44, ln.lines.length === 1 ? T + 72 : T + 54 + j * 36, 26, 650); });
    });
    /* bars: outlined while planned, filled by the playhead, a check when done */
    D.inits.forEach(function (b) {
      var g = barGeo(b), bw = g.x1 - g.x0, fg = el('g', {}, L.shapes);
      var out = el('rect', { x: g.x0, y: g.y0, width: bw, height: BAR_H, rx: 11, fill: C.panel, stroke: '#6a7ba3', 'stroke-width': 3 }, fg);
      var fill = el('rect', { x: g.x0 + 1.5, y: g.y0 + 1.5, width: 0, height: BAR_H - 3, rx: 9.5, fill: C.accent }, fg);
      var chk = el('g', { opacity: 0, transform: 'scale(0)' }, el('g', { transform: 'translate(' + (g.x1 - 22) + ',' + g.mid + ')' }, fg));
      el('circle', { cx: 0, cy: 0, r: 15, fill: C.secure, stroke: C.bg, 'stroke-width': 3.5 }, chk);
      el('path', { d: 'M-7,0 L-2,5 L7,-5', fill: 'none', stroke: C.bg, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, chk);
      W.bar[b.id] = { g: g, out: out, fill: fill, chk: chk, bw: bw - 3, lab: label(L.labels, b.name, 'bar:' + b.id, g.x0, g.y0 - 11, 24, 650).also(fg) };
    });
    /* dependency arrows, drawn by the step about dependencies */
    D.deps.forEach(function (d) {
      var pts = routeDep(d), n = pts.length, p = pts[n - 1], q = pts[n - 2], dx = Math.sign(p[0] - q[0]), dy = Math.sign(p[1] - q[1]);
      var base = [p[0] - dx * 17, p[1] - dy * 17], hw = 9, g = el('g', { opacity: 0 }, L.deps);
      W.dep.push({ d: d, g: g,
        line: el('path', { d: roundedPath(pts.slice(0, n - 1).concat([base]), 12), fill: 'none', stroke: C.identity, 'stroke-width': 4.5, 'stroke-linecap': 'round' }, g),
        head: el('path', { d: 'M' + p[0] + ',' + p[1] + ' L' + (base[0] + dy * hw) + ',' + (base[1] + dx * hw) + ' L' + (base[0] - dy * hw) + ',' + (base[1] - dx * hw) + ' Z', fill: C.identity }, g) });
    });
    W.ph = el('g', { opacity: 0, transform: 'translate(' + X(0) + ',0)' }, L.play);
    el('path', { d: 'M0,104 V' + (LANE_T0 + D.lanes.length * LANE_P - 4), stroke: C.token, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.9 }, W.ph);
    el('path', { d: 'M-13,86 L13,86 L0,106 Z', fill: C.token }, W.ph);

    /* the risk panel and the headline, on the kit's HUD */
    W.panel = ctx.hud.panel({ x: PANEL.x, y: ctx.area.y + PANEL.y, w: PANEL.w, h: PANEL.h });
    var body = W.panel.body;
    label(body, 'Exposure index, out of ' + F('scale'), 'panel-head', TRK, 38, 22, 600, { fill: C.muted }).keep();
    label(body, 'Appetite', 'panel-appetite', 494, 38, 22, 600, { fill: C.muted }).keep();
    el('path', { d: 'M478,18 V46', stroke: C.text, 'stroke-width': 4, 'stroke-linecap': 'round' }, body);
    D.risks.forEach(function (r, i) {
      var R = ROW0 + i * ROW_P, g = el('g', {}, body), ap = F(r.appetite);
      var hi = el('rect', { x: 10, y: R - 4, width: PANEL.w - 20, height: 92, rx: 14, fill: C.danger, 'fill-opacity': 0.08, stroke: C.danger, 'stroke-width': 3, opacity: 0 }, g);
      var name = label(g, r.name, 'risk:' + r.id, TRK, R + 27, 26, 650);
      var val = label(g, '0', 'risk-value:' + r.id, 606, R + 29, 32, 750, { 'text-anchor': 'end' });
      el('rect', { x: TRK, y: R + 42, width: 100 * PX, height: 30, rx: 8, fill: '#1b2436' }, g);
      var ghost = el('rect', { x: TRK, y: R + 42, width: 0, height: 30, rx: 8, fill: C.danger, 'fill-opacity': 0.26 }, g);
      var bar = el('rect', { x: TRK, y: R + 42, width: 0, height: 30, rx: 8, fill: C.danger }, g);
      el('path', { d: 'M' + (TRK + ap * PX) + ',' + (R + 34) + ' V' + (R + 80), stroke: C.text, 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
      var note = label(g, 'Not addressed', 'note:' + r.id, 366, R + 27, 24, 650, { fill: C.danger, opacity: 0 }).keep();
      W.risk[r.id] = { hi: hi, name: name, val: val, bar: bar, ghost: ghost, note: note, proxy: { v: 0 }, cur: 0, ap: ap };
    });
    W.measure = ctx.hud.measure({ label: 'Risks above appetite', value: ctx.count(0, D.risks.length), color: C.danger,
      rect: { x: PANEL.x, y: ctx.area.y + 8, w: 350, h: 118 } });
    W.fx = el('g', { transform: 'translate(0,' + ctx.area.y + ')' }, ctx.layers.hud);     /* links and rings, above the panel; area px */
    W.vals = {}; D.risks.forEach(function (r) { W.vals[r.id] = D.val0[r.id]; });
    W.above = D.above(W.vals);
  }

  /* ---- choreography ---- */
  function tweenRisk(ctx, r, t, to, dur) {
    var R = W.risk[r.id];
    ctx.tl.fromTo(R.proxy, { v: R.cur }, { v: to, duration: dur, ease: 'power2.inOut', onUpdate: function () {
      R.bar.setAttribute('width', Math.max(0, R.proxy.v * PX)); R.val.el.textContent = Math.round(R.proxy.v);
    } }, t);
    R.cur = to;
  }
  /* the bar shrinks by `by`; the ghost of its start stays; crossing the appetite turns it green */
  function shrinkRisk(ctx, r, t, by, dur) {
    var R = W.risk[r.id], from = R.cur, to = from - by;
    tweenRisk(ctx, r, t, to, dur);
    if (from > R.ap && to <= R.ap) ctx.tl.fromTo(R.bar, { fill: ctx.THEME.danger }, { fill: ctx.THEME.secure, duration: 0.5 }, t + dur - 0.3);
  }
  /* a thin line from a landed bar to the risk it reduces; short-lived */
  function linkTo(ctx, b, riskId, t) {
    var C = ctx.THEME, g = barGeo(b), xs = g.x1 - 24, ry = trackMid(riskId), tl = ctx.tl;
    var ln = ctx.el('path', { d: roundedPath([[xs, g.y1], [xs, g.T + LINK_GAP], [GUTTER_X, g.T + LINK_GAP], [GUTTER_X, ry], [PANEL.x + TRK - 12, ry]], 14), fill: 'none', stroke: C.secure, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 }, W.fx);
    var dot = ctx.el('circle', { cx: PANEL.x + TRK - 12, cy: ry, r: 7, fill: C.secure, stroke: C.bg, 'stroke-width': 2.5, opacity: 0 }, W.fx);
    tl.fromTo(ln, { opacity: 0 }, { opacity: 0.95, duration: 0.01 }, t);
    tl.fromTo(ln, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.6, ease: 'power1.inOut' }, t);
    tl.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.15 }, t + 0.55);
    tl.fromTo(ln, { opacity: 0.95 }, { opacity: 0, duration: 0.5, ease: 'power1.in' }, t + 0.85);
    tl.fromTo(dot, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: 'power1.in' }, t + 0.85);
  }
  function ringBar(ctx, id, t, color) {
    var g = W.bar[id].g, r = ctx.el('rect', { x: g.x0 - 6, y: g.y0 - 6, width: g.x1 - g.x0 + 12, height: BAR_H + 12, rx: 15, fill: 'none', stroke: color, 'stroke-width': 5, opacity: 0 }, W.fx);
    ctx.tl.fromTo(r, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' }, t);
    ctx.tl.fromTo(r, { opacity: 1 }, { opacity: 0, duration: 0.9, ease: 'power2.in' }, t + 0.7);
  }
  /* a bar is done; links flash to its risks (staggered); the risks shrink; the headline counts down. Returns when its motion ends. */
  function land(ctx, t0, ev, r) {
    var C = ctx.THEME, tl = ctx.tl, T = t0 + r, B = W.bar[ev.id], Q = ctx.timing.QUANTITY_MIN;
    tl.fromTo(B.fill, { fill: C.accent }, { fill: C.secure, duration: 0.4 }, T);
    tl.fromTo(B.out, { stroke: '#6a7ba3' }, { stroke: C.secure, duration: 0.4 }, T);
    tl.fromTo(B.chk, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, T + 0.1);
    ev.reduces.slice().sort(function (p, q) { return D.risks.indexOf(D.risk[p.risk]) - D.risks.indexOf(D.risk[q.risk]); }).forEach(function (x, i) {
      var tk = T + 0.3 + 0.2 * i, ts = tk + 0.6;
      linkTo(ctx, ev, x.risk, tk);
      shrinkRisk(ctx, D.risk[x.risk], ts, D.F(x.by), Q);
      ctx.shown(ctx.figure(x.by), ts, Infinity);
      W.vals[x.risk] -= D.F(x.by);
    });
    var now = D.above(W.vals);
    if (now !== W.above) { W.measure.to(now, T + 0.9); W.above = now; }
    return r + 0.3 + 0.2 * (ev.reduces.length - 1) + 0.6 + Q;
  }
  /* the playhead moves p0 to p1 over [r, r + dist * SWEEP]; every bar it crosses fills in step */
  function sweepTo(ctx, t0, p0, p1, r) {
    var ts = t0 + r;
    ctx.tl.fromTo(W.ph, { x: X(p0) }, { x: X(p1), duration: (p1 - p0) * SWEEP, ease: 'none' }, ts);
    D.inits.forEach(function (b) {
      if (b.start >= p1 - 1e-9 || b.end <= p0 + 1e-9) return;
      var a = Math.max(p0, b.start), z = Math.min(p1, b.end), bw = W.bar[b.id].bw;
      ctx.tl.fromTo(W.bar[b.id].fill, { attr: { width: (a - b.start) / (b.end - b.start) * bw } }, { attr: { width: (z - b.start) / (b.end - b.start) * bw }, duration: (z - a) * SWEEP, ease: 'none' }, ts + (a - p0) * SWEEP);
    });
  }
  /* sweep the playhead across [h0, h1], stopping at each landing so no two landings overlap; each result holds before the next */
  function runHorizon(ctx, t0, h0, h1, r) {
    var evs = D.landings.filter(function (b) { return b.end > h0 + 1e-9 && b.end <= h1 + 1e-9; }), p = h0, motionEnd = r;
    evs.forEach(function (ev, i) {
      if (ev.end > p + 1e-9) { sweepTo(ctx, t0, p, ev.end, r); r += (ev.end - p) * SWEEP; p = ev.end; }
      motionEnd = land(ctx, t0, ev, r);
      if (i < evs.length - 1 || p < h1 - 1e-9) r = motionEnd + ctx.timing.resultHold();
    });
    if (p < h1 - 1e-9) { sweepTo(ctx, t0, p, h1, r); motionEnd = Math.max(motionEnd, r + (h1 - p) * SWEEP); }
    return motionEnd;
  }

  var ACT = {
    baseline: function (ctx, st, t0) {
      var tl = ctx.tl, gEnd = 0, at = t0 + 0.2;
      tl.fromTo(W.rm, { opacity: 0 }, { opacity: 1, duration: 0.8 }, at);
      W.measure.show(t0 + 0.4, 0.6);
      W.panel.show(t0 + 0.5, 0.6);
      [D.horizons, D.lanes, D.inits].forEach(function (rs) { rs.forEach(function (x) { ctx.shown(x, at, Infinity); }); });
      D.horizons.forEach(function (h) { ctx.figure(h.span).shown(at, Infinity); });
      ctx.figure('scale').shown(t0 + 0.5, Infinity);
      D.risks.forEach(function (r, i) {
        var t = t0 + 1.0 + i * 0.35, R = W.risk[r.id], v = D.F(r.start);
        ctx.shown(r, t0 + 0.5, Infinity); ctx.figure(r.start).shown(t, Infinity); ctx.figure(r.appetite).shown(t0 + 0.5, Infinity);
        tweenRisk(ctx, r, t, v, 1.4);
        tl.fromTo(R.ghost, { attr: { width: 0 } }, { attr: { width: v * PX }, duration: 0.01 }, t + 1.4);
        gEnd = 1.0 + i * 0.35 + 1.4;
      });
      W.measure.to(W.above, t0 + 1.0, 2.4);
      return { end: gEnd, first: 0.2 };
    },
    sweep: function (ctx, st, t0) {
      var h = D.hz[st.horizon];
      if (h.from === 0) ctx.tl.fromTo(W.ph, { opacity: 0 }, { opacity: 1, duration: 0.5 }, t0 + 0.4);
      return { end: runHorizon(ctx, t0, h.from, h.to, h.from === 0 ? 1.2 : 1.0), first: 0.4 };
    },
    dependencies: function (ctx, st, t0) {
      var r = 1.0, end = 0, C = ctx.THEME;
      W.dep.forEach(function (x) {
        ringBar(ctx, x.d.from, t0 + r, C.identity);
        ctx.tl.fromTo(x.g, { opacity: 0 }, { opacity: 1, duration: 0.01 }, t0 + r + 0.3);
        ctx.tl.fromTo(x.line, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.9, ease: 'power1.inOut' }, t0 + r + 0.3);
        ctx.tl.fromTo(x.head, { opacity: 0 }, { opacity: 1, duration: 0.2 }, t0 + r + 1.1);
        ringBar(ctx, x.d.to, t0 + r + 1.1, C.identity);
        ctx.shown(x.d, t0 + r + 0.3, Infinity);
        end = r + 1.4; r += 1.6;
      });
      ctx.tl.fromTo(W.dep.map(function (x) { return x.g; }), { opacity: 1 }, { opacity: 0.55, duration: 0.8 }, t0 + end + 0.8);
      return { end: end, first: 1.0 };
    },
    remains: function (ctx, st, t0) {
      D.remain.forEach(function (rr) {
        ctx.tl.fromTo(W.risk[rr.id].hi, { opacity: 0 }, { opacity: 1, duration: 0.6 }, t0 + 0.8);
        ctx.tl.fromTo(W.risk[rr.id].note.el, { opacity: 0 }, { opacity: 1, duration: 0.6 }, t0 + 1.2);
      });
      W.measure.border(ctx.THEME.danger, t0 + 0.8);
      return { end: 1.8, first: 0.8 };
    }
  };

  /* what the step is about stays at full, the rest dims */
  function active(st) {
    var h = st.horizon && D.hz[st.horizon], out = [];
    if (st.act === 'baseline') { D.risks.forEach(function (r) { out.push(W.risk[r.id].name, W.risk[r.id].val); }); return out; }
    function barOn(b) {
      if (st.act === 'dependencies') return D.deps.some(function (d) { return d.from === b.id || d.to === b.id; });
      return b.start < h.to - 1e-9 && b.end > h.from + 1e-9;
    }
    function riskOn(r) {
      return st.act === 'sweep' && D.inits.some(function (b) { return b.end > h.from + 1e-9 && b.end <= h.to + 1e-9 && b.reduces.some(function (x) { return x.risk === r.id; }); });
    }
    D.horizons.forEach(function (x) { if (st.act === 'sweep' && x.from === h.from) out.push(W.hz[x.id]); });
    D.lanes.forEach(function (l) { if (D.inits.some(function (b) { return b.lane === l.id && barOn(b); })) out.push(W.lane[l.id]); });
    D.inits.forEach(function (b) { if (barOn(b)) out.push(W.bar[b.id].lab); });
    D.risks.forEach(function (r) { if (riskOn(r)) out.push(W.risk[r.id].name, W.risk[r.id].val); });
    return out;
  }

  EXK.scenes.roadmap = {
    build: build,
    step: function (ctx, st, t0) {
      ctx.emphasise(st.act === 'remains' ? 'all' : active(st), t0 + 0.1);
      var r = ACT[st.act](ctx, st, t0);
      return { end: r.end, firstMotion: r.first, hold: ctx.timing.resultHold() };
    }
  };
})();
