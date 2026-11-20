/* Orthogonal link routing over a laid-out estate (EXK.layout). Pure: no DOM, no GSAP, no painter,
   no timing. Ground units. references/rules.md: orthogonal, routed through the gaps, parallel
   runs on separate lanes, never sharing a segment; section 9: one port per border crossing.

   EXK.route.routeLinks(estate, story) -> E: { linkId: route }    linkId = 'from-to' ('#2' on repeats)
   route = { id, a, b,               system ids (link from / to)
             pts: [[x, y]...],        orthogonal polyline; the first and last points sit inside the
                                      end nodes (hidden under them), on the line the route enters by
             d, len,                  rounded SVG path (r 24) and polyline length
             shape,                   'straight' | 'L' | 'Z' | 'U' | 'path' (more than two bends)
             rule,                    'straight' | 'auto' | 'corridor' | 'via' | 'blocked'
             axis, lane, lanes,       'v' (run is horizontal) | 'h'; lane index in its bundle, bundle size
             exit, entry,             side of a the route leaves by, side of b it enters by
             ports: [{x, y, box, side, s, f}],   container border crossings in order (s along, f = s / len)
             issues: [{level, kind, message, fix}] }
   One rule picks the shape: candidate runs are the end-centre lines (straight, L) and the middle of
   every free gap between container/node edges along the span (Z, U), in both orientations; the
   cheapest that passes under no other node wins (length + 60 per bend + 400 per border of a
   container holding neither end). Hints on link.route (link.route.iso, when present, replaces them for an
   iso estate): exit ('top'|'bottom'|'left'|'right')
   filters candidates; corridor ('below:<id>', 'above:', 'left:', 'right:') fixes the run in the
   gap beside that box; lane (0 = nearest the corridor's box) fixes the order in a bundle; via
   ([[x, y]...] ground units) is taken as given. Runs that would share a segment form a bundle
   and get lanes 22 apart; unhinted bundles try every lane order (up to 6) and keep the one with
   fewest crossings. Ports on one node side are spread 60 apart and nested so bundles do not cross.
   What cannot be routed cleanly is reported in issues and by checkRoutes, never hidden. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};

  var LANE = 22, PORT = 60, PORT_END = 24, IN = 12, CLEAR = 6, MIN_GAP = 16, ROUND = 24;
  var W_BEND = 60, W_FOREIGN = 400, W_CROSS = 150, BIG = 1e6, MAX_PERM = 6;

  /* ---------- geometry ---------- */
  function polyLen(pts) {
    var s = 0;
    for (var i = 1; i < pts.length; i++) s += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
    return s;
  }
  function roundedPath(pts, r) {
    r = r == null ? ROUND : r;
    var d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (var i = 1; i < pts.length - 1; i++) {
      var p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
      var l1 = Math.abs(p1[0] - p0[0]) + Math.abs(p1[1] - p0[1]), l2 = Math.abs(p2[0] - p1[0]) + Math.abs(p2[1] - p1[1]);
      var rr = Math.min(r, l1 / 2, l2 / 2);
      var ax = p1[0] - Math.sign(p1[0] - p0[0]) * rr, ay = p1[1] - Math.sign(p1[1] - p0[1]) * rr;
      var bx = p1[0] + Math.sign(p2[0] - p1[0]) * rr, by = p1[1] + Math.sign(p2[1] - p1[1]) * rr;
      d += ' L' + ax + ',' + ay + ' Q' + p1[0] + ',' + p1[1] + ' ' + bx + ',' + by;
    }
    var q = pts[pts.length - 1];
    return d + ' L' + q[0] + ',' + q[1];
  }
  // point at distance s along the polyline
  function pointAt(pts, s) {
    var acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var l = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
      if (acc + l >= s && l > 0) { var t = (s - acc) / l; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; }
      acc += l;
    }
    return pts[pts.length - 1].slice();
  }
  // drops repeated points and collinear middles
  function simplify(pts) {
    var q = [];
    pts.forEach(function (p) {
      var l = q[q.length - 1];
      if (l && Math.abs(l[0] - p[0]) < 0.5 && Math.abs(l[1] - p[1]) < 0.5) return;
      q.push([p[0], p[1]]);
    });
    for (var i = q.length - 2; i >= 1; i--) {
      var a = q[i - 1], b = q[i], c = q[i + 1];
      if ((Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - c[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - c[1]) < 0.5)) q.splice(i, 1);
    }
    return q;
  }
  function segsOf(pts) {
    var out = [];
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i - 1], q = pts[i], h = Math.abs(p[1] - q[1]) < 0.5;
      out.push({ i: i - 1, p: p, q: q, h: h, c: h ? p[1] : p[0], lo: h ? Math.min(p[0], q[0]) : Math.min(p[1], q[1]), hi: h ? Math.max(p[0], q[0]) : Math.max(p[1], q[1]) });
    }
    return out;
  }
  // does an axis-aligned segment pass through the rect grown by e (e < 0 shrinks)?
  function segHits(sg, r, e) {
    var x0 = r.x - e, x1 = r.x + r.w + e, y0 = r.y - e, y1 = r.y + r.h + e;
    if (sg.h) return sg.c > y0 && sg.c < y1 && sg.hi > x0 && sg.lo < x1;
    return sg.c > x0 && sg.c < x1 && sg.hi > y0 && sg.lo < y1;
  }
  function inSpan(v, lo, len) { return v > lo + IN && v < lo + len - IN; }

  /* ---------- the estate as the router sees it ---------- */
  function ctxOf(estate) {
    var B = estate.B, anc = {};
    Object.keys(B).forEach(function (id) {
      var s = {}, p = B[id].parent;
      while (p) { s[p] = true; p = B[p].parent; }
      anc[id] = s;
    });
    var tabs = estate.boxes.filter(function (b) { return b.tab; }).map(function (b) {
      return { id: 'tab:' + b.id, x: b.x, y: b.y, w: b.tab.w, h: b.tab.h };
    });
    return { B: B, nodes: estate.nodes, boxes: estate.boxes, tabs: tabs, world: estate.world, anc: anc };
  }
  function related(ctx, boxId, a, b) { return !!(ctx.anc[a.id][boxId] || ctx.anc[b.id][boxId]); }

  // edge lines across the run's axis: for axis 'v' (horizontal run) the y of every box/node top
  // and bottom whose x-range overlaps [lo, hi]; the end nodes are not obstacles
  function linesFor(ctx, axis, lo, hi, a, b) {
    var L = [ctx.world.y, ctx.world.y + ctx.world.h];
    if (axis === 'h') L = [ctx.world.x, ctx.world.x + ctx.world.w];
    ctx.boxes.concat(ctx.nodes, ctx.tabs).forEach(function (r) {
      if (r.id === a.id || r.id === b.id) return;
      var s0 = axis === 'v' ? r.x : r.y, s1 = s0 + (axis === 'v' ? r.w : r.h);
      if (s1 <= lo || s0 >= hi) return;
      if (axis === 'v') L.push(r.y, r.y + r.h); else L.push(r.x, r.x + r.w);
    });
    L.sort(function (p, q) { return p - q; });
    return L.filter(function (v, i) { return i === 0 || v - L[i - 1] > 0.5; });
  }
  function spanOf(axis, a, b) {
    return axis === 'v' ? [Math.min(a.cx, b.cx) - PORT, Math.max(a.cx, b.cx) + PORT] : [Math.min(a.cy, b.cy) - PORT, Math.max(a.cy, b.cy) + PORT];
  }

  /* ---------- building one route from a plan ---------- */
  // plan: {a, b, axis, m (run coordinate), pa, pb (port offsets)} or {via}
  function build(plan) {
    if (plan.viaPts) return plan.viaPts;
    var a = plan.a, b = plan.b, m = plan.m, pa = plan.pa || 0, pb = plan.pb || 0, pts;
    if (plan.axis === 'v') {
      var aIn = inSpan(m, a.y, a.h), bIn = inSpan(m, b.y, b.h);
      pts = [];
      if (aIn) pts.push([a.cx, m]); else pts.push([a.cx + pa, a.cy], [a.cx + pa, m]);
      if (bIn) pts.push([b.cx, m]); else pts.push([b.cx + pb, m], [b.cx + pb, b.cy]);
    } else {
      var aIn2 = inSpan(m, a.x, a.w), bIn2 = inSpan(m, b.x, b.w);
      pts = [];
      if (aIn2) pts.push([m, a.cy]); else pts.push([a.cx, a.cy + pa], [m, a.cy + pa]);
      if (bIn2) pts.push([m, b.cy]); else pts.push([m, b.cy + pb], [b.cx, b.cy + pb]);
    }
    return simplify(pts);
  }
  function sideAt(pts, end) {
    var p = end ? pts[pts.length - 1] : pts[0], q = end ? pts[pts.length - 2] : pts[1];
    if (!q) return null;
    if (Math.abs(p[0] - q[0]) < 0.5) return q[1] > p[1] ? 'bottom' : 'top';
    return q[0] > p[0] ? 'right' : 'left';
  }
  function shapeOf(pts) {
    var bends = pts.length - 2;
    if (bends <= 0) return 'straight';
    if (bends === 1) return 'L';
    if (bends === 2) {
      var s = segsOf(pts), d0 = s[0].h ? s[0].q[0] - s[0].p[0] : s[0].q[1] - s[0].p[1], d2 = s[2].h ? s[2].q[0] - s[2].p[0] : s[2].q[1] - s[2].p[1];
      return d0 * d2 > 0 ? 'Z' : 'U';
    }
    return 'path';
  }

  // cost and the nodes a polyline passes under
  function evaluate(ctx, pts, a, b) {
    var hits = [], foreign = 0, sg = segsOf(pts);
    ctx.nodes.forEach(function (n) {
      if (n.id === a.id || n.id === b.id) return;
      if (sg.some(function (s) { return segHits(s, n, CLEAR); })) hits.push(n.id);
    });
    ctx.tabs.forEach(function (t) {
      if (sg.some(function (s) { return segHits(s, t, CLEAR); })) hits.push(t.id);
    });
    ctx.boxes.forEach(function (bx) {
      if (related(ctx, bx.id, a, b)) return;
      foreign += crossings(pts, bx).length;
    });
    return { hits: hits, cost: polyLen(pts) + W_BEND * Math.max(0, pts.length - 2) + W_FOREIGN * foreign };
  }

  // border crossings of one box: [{x, y, side, s}]
  function crossings(pts, c) {
    var out = [], acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], l = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      if (Math.abs(a[0] - b[0]) < 0.5) {
        var x = a[0], lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
        if (x > c.x + 1 && x < c.x + c.w - 1) {
          if (lo < c.y && hi > c.y) out.push({ x: x, y: c.y, side: 'top', s: acc + Math.abs(c.y - a[1]) });
          if (lo < c.y + c.h && hi > c.y + c.h) out.push({ x: x, y: c.y + c.h, side: 'bottom', s: acc + Math.abs(c.y + c.h - a[1]) });
        }
      } else {
        var y = a[1], l2 = Math.min(a[0], b[0]), h2 = Math.max(a[0], b[0]);
        if (y > c.y + 1 && y < c.y + c.h - 1) {
          if (l2 < c.x && h2 > c.x) out.push({ x: c.x, y: y, side: 'left', s: acc + Math.abs(c.x - a[0]) });
          if (l2 < c.x + c.w && h2 > c.x + c.w) out.push({ x: c.x + c.w, y: y, side: 'right', s: acc + Math.abs(c.x + c.w - a[0]) });
        }
      }
      acc += l;
    }
    return out;
  }
  // every container border a route crosses, in order along it
  function portsFor(pts, boxes) {
    var out = [], len = polyLen(pts);
    boxes.forEach(function (c) {
      crossings(pts, c).forEach(function (q) { out.push({ x: q.x, y: q.y, box: c.id, side: q.side, s: q.s, f: len ? q.s / len : 0 }); });
    });
    out.sort(function (p, q) { return p.s - q.s || (p.box < q.box ? -1 : 1); });
    return out;
  }
  // one marker per crossing across all routes; crossings closer than mergeDist share a marker.
  // Sets port.m on every route's ports; returns [{x, y, links: [id]}].
  function markers(E, mergeDist) {
    var M = [];
    Object.keys(E).forEach(function (id) {
      E[id].ports.forEach(function (q) {
        var m = -1;
        for (var i = 0; i < M.length; i++) if (Math.hypot(M[i].x - q.x, M[i].y - q.y) < mergeDist) { m = i; break; }
        if (m < 0) { M.push({ x: q.x, y: q.y, links: [] }); m = M.length - 1; }
        if (M[m].links.indexOf(id) < 0) M[m].links.push(id);
        q.m = m;
      });
    });
    return M;
  }

  /* ---------- planning: the shape of each link ---------- */
  function issue(level, kind, message, fix) { return { level: level, kind: kind, message: message, fix: fix }; }

  function corridorChannel(ctx, spec, a, b) {
    var mm = /^(below|above|left|right):(.+)$/.exec(spec || '');
    if (!mm || !ctx.B[mm[2]]) return null;
    var side = mm[1], ref = ctx.B[mm[2]], axis = side === 'below' || side === 'above' ? 'v' : 'h';
    var span = spanOf(axis, a, b), L = linesFor(ctx, axis, span[0], span[1], a, b), lo, hi;
    var edge0 = axis === 'v' ? ref.y : ref.x, edge1 = edge0 + (axis === 'v' ? ref.h : ref.w);
    if (side === 'below' || side === 'right') {
      lo = edge1; hi = null;
      for (var i = 0; i < L.length; i++) if (L[i] > lo + 0.5) { hi = L[i]; break; }
      if (hi == null) hi = lo + 4 * LANE;
    } else {
      hi = edge0; lo = null;
      for (var j = L.length - 1; j >= 0; j--) if (L[j] < hi - 0.5) { lo = L[j]; break; }
      if (lo == null) lo = hi - 4 * LANE;
    }
    return { axis: axis, lo: lo, hi: hi, ref: ref.id, near: side === 'below' || side === 'right' ? 'lo' : 'hi' };
  }

  function viaPoints(a, b, via, exit) {
    var v = via.map(function (p) { return [p[0], p[1]]; }), pts = [];
    var v0 = v[0], vn = v[v.length - 1];
    if (inSpan(v0[0], a.x, a.w) && exit !== 'left' && exit !== 'right') pts.push([v0[0], a.cy]);
    else if (inSpan(v0[1], a.y, a.h)) pts.push([a.cx, v0[1]]);
    else if (exit === 'left' || exit === 'right') pts.push([a.cx, a.cy], [v0[0], a.cy]);
    else pts.push([a.cx, a.cy], [a.cx, v0[1]]);
    v.forEach(function (p) {
      var l = pts[pts.length - 1];
      if (Math.abs(l[0] - p[0]) > 0.5 && Math.abs(l[1] - p[1]) > 0.5) pts.push([p[0], l[1]]);
      pts.push(p);
    });
    var l2 = pts[pts.length - 1];
    if (Math.abs(l2[0] - vn[0]) < 0.5 && inSpan(vn[0], b.x, b.w)) pts.push([vn[0], b.cy]);
    else if (Math.abs(l2[1] - vn[1]) < 0.5 && inSpan(vn[1], b.y, b.h)) pts.push([b.cx, vn[1]]);
    else if (inSpan(vn[0], b.x, b.w)) pts.push([vn[0], b.cy]);
    else if (inSpan(vn[1], b.y, b.h)) pts.push([b.cx, vn[1]]);
    else pts.push([b.cx, vn[1]], [b.cx, b.cy]);
    return simplify(pts);
  }

  function planLink(ctx, link, idx) {
    var a = ctx.B[link.from], b = ctx.B[link.to], iss = [];
    var h = (ctx.iso && link.route && link.route.iso) || link.route || {};     /* route.iso replaces route for the iso style */
    var plan = { idx: idx, link: link, a: a, b: b, hint: h, issues: iss, lane: h.lane != null ? h.lane : null };
    if (Array.isArray(h.via) && h.via.length) {
      plan.rule = 'via'; plan.viaPts = viaPoints(a, b, h.via, h.exit);
      return plan;
    }
    var cands = [];
    function add(axis, m, chan, rule) {
      var p = { a: a, b: b, axis: axis, m: m };
      assignPorts(ctx, [p]);
      var pts = build(p), ev = evaluate(ctx, pts, a, b);
      cands.push({ axis: axis, m: m, chan: chan, rule: rule, pts: pts, hits: ev.hits, cost: ev.cost, exit: sideAt(pts, false) });
    }
    var cor = h.corridor ? corridorChannel(ctx, h.corridor, a, b) : null;
    if (h.corridor && !cor) iss.push(issue('warning', 'hint', 'corridor ' + JSON.stringify(h.corridor) + ' names no known box or side, ignored', 'write below:<id>, above:<id>, left:<id> or right:<id>'));
    if (cor) {
      add(cor.axis, (cor.lo + cor.hi) / 2, cor, 'corridor');
    } else {
      ['v', 'h'].forEach(function (axis) {
        var ca = axis === 'v' ? a.cy : a.cx, cb = axis === 'v' ? b.cy : b.cx;
        var a0 = axis === 'v' ? a.y : a.x, a1 = a0 + (axis === 'v' ? a.h : a.w);
        var b0 = axis === 'v' ? b.y : b.x, b1 = b0 + (axis === 'v' ? b.h : b.w);
        var ol = Math.max(a0, b0) + IN, oh = Math.min(a1, b1) - IN;
        if (Math.abs(ca - cb) < 0.5) add(axis, ca, { lo: ol, hi: oh, body: true }, 'straight');
        else {
          if (oh - ol >= 2 * IN) add(axis, (ol + oh) / 2, { lo: ol, hi: oh, body: true }, 'straight');
          add(axis, ca, { lo: a0 + IN, hi: a1 - IN, body: true }, 'auto');
          add(axis, cb, { lo: b0 + IN, hi: b1 - IN, body: true }, 'auto');
        }
        var span = spanOf(axis, a, b), L = linesFor(ctx, axis, span[0], span[1], a, b);
        for (var i = 1; i < L.length; i++) if (L[i] - L[i - 1] >= MIN_GAP) add(axis, (L[i - 1] + L[i]) / 2, { lo: L[i - 1], hi: L[i] }, 'auto');
      });
    }
    var pool = cands;
    if (h.exit) {
      var ok = cands.filter(function (c) { return c.exit === h.exit; });
      if (ok.length) pool = ok;
      else iss.push(issue('warning', 'hint', 'exit ' + h.exit + ' cannot be honoured with ' + (cor ? 'corridor ' + h.corridor : 'any clean route') + ', ignored', 'change exit or the corridor'));
    }
    var mid = { v: (a.cy + b.cy) / 2, h: (a.cx + b.cx) / 2 };
    plan.pool = pool.slice().sort(function (p, q) {
      return (p.hits.length > 0) - (q.hits.length > 0) || p.cost - q.cost ||
        Math.abs(p.m - mid[p.axis]) - Math.abs(q.m - mid[q.axis]) || (p.axis < q.axis ? 1 : p.axis > q.axis ? -1 : 0) || p.m - q.m;
    });
    adopt(plan, plan.pool[0]);
    return plan;
  }

  function adopt(plan, c) {
    plan.cand = c;
    plan.axis = c.axis; plan.m = plan.base = c.m; plan.chan = c.chan;
    // run extent along the run, for bundling
    var rs = segsOf(c.pts).filter(function (s) { return s.h === (c.axis === 'v') && Math.abs(s.c - c.m) < 0.5; })[0];
    plan.run = rs ? [rs.lo, rs.hi] : null;
  }

  // Second look, in link order: a link may take its next-cheapest clean candidate when that
  // crosses fewer of the other routes (W_CROSS per crossing). Lanes are not assigned yet, so a
  // shared run is not counted here; bundling separates those.
  function refine(plans) {
    plans.forEach(function (p) {
      if (p.viaPts || p.cand.rule === 'corridor' || p.pool.length < 2) return;
      var others = plans.filter(function (q) { return q !== p; }).map(function (q) { return segsOf(q.viaPts || q.cand.pts); });
      var best = null, bestCost = 0;
      p.pool.forEach(function (c) {
        if (c.hits.length && best) return;
        var sg = segsOf(c.pts), cr = 0;
        others.forEach(function (o) { cr += pairStats(sg, o).cross; });
        var cost = (c.hits.length ? BIG : 0) + c.cost + W_CROSS * cr;
        if (best === null || cost < bestCost) { best = c; bestCost = cost; }
      });
      if (best !== p.cand) adopt(p, best);
    });
  }

  function finalIssues(plans) {
    plans.forEach(function (p) {
      if (p.viaPts) return;
      var c = p.cand, h = p.hint;
      p.rule = c.hits.length ? 'blocked' : c.rule === 'straight' && c.pts.length === 2 ? 'straight' : c.rule === 'straight' ? 'auto' : c.rule;
      if (c.hits.length) {
        p.issues.push(issue('error', 'blocked', 'no clean route; the best passes under ' + c.hits.join(', '),
          'add route.corridor (below:<id> of a box beside the gap to use) or route.via waypoints in ground units'));
      }
      if (c.rule === 'corridor' && c.chan.hi - c.chan.lo < MIN_GAP) {
        p.issues.push(issue('warning', 'narrow', 'corridor ' + h.corridor + ' is only ' + Math.round(c.chan.hi - c.chan.lo) + ' units wide', 'pick a wider gap or add gap/pad to the layout'));
      }
    });
  }

  /* ---------- bundles, lanes, ports ---------- */
  function bundlesOf(plans) {
    var P = plans.filter(function (p) { return !p.viaPts && p.run; }), parent = P.map(function (_, i) { return i; });
    function find(i) { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; }
    for (var i = 0; i < P.length; i++) for (var j = i + 1; j < P.length; j++) {
      var p = P[i], q = P[j];
      if (p.axis !== q.axis) continue;
      var chanMeet = Math.abs(p.base - q.base) < LANE;
      var runMeet = Math.min(p.run[1], q.run[1]) - Math.max(p.run[0], q.run[0]) > 1;
      if (chanMeet && runMeet) parent[find(i)] = find(j);
    }
    var groups = {}, order = [];
    P.forEach(function (p, i) { var r = find(i); if (!groups[r]) { groups[r] = []; order.push(r); } groups[r].push(p); });
    return order.map(function (r) { return groups[r]; }).filter(function (g) { return g.length > 1; });
  }

  // A gap holds floor((width - 16) / LANE) + 1 lanes. When a bundle overflows, the links beyond
  // that (unhinted, longest runs first) move to their next clean candidate outside that gap.
  function spill(plans) {
    function runLen(p) { return p.run ? p.run[1] - p.run[0] : 0; }
    for (var it = 0; it < 8; it++) {
      var moved = false;
      bundlesOf(plans).forEach(function (g) {
        var lo = -Infinity, hi = Infinity;
        g.forEach(function (p) { lo = Math.max(lo, p.chan.lo); hi = Math.min(hi, p.chan.hi); });
        if (!(lo < hi)) return;
        var cap = Math.max(1, Math.floor((hi - lo - 16) / LANE) + 1);
        if (g.length <= cap) return;
        g.slice().sort(function (p, q) {
          return (p.lane == null) - (q.lane == null) || (p.cand.rule !== 'corridor') - (q.cand.rule !== 'corridor') || runLen(p) - runLen(q) || p.idx - q.idx;
        }).slice(cap).forEach(function (p) {
          if (p.cand.rule === 'corridor' || p.lane != null) return;
          (p.banned = p.banned || []).push({ axis: p.axis, m: p.base });
          var alt = p.pool.filter(function (c) {
            return !c.hits.length && !p.banned.some(function (b) { return b.axis === c.axis && Math.abs(b.m - c.m) < 0.5; });
          })[0];
          if (alt) { adopt(p, alt); moved = true; }
        });
      });
      if (!moved) break;
    }
  }

  // lane coordinates for a bundle: slot k -> coordinate (slot 0 nearest the corridor's box)
  function slotsFor(g) {
    var n = g.length, lo = -Infinity, hi = Infinity, sum = 0, near = null;
    g.forEach(function (p) { lo = Math.max(lo, p.chan.lo); hi = Math.min(hi, p.chan.hi); sum += p.base; if (!near && p.chan.near) near = p.chan.near; });
    var c = lo < hi ? (g.every(function (p) { return !p.chan.body; }) ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, sum / n))) : sum / n;
    var room = lo < hi ? hi - lo - 2 * 8 : 0, sp = LANE, narrow = false;
    if ((n - 1) * LANE > room) { sp = Math.max(room / (n - 1), 0); narrow = sp < 8; if (narrow) sp = 8; }
    var first = c - (n - 1) / 2 * sp;
    if (lo < hi) first = Math.max(lo + 8, Math.min(first, hi - 8 - (n - 1) * sp));
    var s = [];
    for (var k = 0; k < n; k++) s.push(first + k * sp);
    if (near === 'hi') s.reverse();
    return { coords: s, narrow: narrow, lo: lo, hi: hi };
  }

  // the end segment of a route at one node (from the node's centre line to the run), at offset off
  function endSeg(p, end, off) {
    var n = p[end];
    if (p.axis === 'v') { var x = n.cx + off; return { h: false, c: x, lo: Math.min(n.cy, p.m), hi: Math.max(n.cy, p.m) }; }
    var y = n.cy + off;
    return { h: true, c: y, lo: Math.min(n.cx, p.m), hi: Math.max(n.cx, p.m) };
  }
  function endClear(ctx, p, end, off) {
    var sg = endSeg(p, end, off);
    var obs = ctx.nodes.filter(function (n) { return n.id !== p.a.id && n.id !== p.b.id; }).concat(ctx.tabs);
    return !obs.some(function (r) { return segHits(sg, r, CLEAR); });
  }

  // Port offsets: route ends that leave/enter a node side perpendicular to it share that side;
  // spread PORT apart, nested (the run nearer the node turns on the side it turns to), then the
  // whole group slides along the side (12-unit steps) until no end passes under a node or a tab.
  function assignPorts(ctx, plans) {
    var groups = {}, keys = [], fixed = {};
    plans.forEach(function (p) {
      p.pa = 0; p.pb = 0;
      if (p.viaPts) return;
      var pts = build(p);
      [['a', false], ['b', true]].forEach(function (e) {
        var node = p[e[0]], other = p[e[0] === 'a' ? 'b' : 'a'];
        var side = sideAt(pts, e[1]);
        var crossAxis = p.axis === 'v' ? (side === 'top' || side === 'bottom') : (side === 'left' || side === 'right');
        if (pts.length < 2) return;
        /* an end that leaves along its own run (a straight route, or a run through the node) cannot move: it holds the
           point m on that side, and the movable ends of the side keep clear of it */
        if (!crossAxis) { (fixed[node.id + ':' + side] = fixed[node.id + ':' + side] || []).push(p.m - (p.axis === 'v' ? node.cy : node.cx)); return; }
        var depth = Math.abs(p.m - (p.axis === 'v' ? node.cy : node.cx));
        var t = Math.sign(p.axis === 'v' ? other.cx - node.cx : other.cy - node.cy);
        if (pts.length === 2) t = 0;
        var k = node.id + ':' + side;
        if (!groups[k]) { groups[k] = []; keys.push(k); }
        groups[k].push({ p: p, end: e[0], key: t === 0 ? 0 : t * (BIG - depth), len: p.axis === 'v' ? node.w : node.h });
      });
    });
    keys.forEach(function (k) {
      var g = groups[k], n = g.length, half = g[0].len / 2 - PORT_END;
      g.sort(function (u, v) { return u.key - v.key || u.p.idx - v.p.idx; });
      var sp = n > 1 ? Math.min(PORT, 2 * half / (n - 1)) : 0;
      g.forEach(function (u, i) { u.off = (i - (n - 1) / 2) * sp; });
      var room = half - (n - 1) / 2 * sp, shift = null, fx = fixed[k] || [];
      function apart(d) { return g.every(function (u) { return fx.every(function (o) { return Math.abs(u.off + d - o) >= LANE; }); }); }
      function clear(d) { return g.every(function (u) { return endClear(ctx, u.p, u.end, u.off + d); }); }
      /* an end segment must not lie along a segment of another route as last built (they would share it) */
      function own(d) {
        return g.every(function (u) {
          var sg = endSeg(u.p, u.end, u.off + d);
          return plans.every(function (q) {
            return q === u.p || !q.lastPts || segsOf(q.lastPts).every(function (v) {
              return v.h !== sg.h || Math.abs(v.c - sg.c) >= 6 || Math.min(v.hi, sg.hi) - Math.max(v.lo, sg.lo) <= 2;
            });
          });
        });
      }
      [function (d) { return apart(d) && clear(d) && own(d); }, function (d) { return apart(d) && clear(d); }, clear, apart].forEach(function (ok) {
        for (var step = 0; shift === null && step <= 2 * Math.floor(room / 12); step++) {
          var d = (step % 2 ? 1 : -1) * Math.ceil(step / 2) * 12;
          if (ok(d)) shift = d;
        }
      });
      if (shift === null) shift = 0;
      g.forEach(function (u) { if (u.end === 'a') u.p.pa = u.off + shift; else u.p.pb = u.off + shift; });
    });
  }

  /* ports twice: the second pass keeps each end off the segments the first pass built for the other routes */
  function materialize(ctx, plans) {
    plans.forEach(function (p) { p.lastPts = null; });
    assignPorts(ctx, plans);
    plans.forEach(function (p) { p.lastPts = build(p); });
    assignPorts(ctx, plans);
    return plans.map(function (p) { return build(p); });
  }

  // shared segments, nodes passed under, proper crossings between two polylines
  function pairStats(s1, s2) {
    var shared = 0, cross = 0;
    s1.forEach(function (u) {
      s2.forEach(function (v) {
        if (u.h === v.h) {
          if (Math.abs(u.c - v.c) < 4 && Math.min(u.hi, v.hi) - Math.max(u.lo, v.lo) > 2) shared++;
        } else {
          var hs = u.h ? u : v, vs = u.h ? v : u;
          if (vs.c > hs.lo + 0.5 && vs.c < hs.hi - 0.5 && hs.c > vs.lo + 0.5 && hs.c < vs.hi - 0.5) cross++;
        }
      });
    });
    return { shared: shared, cross: cross };
  }
  function score(ctx, plans, all) {
    var S = all.map(segsOf), tot = 0;
    for (var i = 0; i < S.length; i++) {
      var p = plans[i];
      tot += 1000 * evaluate(ctx, all[i], p.a, p.b).hits.length;
      for (var j = i + 1; j < S.length; j++) { var st = pairStats(S[i], S[j]); tot += 1000 * st.shared + st.cross; }
    }
    return tot;
  }

  function permutations(n) {
    var out = [];
    (function rec(cur, used) {
      if (cur.length === n) { out.push(cur.slice()); return; }
      for (var i = 0; i < n; i++) if (!used[i]) { used[i] = true; cur.push(i); rec(cur, used); cur.pop(); used[i] = false; }
    })([], {});
    return out;
  }

  function assignLanes(ctx, plans) {
    spill(plans);
    var bundles = bundlesOf(plans);
    var setups = bundles.map(function (g) {
      var sl = slotsFor(g), n = g.length, taken = {}, free = [], fixed = [], loose = [];
      g.slice().sort(function (p, q) { return (p.lane == null) - (q.lane == null) || (p.lane || 0) - (q.lane || 0) || p.idx - q.idx; }).forEach(function (p) {
        if (p.lane != null && p.lane >= 0 && p.lane < n && !taken[p.lane]) { taken[p.lane] = true; fixed.push(p); }
        else {
          if (p.lane != null) p.issues.push(issue('warning', 'hint', 'lane ' + p.lane + ' is taken or outside the ' + n + ' lanes of its bundle, reassigned', 'give each link in the bundle a distinct lane 0..' + (n - 1)));
          loose.push(p);
        }
      });
      for (var k = 0; k < n; k++) if (!taken[k]) free.push(k);
      if (sl.narrow) g.forEach(function (p) { p.issues.push(issue('warning', 'narrow', 'the gap holds ' + n + ' lanes less than 8 units apart', 'widen the gap (layout gap/pad/belowGap) or route some links elsewhere')); });
      fixed.forEach(function (p) { p.slot = p.lane; });
      loose.sort(function (p, q) { return p.idx - q.idx; });
      loose.forEach(function (p, i) { p.slot = free[i]; });
      g.forEach(function (p) { p.m = sl.coords[p.slot]; p.lanes = n; });
      return { g: g, sl: sl, loose: loose, free: free };
    });
    setups.forEach(function (st) {
      if (st.loose.length < 2) return;
      if (st.loose.length > MAX_PERM) {
        st.loose.forEach(function (p) { p.issues.push(issue('warning', 'lanes', 'bundle too large to search lane orders; kept link order', 'add route.lane hints')); });
        return;
      }
      var best = null, bestOrder = null;
      permutations(st.loose.length).forEach(function (perm) {
        st.loose.forEach(function (p, i) { p.slot = st.free[perm[i]]; p.m = st.sl.coords[p.slot]; });
        var sc = score(ctx, plans, materialize(ctx, plans));
        if (best === null || sc < best) { best = sc; bestOrder = perm; }
      });
      st.loose.forEach(function (p, i) { p.slot = st.free[bestOrder[i]]; p.m = st.sl.coords[p.slot]; });
    });
    plans.forEach(function (p) { if (p.slot == null) { p.slot = 0; p.lanes = p.lanes || 1; } });
  }

  function routeLinks(estate, story) {
    var ctx = ctxOf(estate), seen = {}, plans = [];
    ctx.iso = !!(estate.sizes && estate.sizes.iso);
    (story.links || []).forEach(function (l, i) {
      if (!ctx.B[l.from] || !ctx.B[l.to] || ctx.B[l.from].type !== 'node' || ctx.B[l.to].type !== 'node') return;
      var id = l.from + '-' + l.to;
      if (seen[id]) { var n = 2; while (seen[id + '#' + n]) n++; id += '#' + n; }
      seen[id] = true;
      var p = planLink(ctx, l, i);
      p.id = id;
      plans.push(p);
    });
    refine(plans);
    finalIssues(plans);
    assignLanes(ctx, plans);
    var all = materialize(ctx, plans), E = {};
    plans.forEach(function (p, i) {
      var pts = all[i], len = polyLen(pts);
      E[p.id] = {
        id: p.id, a: p.a.id, b: p.b.id, pts: pts, d: roundedPath(pts, ROUND), len: len,
        shape: shapeOf(pts), rule: p.rule === 'straight' && pts.length > 2 ? 'auto' : p.rule, axis: p.viaPts ? null : p.axis,
        lane: p.viaPts ? null : p.slot, lanes: p.viaPts ? 1 : p.lanes,
        exit: sideAt(pts, false), entry: sideAt(pts, true),
        ports: portsFor(pts, estate.boxes), issues: p.issues
      };
    });
    return E;
  }

  // the route for a pair of systems in either direction: {id, rev} or null
  function findLink(E, from, to) {
    var ids = Object.keys(E);
    for (var i = 0; i < ids.length; i++) {
      var r = E[ids[i]];
      if (r.a === from && r.b === to) return { id: r.id, rev: false };
    }
    for (var j = 0; j < ids.length; j++) {
      var q = E[ids[j]];
      if (q.a === to && q.b === from) return { id: q.id, rev: true };
    }
    return null;
  }

  /* checks: [{level, kind, links: [ids], message, fix}]
     opts.near (units): also warn when a route passes within that distance of a node it does not
     belong to (iso: a route skimming a block). */
  function checkRoutes(estate, E, opts) {
    opts = opts || {};
    var out = [], ids = Object.keys(E), S = {};
    ids.forEach(function (id) { S[id] = segsOf(E[id].pts); });
    ids.forEach(function (id) {
      var r = E[id];
      r.issues.forEach(function (q) { out.push({ level: q.level, kind: q.kind, links: [id], message: id + ': ' + q.message, fix: q.fix }); });
      estate.nodes.forEach(function (n) {
        if (n.id === r.a || n.id === r.b) return;
        if (S[id].some(function (s) { return segHits(s, n, 0); })) {
          out.push({ level: 'error', kind: 'through', links: [id], message: id + ' passes under ' + n.id, fix: 'add route.corridor or route.via to ' + id });
        } else if (opts.near && S[id].some(function (s) { return segHits(s, n, opts.near); })) {
          out.push({ level: 'warning', kind: 'near', links: [id], message: id + ' skims ' + n.id + ' (within ' + opts.near + ')', fix: 'move the route with route.corridor/lane, or add gap in the layout' });
        }
      });
      estate.boxes.forEach(function (bx) {
        S[id].forEach(function (s) {
          var e0 = s.h ? bx.y : bx.x, e1 = e0 + (s.h ? bx.h : bx.w), r0 = s.h ? bx.x : bx.y, r1 = r0 + (s.h ? bx.w : bx.h);
          [e0, e1].forEach(function (e) {
            if (Math.abs(s.c - e) < 6 && Math.min(s.hi, r1) - Math.max(s.lo, r0) > 10) {
              out.push({ level: 'warning', kind: 'skim', links: [id], message: id + ' runs along the border of ' + bx.id, fix: 'move the run into the gap (route.corridor) or adjust layout padding' });
            }
          });
        });
      });
    });
    for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) {
      var st = pairStats(S[ids[i]], S[ids[j]]);
      if (st.shared) out.push({ level: 'error', kind: 'shared', links: [ids[i], ids[j]], message: ids[i] + ' and ' + ids[j] + ' share a segment', fix: 'give them distinct route.lane values or separate corridors' });
      if (st.cross) out.push({ level: 'info', kind: 'crossing', links: [ids[i], ids[j]], message: ids[i] + ' crosses ' + ids[j] + (st.cross > 1 ? ' (' + st.cross + 'x)' : ''), fix: 'reorder lanes with route.lane if the crossing reads badly' });
    }
    return out;
  }

  EXK.route = {
    LANE: LANE, PORT: PORT,
    routeLinks: routeLinks, findLink: findLink, checkRoutes: checkRoutes,
    portsFor: portsFor, markers: markers, roundedPath: roundedPath, polyLen: polyLen, pointAt: pointAt,
    segments: segsOf
  };
})();
