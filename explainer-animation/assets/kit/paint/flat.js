/* The flat painter (references/rules.md): draws the laid-out estate once, as the flat v3 reference does
   (container rectangles with label tabs, node boxes with icons and sub-labels, rounded orthogonal links, port
   rings, trails, blast-radius markers, packets), and applies the camera as a transform on the world group.
   It draws; it does not decide when. Every tween is emitted by scene/beats.js, except painter.focus, which is
   handed its time and duration. Port of a-flat-attack-chain.html buildWorld / ring / mkChip.

   EXK.painters.flat(ctx) -> painter
     build(estate, story, layers)       estate = EXK.layout.layoutEstate(..) plus .routes (EXK.route.routeLinks)
                                        and .ports (EXK.route.markers); layers = shell.layers
     applyCamera(cam)                   cam {x, y, w, h} scene px
     pathEl(linkId)                     the drawn link path (MotionPath, DrawSVG)
     onScreenRange(linkId, cam, proxyW) {f0, f1, aOff, bOff}: the part of the link inside the frame
     anchor(id, side)                   'top' | 'side' (top-right corner, beyond the marker badge) | 'left' | 'right' | 'bottom' | 'center'
     stageRect(id, cam)                 a system's block in stage px
     packet({color, chip, glyph})       a new packet group (direct child of [data-layer="packets"]), hidden; a dot, a
                                        glyph (EXK.GLYPHS: file, push, mail, key), or empty when chip (text.tag draws
                                        the chip into it)
     portLight(m, color)                a new highlight over port marker m, hidden
     shield(point, num) -> {g, icon}    a shield for the summary step, hidden
     shieldLift, shieldBox(cam)         scene px a shield stands above its link; its stage rect as half extents
     traceLink(linkId)                  a new summary trace over the link, hidden
     markedIds() / trailIds()           the ids that have a marker / a trail
     tagLift                            stage px from the packet centre up to its tag's bottom (text.tag)
     lightLink(linkId, color)           a new lit-link path over the link, hidden (DrawSVG target)
     ring(id, color)                    a new arrival ring on a node, hidden
     marker(id)                         the node's blast-radius marker group, hidden until tweened
     trail(linkId)                      the link's persistent trail path, hidden until tweened
     focus(sets | null, t, dur)         dim what sets = {nodes, boxes, edges} does not hold (null: nothing dimmed)
     texts()                            painter-drawn text for the text registry: [{key, el, node | tab}]
     textRects(cam)                     stage rects of painter-drawn text (tabs, node labels), for placement
     labelPolicy                        'always' (flat: every node shows its label) */
(function () {
  'use strict';
  var EXK = window.EXK, C = EXK.THEME, T = EXK.timing;
  var NS = 'http://www.w3.org/2000/svg';
  var FADE = 56;            /* stage px: the soft edge of the diagram area (page.html #fade) */
  var TAB_FS = 34;          /* container tab label, scene px (flat v3 LFS) */
  var BADGE_CLEAR = 20;     /* 'side' anchors sit this far out from a node's top-right corner, clear of its marker badge */
  var TAG_HALF = 17;        /* half the moving tag's height (text.js TAG_H 34), stage px */
  var FILE_SCALE = 1.1;     /* stream packet glyphs, scene units (the flat reference's file size in its close-up) */
  var NODE_R = 20, PACKET_R = 15, TRAIL_OPACITY = 0.42, LIT_W = 8, PORT_MERGE = 36;

  var ICONS = {
    attacker: '<path d="M-17,23 C-17,9 -8,3 0,3 C8,3 17,9 17,23 Z"/><path d="M-11,-7 C-11,-18 -6,-23 0,-23 C6,-23 11,-18 11,-7 C11,3 6,5 0,5 C-6,5 -11,3 -11,-7 Z"/><path d="M-6,-8 H6"/>',
    cdn: '<path d="M0,-23 L19,-15 V2 C19,13 10,20 0,25 C-10,20 -19,13 -19,2 V-15 Z"/><path d="M-10,-7 L-5,9 L0,-3 L5,9 L10,-7"/>',
    lb: '<circle cx="-19" cy="0" r="4"/><path d="M-15,0 H-5 M-5,0 L6,-14 H14 M-5,0 H14 M-5,0 L6,14 H14"/><circle cx="18" cy="-14" r="3.5"/><circle cx="18" cy="0" r="3.5"/><circle cx="18" cy="14" r="3.5"/>',
    store: '<path d="M-20,-8 L-15,-21 H15 L20,-8"/><path d="M-20,-8 C-20,-2 -10,-2 -10,-8 C-10,-2 0,-2 0,-8 C0,-2 10,-2 10,-8 C10,-2 20,-2 20,-8"/><path d="M-16,-1 V21 H16 V-1"/><rect x="-5" y="7" width="10" height="14"/>',
    payments: '<rect x="-24" y="-15" width="48" height="30" rx="5"/><path d="M-24,-5 H24 M-16,7 H-4"/>',
    chip: '<rect x="-15" y="-15" width="30" height="30" rx="5"/><rect x="-6" y="-6" width="12" height="12" rx="2"/><path d="M-8,-15 V-22 M0,-15 V-22 M8,-15 V-22 M-8,15 V22 M0,15 V22 M8,15 V22 M-15,-8 H-22 M-15,0 H-22 M-15,8 H-22 M15,-8 H22 M15,0 H22 M15,8 H22"/>',
    iam: '<path d="M0,-21 L18,-14 V2 C18,13 9,19 0,23 C-9,19 -18,13 -18,2 V-14 Z"/><circle cx="0" cy="-5" r="5"/><path d="M-9,12 C-9,5 9,5 9,12"/>',
    bucket: '<ellipse cx="0" cy="-15" rx="19" ry="6"/><path d="M-19,-15 L-14,19 C-14,24 14,24 14,19 L19,-15"/><path d="M-17,-1 C-10,4 10,4 17,-1"/>',
    lock: '<rect x="-15" y="-4" width="30" height="25" rx="5"/><path d="M-9,-4 V-11 A9,9 0 0 1 9,-11 V-4"/><circle cx="0" cy="8" r="3"/><path d="M0,11 V15"/>',
    eye: '<path d="M-23,0 C-12,-15 12,-15 23,0 C12,15 -12,15 -23,0 Z"/><circle cx="0" cy="0" r="6.5"/>',
    db: '<ellipse cx="0" cy="-14" rx="19" ry="6.5"/><path d="M-19,-14 V14 C-19,18 -10,21 0,21 C10,21 19,18 19,14 V-14"/><path d="M-19,0 C-19,4 -10,7 0,7 C10,7 19,4 19,0"/>',
    box: '<rect x="-18" y="-18" width="36" height="36" rx="6"/>'
  };

  /* container styles of the flat v3 reference (KIND), chosen here by depth and by whether the zone holds zones */
  var KIND = {
    internet: { r: 34, sw: 3, stroke: '#33405a', dash: '18 12', fa: 0.012 },
    account: { r: 36, sw: 4.5, stroke: '#46536f', dash: null, fa: 0.03 },
    edge: { r: 30, sw: 4, stroke: '#4d5c7b', dash: '1 11', fa: 0.045, cap: 'round' },
    vpc: { r: 30, sw: 3.5, stroke: '#4d5d7e', dash: '30 9 5 9', fa: 0.05 },
    subnet: { r: 24, sw: 2.5, stroke: '#52628a', dash: null, fa: 0.065 },
    cluster: { r: 22, sw: 3, stroke: '#5a6b93', dash: null, fa: 0.085, dbl: true },
    ns: { r: 18, sw: 2.5, stroke: '#65779f', dash: '9 7', fa: 0.11 }
  };
  function kindOf(b, B) {
    var nest = (b.kids || []).some(function (k) { return B[k] && B[k].type === 'box'; });
    if (b.depth <= 1) return nest ? KIND.account : KIND.internet;
    if (b.depth === 2) return nest ? KIND.vpc : KIND.edge;
    if (b.depth === 3) return KIND.subnet;
    if (b.depth === 4) return KIND.cluster;
    return KIND.ns;
  }

  /* stream packet glyphs, drawn in a box of about 48 x 52 around the packet point: what a stream carries when it is not
     a plain message (a stream beat's `glyph`; story/validate.js GLYPHS). Shared with the iso painter. */
  var GLYPHS = {
    file: function (g, col) {
      var d = 'M-20,-26 H8 L20,-14 V26 H-20 Z';
      el('path', { d: d, fill: C.panel, stroke: col, 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
      el('path', { d: d, fill: col, 'fill-opacity': 0.25 }, g);
      el('path', { d: 'M8,-26 V-14 H20 M-10,0 H10 M-10,10 H10', fill: 'none', stroke: col, 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
    },
    push: function (g, col) {     /* a phone with a notification badge */
      el('rect', { x: -15, y: -26, width: 30, height: 52, rx: 7, fill: C.panel, stroke: col, 'stroke-width': 5 }, g);
      el('path', { d: 'M-6,18 H6', fill: 'none', stroke: col, 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
      el('circle', { cx: 15, cy: -24, r: 10, fill: col, stroke: C.bg, 'stroke-width': 3 }, g);
    },
    mail: function (g, col) {     /* an envelope */
      el('rect', { x: -24, y: -17, width: 48, height: 34, rx: 5, fill: C.panel, stroke: col, 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
      el('path', { d: 'M-22,-14 L0,4 L22,-14', fill: 'none', stroke: col, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
    },
    key: function (g, col) {      /* a key */
      el('circle', { cx: -12, cy: 0, r: 11, fill: C.panel, stroke: col, 'stroke-width': 5 }, g);
      el('path', { d: 'M-1,0 H24 M16,0 V9 M22,0 V7', fill: 'none', stroke: col, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
    }
  };
  EXK.GLYPHS = GLYPHS;

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, s, attrs) { var e = el('text', attrs, parent); e.textContent = s; return e; }
  function colorOf(name, dflt) { return name ? (C[name] || name) : dflt; }

  /* a node's text lines: name (wrapped into two when it does not fit) or name + sub */
  function nodeLines(sys, w) {
    if (sys.sub) return { lines: [sys.name, sys.sub], sub: true };
    var name = String(sys.name);
    if (name.length * 28 * 0.56 <= w - 28) return { lines: [name], sub: false };
    var words = name.split(/\s+/), best = null;
    for (var i = 1; i < words.length; i++) {
      var a = words.slice(0, i).join(' '), b = words.slice(i).join(' '), d = Math.max(a.length, b.length);
      if (!best || d < best.d) best = { d: d, lines: [a, b] };
    }
    return { lines: best ? best.lines : [name], sub: false };
  }

  EXK.painters.flat = function (ctx) {
    var area = ctx.area, tl = ctx.tl;
    var B = null, E = null, svg = null, world = null, L = {};
    var ports = [], nodeG = {}, boxG = {}, edgeG = {}, edgeP = {}, portG = [], trailP = {}, markG = {};
    var labelEls = {}, labelBox = {}, tabEls = {}, tabBox = {}, focusCur = new Map(), D = {};

    function k(cam) { return area.w / cam.w; }
    function toStage(x, y, cam) { var s = k(cam); return { x: area.x + (x - cam.x) * s, y: area.y + (y - cam.y) * s }; }
    function rectToStage(r, cam) {
      var a = toStage(r.x0, r.y0, cam), b = toStage(r.x1, r.y1, cam);
      return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    }

    var painter = {
      labelPolicy: 'always',
      tagLift: -TAG_HALF,     /* the tag is centred on the packet, like the flat reference's chip: the container tabs sit
                                 just above the link row, so a tag lifted above the packet would cover them all the way */
      TRAIL_OPACITY: TRAIL_OPACITY,

      build: function (estate, story, layers) {
        if (!estate || !estate.routes) throw new Error('flat painter: build needs the estate model (layoutEstate + routeLinks)');
        B = estate.B; E = estate.routes;
        var NW = estate.sizes.nodeW, NH = estate.sizes.nodeH, TABH = estate.sizes.tabH;
        var sysOf = {};
        story.systems.forEach(function (s) { sysOf[s.id] = s; });

        svg = el('svg', { width: area.w, height: area.h, viewBox: '0 0 ' + area.w + ' ' + area.h }, layers.world);
        world = el('g', { 'data-layer': 'world' }, svg);
        ['boxes', 'edges', 'ports', 'trail', 'fx', 'portfx', 'packets', 'nodes', 'top'].forEach(function (n) { L[n] = el('g', { 'data-layer': n }, world); });

        /* containers: rect (double for clusters), tab, label */
        estate.boxes.slice().sort(function (a, b) { return a.depth - b.depth; }).forEach(function (b) {
          var kd = kindOf(b, B), g = el('g', { 'data-box': b.id }, L.boxes);
          boxG[b.id] = g;
          var ra = { x: b.x, y: b.y, width: b.w, height: b.h, rx: kd.r, fill: '#ffffff', 'fill-opacity': kd.fa, stroke: kd.stroke, 'stroke-width': kd.sw };
          if (kd.dash) ra['stroke-dasharray'] = kd.dash;
          if (kd.cap) ra['stroke-linecap'] = kd.cap;
          el('rect', ra, g);
          if (kd.dbl) el('rect', { x: b.x + 10, y: b.y + 10, width: b.w - 20, height: b.h - 20, rx: kd.r - 6, fill: 'none', stroke: kd.stroke, 'stroke-width': 1.5, 'stroke-opacity': 0.7 }, g);
          if (!b.tab) return;
          var tw = b.tab.w, th = TABH, r = kd.r;
          el('path', { d: 'M' + b.x + ',' + (b.y + th) + ' V' + (b.y + r) + ' Q' + b.x + ',' + b.y + ' ' + (b.x + r) + ',' + b.y + ' H' + (b.x + tw) +
            ' V' + (b.y + th - 14) + ' Q' + (b.x + tw) + ',' + (b.y + th) + ' ' + (b.x + tw - 14) + ',' + (b.y + th) + ' Z', fill: kd.stroke, 'fill-opacity': 0.55 }, g);
          tabEls[b.id] = txt(g, b.caps ? String(b.label).toUpperCase() : b.label, { x: b.x + 22, y: b.y + 44, class: 'sans', fill: '#dbe3f0', 'font-size': TAB_FS, 'font-weight': 650, 'letter-spacing': b.caps ? 2 : 0 });
          var tb = tabEls[b.id].getBBox();
          tabBox[b.id] = { x0: b.x, y0: b.y, x1: Math.max(b.x + tw, tb.x + tb.width), y1: Math.max(b.y + th, tb.y + tb.height) };
        });

        /* links run from the centre of one node to the centre of the other: a route ends inside its node on the line it
           enters by, and two routes of one node end at different points, so a packet going on to its next hop jumped
           between them (up to about 110 stage px in one frame). The parts under a node are never seen: the link layers
           are masked by the node boxes, which also keeps a link from showing through its own end node when that is
           dimmed. Port fractions are re-measured on the drawn path, which is the one packets travel. */
        var mask = el('mask', { id: 'exk-node-mask', maskUnits: 'userSpaceOnUse', x: estate.world.x - 4000, y: estate.world.y - 4000,
          width: estate.world.w + 8000, height: estate.world.h + 8000 }, el('defs', {}, svg));
        el('rect', { x: estate.world.x - 4000, y: estate.world.y - 4000, width: estate.world.w + 8000, height: estate.world.h + 8000, fill: '#fff' }, mask);
        estate.nodes.forEach(function (b) { el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: NODE_R, fill: '#000' }, mask); });
        ['edges', 'trail', 'fx'].forEach(function (n) { L[n].setAttribute('mask', 'url(#exk-node-mask)'); });
        Object.keys(E).forEach(function (id) {
          var r = E[id], g = el('g', { 'data-link': id }, L.edges), a = B[r.a], b = B[r.b], pts = r.pts.slice(), lead = 0;
          if (Math.hypot(pts[0][0] - a.cx, pts[0][1] - a.cy) > 0.5) { lead = Math.abs(pts[0][0] - a.cx) + Math.abs(pts[0][1] - a.cy); pts.unshift([a.cx, a.cy]); }
          var q = pts[pts.length - 1];
          if (Math.hypot(q[0] - b.cx, q[1] - b.cy) > 0.5) pts.push([b.cx, b.cy]);
          D[id] = EXK.route.roundedPath(pts);
          edgeG[id] = g;
          edgeP[id] = el('path', { d: D[id], fill: 'none', stroke: '#33405a', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
          trailP[id] = el('path', { d: D[id], fill: 'none', stroke: C.danger, 'stroke-width': 9, 'stroke-linecap': 'round', opacity: 0 }, L.trail);
          var tot = EXK.route.polyLen(pts);
          r.ports.forEach(function (pq) { pq.f = tot ? (lead + pq.s) / tot : 0; });
        });
        ports = estate.ports || EXK.route.markers(E, PORT_MERGE);
        ports.forEach(function (m) {
          var g = el('g', {}, L.ports);
          el('circle', { cx: m.x, cy: m.y, r: 9, fill: C.bg, stroke: '#7d8cab', 'stroke-width': 3 }, g);
          portG.push({ g: g, links: m.links });
        });

        /* nodes: box, icon, one or two lines, the hidden blast-radius marker */
        estate.nodes.forEach(function (b) {
          var s = sysOf[b.id] || { name: b.label }, hw = NW / 2, hh = NH / 2;
          var g = el('g', { class: 'node', 'data-node': b.id, transform: 'translate(' + b.cx + ',' + b.cy + ')' }, L.nodes);
          nodeG[b.id] = g;
          el('rect', { 'data-block': b.id, x: -hw, y: -hh, width: NW, height: NH, rx: NODE_R, fill: C.panel, stroke: '#3a4660', 'stroke-width': 2.5 }, g);
          var nl = nodeLines(s, NW), two = nl.lines.length > 1;
          var ig = el('g', { transform: 'translate(0,' + (two ? -30 : -16) + ')', fill: 'none', stroke: colorOf(s.tint, C.text), 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
          ig.innerHTML = ICONS[s.icon] || ICONS.box;
          var lg = el('g', {}, g);
          if (two) {
            txt(lg, nl.lines[0], { x: 0, y: 22, 'text-anchor': 'middle', class: 'sans', fill: C.text, 'font-size': 26, 'font-weight': 600 });
            txt(lg, nl.lines[1], { x: 0, y: 52, 'text-anchor': 'middle', class: 'sans', fill: nl.sub ? C.muted : C.text, 'font-size': nl.sub ? 24 : 26, 'font-weight': nl.sub ? 500 : 600 });
          } else {
            txt(lg, nl.lines[0], { x: 0, y: 44, 'text-anchor': 'middle', class: 'sans', fill: C.text, 'font-size': 28, 'font-weight': 600 });
          }
          labelEls[b.id] = lg;
          var bb = lg.getBBox();
          labelBox[b.id] = bb.width > 0 ? { x0: b.cx + bb.x, y0: b.cy + bb.y, x1: b.cx + bb.x + bb.width, y1: b.cy + bb.y + bb.height }
            : { x0: b.cx - hw + 12, y0: b.cy + 4, x1: b.cx + hw - 12, y1: b.cy + hh - 8 };
          var mk = el('g', { opacity: 0 }, g);
          el('rect', { x: -hw, y: -hh, width: NW, height: NH, rx: NODE_R, fill: C.danger, 'fill-opacity': 0.1, stroke: C.danger, 'stroke-width': 6 }, mk);
          var bd = el('g', { transform: 'translate(' + (hw - 6) + ',' + (-hh + 6) + ')' }, mk);
          el('circle', { cx: 0, cy: 0, r: 21, fill: C.danger, stroke: C.bg, 'stroke-width': 4 }, bd);
          txt(bd, '!', { x: 0, y: 10, 'text-anchor': 'middle', class: 'sans', fill: C.bg, 'font-size': 30, 'font-weight': 800 });
          markG[b.id] = mk;
        });

        /* mini-map: the estate in outline (the camera adds its frame rect on top) */
        var mm = ctx.shell && ctx.shell.minimap;
        if (mm) {
          var mg = el('g', {}, mm), sw = estate.full.w / 340;
          estate.boxes.forEach(function (b) { el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 14, fill: 'none', stroke: '#52628a', 'stroke-width': 2 * sw }, mg); });
          estate.nodes.forEach(function (b) { el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 14, fill: '#3a4660' }, mg); });
        }
        painter.applyCamera(estate.full);
      },

      applyCamera: function (cam) {
        var s = k(cam);
        world.setAttribute('transform', 'scale(' + s.toFixed(6) + ') translate(' + (-cam.x).toFixed(3) + ',' + (-cam.y).toFixed(3) + ')');
      },

      pathEl: function (id) { return edgeP[id]; },

      /* the part of a link on screen: an endpoint outside the frame is replaced by where the path enters the frame,
         inset by the edge fade (and by proxyW on the side the endpoint lies beyond, where its proxy badge sits) */
      onScreenRange: function (id, cam, proxyW) {
        var r = E[id], a = B[r.a], b = B[r.b];
        function inF(p) { return p.x >= cam.x && p.x <= cam.x + cam.w && p.y >= cam.y && p.y <= cam.y + cam.h; }
        var aOff = !inF({ x: a.cx, y: a.cy }), bOff = !inF({ x: b.cx, y: b.cy });
        if (!aOff && !bOff) return { f0: 0, f1: 1, aOff: false, bOff: false };
        var z = k(cam), path = edgeP[id], Lp = path.getTotalLength(), n = Math.max(8, Math.ceil(Lp / 4));
        function inset(end) {
          var m = { left: FADE, right: FADE, top: FADE, bottom: FADE }, pp = EXK.frame.proxyPoint(r, cam, end);
          if (pp && proxyW) m[pp.side] = Math.max(FADE, proxyW);
          return m;
        }
        function ins(p, m) { return p.x >= cam.x + m.left / z && p.x <= cam.x + cam.w - m.right / z && p.y >= cam.y + m.top / z && p.y <= cam.y + cam.h - m.bottom / z; }
        var f0 = 0, f1 = 1, q, i;
        if (aOff) { var ma = inset('a'); for (i = 0; i <= n; i++) { q = path.getPointAtLength(Lp * i / n); if (ins(q, ma)) { f0 = i / n; break; } } }
        if (bOff) { var mb = inset('b'); for (i = n; i >= 0; i--) { q = path.getPointAtLength(Lp * i / n); if (ins(q, mb)) { f1 = i / n; break; } } }
        if (f1 < f0) f1 = f0;
        return { f0: f0, f1: f1, aOff: aOff, bOff: bOff };
      },

      anchor: function (id, side) {
        var b = B[id];
        if (!b && E[id]) { var p = EXK.route.pointAt(E[id].pts, E[id].len / 2); return { x: p[0], y: p[1] }; }
        switch (side) {
          case 'side': return b.type === 'node' ? { x: b.x + b.w + BADGE_CLEAR, y: b.y - BADGE_CLEAR } : { x: b.x + b.w, y: b.y };
          case 'left': return { x: b.x, y: b.cy };
          case 'right': return { x: b.x + b.w, y: b.cy };
          case 'bottom': return { x: b.cx, y: b.y + b.h };
          case 'center': return { x: b.cx, y: b.cy };
          default: return { x: b.cx, y: b.y };
        }
      },

      stageRect: function (id, cam) {
        var b = B[id];
        if (!b) return null;
        return rectToStage({ x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h }, cam);
      },

      /* spec.chip: the packet is a chip carrying a tag (text.tag draws it into the group); spec.glyph: a stream item's
         glyph (file, push, mail, key); otherwise a plain dot */
      packet: function (spec) {
        var g = el('g', { opacity: 0 }, L.packets);
        var col = colorOf(spec && spec.color, C.accent);
        if (spec && GLYPHS[spec.glyph]) GLYPHS[spec.glyph](el('g', { transform: 'scale(' + FILE_SCALE + ')' }, g), col);
        else if (!spec || !spec.chip) el('circle', { r: PACKET_R, fill: col, stroke: C.bg, 'stroke-width': 4 }, g);
        return g;
      },
      /* a new highlight over port marker m (estate.ports index), hidden: lit while a packet crosses it */
      portLight: function (m, color) {
        var q = ports[m];
        return el('circle', { cx: q.x, cy: q.y, r: 11, fill: color, 'fill-opacity': 0.35, stroke: color, 'stroke-width': 4, opacity: 0 }, L.portfx);
      },
      shieldLift: 0,          /* scene px a shield stands above its link's line (on it) */
      /* the stage rect a shield occupies around its point, as half extents (it scales with the camera) */
      shieldBox: function (cam) { var z = k(cam); return { l: 31 * z, r: 31 * z, t: 37 * z, b: 41 * z }; },
      /* a shield (summary step) at a scene point, hidden; returns {g, icon} (icon is scaled in by the runner) */
      shield: function (pt, num) {
        var g = el('g', { transform: 'translate(' + pt.x + ',' + pt.y + ')', opacity: 0 }, L.top), ic = el('g', {}, g);
        var d = 'M0,-34 L28,-24 V0 C28,18 14,30 0,38 C-14,30 -28,18 -28,0 V-24 Z';
        el('path', { d: d, fill: C.panel, stroke: C.secure, 'stroke-width': 5 }, ic);
        el('path', { d: d, fill: C.secure, 'fill-opacity': 0.25 }, ic);
        txt(ic, num, { x: 0, y: 10, 'text-anchor': 'middle', class: 'sans', fill: C.text, 'font-size': num.length > 2 ? 20 : num.length > 1 ? 24 : 30, 'font-weight': 800 });
        return { g: g, icon: ic };
      },
      /* a new full-width trace of a link for the summary step, hidden (DrawSVG target) */
      traceLink: function (id) {
        return el('path', { d: D[id], fill: 'none', stroke: C.danger, 'stroke-width': 11, 'stroke-linecap': 'round', opacity: 0 }, L.fx);
      },
      markedIds: function () { return Object.keys(markG); },
      trailIds: function () { return Object.keys(trailP); },
      lightLink: function (id, color) {
        return el('path', { d: D[id], fill: 'none', stroke: color, 'stroke-width': LIT_W, 'stroke-linecap': 'butt', opacity: 0 }, L.fx);
      },
      ring: function (id, color) {
        var b = B[id], hw = b.w / 2, hh = b.h / 2;
        return el('rect', { x: -hw, y: -hh, width: b.w, height: b.h, rx: NODE_R, fill: 'none', stroke: color, 'stroke-width': 7, opacity: 0 }, nodeG[id]);
      },
      marker: function (id) { return markG[id]; },
      trail: function (id) { return trailP[id]; },

      /* focus: nodes, containers, links and port rings not in sets go to FOCUS_DIM; tweens are emitted in call order
         (the runner calls this once per step, in time order), each from the element's previous value */
      focus: function (sets, t, dur) {
        var items = [];
        Object.keys(nodeG).forEach(function (id) { items.push([nodeG[id], !sets || sets.nodes[id]]); });
        Object.keys(boxG).forEach(function (id) { items.push([boxG[id], !sets || sets.boxes[id]]); });
        Object.keys(edgeG).forEach(function (id) { items.push([edgeG[id], !sets || sets.edges[id]]); });
        portG.forEach(function (p) { items.push([p.g, !sets || p.links.some(function (id) { return sets.edges[id]; })]); });
        items.forEach(function (it) {
          var to = it[1] ? 1 : T.FOCUS_DIM, from = focusCur.has(it[0]) ? focusCur.get(it[0]) : 1;
          if (from !== to) tl.fromTo(it[0], { opacity: from }, { opacity: to, duration: dur, ease: T.DIM_EASE, immediateRender: false }, t);
          focusCur.set(it[0], to);
        });
      },

      texts: function () {
        var out = [];
        Object.keys(labelEls).forEach(function (id) { out.push({ key: 'label:' + id, el: labelEls[id], node: id }); });
        Object.keys(tabEls).forEach(function (id) { out.push({ key: 'tab:' + id, el: tabEls[id], tab: id }); });
        return out;
      },
      textRects: function (cam) {
        var out = [];
        Object.keys(labelBox).forEach(function (id) { out.push({ key: 'label:' + id, rect: rectToStage(labelBox[id], cam) }); });
        Object.keys(tabBox).forEach(function (id) { out.push({ key: 'tab:' + id, rect: rectToStage(tabBox[id], cam) }); });
        return out;
      }
    };
    return painter;
  };
})();
