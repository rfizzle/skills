/* The isometric painter (references/rules.md, the iso v3 reference b-isometric-attack-chain.html): the laid-out
   estate (ground units, EXK.layout 'iso') drawn as slabs by nesting level and blocks with three-shade faces, the shared
   ground routes lifted onto the slab tops, flat port rings on the floor, packets as a dot floating above its shadow.
   The scene space is the projection iso(x, y, z) (scene px); the camera {x, y, w, h} is a zoom and pan in it, so the
   text layer, the camera and the beats work on it as they do on the flat painter's plane. It draws; it does not decide
   when (every tween but painter.focus is emitted by scene/beats.js).

   EXK.painters.iso(ctx) -> painter: the flat painter's interface (see paint/flat.js), plus
     frameFor(stepOrSpec, area, ids)   a camera frame in scene px. A step is framed on what it is about: its hold,
                                       the ids it involves (ids) and its callout targets; 'full' (or a step that
                                       involves nothing, or sets all) is the whole estate. grow is ignored, the zoom
                                       is capped at ZMAX (or the spec's zoom), and never wider than the full view.
     stepText(text, frame, o)          per text session: the labels of the step's systems (labelPolicy 'touched')
                                       and the upright tags of the containers around them (full view: the top two
                                       levels); returns the items, which the runner fades at the step end
     cameraBeats: false, maxCards: 1   what this painter does not support in version 1: the
                                       runner skips camera beats and cards after the first, with a warning
   Depth order (the reference's trap, kept): layers, not geometry. Slabs by level then x0 + y0; routes, rings and
   plates on the floor under every block; blocks by x + y; badges, packets and shields above everything. It holds
   because slabs have gaps, routes run on slab tops and blocks stand clear of each other (check-layout --style iso
   warns when two blocks share x + y or a route skims a block). */
(function () {
  'use strict';
  var EXK = window.EXK, C = EXK.THEME, T = EXK.timing;
  var NS = 'http://www.w3.org/2000/svg';
  var C30 = Math.cos(Math.PI / 6);
  var TH = EXK.layout.ISO.TH;       /* slab thickness per nesting level, ground units (estate/layout.js ISO, shared with isoAudit) */
  var HALF = EXK.layout.ISO.HALF;   /* half the block's side (the footprint plate is the layout's node box, 100) */
  var BH = EXK.layout.ISO.BH;       /* block height */
  var RING_R = 17, RING_LIT_R = 21, PORT_MERGE = 70;   /* port rings, ground units; crossings closer than PORT_MERGE share one */
  var LIFT = 30;            /* stage px: the packet's dot floats this far above its shadow on the floor */
  var DOT_R = 13;           /* stage px */
  var TAG_GAP = 8;          /* stage px between the dot and its tag */
  var SHIELD_LIFT = 44;     /* ground units: a summary shield stands this far above its link */
  var SHIELD_AHEAD = 50;    /* ground units */
  var ZMAX = 1.3;           /* stage px per scene px: the closest a step frame gets (the reference's ZMAX) */
  var FADE = 56;            /* stage px: the diagram area's soft edge (page.html #fade) */
  var FIT = { x: 120, top: 96, bottom: 90 };       /* stage px around a step's held content: a label above the top block clears the
                                                     text margin (56) with its own 38; tags, cards and tallies at the sides and front */
  var FIT_FULL = { x: 24, top: 24, bottom: 16 };
  var PARENT_MAX = 4;       /* a block's own container joins its frame unless its box is more than this many times the block's */
  var FULL_AT = 0.97;       /* a step frame this close to the full view is the full view */
  var SLAB_TOP = ['#111823', '#151d2b', '#19233a', '#1e2a40', '#233149'];
  var SHADE = { top: '#2a3855', left: '#18213a', right: '#101728' };
  var TAG_PX = 22, TAG_H = 34;   /* container tags (stage px) */

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, s, attrs) { var e = el('text', attrs, parent); e.textContent = s; return e; }
  function colorOf(name, dflt) { return name ? (C[name] || name) : dflt; }
  function mixHex(hex, k) {
    var n = parseInt(hex.slice(1), 16);
    return '#' + [16, 8, 0].map(function (s) { var v = Math.round(((n >> s) & 255) * k).toString(16); return v.length < 2 ? '0' + v : v; }).join('');
  }
  function f1(v) { return v.toFixed(1); }
  /* the projection: +x runs down-right, +y down-left, +z up; one ground unit along x or y is one scene px */
  function iso(x, y, z) { return { x: (x - y) * C30, y: (x + y) * 0.5 - (z || 0) }; }
  function P(x, y, z) { var q = iso(x, y, z); return f1(q.x) + ',' + f1(q.y); }
  function poly(pts) { return pts.map(function (p) { return P(p[0], p[1], p[2] || 0); }).join(' '); }
  function bboxOf(pts) {
    var r = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    pts.forEach(function (p) { r.x0 = Math.min(r.x0, p.x); r.y0 = Math.min(r.y0, p.y); r.x1 = Math.max(r.x1, p.x); r.y1 = Math.max(r.y1, p.y); });
    return r;
  }
  function union(a, b) { return a ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : b; }
  /* a polyline through 3D points with rounded corners (r in ground units), projected */
  function pathD(pts, r) {
    var d = '';
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (i === 0) { d += 'M' + P(p[0], p[1], p[2]); continue; }
      if (i === pts.length - 1) { d += ' L' + P(p[0], p[1], p[2]); continue; }
      var a = pts[i - 1], n = pts[i + 1];
      var l1 = Math.hypot(p[0] - a[0], p[1] - a[1]), l2 = Math.hypot(n[0] - p[0], n[1] - p[1]);
      var turn = Math.abs((p[0] - a[0]) * (n[1] - p[1]) - (p[1] - a[1]) * (n[0] - p[0])) > 1e-3;
      if (!turn || l1 < 1e-6 || l2 < 1e-6) { d += ' L' + P(p[0], p[1], p[2]); continue; }
      var r1 = Math.min(r, l1 / 2), r2 = Math.min(r, l2 / 2);
      d += ' L' + P(p[0] + (a[0] - p[0]) / l1 * r1, p[1] + (a[1] - p[1]) / l1 * r1, p[2]) + ' Q' + P(p[0], p[1], p[2]) +
        ' ' + P(p[0] + (n[0] - p[0]) / l2 * r2, p[1] + (n[1] - p[1]) / l2 * r2, p[2]);
    }
    return d;
  }

  EXK.painters.iso = function (ctx) {
    var area = ctx.area, tl = ctx.tl, story = null;
    var B = null, E = null, boxes = [], svg = null, world = null, L = {}, sysOf = {};
    var ports = [], nodeG = {}, slabG = {}, edgeG = {}, edgeP = {}, portG = [], trailP = {}, markG = {}, R3 = {}, G2 = {};
    var cs = [], tagsDrawn = [], focusCur = new Map(), FULLF = null, lastCam = null;

    function k(cam) { return area.w / cam.w; }
    function toStage(p, cam) { var s = k(cam); return { x: area.x + (p.x - cam.x) * s, y: area.y + (p.y - cam.y) * s }; }
    function rectToStage(r, cam) { var a = toStage({ x: r.x0, y: r.y0 }, cam), b = toStage({ x: r.x1, y: r.y1 }, cam); return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }; }

    /* ---- the ground model: slab heights ---- */
    function zTop(id) { return B[id] && B[id].type === 'box' ? B[id].depth * TH : 0; }      /* top of a zone's slab (level depth - 1) */
    function zAt(x, y) {
      var best = 0;
      boxes.forEach(function (b) { if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) best = Math.max(best, b.depth * TH); });
      return best;
    }
    function nodeZ(id) { return zTop(B[id].parent); }
    function nodeBox(id) {
      var b = B[id], z0 = nodeZ(id), pts = [];
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s) {
        pts.push(iso(b.cx + s[0] * HALF, b.cy + s[1] * HALF, z0)); pts.push(iso(b.cx + s[0] * HALF, b.cy + s[1] * HALF, z0 + BH));
      });
      return bboxOf(pts);
    }
    function slabBox(id) {
      var b = B[id], z0 = (b.depth - 1) * TH, z1 = b.depth * TH;
      return bboxOf([iso(b.x, b.y, z1), iso(b.x + b.w, b.y, z1), iso(b.x + b.w, b.y + b.h, z1), iso(b.x, b.y + b.h, z1), iso(b.x, b.y + b.h, z0), iso(b.x + b.w, b.y + b.h, z0)]);
    }
    function plateBox(id) {
      var b = B[id], e = b.w / 2, z = nodeZ(id);
      return bboxOf([iso(b.cx - e, b.cy - e, z), iso(b.cx + e, b.cy - e, z), iso(b.cx + e, b.cy + e, z), iso(b.cx - e, b.cy + e, z)]);
    }

    /* route3D (the reference's): the ground polyline split at every container edge it crosses, each piece at the
       height of the slab it runs on, a short ramp at each step in height */
    function route3D(pts) {
      var out = [];
      function push(x, y, z) { var l = out[out.length - 1]; if (!l || Math.abs(l[0] - x) > 1e-6 || Math.abs(l[1] - y) > 1e-6 || l[2] !== z) out.push([x, y, z]); }
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
        if (len < 1e-6) continue;
        var ux = dx / len, uy = dy / len, cuts = [];
        boxes.forEach(function (bx) {
          var x0 = bx.x, x1 = bx.x + bx.w, y0 = bx.y, y1 = bx.y + bx.h;
          if (Math.abs(dy) < 1e-6 && a[1] > y0 && a[1] < y1) [x0, x1].forEach(function (xe) { var s = (xe - a[0]) / dx * len; if (s > 0.5 && s < len - 0.5) cuts.push(s); });
          if (Math.abs(dx) < 1e-6 && a[0] > x0 && a[0] < x1) [y0, y1].forEach(function (ye) { var s = (ye - a[1]) / dy * len; if (s > 0.5 && s < len - 0.5) cuts.push(s); });
        });
        cuts.sort(function (p, q) { return p - q; });
        var ss = [0].concat(cuts, [len]), zs = [];
        for (var m = 0; m < ss.length - 1; m++) { var mid = (ss[m] + ss[m + 1]) / 2; zs.push(zAt(a[0] + ux * mid, a[1] + uy * mid)); }
        push(a[0], a[1], zs[0]);
        cuts.forEach(function (s, n) {
          var cx = a[0] + ux * s, cy = a[1] + uy * s, z1 = zs[n], z2 = zs[n + 1];
          if (z1 !== z2) { push(cx - ux * 7, cy - uy * 7, z1); push(cx + ux * 7, cy + uy * 7, z2); } else push(cx, cy, z1);
        });
        push(b[0], b[1], zs[zs.length - 1]);
      }
      return out;
    }
    /* where a ground point lies along a lifted route, as a fraction of its projected length */
    function fracAt(p3, x, y) {
      var acc = 0, best = null, total = 0, segs = [];
      for (var i = 1; i < p3.length; i++) {
        var a = iso(p3[i - 1][0], p3[i - 1][1], p3[i - 1][2]), b = iso(p3[i][0], p3[i][1], p3[i][2]), l = Math.hypot(b.x - a.x, b.y - a.y);
        segs.push({ g0: p3[i - 1], g1: p3[i], s0: total, l: l }); total += l;
      }
      segs.forEach(function (sg) {
        var gx = sg.g1[0] - sg.g0[0], gy = sg.g1[1] - sg.g0[1], gl = gx * gx + gy * gy;
        var t = gl > 0 ? Math.max(0, Math.min(1, ((x - sg.g0[0]) * gx + (y - sg.g0[1]) * gy) / gl)) : 0;
        var d = Math.hypot(sg.g0[0] + gx * t - x, sg.g0[1] + gy * t - y);
        if (!best || d < best.d) best = { d: d, s: sg.s0 + sg.l * t };
      });
      acc = best ? best.s : 0;
      return total ? acc / total : 0;
    }
    /* a link's own point: on its last run, SHIELD_AHEAD before the destination's footprint (the middle of the run when it
       is shorter), just in front of the system the control protects. Links that share a corridor (a bundle) part there,
       so their shields do not land on one another as their midpoints would */
    function linkPoint(id, lift) {
      var g = G2[id], Z = B[E[id].b], e = Z.w / 2, i = g.length - 1;
      function inFoot(p) { return Math.abs(p[0] - Z.cx) <= e + 0.5 && Math.abs(p[1] - Z.cy) <= e + 0.5; }
      while (i > 1 && inFoot(g[i - 1])) i--;                      /* the last segment that starts outside the footprint */
      var a = g[i - 1], b = g[i], ux = b[0] - a[0], uy = b[1] - a[1], L = Math.hypot(ux, uy) || 1, s = L;
      for (var n = 0; n <= 64; n++) { var f = n / 64; if (inFoot([a[0] + ux * f, a[1] + uy * f])) { s = L * f; break; } }   /* up to the footprint */
      var at = Math.max(s / 2, s - SHIELD_AHEAD), x = a[0] + ux / L * at, y = a[1] + uy / L * at, q = iso(x, y, zAt(x, y) + (lift || 0));
      return { x: q.x, y: q.y };
    }

    /* ---- frames in scene px ---- */
    function fitFrame(bb, m, zmin, zmax, zoom) {
      var w = bb.x1 - bb.x0, h = bb.y1 - bb.y0, aw = area.w - 2 * m.x, ah = area.h - m.top - m.bottom;
      var z = zoom > 0 ? zoom : Math.min(aw / w, ah / h);
      z = Math.max(zmin || 0, Math.min(zmax || Infinity, z));
      var fw = area.w / z, fh = area.h / z;
      var cx = (bb.x0 + bb.x1) / 2, top = m.top / z + (ah / z - h) / 2;
      return { x: cx - fw / 2, y: bb.y0 - top, w: fw, h: fh, zoom: z };
    }
    function groundAt(X, Y, z) { var u = X / C30, v = 2 * (Y + z); return { x: (u + v) / 2, y: (v - u) / 2 }; }
    /* containers whose top face holds the whole visible frame (inside the edge fade) become the breadcrumb */
    function crumbFor(f) {
      if (f.full) return [];
      var z = area.w / f.w, ins = FADE / z, out = [];
      boxes.forEach(function (b) {
        var zt = b.depth * TH;
        var ok = [[f.x + ins, f.y + ins], [f.x + f.w - ins, f.y + ins], [f.x + f.w - ins, f.y + f.h - ins], [f.x + ins, f.y + f.h - ins]].every(function (c) {
          var g = groundAt(c[0], c[1], zt); return g.x >= b.x && g.x <= b.x + b.w && g.y >= b.y && g.y <= b.y + b.h;
        });
        if (ok) out.push(b);
      });
      out.sort(function (p, q) { return p.depth - q.depth; });
      return out.map(function (b) { return b.short || b.label; });
    }
    function fullFrame() {
      var bb = null;
      boxes.forEach(function (b) { bb = union(bb, slabBox(b.id)); });
      Object.keys(B).forEach(function (id) { if (B[id].type === 'node') bb = union(bb, nodeBox(id)); });
      var f = fitFrame(bb, FIT_FULL);
      f.full = true; f.hold = []; f.crumb = [];
      return f;
    }

    /* ---- per-step text: container tags (the reference's placeTag), stage px, anchored at a slab corner ---- */
    function tagWidth(s) { return Math.round(s.length * TAG_PX * 0.6 + 28); }
    function placeTag(id, cam, occ) {
      var b = B[id], z = b.depth * TH, w = tagWidth(b.short || b.label), h = TAG_H;
      var corners = [[b.x + b.w, b.y + b.h], [b.x, b.y + b.h], [b.x + b.w, b.y], [b.x, b.y]];     /* nearest the viewer first */
      /* clear of the step's blocks and of the packet lanes; then clear of the blocks only; a tag that cannot be clear of
         the blocks is dropped (it is context, and over a block it hides what the step is about) */
      for (var pass = 0; pass < 2; pass++) for (var ci = 0; ci < corners.length; ci++) {
        var A = iso(corners[ci][0], corners[ci][1], z), v = toStage(A, cam);
        var cands = [[v.x - w / 2, v.y + 6], [v.x - w / 2, v.y - h - 6], [v.x - w / 2, v.y + 10 + h], [v.x - w / 2, v.y - 2 * h - 10],
          [v.x - w - 8, v.y - h / 2], [v.x + 8, v.y - h / 2], [v.x - w / 2, v.y + 14 + 2 * h], [v.x - w - 8, v.y + 6], [v.x + 8, v.y + 6],
          [v.x - w - 8, v.y - h - 6], [v.x + 8, v.y - h - 6], [v.x - w - 30, v.y - h / 2], [v.x + 30, v.y - h / 2]];
        for (var n = 0; n < cands.length; n++) {
          var r = { x0: cands[n][0], x1: cands[n][0] + w, y0: cands[n][1], y1: cands[n][1] + h };
          if (occ.free(r, true, pass === 1)) { occ.add(r); return { id: id, a: A, dx: r.x0 - v.x, dy: r.y0 - v.y, w: w, h: h, rect: r }; }
        }
      }
      return null;
    }
    function drawTag(text, lay, at) {
      var b = B[lay.id], g = el('g', { class: 'ti', 'data-key': 'tab:' + lay.id }, text.layer), pres = el('g', { opacity: 0 }, g);
      var em = el('g', {}, pres);
      el('rect', { x: f1(lay.dx), y: f1(lay.dy), width: lay.w, height: lay.h, rx: 14, fill: '#0e1420', stroke: '#5d6c88', 'stroke-width': 2 }, em);
      txt(em, b.short || b.label, { x: f1(lay.dx + lay.w / 2), y: f1(lay.dy + lay.h / 2), dy: '.35em', 'text-anchor': 'middle', class: 'sans', fill: '#c0cbdd', 'font-size': TAG_PX, 'font-weight': 600 });
      var it = text.register({ key: 'tab:' + lay.id, els: [em], tab: lay.id, rect: lay.rect, at: at, kind: 'tab' });
      it.pres = pres;
      tagsDrawn.push({ g: g, a: lay.a });
      if (lastCam) placeTagEl(tagsDrawn[tagsDrawn.length - 1], lastCam);
      text.appear(it, at);
      return it;
    }
    function placeTagEl(t, cam) { var p = toStage(t.a, cam); t.g.setAttribute('transform', 'translate(' + p.x.toFixed(2) + ',' + p.y.toFixed(2) + ')'); }
    function ancestors(id) { var a = [], p = B[id] && B[id].parent; while (p && p !== 'root') { a.push(p); p = B[p].parent; } return a; }

    var painter = {
      labelPolicy: 'touched',
      cameraBeats: false,
      maxCards: 1,
      cardFold: false,       /* a card's then:'fold' fades it where it stands, as the reference's card does: folding into the
                                block sweeps it across the labels and tags around a projected block */
      /* placement modes in order (text.js place; every leader is clear in every mode): clear of blocks, then over a block's
         box, before the lanes. Blocks crowd a projected scene (their boxes are hexagons' bounds, with empty corners), and
         a long leader reads worse than a pill over a corner of a block's box */
      placeTiers: [[0, 0], [2, 2], [1, 1], [3, 4]],
      shieldTiers: [[0, 1], [2, 3]],     /* summary shield labels: clear of block boxes, then over their empty corners; never text */
      blockCorner: 0.05,                 /* the loose modes cover at most this fraction of a block's box (text.js occ.free): each empty corner of a cube's projected box is about 6.5% of it */
      tagLift: LIFT + DOT_R + TAG_GAP,     /* stage px from the floor point up to the tag's bottom: the tag rides above the dot */
      TRAIL_OPACITY: 0.42,

      build: function (estate, st, layers) {
        if (!estate || !estate.routes) throw new Error('iso painter: build needs the estate model (layoutEstate + routeLinks)');
        story = st; B = estate.B; E = estate.routes;
        boxes = estate.boxes;
        story.systems.forEach(function (s) { sysOf[s.id] = s; });

        svg = el('svg', { width: area.w, height: area.h, viewBox: '0 0 ' + area.w + ' ' + area.h }, layers.world);
        world = el('g', { 'data-layer': 'world' }, svg);
        ['slabs', 'edges', 'trail', 'lit', 'ports', 'portfx', 'plates', 'blocks', 'fx', 'badges', 'top', 'packets'].forEach(function (n) { L[n] = el('g', { 'data-layer': n }, world); });

        /* slabs: one per zone, by level then x0 + y0; a shade step per level; no text on the slabs */
        boxes.slice().sort(function (a, b) { return a.depth - b.depth || (a.x + a.y) - (b.x + b.y); }).forEach(function (b) {
          var lv = b.depth - 1, z0 = lv * TH, z1 = z0 + TH, top = SLAB_TOP[Math.min(lv, 4)];
          var x0 = b.x, x1 = b.x + b.w, y0 = b.y, y1 = b.y + b.h;
          var outer = lv === 0 && !(b.kids || []).some(function (q) { return B[q] && B[q].type === 'box'; });   /* a top-level zone of outside parties */
          var stroke = outer ? '#4d3340' : (lv === 0 ? '#3b4863' : '#334059');
          var g = el('g', { 'data-box': b.id }, L.slabs);
          el('polygon', { points: poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]), fill: mixHex(top, 0.7), stroke: '#0b0f17', 'stroke-width': 1.5 }, g);
          el('polygon', { points: poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]), fill: mixHex(top, 0.5), stroke: '#0b0f17', 'stroke-width': 1.5 }, g);
          el('polygon', { points: poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]), fill: top, stroke: stroke, 'stroke-width': lv === 0 ? 3 : 2.5, 'stroke-linejoin': 'round' }, g);
          slabG[b.id] = g;
        });

        /* routes: the shared ground routes, lifted onto the slab tops (a ribbon: line colour under panel colour) */
        Object.keys(E).forEach(function (id) {
          /* each end runs on to its block's centre (hidden under the block), so a packet's consecutive hops join up */
          var gp = E[id].pts.map(function (q) { return [q[0], q[1]]; }), A = B[E[id].a], Z = B[E[id].b];
          if (Math.hypot(gp[0][0] - A.cx, gp[0][1] - A.cy) > 0.5) gp.unshift([A.cx, A.cy]);
          if (Math.hypot(gp[gp.length - 1][0] - Z.cx, gp[gp.length - 1][1] - Z.cy) > 0.5) gp.push([Z.cx, Z.cy]);
          G2[id] = gp;
          var p3 = R3[id] = route3D(gp), d = pathD(p3, 24), g = el('g', { 'data-link': id }, L.edges);
          el('path', { d: d, fill: 'none', stroke: C.line, 'stroke-width': 14, 'stroke-linecap': 'butt', 'stroke-linejoin': 'round' }, g);
          edgeP[id] = el('path', { d: d, fill: 'none', stroke: C.panel, 'stroke-width': 7, 'stroke-linecap': 'butt', 'stroke-linejoin': 'round' }, g);
          edgeG[id] = g;
          trailP[id] = el('path', { d: d, fill: 'none', stroke: C.danger, 'stroke-width': 9, 'stroke-linecap': 'butt', 'stroke-linejoin': 'round', opacity: 0 }, L.trail);
        });
        /* port rings: one flat ring per border crossing, crossings closer than PORT_MERGE share one; the crossing's
           fraction is re-measured along the lifted path, which is the one packets travel */
        ports = estate.ports = EXK.route.markers(E, PORT_MERGE);
        Object.keys(E).forEach(function (id) { E[id].ports.forEach(function (q) { q.f = fracAt(R3[id], q.x, q.y); }); });
        ports.forEach(function (m) {
          m.z = Math.min(zAt(m.x - 2, m.y - 2), zAt(m.x + 2, m.y + 2), zAt(m.x - 2, m.y + 2), zAt(m.x + 2, m.y - 2));
          var g = el('g', {}, L.ports);
          el('polygon', { points: ringPts(m, RING_R), fill: 'none', stroke: '#6b7a96', 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, g);
          portG.push({ g: g, links: m.links });
        });

        /* blocks, by x + y (the depth-order trap: by layer, not geometry); the footprint plate and the marker live
           on the floor under them, the marker's badge above them */
        estate.nodes.slice().sort(function (a, b) { return (a.cx + a.cy) - (b.cx + b.cy); }).forEach(function (b) {
          var s = sysOf[b.id] || {}, col = nodeColor(s), a = HALF, x = b.cx, y = b.cy, z0 = nodeZ(b.id), z1 = z0 + BH, band = 9;
          var g = el('g', { class: 'node', 'data-node': b.id }, L.blocks), faces = el('g', { 'data-block': b.id }, g);
          el('polygon', { points: poly([[x - a, y + a, z0], [x + a, y + a, z0], [x + a, y + a, z1], [x - a, y + a, z1]]), fill: SHADE.left, stroke: '#0b0f17', 'stroke-width': 1.5 }, faces);
          el('polygon', { points: poly([[x + a, y - a, z0], [x + a, y + a, z0], [x + a, y + a, z1], [x + a, y - a, z1]]), fill: SHADE.right, stroke: '#0b0f17', 'stroke-width': 1.5 }, faces);
          el('polygon', { points: poly([[x - a, y + a, z1 - band], [x + a, y + a, z1 - band], [x + a, y + a, z1], [x - a, y + a, z1]]), fill: col, 'fill-opacity': 0.9 }, faces);
          el('polygon', { points: poly([[x + a, y - a, z1 - band], [x + a, y + a, z1 - band], [x + a, y + a, z1], [x + a, y - a, z1]]), fill: col, 'fill-opacity': 0.6 }, faces);
          el('polygon', { points: poly([[x - a, y - a, z1], [x + a, y - a, z1], [x + a, y + a, z1], [x - a, y + a, z1]]), fill: SHADE.top, stroke: col, 'stroke-width': 3, 'stroke-linejoin': 'round' }, faces);
          nodeG[b.id] = g;
          var mp = el('polygon', { points: plateOf(b.id), fill: C.danger, 'fill-opacity': 0.2, stroke: C.danger, 'stroke-width': 4, 'stroke-linejoin': 'round', opacity: 0 }, L.plates);
          var bp = iso(x + a, y - a, z1), badge = el('g', { opacity: 0, transform: 'translate(' + f1(bp.x) + ',' + f1(bp.y) + ')' }, L.badges), bi = el('g', {}, badge);
          el('circle', { cx: 14, cy: -12, r: 13, fill: C.danger, stroke: C.bg, 'stroke-width': 3 }, bi);
          txt(bi, '!', { x: 14, y: -5, 'text-anchor': 'middle', class: 'sans', fill: C.bg, 'font-size': 19, 'font-weight': 800 });
          cs.push(bi);
          markG[b.id] = [mp, badge];
        });

        /* mini-map: slab tops in outline, a dot per block (the camera adds its frame rect) */
        FULLF = fullFrame();
        var mm = ctx.shell && ctx.shell.minimap;
        if (mm) {
          var mg = el('g', {}, mm), sw = FULLF.w / 340;
          boxes.forEach(function (b) {
            var z = b.depth * TH;
            el('polygon', { points: poly([[b.x, b.y, z], [b.x + b.w, b.y, z], [b.x + b.w, b.y + b.h, z], [b.x, b.y + b.h, z]]), fill: b.depth === 1 ? 'rgba(42,52,71,0.5)' : 'rgba(42,52,71,0.28)', stroke: '#52617d', 'stroke-width': 1.5 * sw }, mg);
          });
          estate.nodes.forEach(function (b) { var q = iso(b.cx, b.cy, nodeZ(b.id) + BH); el('circle', { cx: f1(q.x), cy: f1(q.y), r: 4 * sw, fill: nodeColor(sysOf[b.id] || {}) }, mg); });
        }
        painter.applyCamera(FULLF);
      },

      applyCamera: function (cam) {
        var s = k(cam), inv = 'scale(' + (1 / s).toFixed(5) + ')';
        world.setAttribute('transform', 'scale(' + s.toFixed(6) + ') translate(' + (-cam.x).toFixed(3) + ',' + (-cam.y).toFixed(3) + ')');
        if (!lastCam || lastCam.w !== cam.w) cs.forEach(function (e) { e.setAttribute('transform', inv); });
        tagsDrawn.forEach(function (t) { placeTagEl(t, cam); });
        packs.forEach(intoBlock);
        lastCam = { x: cam.x, y: cam.y, w: cam.w, h: cam.h };
      },

      frameFor: function (spec, ar, ids) {
        if (spec && spec.w) return spec;
        var isStep = spec && typeof spec === 'object' && !Array.isArray(spec.hold) && 'frame' in spec;
        var fr = isStep ? spec.frame : spec, want = [], seen = {};
        function add(id) { if (id && B[id] && id !== 'root' && !seen[id]) { seen[id] = 1; want.push(id); } }
        if (fr && fr !== 'full' && Array.isArray(fr.hold)) fr.hold.forEach(add);
        if (isStep && !spec.all) {
          (ids || spec.touch || []).forEach(add);
          (spec.callouts || []).forEach(function (c) { add(c.target); });
        } else if (!isStep && fr !== 'full') (ids || []).forEach(add);
        if (!want.length || (isStep && spec.all)) return FULLF;
        /* the tightest box holding each involved block with its footprint plate, the container it stands in (unless that
           container is a long strip, such as the Internet zone, which would set the frame by itself), and the held zones;
           the FIT margins are the room its labels need; then as close as fills the area, up to ZMAX */
        var bb = null;
        want.forEach(function (id) {
          if (B[id].type !== 'node') { bb = union(bb, slabBox(id)); return; }
          var nb = union(nodeBox(id), plateBox(id)), p = B[id].parent;
          bb = union(bb, nb);
          if (p && p !== 'root') { var pb = slabBox(p); if ((pb.x1 - pb.x0) * (pb.y1 - pb.y0) <= PARENT_MAX * (nb.x1 - nb.x0) * (nb.y1 - nb.y0)) bb = union(bb, pb); }
        });
        var f = fitFrame(bb, FIT, FULLF.zoom, fr && fr.zoom > 0 ? fr.zoom : ZMAX);
        if (f.zoom <= FULLF.zoom / FULL_AT) return FULLF;
        f.full = false; f.hold = want; f.crumb = crumbFor(f);
        return f;
      },

      pathEl: function (id) { return edgeP[id]; },

      /* the part of a link on screen (as the flat painter's, with the ends' projected centres) */
      onScreenRange: function (id, cam, proxyW) {
        var r = E[id];
        function inF(p) { return p.x >= cam.x && p.x <= cam.x + cam.w && p.y >= cam.y && p.y <= cam.y + cam.h; }
        var aOff = !inF(painter.anchor(r.a, 'center')), bOff = !inF(painter.anchor(r.b, 'center'));
        if (!aOff && !bOff) return { f0: 0, f1: 1, aOff: false, bOff: false };
        var z = k(cam), path = edgeP[id], Lp = path.getTotalLength(), n = Math.max(8, Math.ceil(Lp / 4)), m = Math.max(FADE, proxyW || 0) / z;
        function ins(p) { return p.x >= cam.x + m && p.x <= cam.x + cam.w - m && p.y >= cam.y + m && p.y <= cam.y + cam.h - m; }
        var f0 = 0, f1v = 1, q, i;
        if (aOff) for (i = 0; i <= n; i++) { q = path.getPointAtLength(Lp * i / n); if (ins(q)) { f0 = i / n; break; } }
        if (bOff) for (i = n; i >= 0; i--) { q = path.getPointAtLength(Lp * i / n); if (ins(q)) { f1v = i / n; break; } }
        if (f1v < f0) f1v = f0;
        return { f0: f0, f1: f1v, aOff: aOff, bOff: bOff };
      },

      /* scene points: a block's 'top' is the apex of its top face, 'side' a point on its right edge (says, callouts, cards),
         'bottom' its front foot; a zone's are its slab's corners; a link id is its midpoint, raised for a shield */
      anchor: function (id, side) {
        var b = B[id];
        if (!b && E[id]) return linkPoint(id, SHIELD_LIFT);
        if (b.type === 'node') {
          var x = b.cx, y = b.cy, z0 = nodeZ(id), a = HALF;
          switch (side) {
            case 'side': var q = iso(x + a, y - a, z0 + BH * 0.6); return { x: q.x + 2, y: q.y };   /* on the block's right edge, under its marker
                                                    badge: a point off the block can be nearer a neighbour, and a leader from it points there */
            case 'left': return iso(x - a, y + a, z0 + BH / 2);
            case 'right': return iso(x + a, y - a, z0 + BH / 2);
            case 'bottom': return iso(x + a, y + a, z0);
            case 'center': return iso(x, y, z0 + BH / 2);
            default: return iso(x - a, y - a, z0 + BH);
          }
        }
        var zt = b.depth * TH;
        switch (side) {
          case 'side': case 'right': return iso(b.x + b.w, b.y, zt);
          case 'left': return iso(b.x, b.y + b.h, zt);
          case 'bottom': return iso(b.x + b.w, b.y + b.h, zt - TH);
          case 'center': return iso(b.cx, b.cy, zt);
          default: return iso(b.x, b.y, zt);
        }
      },

      /* a system's block in stage px, with room for its marker badge at the top-right corner. Zones have none: a slab's
         edges are diagonals, so its bounding box is not a border text should keep clear of */
      stageRect: function (id, cam) {
        var b = B[id];
        if (!b || b.type !== 'node') return null;
        var r = rectToStage(nodeBox(id), cam);
        r.y0 -= 14; r.x1 += 12;
        return r;
      },

      /* a dot floating LIFT px above its shadow on the floor (both a fixed stage size); a stream item's glyph instead of
         the dot when it names one; the tag (text.tag) rides above the dot */
      packet: function (spec) {
        var g = el('g', { opacity: 0 }, L.packets), col = colorOf(spec && spec.color, C.accent), inner = el('g', {}, g);
        cs.push(inner);
        packs.push(g);
        if (lastCam) inner.setAttribute('transform', 'scale(' + (lastCam.w / area.w).toFixed(5) + ')');
        el('ellipse', { cx: 0, cy: 0, rx: 13, ry: 6, fill: '#000', 'fill-opacity': 0.5 }, inner);
        var d = el('g', { transform: 'translate(0,' + (-LIFT) + ')' }, inner);
        if (spec && EXK.GLYPHS[spec.glyph]) EXK.GLYPHS[spec.glyph](el('g', { transform: 'scale(0.62)' }, d), col);    /* a stream item's glyph */
        else {
          el('circle', { r: DOT_R, fill: C.bg, stroke: col, 'stroke-width': 4 }, d);
          el('circle', { r: 5, fill: col }, d);
        }
        return g;
      },
      portLight: function (m, color) {
        return el('polygon', { points: ringPts(ports[m], RING_LIT_R), fill: 'none', stroke: color, 'stroke-width': 6, 'stroke-linejoin': 'round', opacity: 0 }, L.portfx);
      },
      shieldLift: SHIELD_LIFT,     /* scene px (one ground unit of height is one scene px) */
      shieldBox: function () { return { l: 25, r: 25, t: 29, b: 32 }; },    /* counter-scaled: a fixed stage size */
      shield: function (pt, num) {
        var g = el('g', { transform: 'translate(' + f1(pt.x) + ',' + f1(pt.y) + ')', opacity: 0 }, L.top), c2 = el('g', {}, g), ic = el('g', {}, c2);
        cs.push(c2);
        if (lastCam) c2.setAttribute('transform', 'scale(' + (lastCam.w / area.w).toFixed(5) + ')');
        var d = 'M0,-27 L23,-19 V3 Q23,21 0,30 Q-23,21 -23,3 V-19 Z';
        el('path', { d: d, fill: C.panel, stroke: C.secure, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, ic);
        el('path', { d: d, fill: C.secure, 'fill-opacity': 0.3 }, ic);
        txt(ic, num, { x: 0, y: 8, 'text-anchor': 'middle', class: 'mono', fill: C.text, 'font-size': num.length > 2 ? 14 : num.length > 1 ? 17 : 21, 'font-weight': 800 });
        return { g: g, icon: ic };
      },
      traceLink: function (id) {
        return el('path', { d: edgeP[id].getAttribute('d'), fill: 'none', stroke: C.danger, 'stroke-width': 10, 'stroke-linecap': 'butt', 'stroke-linejoin': 'round', opacity: 0 }, L.fx);
      },
      markedIds: function () { return Object.keys(markG); },
      trailIds: function () { return Object.keys(trailP); },
      lightLink: function (id, color) {
        return el('path', { d: edgeP[id].getAttribute('d'), fill: 'none', stroke: color, 'stroke-width': 7, 'stroke-linecap': 'butt', 'stroke-linejoin': 'round', opacity: 0 }, L.lit);
      },
      /* an arrival ring: the block's footprint plate lit in the colour */
      ring: function (id, color) {
        return el('polygon', { points: plateOf(id), fill: color, 'fill-opacity': 0.16, stroke: color, 'stroke-width': 4, 'stroke-linejoin': 'round', opacity: 0 }, L.plates);
      },
      marker: function (id) { return markG[id]; },
      trail: function (id) { return trailP[id]; },

      focus: function (sets, t, dur) {
        var items = [];
        Object.keys(nodeG).forEach(function (id) { items.push([nodeG[id], !sets || sets.nodes[id]]); });
        Object.keys(slabG).forEach(function (id) { items.push([slabG[id], !sets || sets.boxes[id]]); });
        Object.keys(edgeG).forEach(function (id) { items.push([edgeG[id], !sets || sets.edges[id]]); });
        portG.forEach(function (p) { items.push([p.g, !sets || p.links.some(function (id) { return sets.edges[id]; })]); });
        items.forEach(function (it) {
          var to = it[1] ? 1 : T.FOCUS_DIM, from = focusCur.has(it[0]) ? focusCur.get(it[0]) : 1;
          if (from !== to) tl.fromTo(it[0], { opacity: from }, { opacity: to, duration: dur, ease: T.DIM_EASE, immediateRender: false }, t);
          focusCur.set(it[0], to);
        });
      },

      /* labelPolicy 'touched' (P§10): a system's label shows only in the steps that involve it, placed for the step's
         camera; container tags only for the containers around the action (the full view: the top two levels);
         containers holding the whole frame are the breadcrumb instead */
      stepText: function (text, frame, o) {
        /* after the camera has settled when the step moved it (anchored text keeps its stage offsets while the zoom changes) */
        var moved = !planned || Math.abs(planned.x - frame.x) > 0.5 || Math.abs(planned.y - frame.y) > 0.5 || Math.abs(planned.w - frame.w) > 0.5;
        planned = frame;
        var s = text.sessions[text.sessions.length - 1], at = o.t + (moved ? T.CAMERA_MOVE : LABEL_AT), out = [];
        var ids = (o.nodes || []).filter(function (id) { return B[id] && B[id].type === 'node'; });
        ids.forEach(function (id) {
          out.push(text.label(id, [(sysOf[id] || { name: id }).name], { at: at }));     /* the name only, as the reference: a sub-line crowds the block */
        });
        /* the summary (a shields beat): each shield's protected system (the end its link leads to) is named when its label
           fits clear of blocks, lanes and the shields themselves; otherwise its name is folded into the shield's label
           (shieldName). The shields' places are reserved before this runs, as the reference does */
        var shielded = shieldTargets(o.step);
        if (shielded.length) {       /* the shields' places are already reserved (scene/beats.js planShields) */
          var named = {};
          shielded.forEach(function (q) {
            if (named[q.to] != null) return;
            named[q.to] = labelFits(q.to, s);
            if (named[q.to]) out.push(text.label(q.to, [(sysOf[q.to] || { name: q.to }).name], { at: at }));
          });
          folded = {};
          shielded.forEach(function (q) { if (!named[q.to]) folded[q.id] = (sysOf[q.to] || { name: q.to }).name; });
        }
        var chain = {}, crumb = frame.full ? [] : (frame.crumb || []);
        if (frame.full && !ids.length) boxes.forEach(function (b) { if (b.depth <= 2) chain[b.id] = 1; });
        else ids.forEach(function (id) { ancestors(id).forEach(function (p) { chain[p] = 1; }); });
        Object.keys(chain).filter(function (id) { return crumb.indexOf(B[id].short || B[id].label) < 0; })
          .sort(function (a, b) { return B[a].depth - B[b].depth; })
          .forEach(function (id) { var lay = placeTag(id, s.cam, s.occ); if (lay) out.push(drawTag(text, lay, at)); });
        return out;
      },

      /* the shield label for a control: its name, with its protected system's name folded in when that has no label */
      shieldName: function (control) { return folded[control.id] ? control.name + ' \u00b7 ' + folded[control.id] : control.name; },

      texts: function () { return []; },
      textRects: function () { return []; }
    };
    /* A packet runs on into its block's centre (routes do, so consecutive hops join), but it is drawn above every block.
       While its floor point is inside a block's footprint it fades (dot, shadow and tag, not the group the runner tweens),
       so it goes into the block instead of over it, as a flat packet passes behind its node. A pure function of the
       packet's current position: seek gives the same frame. */
    var packs = [], feet = null;
    function intoBlock(g) {
      var m = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/.exec(g.getAttribute('transform') || ''), o = 1;
      if (m) {
        var X = +m[1], Y = +m[2];
        if (!feet) feet = Object.keys(nodeG).map(function (id) { return { cx: B[id].cx, cy: B[id].cy, z: nodeZ(id) }; });
        feet.forEach(function (n) {
          var q = groundAt(X, Y, n.z), d = Math.max(Math.abs(q.x - n.cx), Math.abs(q.y - n.cy));
          o = Math.min(o, Math.max(0, Math.min(1, (d - INTO_IN) / (INTO_OUT - INTO_IN))));
        });
      }
      var v = o >= 1 ? null : o.toFixed(3);
      for (var c = g.firstChild; c; c = c.nextSibling) {
        if (v === null) c.removeAttribute('opacity'); else c.setAttribute('opacity', v);
        /* the tag (text.tag: outline, tint, then the text group that gives way): the outline follows its text, so the
           whole tag gives way, as in the reference, instead of leaving an empty chip */
        var gt = c !== g.firstChild && c.lastChild, tx = gt && gt.firstChild;
        if (!tx || !gt.style) continue;
        var vt = (parseFloat(gt.style.opacity || '1') * parseFloat((tx.style && tx.style.opacity) || '1')).toFixed(3);
        for (var r = c.firstChild; r && r !== gt; r = r.nextSibling) r.setAttribute('opacity', vt);
      }
    }
    var INTO_IN = HALF - 8, INTO_OUT = HALF + 14;   /* ground units from the block's centre: hidden inside, whole outside */
    var LABEL_AT = 0.3;       /* s after the text session opens: labels and tags fade in when the camera stays put */
    var planned = null;
    var folded = {};          /* control id -> its protected system's name, when that is folded into the shield label */
    function shieldTargets(st) {
      var sb = (st.beats || []).filter(function (b) { return b.shields !== undefined; })[0];
      if (!sb) return [];
      return (story.controls || []).filter(function (k) { return sb.shields === 'controls' || (Array.isArray(sb.shields) && sb.shields.indexOf(k.id) >= 0); })
        .map(function (k) { var lk = k.on && EXK.route.findLink(E, k.on[0], k.on[1]); return lk ? { id: k.id, link: lk.id, to: E[lk.id].b } : null; })
        .filter(Boolean);
    }
    /* would a node label fit clear of blocks, lanes and placed text at one of text.label's near spots (above, beside)? */
    function labelFits(id, s) {
      var name = (sysOf[id] || { name: id }).name, w = name.length * 26 * 0.6 + 8, h = 30, br = painter.stageRect(id, s.cam);
      var cx = (br.x0 + br.x1) / 2, cy = (br.y0 + br.y1) / 2, above = br.y0 - 8 - h / 2;
      return [[cx, above], [cx - w / 2 - 18, above], [cx + w / 2 + 18, above], [br.x0 - 12 - w / 2, cy], [br.x1 + 12 + w / 2, cy]].some(function (c) {
        return s.occ.free({ x0: c[0] - w / 2, x1: c[0] + w / 2, y0: c[1] - h / 2, y1: c[1] + h / 2 }, true, true, true);
      });
    }       /* the frame the last text session was planned for */

    function nodeColor(s) {
      if (s.tint) return colorOf(s.tint, C.text);
      if (s.icon === 'cdn' || s.icon === 'lb') return C.accent;
      if (s.icon === 'db') return C.muted;
      return '#c9d6ea';
    }
    function plateOf(id) {
      var b = B[id], e = b.w / 2, z = nodeZ(id) + 0.8;
      return poly([[b.cx - e, b.cy - e, z], [b.cx + e, b.cy - e, z], [b.cx + e, b.cy + e, z], [b.cx - e, b.cy + e, z]]);
    }
    function ringPts(m, r) {
      var out = [];
      for (var i = 0; i < 28; i++) { var a = i / 28 * 2 * Math.PI; out.push(P(m.x + r * Math.cos(a), m.y + r * Math.sin(a), m.z + 0.8)); }
      return out.join(' ');
    }
    return painter;
  };
})();
