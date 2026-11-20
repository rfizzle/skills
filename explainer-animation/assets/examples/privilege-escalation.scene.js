/* Privilege escalation paths, as a custom scene (--pattern custom --scene): the "graph reachability" pattern.
   What an identity can reach from where it stands, hop by hop, the specific chain that turns a small grant into full
   control, and how much of that reach disappears when one edge is cut. Only the graph's own drawing and choreography
   live here; the stage, chrome, step timing, chip and window.anim come from the kit through ctx.

   Story blocks that drive it:  nodes  { id, name, kind: identity | role | resource, crown? }
                                edges  { id, from, to, kind, why, granted? }   granted: a grant someone made on purpose
                                start  the identity the scene follows (a string id)
                                cuts   { id, name, why, edges: [edge ids] }    one control, removing those edges
   Every record carries `source`. Nothing shown as reachable is typed: counts and positions are computed from the graph.

   Which edge kinds grant movement. "member of", "can assume", "can change" (code or policy: changing a thing is how
   you borrow what it runs as), "runs as" and "can read" move you to the other end. "can list" does not (it shows
   names, it grants no use); it is drawn dashed and never extends reach. Any other kind is an error. A resource that
   nothing leaves (a data store) simply ends the path. Cycles are fine: a node is reached once, at its shortest hop.

   The target. The scene traces the chain to the one crown node that is a resource (here Customer data); any other
   crown node (here Administrator) is drawn with the crown mark and is passed on the way. Exactly one crown resource
   is required.

   Edges that start in the "Not reachable" column and run to a column further left are not drawn across the graph: each is a
   short stub that fades out toward its target, with the target's name in a small tag (the column gets a wider gap for it).

   Pure helpers (no DOM; loaded under Node by scripts/reach.test.mjs through EXK.graph):
     reach(nodes, edges, from, cut?)             -> { id: hop } for every reachable node (from is hop 0); cut: edge ids
     pathTo(nodes, edges, from, to, cut?)        -> the shortest chain as an array of edges, [] when from is to, null if none
     others(nodes, edges, start, target, cut?)   -> ids of the other identities that can also reach target
     given(nodes, edges, from)                   -> reach over the edges marked `granted` only
     layout(nodes, edges, start, box, opts?)     -> columns by hop (unreachable ones in a last column), order inside a
                                                    column chosen to reduce crossings, card positions sized to box, and
                                                    the path of every edge (smooth curves, long ones routed above, the long
                                                    ones that start in the unreachable column as short stubs); opts.nameW is
                                                    the widest card name in px: cards grow to hold it on one line (never
                                                    past a gap of a fifth of a card between columns, so no lane comes back)
   Drawing helpers:
     wave(ctx, t0, r)             reachability spreads one hop per beat: edges light, then nodes, the headline counts up
     tracePath(ctx, path, t0, r)  the escalation chain in the attacker colour; each edge's `why` is a stationary label
     cutEdge(ctx, t0, r)          the control lands (a shield and the cut's name), the edge breaks, what is no longer
                                  reachable drains back to unreached and leaves a ghost outline; the headline counts down
     showOthers(ctx, t0, r)       the other identities that reach the target, before and after, on a second measure
   Headline measure, fixed in one place: "Reachable from <start>: N of M". A second small measure in the last steps. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};
  EXK.scenes = EXK.scenes || {};

  /* =============================== pure graph functions =============================== */
  var MOVING = ['member of', 'can assume', 'can change', 'runs as', 'can read'];
  var NON_MOVING = ['can list'];
  var CARD_H = 98, ARROW = 11, HALF = 6.5, STUB_LEN = 24, TAG_MAX = 150, STUB_DROP = 24;

  function byId(list) { var m = {}; list.forEach(function (x) { m[x.id] = x; }); return m; }

  /* throws a clear message for a malformed graph; returns the node index */
  function validate(nodes, edges) {
    var ids = {}, eids = {};
    nodes.forEach(function (n) {
      if (!n || typeof n.id !== 'string' || !n.id) throw new Error('graph: every node needs a string id');
      if (ids[n.id]) throw new Error('graph: duplicate node id "' + n.id + '"');
      ids[n.id] = n;
    });
    edges.forEach(function (e) {
      if (!e || typeof e.id !== 'string' || !e.id) throw new Error('graph: every edge needs a string id (cuts refer to it)');
      if (eids[e.id]) throw new Error('graph: duplicate edge id "' + e.id + '"');
      eids[e.id] = e;
      if (!ids[e.from]) throw new Error('graph: edge "' + e.id + '" starts at "' + e.from + '", which is not a node');
      if (!ids[e.to]) throw new Error('graph: edge "' + e.id + '" ends at "' + e.to + '", which is not a node');
      if (MOVING.indexOf(e.kind) < 0 && NON_MOVING.indexOf(e.kind) < 0) {
        throw new Error('graph: edge "' + e.id + '" has kind "' + e.kind + '"; kinds that move: ' + MOVING.join(', ') + '; kinds that do not: ' + NON_MOVING.join(', '));
      }
    });
    return ids;
  }
  function cutSet(cut, edges) {
    var gone = {}, known = byId(edges);
    (cut || []).forEach(function (c) {
      var id = typeof c === 'string' ? c : c && c.id;
      if (!known[id]) throw new Error('graph: cut names edge "' + id + '", which is not in the graph');
      gone[id] = true;
    });
    return gone;
  }
  function movers(edges, gone) {
    var out = {};
    edges.forEach(function (e) { if (MOVING.indexOf(e.kind) >= 0 && !gone[e.id]) (out[e.from] = out[e.from] || []).push(e); });
    return out;
  }
  function reach(nodes, edges, from, cut) {
    var ids = validate(nodes, edges);
    if (!ids[from]) throw new Error('graph: "' + from + '" is not a node');
    var out = movers(edges, cutSet(cut, edges)), dist = {}, q = [from];
    dist[from] = 0;
    for (var i = 0; i < q.length; i++) {
      (out[q[i]] || []).forEach(function (e) { if (dist[e.to] === undefined) { dist[e.to] = dist[q[i]] + 1; q.push(e.to); } });
    }
    return dist;
  }
  function pathTo(nodes, edges, from, to, cut) {
    var ids = validate(nodes, edges);
    if (!ids[from]) throw new Error('graph: "' + from + '" is not a node');
    if (!ids[to]) throw new Error('graph: "' + to + '" is not a node');
    if (from === to) return [];
    var out = movers(edges, cutSet(cut, edges)), via = {}, seen = {}, q = [from];
    seen[from] = true;
    for (var i = 0; i < q.length && !seen[to]; i++) {
      (out[q[i]] || []).forEach(function (e) { if (!seen[e.to]) { seen[e.to] = true; via[e.to] = e; q.push(e.to); } });
    }
    if (!seen[to]) return null;
    var path = [];
    for (var at = to; at !== from; at = via[at].from) path.unshift(via[at]);
    return path;
  }
  function others(nodes, edges, start, target, cut) {
    return nodes.filter(function (n) {
      return n.kind === 'identity' && n.id !== start && n.id !== target && pathTo(nodes, edges, n.id, target, cut) !== null;
    }).map(function (n) { return n.id; });
  }
  function given(nodes, edges, from) {
    return reach(nodes, edges.filter(function (e) { return e.granted === true; }), from);
  }

  function permutations(a) {
    if (a.length <= 1) return [a.slice()];
    var out = [];
    a.forEach(function (x, i) { permutations(a.slice(0, i).concat(a.slice(i + 1))).forEach(function (p) { out.push([x].concat(p)); }); });
    return out;
  }
  /* lower is better: crossings between neighbouring columns, then same-column edges that are not neighbours, then edge slope */
  function orderCost(cols, col, edges) {
    var y = {}, ix = {}, gaps = {}, cross = 0, len = 0, same = 0;
    cols.forEach(function (ids) { ids.forEach(function (id, i) { y[id] = (i + 0.5) / ids.length; ix[id] = i; }); });
    edges.forEach(function (e) {
      var a = col[e.from], b = col[e.to];
      if (a === b) { same += Math.max(0, Math.abs(ix[e.from] - ix[e.to]) - 1); return; }
      if (Math.abs(a - b) !== 1) return;
      var l = a < b ? e.from : e.to, r = a < b ? e.to : e.from;
      (gaps[Math.min(a, b)] = gaps[Math.min(a, b)] || []).push([y[l], y[r]]);
      len += Math.abs(y[l] - y[r]);
    });
    Object.keys(gaps).forEach(function (g) {
      var L = gaps[g];
      for (var i = 0; i < L.length; i++) for (var j = i + 1; j < L.length; j++) if ((L[i][0] - L[j][0]) * (L[i][1] - L[j][1]) < -1e-9) cross++;
    });
    return { cost: cross * 10 + same * 3 + len, crossings: cross };
  }

  function bezier(p, t) {
    var u = 1 - t;
    return { x: u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
             y: u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1] };
  }
  function rounded(pts, r) {
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
  function head(tip, dir) {
    var bx = tip.x - dir.x * ARROW, by = tip.y - dir.y * ARROW, px = -dir.y * HALF, py = dir.x * HALF;
    return tip.x + ',' + tip.y + ' ' + (bx + px) + ',' + (by + py) + ' ' + (bx - px) + ',' + (by - py);
  }

  /* box = {x, y, w, h}: where the cards go (area px). Long edges run in lanes above box.y; those that start in the last
     (unreachable) column are stubs instead, and that column's gap grows to hold a stub and its tag. */
  function layout(nodes, edges, start, box, opts) {
    var dist = reach(nodes, edges, start), maxd = 0, un = false;
    nodes.forEach(function (n) { if (dist[n.id] === undefined) un = true; else maxd = Math.max(maxd, dist[n.id]); });
    var ncol = maxd + 1 + (un ? 1 : 0), col = {}, cols = [], c, i;
    for (c = 0; c < ncol; c++) cols.push([]);
    nodes.forEach(function (n) { var k = dist[n.id] === undefined ? maxd + 1 : dist[n.id]; col[n.id] = k; cols[k].push(n.id); });

    /* order within columns: exhaustive per column, a few sweeps, keeping the best */
    var best = orderCost(cols, col, edges).cost;
    for (var sweep = 0; sweep < 6; sweep++) {
      var improved = false;
      for (c = 0; c < ncol; c++) {
        if (cols[c].length < 2 || cols[c].length > 7) continue;
        var keep = cols[c], pick = keep;
        permutations(keep).forEach(function (p) {
          cols[c] = p;
          var s = orderCost(cols, col, edges).cost;
          if (s < best - 1e-9) { best = s; pick = p; improved = true; }
        });
        cols[c] = pick;
      }
      if (!improved) break;
    }

    var maxk = 1;
    cols.forEach(function (ids) { maxk = Math.max(maxk, ids.length); });
    var stubbed = un && ncol > 2 && edges.some(function (e) { return col[e.from] === ncol - 1 && col[e.to] < ncol - 2; });
    var LG = stubbed ? STUB_LEN + TAG_MAX + 16 : 0, free = ncol - 1 - (stubbed ? 1 : 0);
    var W = Math.min(230, (box.w - LG) / (ncol + free * (stubbed ? 0.3 : 0.36)));
    if (opts && opts.nameW) W = Math.min(230, Math.max(W, Math.min(opts.nameW + 24, (box.w - LG) / (ncol + free * 0.2))));     /* a card holds its widest name on one line, the gaps keep a fifth of a card */
    var G = free > 0 ? (box.w - LG - ncol * W) / free : 0;
    var H = Math.min(CARD_H, box.h / maxk - 14), pos = {};
    cols.forEach(function (ids, k) {
      var x = box.x + k * (W + G) + (stubbed && k === ncol - 1 ? LG - G : 0);
      ids.forEach(function (id, j) {
        pos[id] = { id: id, col: k, row: j, rows: ids.length, w: W, h: H, x: x, y: box.y + (j + 0.5) * box.h / ids.length - H / 2 };
      });
    });

    /* ports: where each edge meets a card, spread along the side by where the other end is */
    var plan = {}, ports = {};
    edges.forEach(function (e) {
      var a = pos[e.from], b = pos[e.to], dc = b.col - a.col, p;
      if (dc === 1) p = { kind: 'curve', fs: 'R', ts: 'L' };
      else if (dc === -1) p = { kind: 'curve', fs: 'L', ts: 'R' };
      else if (dc === 0 && Math.abs(a.row - b.row) === 1) p = { kind: 'line', fs: b.row > a.row ? 'B' : 'T', ts: b.row > a.row ? 'T' : 'B' };
      else if (dc === 0) p = { kind: 'arc', fs: 'L', ts: 'L' };
      else if (stubbed && a.col === ncol - 1) p = { kind: 'stub', fs: 'L', ts: 'L' };
      else p = { kind: 'lane', fs: dc < 0 ? 'L' : 'R', ts: 'T', span: Math.abs(dc) };
      plan[e.id] = p;
      [['from', e.from, p.fs, e.to], ['to', e.to, p.ts, e.from]].forEach(function (s) {
        if (p.kind === 'stub' && s[0] === 'to') return;
        var o = pos[s[3]], key = s[1] + '|' + s[2];
        (ports[key] = ports[key] || []).push({ e: e, end: s[0], other: p.kind === 'lane' && s[0] === 'from' ? -1e6 : (s[2] === 'T' || s[2] === 'B' ? o.x : o.y) });
      });
    });
    Object.keys(ports).forEach(function (key) {
      var list = ports[key], nid = key.split('|')[0], side = key.split('|')[1], p = pos[nid];
      list.sort(function (u, v) { return u.other - v.other; });
      var usable = (side === 'L' || side === 'R' ? p.h : p.w) - 40, step = list.length > 1 ? Math.min(24, usable / (list.length - 1)) : 0;
      list.forEach(function (it, j) { plan[it.e.id][it.end + 'Off'] = (j - (list.length - 1) / 2) * step + (plan[it.e.id].kind === 'stub' ? Math.min(STUB_DROP, p.h / 2 - 14) : 0); });
    });
    function port(id, side, off) {
      var p = pos[id];
      if (side === 'R') return { x: p.x + p.w, y: p.y + p.h / 2 + off };
      if (side === 'L') return { x: p.x, y: p.y + p.h / 2 + off };
      if (side === 'T') return { x: p.x + p.w / 2 + off, y: p.y };
      return { x: p.x + p.w / 2 + off, y: p.y + p.h };
    }
    var laneEdges = edges.filter(function (e) { return plan[e.id].kind === 'lane'; })
      .sort(function (u, v) { return plan[u.id].span - plan[v.id].span; });
    var out = {};
    edges.forEach(function (e) {
      var p = plan[e.id], s = port(e.from, p.fs, p.fromOff || 0), t = port(e.to, p.ts, p.toOff || 0), g;
      if (p.kind === 'curve') {
        var dx = t.x > s.x ? 1 : -1, bx = t.x - dx * ARROW, k = Math.abs(bx - s.x) * 0.5;
        var pts = [[s.x, s.y], [s.x + dx * k, s.y], [bx - dx * k, t.y], [bx, t.y]];
        g = { d: 'M' + pts[0] + ' C' + pts[1] + ' ' + pts[2] + ' ' + pts[3], tip: t, dir: { x: dx, y: 0 }, mid: bezier(pts, 0.5) };
      } else if (p.kind === 'line') {
        var dy = t.y > s.y ? 1 : -1, by = t.y - dy * ARROW;
        g = { d: 'M' + s.x + ',' + s.y + ' L' + s.x + ',' + by, tip: { x: s.x, y: t.y }, dir: { x: 0, y: dy }, mid: { x: s.x, y: (s.y + t.y) / 2 } };
      } else if (p.kind === 'arc') {
        var bulge = Math.min(54, G * 0.7 + 8), bx2 = t.x - ARROW, pts2 = [[s.x, s.y], [s.x - bulge, s.y], [bx2 - bulge, t.y], [bx2, t.y]];
        g = { d: 'M' + pts2[0] + ' C' + pts2[1] + ' ' + pts2[2] + ' ' + pts2[3], tip: t, dir: { x: 1, y: 0 }, mid: bezier(pts2, 0.5) };
      } else if (p.kind === 'stub') {
        var x2 = s.x - STUB_LEN;
        g = { d: 'M' + s.x + ',' + s.y + ' L' + x2 + ',' + s.y, tip: { x: x2, y: s.y }, dir: { x: -1, y: 0 }, mid: { x: (s.x + x2) / 2, y: s.y }, stub: { x1: s.x, x2: x2, y: s.y, to: e.to } };
      } else {
        var rank = laneEdges.indexOf(e), dirx = p.fs === 'L' ? -1 : 1, nl = laneEdges.length;
        var laneY = box.y - 18 - rank * 14, chx = s.x + dirx * (14 + (nl - 1 - rank) * 10);
        var poly = [[s.x, s.y], [chx, s.y], [chx, laneY], [t.x, laneY], [t.x, t.y - ARROW]];
        g = { d: rounded(poly, 12), tip: t, dir: { x: 0, y: 1 }, mid: { x: (chx + t.x) / 2, y: laneY }, laneY: laneY };
      }
      g.kind = p.kind; g.head = p.kind === 'stub' ? '' : head(g.tip, g.dir);
      out[e.id] = g;
    });
    var res = { dist: dist, col: col, cols: cols, ncol: ncol, hasUnreached: un, pos: pos, edges: out, W: W, H: H, G: G, box: box, lanes: laneEdges.length, stubs: edges.filter(function (e) { return plan[e.id].kind === 'stub'; }).length };
    res.crossings = orderCost(cols, col, edges).crossings;
    return res;
  }

  EXK.graph = { MOVING: MOVING, NON_MOVING: NON_MOVING, reach: reach, pathTo: pathTo, others: others, given: given, layout: layout };
  if (typeof document === 'undefined') return;            /* under Node (the unit tests) only the pure helpers are needed */

  /* =============================== the scene =============================== */
  var BOX = { x: 24, y: 176, w: 1872, h: 528 };            /* cards, area px; the strip above holds the measures and the label */
  var D, W;                                                /* derived data, drawn parts */
  var BEAT = 1.35;                                         /* seconds per hop of the wave */

  function shapeD(kind, w, h) {
    if (kind === 'identity') { var r = 40; return 'M' + r + ',0 H' + (w - r) + ' A' + r + ',' + r + ' 0 0 1 ' + (w - r) + ',' + h + ' H' + r + ' A' + r + ',' + r + ' 0 0 1 ' + r + ',0 Z'; }
    if (kind === 'role') { var c = 16; return 'M' + c + ',0 H' + (w - c) + ' L' + w + ',' + c + ' V' + (h - c) + ' L' + (w - c) + ',' + h + ' H' + c + ' L0,' + (h - c) + ' V' + c + ' Z'; }
    return 'M8,0 H' + (w - 8) + ' Q' + w + ',0 ' + w + ',8 V' + (h - 8) + ' Q' + w + ',' + h + ' ' + (w - 8) + ',' + h + ' H8 Q0,' + h + ' 0,' + (h - 8) + ' V8 Q0,0 8,0 Z';
  }

  function derive(ctx) {
    var d = { nodes: ctx.block('nodes'), edges: ctx.block('edges'), cuts: ctx.block('cuts') };
    d.byId = byId(d.nodes); d.edge = byId(d.edges);
    d.startId = ctx.story.start;
    if (typeof d.startId !== 'string' || !d.byId[d.startId]) throw new Error('privilege-escalation: story.start must be the id of a node');
    d.start = d.byId[d.startId];
    if (d.start.kind !== 'identity') throw new Error('privilege-escalation: the start node must be an identity');
    var crowns = d.nodes.filter(function (n) { return n.crown && n.kind === 'resource'; });
    if (crowns.length !== 1) throw new Error('privilege-escalation: exactly one node must be a crown resource (kind "resource", crown true); found ' + crowns.length);
    d.target = crowns[0];
    if (d.cuts.length !== 1) throw new Error('privilege-escalation: this scene shows one control; the story has ' + d.cuts.length + ' in cuts');
    d.cut = d.cuts[0];
    d.cutIds = d.cut.edges.slice();
    d.dist0 = reach(d.nodes, d.edges, d.startId);
    d.dist1 = reach(d.nodes, d.edges, d.startId, d.cutIds);
    d.given = given(d.nodes, d.edges, d.startId);
    d.chain = pathTo(d.nodes, d.edges, d.startId, d.target.id);
    if (!d.chain) throw new Error('privilege-escalation: no path from "' + d.startId + '" to "' + d.target.id + '" before the cut; there is no escalation to show');
    if (pathTo(d.nodes, d.edges, d.startId, d.target.id, d.cutIds) !== null) throw new Error('privilege-escalation: "' + d.startId + '" still reaches "' + d.target.id + '" after the cut; the control does not break the chain');
    var nGiven = Object.keys(d.given).length, nReach = Object.keys(d.dist0).length;
    Object.keys(d.given).forEach(function (id) { if (d.dist0[id] === undefined) throw new Error('privilege-escalation: "' + id + '" is granted but not reachable'); });
    if (!(nGiven < nReach)) throw new Error('privilege-escalation: the direct grants must be a strict subset of the full reach');
    d.M = d.nodes.length - 1;
    d.n0 = nReach - 1; d.n1 = Object.keys(d.dist1).length - 1; d.nGiven = nGiven - 1;
    d.maxHop = Math.max.apply(null, Object.keys(d.dist0).map(function (k) { return d.dist0[k]; }));
    d.idents = d.nodes.filter(function (n) { return n.kind === 'identity' && n.id !== d.startId; });
    d.oth0 = others(d.nodes, d.edges, d.startId, d.target.id);
    d.oth1 = others(d.nodes, d.edges, d.startId, d.target.id, d.cutIds);
    if (!d.oth0.length) throw new Error('privilege-escalation: no other identity reaches "' + d.target.id + '" before the cut, so the "who else" step has nothing to show');
    d.givenEdges = d.edges.filter(function (e) { return e.granted === true && d.given[e.from] !== undefined && d.given[e.to] !== undefined && d.given[e.to] > d.given[e.from]; })
      .sort(function (a, b) { return d.given[a.to] - d.given[b.to]; });
    function live(dist, cut) { return function (e) { return MOVING.indexOf(e.kind) >= 0 && dist[e.from] !== undefined && cut.indexOf(e.id) < 0; }; }
    d.reachEdges = d.edges.filter(live(d.dist0, []));
    d.drainE = d.reachEdges.filter(function (e) { return !live(d.dist1, d.cutIds)(e); });
    d.drainN = d.nodes.filter(function (n) { return d.dist0[n.id] !== undefined && d.dist1[n.id] === undefined; });
    if (!d.drainN.length) throw new Error('privilege-escalation: the cut drains nothing');
    d.lay = layout(d.nodes, d.edges, d.startId, BOX, { nameW: widestName(ctx, d.nodes) });
    return d;
  }

  /* the widest card name at the card's text size, measured in the page */
  function widestName(ctx, nodes) {
    var probe = ctx.el('text', { 'class': 'sans', 'font-size': 22, 'font-weight': 650, opacity: 0 }, ctx.layers.world), w = 0;
    nodes.forEach(function (n) { probe.textContent = n.name; w = Math.max(w, Math.ceil(probe.getBBox().width)); });
    ctx.layers.world.removeChild(probe);
    return w;
  }

  function nameOf(id) { return D.byId[id].name; }
  function join(names) { return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]; }
  function headOf(e) { return nameOf(e.from) + ' ' + e.kind + ' ' + nameOf(e.to); }

  /* opacity, tracked per element so every tween starts from where the last one left it (build order is time order) */
  function fade(ctx, el, to, t, dur) {
    var from = el.__v === undefined ? 0 : el.__v;
    if (from === to) return;
    ctx.tl.fromTo(el, { opacity: from }, { opacity: to, duration: dur === undefined ? 0.4 : dur, ease: 'power2.out' }, t);
    el.__v = to;
  }

  var NOV = { meant: { c: 'accent', f: 0.16, w: 5 }, reach: { c: 'token', f: 0.16, w: 5 }, chain: { c: 'danger', f: 0.2, w: 6 },
    others: { c: 'identity', f: 0.2, w: 5.5 }, ghost: { c: 'token', f: 0, w: 4, dash: '10 7' }, ghostO: { c: 'identity', f: 0, w: 4, dash: '10 7' } };
  function nov(ctx, id, key) {
    var k = id + '|' + key;
    if (!W.nov[k]) {
      var s = NOV[key], C = ctx.THEME, g = W.node[id].g, p = D.lay.pos[id];
      var a = { d: shapeD(D.byId[id].kind, p.w, p.h), fill: s.f ? C[s.c] : 'none', 'fill-opacity': s.f, stroke: C[s.c], 'stroke-width': s.w, opacity: 0 };
      if (s.dash) a['stroke-dasharray'] = s.dash;
      W.nov[k] = ctx.el('path', a, g);
    }
    return W.nov[k];
  }
  var EOV = { meant: { c: 'accent', w: 5 }, reach: { c: 'token', w: 5 }, chain: { c: 'danger', w: 7 }, others: { c: 'identity', w: 5.5 },
    ghost: { c: 'token', w: 4, dash: '10 8', o: 0.5 }, ghostO: { c: 'identity', w: 4, dash: '10 8', o: 0.5 } };
  function eov(ctx, e, key) {
    var k = e.id + '|' + key;
    if (!W.eov[k]) {
      var s = EOV[key], col = ctx.THEME[s.c], geo = D.lay.edges[e.id], g = ctx.el('g', { opacity: 0 }, W.Leov);
      var la = { d: geo.d, fill: 'none', stroke: col, 'stroke-width': s.w, 'stroke-linecap': 'round' };
      if (s.dash) la['stroke-dasharray'] = s.dash;
      stubMask(ctx, e, g);
      W.eov[k] = { g: g, line: ctx.el('path', la, g), head: ctx.el('polygon', { points: geo.head, fill: col }, g), o: s.o || 1 };
    }
    return W.eov[k];
  }
  /* an edge lights along its length, head last */
  function drawEdge(ctx, e, key, t, dur) {
    var o = eov(ctx, e, key);
    fade(ctx, o.g, 1, t, 0.01);
    ctx.tl.fromTo(o.line, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: dur, ease: 'power1.inOut' }, t);
    ctx.tl.fromTo(o.head, { opacity: 0 }, { opacity: 1, duration: 0.12 }, t + dur - 0.1);
    return o;
  }
  function lightNode(ctx, id, key, t, dur) { fade(ctx, nov(ctx, id, key), 1, t, dur === undefined ? 0.35 : dur); }
  function edgeOut(ctx, e, key, t, dur) { var k = e.id + '|' + key; if (W.eov[k]) fade(ctx, W.eov[k].g, 0, t, dur); }
  function nodeOut(ctx, id, key, t, dur) { var k = id + '|' + key; if (W.nov[k]) fade(ctx, W.nov[k], 0, t, dur); }

  /* a stub fades out toward its target: a mask on whatever draws it */
  function stubMask(ctx, e, el) { if (D.lay.edges[e.id].stub) el.setAttribute('mask', 'url(#stub-' + e.id + ')'); }

  function nodeItems(ids) { var out = []; ids.forEach(function (id) { out.push(W.node[id].items); }); return out; }

  /* the legend's mark for a state of a card: a filled disc, or a dashed ring for what the control cut off */
  function swatch(ctx, color, fillOpacity, dashed) {
    return function (g, box) {
      var a = { cx: box.w / 2, cy: box.h / 2, r: 14, fill: dashed ? 'none' : color, 'fill-opacity': fillOpacity, stroke: color, 'stroke-width': 4 };
      if (dashed) a['stroke-dasharray'] = '7 5';
      ctx.el('circle', a, g);
    };
  }

  /* ---- build: the whole graph in its first-state look (faint), the measures and the label panel hidden ---- */
  function build(ctx) {
    D = derive(ctx);
    var C = ctx.THEME, el = ctx.el, lay = D.lay;
    W = { node: {}, nov: {}, eov: {}, ebase: {}, chainE: [], chainN: [] };
    W.root = el('g', { opacity: 0 }, ctx.layers.world);
    if (lay.hasUnreached) {
      var last = lay.cols[lay.ncol - 1][0], pu = lay.pos[last];
      el('rect', { x: pu.x - 14, y: BOX.y - 8, width: lay.W + 28, height: BOX.h + 16, rx: 18, fill: '#0f1522', 'fill-opacity': 0.85 }, W.root);
    }
    D.edges.forEach(function (e) {      /* the fade of each stub: opaque at the card, clear at the far end */
      var st = lay.edges[e.id].stub;
      if (!st) return;
      if (!W.defs) W.defs = el('defs', {}, W.root);
      var gr = el('linearGradient', { id: 'stubfade-' + e.id, gradientUnits: 'userSpaceOnUse', x1: st.x1, y1: st.y, x2: st.x2, y2: st.y }, W.defs);
      el('stop', { offset: 0, 'stop-color': '#fff' }, gr); el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0.05 }, gr);
      var mk = el('mask', { id: 'stub-' + e.id, maskUnits: 'userSpaceOnUse', x: st.x2 - 4, y: st.y - 20, width: st.x1 - st.x2 + 8, height: 40 }, W.defs);
      el('rect', { x: st.x2 - 4, y: st.y - 20, width: st.x1 - st.x2 + 8, height: 40, fill: 'url(#stubfade-' + e.id + ')' }, mk);
    });
    W.Lebase = el('g', {}, W.root); W.Leov = el('g', {}, W.root); W.Lnode = el('g', {}, W.root); W.Ltxt = el('g', {}, W.root); W.Lfx = el('g', {}, W.root);
    if (lay.hasUnreached) {
      var pl = lay.pos[lay.cols[lay.ncol - 1][0]];
      ctx.text.add(W.Ltxt, 'Not reachable', { x: pl.x + lay.W / 2, y: BOX.y + 22, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 600, fill: C.muted }, 'hdr:unreached').keep();
    }

    D.edges.forEach(function (e) {
      var geo = lay.edges[e.id], moves = MOVING.indexOf(e.kind) >= 0, live = D.dist0[e.from] !== undefined;
      var col = !moves ? '#3d4a63' : live || lay.edges[e.id].stub ? '#5b6a88' : '#34415a', g = el('g', {}, W.Lebase);
      var a = { d: geo.d, fill: 'none', stroke: col, 'stroke-width': live ? 3.5 : 3, 'stroke-linecap': 'round' };
      if (!moves) a['stroke-dasharray'] = '7 8';
      g.__v = 1;
      W.ebase[e.id] = { g: g, line: el('path', a, g), head: el('polygon', { points: geo.head, fill: col }, g) };
      if (geo.stub) {      /* the target is named in a small tag at the far end */
        stubMask(ctx, e, W.ebase[e.id].line);
        var nm = nameOf(geo.stub.to), fs = 18, tx = ctx.text.add(g, nm, { x: 0, y: geo.stub.y + 6, 'text-anchor': 'end', 'font-size': fs, 'font-weight': 600, fill: C.muted }, 'stub:' + e.id).keep();
        for (; fs > 13 && tx.el.getBBox().width > TAG_MAX - 16; fs--) tx.el.setAttribute('font-size', fs - 1);
        var tw = Math.ceil(tx.el.getBBox().width) + 16, tr = geo.stub.x2 - 6;
        tx.el.setAttribute('x', tr - 8);
        el('rect', { x: tr - tw, y: geo.stub.y - 14, width: tw, height: 28, rx: 14, fill: '#0f1522', stroke: '#3d4a63', 'stroke-width': 2 }, g);
        g.insertBefore(g.lastChild, tx.el);
      }
    });

    D.nodes.forEach(function (n) {
      var p = lay.pos[n.id], un = D.dist0[n.id] === undefined;
      var g = el('g', { transform: 'translate(' + p.x + ',' + p.y + ')' }, W.Lnode);
      el('path', { d: shapeD(n.kind, p.w, p.h), fill: C.panel, stroke: un ? '#3a4760' : '#7284ab', 'stroke-width': 3.5 }, g);
      var ic = el('g', { transform: 'translate(26,24)', fill: 'none', stroke: un ? '#6b7790' : C.muted, 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      if (n.kind === 'identity') { el('circle', { cx: 0, cy: -3, r: 5 }, ic); el('path', { d: 'M-9,10 Q0,0 9,10' }, ic); }
      else if (n.kind === 'role') el('path', { d: 'M0,-9 L9,0 L0,9 L-9,0 Z' }, ic);
      else { el('ellipse', { cx: 0, cy: -6, rx: 9, ry: 3.6 }, ic); el('path', { d: 'M-9,-6 V6 Q0,13 9,6 V-6' }, ic); }
      if (n.crown) el('path', { d: 'M0,-11 L3.2,-3.6 L11,-3.2 L5,2 L7,10 L0,5.6 L-7,10 L-5,2 L-11,-3.2 L-3.2,-3.6 Z', transform: 'translate(' + (p.w - 26) + ',24)', fill: C.token, stroke: C.bg, 'stroke-width': 1.5 }, g);
      /* name: one line, or two split at the space nearest the middle when it does not fit */
      var probe = el('text', { 'class': 'sans', 'font-size': 22, 'font-weight': 650 }, W.Ltxt);
      probe.textContent = n.name;
      var fits = probe.getBBox().width <= p.w - 22, lines = [n.name];
      W.Ltxt.removeChild(probe);
      if (!fits) {
        var mid = n.name.length / 2, cut = -1;
        for (var i = 0; i < n.name.length; i++) if (n.name[i] === ' ' && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
        if (cut > 0) lines = [n.name.slice(0, cut), n.name.slice(cut + 1)];
      }
      var items = [], ink = un ? C.muted : C.text, ys = lines.length === 1 ? [p.y + 74] : [p.y + 59, p.y + 88];
      lines.forEach(function (s, i) {
        items.push(ctx.text.add(W.Ltxt, s, { x: p.x + p.w / 2, y: ys[i], 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 650, fill: ink }, 'node:' + n.id + ':' + i));
      });
      items.push(ctx.text.add(W.Ltxt, n.kind, { x: p.x + 44, y: p.y + 31, 'font-size': 20, 'font-weight': 500, fill: C.muted }, 'kind:' + n.id));
      items.push(ctx.group(g, 'shape:' + n.id));      /* the card shape dims with its text; its own tweens stay free */
      W.node[n.id] = { g: g, items: items };
    });

    /* fixed panels: the headline, the second measure, the label panel (all hidden until a step shows them) */
    W.m1 = ctx.hud.measure({ label: 'Reachable from ' + D.start.name, value: ctx.count(0, D.M), color: C.token,
      rect: { x: 28, y: ctx.area.y + 8, w: 350, h: 118 } });
    W.m2 = ctx.hud.measure({ label: 'Other identities reaching ' + D.target.name, value: ctx.count(D.oth0.length, D.idents.length), color: C.identity,
      rect: { x: 398, y: ctx.area.y + 8, w: 520, h: 118 } });
    W.cap = ctx.hud.caption({ x: 938, y: ctx.area.y + 8, w: 954, h: 118 });
    W.leg = ctx.hud.legend([
      { color: C.accent, label: 'Given on purpose', swatch: swatch(ctx, C.accent, 0.25, false) },
      { color: C.token, label: 'Reached, not given', swatch: swatch(ctx, C.token, 0.25, false) },
      { color: C.token, label: 'Cut off by the control', swatch: swatch(ctx, C.token, 0, true) }], { direction: 'row', rect: W.cap.panel.rect, staged: true, swatchW: 32 });
    W.cur1 = 0;
  }

  /* the headline only ever counts up in the first steps and down at the cut */
  function bump(ctx, n, t, dur) { if (n > W.cur1) { W.m1.to(n, t, dur); W.cur1 = n; } }

  /* walk a path edge by edge: draw it, light the node it reaches, say why, hold, move on. Returns when it ends. */
  function walk(ctx, path, key, t0, r, hook) {
    var out = null;
    path.forEach(function (e, i) {
      var last = i === path.length - 1, tb = t0 + r;
      drawEdge(ctx, e, key, tb, 0.8);
      lightNode(ctx, e.to, key, tb + 0.7, 0.3);
      if (key === 'chain') { W.chainE.push(e); W.chainN.push(e.to); }
      if (hook) hook(i, e, tb + 0.7);
      var c = W.cap.say(e.why, tb + 0.5, { head: headOf(e), last: last });
      if (!last) r = c.readyAt - 0.5 - t0;       /* the next edge starts drawing as this one's text finishes its hold */
      else out = { end: c.visible - t0, hold: c.hold };
    });
    return out;
  }

  /* wave: reachability spreads one hop per beat; edges light, then the nodes they reach; the headline counts up */
  function wave(ctx, t0, r) {
    var end = r, hops = [];
    for (var h = 1; h <= D.maxHop; h++) hops.push(h);
    hops.forEach(function (h, i) {
      var tb = t0 + r + i * BEAT;
      D.reachEdges.filter(function (e) { return D.dist0[e.from] === h - 1; }).forEach(function (e) { drawEdge(ctx, e, 'reach', tb, 0.55); });
      D.nodes.filter(function (n) { return D.dist0[n.id] === h; }).forEach(function (n) { lightNode(ctx, n.id, 'reach', tb + 0.5, 0.3); });
      var cnt = D.nodes.filter(function (n) { return n.id !== D.startId && D.dist0[n.id] !== undefined && D.dist0[n.id] <= h; }).length;
      bump(ctx, cnt, tb + 0.5, ctx.timing.QUANTITY_MIN);
      end = r + i * BEAT + 0.5 + ctx.timing.QUANTITY_MIN;
    });
    return end;
  }

  /* the escalation chain in the attacker colour, each edge's why read standing still */
  function tracePath(ctx, path, t0, r) { return walk(ctx, path, 'chain', t0, r); }

  function shieldAt(ctx, mid) {
    var C = ctx.THEME, at = ctx.el('g', { transform: 'translate(' + mid.x + ',' + mid.y + ')' }, W.Lfx);
    var s = ctx.el('g', { opacity: 0 }, at);
    ctx.el('path', { d: 'M0,-27 L22,-18 V4 C22,17 9,26 0,31 C-9,26 -22,17 -22,4 V-18 Z', fill: C.panel, stroke: C.secure, 'stroke-width': 4.5, 'stroke-linejoin': 'round' }, s);
    ctx.el('path', { d: 'M-10,2 L-3,9 L11,-8', fill: 'none', stroke: C.secure, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s);
    return s;
  }

  /* cut: the control lands on the edge, the edge breaks, what is no longer reachable drains back and leaves a ghost */
  function cutEdge(ctx, t0, r) {
    var C = ctx.THEME, T = ctx.timing, cut = D.cut, edges = cut.edges.map(function (id) { return D.edge[id]; });
    var lab = W.cap.say(cut.why, t0 + r + 0.5, { head: cut.name });
    edges.forEach(function (e) {
      var geo = D.lay.edges[e.id], s = shieldAt(ctx, geo.mid);
      ctx.tl.fromTo(s, { opacity: 0, y: -44 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, t0 + r);
    });
    var tb = lab.readyAt + 0.2 - t0;            /* the label is read before anything breaks */
    var tbk = t0 + tb;
    edges.forEach(function (e) {
      var geo = D.lay.edges[e.id], g = ctx.el('g', { opacity: 0 }, W.Leov);
      var l1 = ctx.el('path', { d: geo.d, fill: 'none', stroke: C.secure, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
      var l2 = ctx.el('path', { d: geo.d, fill: 'none', stroke: C.secure, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
      var hd = ctx.el('polygon', { points: geo.head, fill: C.secure }, g);
      fade(ctx, g, 1, tbk, 0.01);
      ctx.tl.fromTo(l1, { drawSVG: '0% 0%' }, { drawSVG: '0% 28%', duration: 0.4, ease: 'power2.out' }, tbk);
      ctx.tl.fromTo(l2, { drawSVG: '100% 100%' }, { drawSVG: '72% 100%', duration: 0.4, ease: 'power2.out' }, tbk);
      ctx.tl.fromTo(hd, { opacity: 0 }, { opacity: 1, duration: 0.2 }, tbk + 0.3);
      fade(ctx, W.ebase[e.id].g, 0.25, tbk, 0.4);
    });
    /* the chain no longer completes: its red fades everywhere */
    W.chainE.forEach(function (e) { edgeOut(ctx, e, 'chain', tbk + 0.2, 0.6); });
    W.chainN.forEach(function (id) { nodeOut(ctx, id, 'chain', tbk + 0.2, 0.6); });
    /* what is no longer reachable drains back, furthest first, leaving a dashed ghost */
    var levels = {};
    D.drainN.forEach(function (n) { levels[D.dist0[n.id]] = true; });
    var order = Object.keys(levels).map(Number).sort(function (a, b) { return b - a; }), td = tbk + 0.9, step = 0.6;
    order.forEach(function (h, i) {
      var tt = td + i * step;
      D.drainE.filter(function (e) { return D.dist0[e.to] === h; }).forEach(function (e) {
        edgeOut(ctx, e, 'reach', tt, 0.5);
        var gh = eov(ctx, e, 'ghost'); fade(ctx, gh.g, gh.o, tt, 0.5);
      });
      D.drainN.filter(function (n) { return D.dist0[n.id] === h; }).forEach(function (n) {
        nodeOut(ctx, n.id, 'reach', tt + 0.1, 0.5);
        fade(ctx, nov(ctx, n.id, 'ghost'), 0.75, tt + 0.1, 0.5);
      });
    });
    var span = (order.length - 1) * step + 0.5;
    W.m1.to(D.n1, td, Math.max(T.QUANTITY_MIN, span));
    W.cur1 = D.n1;
    var end = td + Math.max(T.QUANTITY_MIN, span) - t0, hold = T.resultHold();
    return { end: end, hold: hold };
  }

  /* the other identities that reach the target, before and after the cut, on the second measure */
  function showOthers(ctx, t0, r) {
    var T = ctx.timing, tgt = D.target.id, drawn = {};
    W.m2.show(t0 + 0.4);
    var paths = D.oth0.map(function (id) { return { id: id, path: pathTo(D.nodes, D.edges, id, tgt) }; });
    var tEnd = r;
    paths.forEach(function (p) {
      lightNode(ctx, p.id, 'others', t0 + r, 0.4);
      p.path.forEach(function (e, i) {
        if (!drawn[e.id]) { drawn[e.id] = true; drawEdge(ctx, e, 'others', t0 + r + 0.4 + i * 0.6, 0.6); lightNode(ctx, e.to, 'others', t0 + r + 0.4 + i * 0.6 + 0.5, 0.3); }
      });
      tEnd = Math.max(tEnd, r + 0.4 + p.path.length * 0.6);
    });
    var before = join(D.oth0.map(nameOf)) + ' could also reach ' + D.target.name;
    var l1 = W.cap.say(before, t0 + tEnd + 0.2, { head: 'Before the cut' });
    /* after: the paths that went through the cut drain; the rest stay */
    var ta = l1.readyAt + 0.1, keepE = {}, keepN = {};
    D.oth1.forEach(function (id) { keepN[id] = true; pathTo(D.nodes, D.edges, id, tgt, D.cutIds).forEach(function (e) { keepE[e.id] = true; keepN[e.to] = true; }); });
    var shown = {};
    paths.forEach(function (p) { p.path.forEach(function (e) { shown[e.id] = e; }); });
    Object.keys(shown).forEach(function (id) {
      var e = shown[id];
      if (keepE[id]) return;
      edgeOut(ctx, e, 'others', ta, 0.5);
      if (!W.eov[id + '|ghost']) { var gh = eov(ctx, e, 'ghostO'); fade(ctx, gh.g, gh.o, ta, 0.5); }
    });
    paths.forEach(function (p) {
      p.path.forEach(function (e) { if (!keepN[e.to]) nodeOut(ctx, e.to, 'others', ta, 0.5); });
      if (!keepN[p.id]) { nodeOut(ctx, p.id, 'others', ta, 0.5); fade(ctx, nov(ctx, p.id, 'ghostO'), 0.8, ta, 0.5); }
    });
    W.m2.to(D.oth1.length, ta, T.QUANTITY_MIN);
    var after = D.oth1.length ? 'Only ' + join(D.oth1.map(nameOf)) + ' still reaches ' + D.target.name : 'No other identity reaches ' + D.target.name;
    var l2 = W.cap.say(after, ta, { head: 'After the cut', last: true });
    return { end: l2.visible - t0, hold: l2.hold };
  }

  /* the takeaway: what was given against what could be reached */
  function rule(ctx, t0) {
    var T = ctx.timing;
    W.leg.show(t0 + 0.5, 0.4);
    W.leg.rows.forEach(function (row, i) { row.show(t0 + 0.9 + i * 0.5, 0.5); });
    /* the previous step's purple (the other identities) clears away */
    Object.keys(W.nov).forEach(function (k) { if (/\|(others|ghostO)$/.test(k)) fade(ctx, W.nov[k], 0, t0 + 0.4, 0.5); });
    Object.keys(W.eov).forEach(function (k) { if (/\|(others|ghostO)$/.test(k)) fade(ctx, W.eov[k].g, 0, t0 + 0.4, 0.5); });
    /* what was given shows again in its own colour; the ghosts of what was reachable brighten */
    D.nodes.forEach(function (n) { if (D.given[n.id] !== undefined && n.id !== D.startId) nodeOut(ctx, n.id, 'reach', t0 + 1.0, 0.6); });
    D.drainN.forEach(function (n) { var o = nov(ctx, n.id, 'ghost'); fade(ctx, o, 1, t0 + 1.8, 0.6); });
    var end = 2.8;
    return { end: end, hold: T.resultHold() };
  }

  var ACT = {
    meant: function (ctx, st, t0) {
      var all = D.nodes.concat(D.edges);
      all.forEach(function (x) { ctx.shown(x, t0 + 0.2, Infinity); });
      fade(ctx, W.root, 1, t0 + 0.2, 0.9);
      W.m1.show(t0 + 0.6);
      lightNode(ctx, D.startId, 'meant', t0 + 1.0, 0.4);
      var seen = 0;
      var res = walk(ctx, D.givenEdges, 'meant', t0, 1.4, function (i, e, t) { seen++; bump(ctx, seen, t, ctx.timing.QUANTITY_MIN); });
      return { end: res.end, first: 0.6, hold: res.hold };
    },
    spread: function (ctx, st, t0) {
      var end = wave(ctx, t0, 0.8);
      return { end: end, first: 0.8, hold: ctx.timing.resultHold() };
    },
    chain: function (ctx, st, t0) {
      var res = tracePath(ctx, D.chain, t0, 0.9);
      return { end: res.end, first: 0.9, hold: res.hold };
    },
    cut: function (ctx, st, t0) {
      ctx.shown(D.cut, t0 + 0.9, Infinity);
      var res = cutEdge(ctx, t0, 0.9);
      return { end: res.end, first: 0.9, hold: res.hold };
    },
    others: function (ctx, st, t0) {
      var res = showOthers(ctx, t0, 0.8);
      return { end: res.end, first: 0.8, hold: res.hold };
    },
    rule: function (ctx, st, t0) {
      var res = rule(ctx, t0);
      return { end: res.end, first: 0.5, hold: res.hold };
    }
  };

  /* what the step is about stays at full, the rest dims */
  function active(st) {
    var ids = [];
    if (st.act === 'meant') ids = [D.startId].concat(D.givenEdges.map(function (e) { return e.to; }));
    else if (st.act === 'chain') ids = [D.startId].concat(D.chain.map(function (e) { return e.to; }));
    else if (st.act === 'cut') return 'all';       /* the drain and its ghosts are the point: nothing dims */
    else if (st.act === 'others') {
      ids = [D.target.id];
      D.oth0.forEach(function (id) { ids.push(id); pathTo(D.nodes, D.edges, id, D.target.id).forEach(function (e) { ids.push(e.to); }); });
    } else return 'all';
    return nodeItems(ids);
  }

  EXK.scenes.privesc = {
    build: build,
    step: function (ctx, st, t0) {
      ctx.emphasise(active(st), t0 + 0.1);
      var r = ACT[st.act](ctx, st, t0);
      return { end: r.end, firstMotion: r.first, hold: r.hold };
    }
  };
})();
