/* Replay derivations: everything on the replay page that is a number, a span or a position on the
   clock is computed here from the story, never typed. Pure: no DOM, loads under Node's vm.

     EXK.replay.derive(story, clockOpts) -> D
     EXK.replay.fmt = { n, T, long, short, axis, plural }

   `story` is a validated, normalized story. clockOpts override CLOCK_DEFAULTS.

   Events are classified by `actor`:
     attacker, system   the attacker's side ("system" is a compromised system acting for the attacker)
     defender           the response
     system + alerted   a detection raising an alert: the response side
   so "attacker actions" = every event that is not on the response side. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};
  var R = EXK.replay = EXK.replay || {};

  var DAY = 86400;
  var VIS = ['blind', 'logged', 'alerted'];

  // incident seconds -> replay seconds: active stretches run at `rate`; a silence longer than
  // `gapMin` collapses to `breakS`, drawn as a break on every time axis.
  var CLOCK_DEFAULTS = { rate: 1 / 12, gapMin: 1800, breakS: 8, leadS: 1.2, tailS: 3, endS: 1, bucketS: 2 };

  // one hue per phase, by order (used only for phase rows, stream tags and scrubber bands)
  var PHASE_HUES = ['#6db3f2', '#e0b252', '#b99cf5', '#5fcfc0', '#3ddc97', '#f08fb0', '#9aa7bd'];

  function arr(v) { return Array.isArray(v) ? v : []; }

  /* ---- formatting ---- */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtN(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function fmtT(t) {
    t = Math.max(0, Math.floor(t + 1e-6));
    var d = Math.floor(t / DAY), r = t % DAY;
    return 'T+' + (d ? d + 'd ' : '') + pad2(Math.floor(r / 3600)) + ':' + pad2(Math.floor(r % 3600 / 60)) + ':' + pad2(r % 60);
  }
  function fmtLong(s) {
    var d = Math.floor(s / DAY), hh = Math.floor(s % DAY / 3600), m = Math.floor(s % 3600 / 60);
    if (d) return plural(d, 'day') + (hh ? ' ' + plural(hh, 'hour') : '');
    if (hh) return plural(hh, 'hour') + (m ? ' ' + plural(m, 'minute') : '');
    return m >= 1 ? plural(m, 'minute') : plural(Math.round(s), 'second');
  }
  function fmtShort(s) {
    var d = Math.floor(s / DAY), hh = Math.floor(s % DAY / 3600), m = Math.floor(s % 3600 / 60);
    if (d) return d + 'd ' + hh + 'h';
    if (hh) return hh + 'h ' + m + 'm';
    return m >= 1 ? m + ' min' : Math.round(s) + ' s';
  }
  function fmtAxis(t) {
    if (t < 3600) return t === 0 ? 'T+0' : 'T+' + Math.round(t / 60) + 'm';
    var d = Math.floor(t / DAY), hh = Math.floor(t % DAY / 3600), m = Math.floor(t % 3600 / 60);
    return 'T+' + (d ? d + 'd ' : '') + hh + 'h ' + m + 'm';
  }

  /* ---- routes: an event between two systems lights every link on the way ---- */
  function linkId(l) { return l.from + '>' + l.to; }

  function makeRouter(links) {
    var adj = {};
    links.forEach(function (l) {
      var id = linkId(l);
      (adj[l.from] = adj[l.from] || []).push([l.to, id]);
      (adj[l.to] = adj[l.to] || []).push([l.from, id]);
    });
    return function route(a, b) {
      var prev = {}, q = [a], n, c;
      prev[a] = null;
      while (q.length) {
        n = q.shift();
        if (n === b) break;
        arr(adj[n]).forEach(function (p) { if (!(p[0] in prev)) { prev[p[0]] = [n, p[1]]; q.push(p[0]); } });
      }
      var nodes = [b], edges = [];
      if (!(b in prev)) return { nodes: a === b ? [a] : [a, b], edges: [] };   // no path: both ends, no links
      c = b;
      while (prev[c]) { edges.unshift(prev[c][1]); c = prev[c][0]; nodes.unshift(c); }
      return { nodes: nodes, edges: edges };
    };
  }

  function isResponse(e) {
    return e.actor === 'defender' || (e.actor === 'system' && e.visibility === 'alerted');
  }

  function derive(story, clockOpts) {
    var C = {}, k;
    for (k in CLOCK_DEFAULTS) C[k] = CLOCK_DEFAULTS[k];
    for (k in (clockOpts || {})) C[k] = clockOpts[k];

    var links = arr(story.links).map(function (l) {
      return { id: linkId(l), from: l.from, to: l.to, label: l.label || null, kind: l.kind || null };
    });
    var route = makeRouter(links);
    var steps = arr(story.steps), stepIx = {}, stepPhase = {};
    steps.forEach(function (s, i) { stepIx[s.id] = i; stepPhase[s.id] = s.phase; });
    var phaseIx = {};
    var phaseDefs = arr(story.phases);
    phaseDefs.forEach(function (p, i) { phaseIx[p.id] = i; });

    // stable sort by incident time
    var events = arr(story.events).map(function (e, i) {
      var c = {}; for (var key in e) c[key] = e[key];
      c._o = i; return c;
    }).sort(function (a, b) { return (a.t - b.t) || (a._o - b._o); });
    if (!events.length) throw new Error('derive: the story has no events');

    // the attacker's own system: where the first attacker-side event starts
    var firstAtt = null;
    events.forEach(function (e) { if (!firstAtt && (e.actor === 'attacker' || e.actor === undefined)) firstAtt = e; });
    var attackerId = firstAtt ? firstAtt.from : events[0].from;

    var nTotal = 0, attTotal = 0, respTotal = 0;
    events.forEach(function (e, i) {
      delete e._o;
      e.i = i;
      e.count = e.count > 0 ? e.count : 1;
      e.stepId = e.step;
      e.stepIndex = (stepIx[e.step] === undefined ? -1 : stepIx[e.step]) + 1;     // 1-based
      e.phase = stepPhase[e.step];
      e.pi = phaseIx[e.phase] === undefined ? -1 : phaseIx[e.phase];
      var p = route(e.from, e.to); e.nodes = p.nodes; e.edges = p.edges;
      e.response = isResponse(e);
      e.attack = !e.response;
      e.c0 = nTotal; nTotal += e.count; e.c1 = nTotal;
      e.a0 = attTotal; if (e.attack) attTotal += e.count; e.a1 = attTotal;
      if (e.response) respTotal += e.count;
    });
    var tFirst = events[0].t, tLast = events[events.length - 1].t;
    var attackEvents = events.filter(function (e) { return e.attack; });
    var tAttackEnd = attackEvents.length ? attackEvents[attackEvents.length - 1].t : tLast;
    var firstAlert = null;
    events.forEach(function (e) { if (!firstAlert && e.visibility === 'alerted') firstAlert = e; });

    /* ---- the piecewise clock ---- */
    var seg = [], breaks = [], r = C.leadS;
    events[0].r = r;
    for (var i = 1; i < events.length; i++) {
      var gap = events[i].t - events[i - 1].t, r0 = r, brk = gap > C.gapMin;
      r += brk ? C.breakS : gap * C.rate;
      events[i].r = r;
      var sg = { r0: r0, r1: r, t0: events[i - 1].t, t1: events[i].t, brk: brk };
      seg.push(sg); if (brk) breaks.push(sg);
    }
    var duration = Math.round((events[events.length - 1].r + C.tailS + C.endS) * 10) / 10;
    function rToT(x) {
      if (x <= events[0].r) return events[0].t;
      for (var j = 0; j < seg.length; j++) {
        if (x <= seg[j].r1) return seg[j].t0 + (seg[j].t1 - seg[j].t0) * (x - seg[j].r0) / (seg[j].r1 - seg[j].r0);
      }
      return tLast;
    }
    function rOfT(t) {
      if (t <= events[0].t) return events[0].r;
      for (var j = 0; j < seg.length; j++) {
        if (t <= seg[j].t1) return seg[j].brk ? (t <= seg[j].t0 ? seg[j].r0 : seg[j].r1) : seg[j].r0 + (t - seg[j].t0) * C.rate;
      }
      return events[events.length - 1].r;
    }
    // index of the last event at or before replay clock x (-1 before the first)
    function idxAt(x) {
      var lo = 0, hi = events.length - 1, ans = -1;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (events[mid].r <= x + 1e-9) { ans = mid; lo = mid + 1; } else hi = mid - 1;
      }
      return ans;
    }

    /* ---- running figures, one entry per event ---- */
    var pre = [], reached = {}, nReached = 0, boundaryId = null, vis = [0, 0, 0], att = 0, resp = 0;
    events.forEach(function (e) {
      vis[VIS.indexOf(e.visibility)] += e.count;
      if (e.attack) att += e.count; else resp += e.count;
      if (e.attack) e.nodes.forEach(function (n) {
        if (n === attackerId) return;
        if (!reached[n]) { reached[n] = 1; nReached++; boundaryId = n; }
      });
      pre.push({ n: e.c1, att: att, resp: resp, vis: vis.slice(), reached: nReached, boundaryId: boundaryId });
    });
    var last = pre[pre.length - 1];

    var systemIds = arr(story.systems).map(function (s) { return s.id; }).filter(function (id) { return id !== attackerId; });

    /* ---- phases: spans on the replay axis ---- */
    var phases = phaseDefs.map(function (p, j) {
      var es = events.filter(function (e) { return e.pi === j; });
      return {
        id: p.id, title: p.title, tag: p.short || p.title, desc: p.descriptor || '', hue: p.hue || PHASE_HUES[j % PHASE_HUES.length],
        first: es.length ? es[0].r : null, last: es.length ? es[es.length - 1].r : null, firstEv: es.length ? es[0].i : -1,
        n: es.length, events: es,
        total: es.reduce(function (a, e) { return a + e.count; }, 0)
      };
    });

    /* ---- what would have stopped it: per control, the first attacker action it would have refused ---- */
    var cuts = [];
    var controls = arr(story.controls).map(function (c, ci) {
      var on = arr(c.on), edge = null;
      links.forEach(function (l) {
        if (!edge && on.length === 2 && ((l.from === on[0] && l.to === on[1]) || (l.from === on[1] && l.to === on[0]))) edge = l.id;
      });
      var stops = arr(c.stops).map(function (id) { return stepIx[id]; }).filter(function (x) { return x !== undefined; });
      var fromStep = stops.length ? Math.min.apply(null, stops) : 0;
      var ev = null;
      if (edge) for (var j = 0; j < events.length; j++) {
        var e = events[j];
        if (e.attack && e.stepIndex - 1 >= fromStep && e.edges.indexOf(edge) >= 0) { ev = e; break; }
      }
      var out = {
        id: c.id, name: c.name, why: c.why || '', edge: edge, on: on,
        badge: stops.map(function (x) { return x + 1; }).join('/'),
        ev: ev, evIndex: ev ? ev.i : -1,
        at: ev ? ev.a0 + 1 : null,                      // the attacker action it would have refused (1-based)
        prevented: ev ? attTotal - ev.a0 : 0,           // that action and every later one
        later: ev ? attTotal - ev.a0 - 1 : 0            // the ones after it
      };
      if (ev) cuts.push(out);
      return out;
    });
    cuts.sort(function (a, b) { return a.evIndex - b.evIndex; });

    /* ---- activity buckets on the replay axis, stacked by visibility ---- */
    var nB = Math.ceil(duration / C.bucketS), data = [];
    for (var b = 0; b < nB; b++) data.push([0, 0, 0]);
    events.forEach(function (e) { data[Math.min(nB - 1, Math.floor(e.r / C.bucketS))][VIS.indexOf(e.visibility)] += e.count; });
    var totals = data.map(function (d) { return d[0] + d[1] + d[2]; });
    var buckets = { size: C.bucketS, n: nB, data: data, totals: totals, max: Math.max.apply(null, totals) };

    return {
      clockOpts: C,
      events: events, links: links, route: route,
      attackerId: attackerId, systemIds: systemIds,
      phases: phases, controls: controls, cuts: cuts,
      pre: pre, buckets: buckets,
      totals: {
        actions: nTotal, attacker: attTotal, response: respTotal, lines: events.length,
        blind: last.vis[0], logged: last.vis[1], alerted: last.vis[2],
        systemsReached: last.reached, systemsTotal: systemIds.length
      },
      reachedIds: Object.keys(reached),
      span: tLast - tFirst, attackSpan: tAttackEnd - tFirst,
      tFirst: tFirst, tLast: tLast,
      firstAlert: firstAlert, firstAlertSeconds: firstAlert ? firstAlert.t - tFirst : null,
      days: Math.floor(tLast / DAY) + 1,
      clock: { duration: duration, segs: seg, breaks: breaks, rToT: rToT, rOfT: rOfT, idxAt: idxAt },
      duration: duration
    };
  }

  R.derive = derive;
  R.CLOCK_DEFAULTS = CLOCK_DEFAULTS;
  R.fmt = { n: fmtN, T: fmtT, long: fmtLong, short: fmtShort, axis: fmtAxis, plural: plural, DAY: DAY };
})();
