/* The replay's small graph: systems as compact cards on a grid, grouped in at most two levels of
   trust-zone frames, short links, and ignition as a pure function of the clock.

     EXK.replay.layoutGraph(story, derived) -> G      pure: no DOM, loads under Node's vm
     EXK.replay.buildGraph(svg, G)          -> H      draws the static SVG, returns handles
     EXK.replay.light(derived, ci, clock)   -> L      pure: what is lit at the clock
     EXK.replay.paintGraph(H, L)                      applies L to the handles

   Layout:
   - Frames: only zones that hold systems are drawn; a zone with a single child merges into the child;
     if more than three levels remain, top-level wrappers (no systems of their own) are dropped, then the
     deepest levels merge into their parent, leaving two. The film's zone tree is deeper than the replay needs.
   - Columns: top-level frames in zone order; a frame with child frames gives one column per child.
     Zones with layout.below (or under one) form a second band, laid out as one row beneath.
   - Rows: the system of a column that touches a system in an earlier column takes that system's row;
     the rest of the column alternate above and below it, in first-touched order. The hub of the
     lower band (the system most linked to its siblings) goes under the last column.
   - story.replay.layout = { "<system id>": [col, row] } overrides any system's cell.

   Sizes and free space (nothing is typed per story):
   - A card is as wide as its text needs (name, and the tag wrapped to two lines), at least 110 and at most
     150 units; a name that still does not fit is cut with an ellipsis. Cards of one column share a width,
     columns are separated by 29 units plus whatever a labelled link between neighbouring columns needs, within
     a width budget (BUDGET) that keeps the text at 11 px or more in the page's graph panel.
   - A link label is a pill placed by a free-space test along its route: it must not touch a card, a frame
     title, another label, the key, or another link (links sharing an end with its own are the same trunk),
     and by preference not a frame border. Tries the full text, then its first word, each first clear of frame
     borders and then across one; if none fits it is hidden (the link still carries it as a tooltip) and layout
     warns, naming `replay.layout`.
   - Illustrative records (links, here) carry a small diamond when the story mixes provenance. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};
  var R = EXK.replay = EXK.replay || {};

  var NS = 'http://www.w3.org/2000/svg';
  var CW = 110, CH = 50, COLGAP = 29, ROWGAP = 28, X0 = 6, Y0 = 50;   // minimum card size, gaps between cards, origin (SVG px)
  var PX = CW + COLGAP, PY = CH + ROWGAP;                             // pitch of the default grid
  var MAXW = 150, PADX = 16, LINE = 14;                                // widest card, text padding, line step
  var BUDGET = 719;                                                  // widest graph (units) the page's 688 px panel draws at 11 px text
  var BELOW_GAP = 62;                                            // gap between the upper band's frames and the lower band's cards
  var KEY_H = 52;
  var DANGER = '#ff5d6c', SECURE = '#3ddc97';
  var HUES = ['#8fa3c7', '#4cc9f0', '#a78bfa', '#3ddc97', '#f5b941'];   // top-level frames, in order; the attacker's frame is DANGER
  var LANE_STEP = 6;
  function arr(v) { return Array.isArray(v) ? v : []; }
  function textW(n, em, ls) { return n * (em * 0.6 + (ls || 0)); }

  /* text width in SVG units for the page's sans font: per-glyph estimates, checked against the browser's own
     measurements to within a few percent (the callers add their margin) */
  function glyph(c) {
    if ("iIl.,:;'|!`".indexOf(c) >= 0) return 0.30;
    if ('jtfr()[]{}-/'.indexOf(c) >= 0) return 0.36;
    if (c === ' ') return 0.28;
    if ('mwMW@%'.indexOf(c) >= 0) return 0.88;
    if (c >= 'A' && c <= 'Z') return 0.66;
    if (c >= '0' && c <= '9') return 0.60;
    return 0.57;
  }
  function measure(str, em, bold) {
    var w = 0;
    for (var i = 0; i < str.length; i++) w += glyph(str.charAt(i));
    return w * em * (bold ? 1.02 : 1);
  }
  function ellipsize(str, em, bold, maxW) {
    if (measure(str, em, bold) <= maxW) return str;
    var t = str;
    while (t.length > 1 && measure(t + '\u2026', em, bold) > maxW) t = t.slice(0, -1);
    return t.replace(/\s+$/, '') + '\u2026';
  }
  function wrap(str, em, maxW, maxLines) {
    var words = str.split(/\s+/).filter(Boolean), lines = [], cur = '', used = 0, i;
    for (i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (!cur || measure(t, em, false) * 1.03 <= maxW) cur = t;
      else {
        if (lines.length + 1 >= maxLines) break;
        lines.push(cur); used = i; cur = words[i];
      }
    }
    if (i < words.length) cur = words.slice(used).join(' ');       // out of lines: the rest goes on the last one, cut
    if (cur) lines.push(cur);
    return lines.map(function (l) { return ellipsize(l, em, false, maxW / 1.03); });
  }
  // one card: its text, the lines it wraps to, and the width and height those need
  function measureCard(s) {
    var name = s.short || s.name || s.id, tag = String(s.tag || '');
    var want = Math.max(CW, Math.ceil(Math.max(measure(name, 13, true), measure(tag, 11.5, false)) * 1.03 + PADX));
    var w = Math.min(MAXW, want), inner = w - PADX;
    var shown = ellipsize(name, 13, true, inner / 1.03);
    var sub = tag ? wrap(tag, 11.5, inner, 2) : [];
    return { w: w, h: Math.max(CH, 28 + LINE * sub.length + 8 + (sub.length ? 0 : 14)), label: shown, sub: sub, cut: shown !== name };
  }
  function pillW(text, ill) { return Math.max(Math.round(text.length * 6.1 + 14), Math.ceil(measure(text, 11.5, true) * 1.03) + 6) + (ill ? 12 : 0); }

  /* ---------- layout ---------- */
  function layoutGraph(story, D, yOff) {
    yOff = yOff || 0;
    var zones = arr(story.zones), systems = arr(story.systems), links = D.links;
    var hints = (story.replay && story.replay.layout) || {};
    var zBy = {}, zIx = {}, sBy = {};
    zones.forEach(function (z, i) { zBy[z.id] = z; zIx[z.id] = i; });
    systems.forEach(function (s) { sBy[s.id] = s; });
    var warnings = [];

    // first-touched order: along the routes of the events, then story order
    var touch = {}, tn = 0;
    D.events.forEach(function (e) { e.nodes.forEach(function (n) { if (touch[n] === undefined) touch[n] = tn++; }); });
    systems.forEach(function (s) { if (touch[s.id] === undefined) touch[s.id] = tn++; });
    function byTouch(a, b) { return touch[a] - touch[b]; }

    // adjacency between systems
    var nbr = {};
    links.forEach(function (l) { (nbr[l.from] = nbr[l.from] || []).push(l.to); (nbr[l.to] = nbr[l.to] || []).push(l.from); });

    /* ---- the zone tree, collapsed to at most two levels ---- */
    var nodes = {}, rootsAll = [];
    function ensure(id) {
      if (nodes[id]) return nodes[id];
      var z = zBy[id], n = nodes[id] = { id: id, z: z || null, kids: [], own: [], parent: null };
      var pid = z && z.parent && zBy[z.parent] ? z.parent : null;
      if (pid) { n.parent = pid; ensure(pid).kids.push(n); } else rootsAll.push(n);
      return n;
    }
    systems.forEach(function (s) {
      var zid = s.zone && zBy[s.zone] ? s.zone : '_none';
      if (zid === '_none' && !nodes._none) { nodes._none = { id: '_none', z: null, kids: [], own: [], parent: null, hidden: true }; rootsAll.push(nodes._none); }
      (zid === '_none' ? nodes._none : ensure(zid)).own.push(s.id);
    });
    function ord(n) { return n.z ? zIx[n.id] : 1e9; }
    function sortKids(list) { list.sort(function (a, b) { return ord(a) - ord(b); }); list.forEach(function (n) { sortKids(n.kids); }); }
    function squash(list) {
      var out = [];
      list.forEach(function (n) {
        n.kids = squash(n.kids);
        out.push(!n.own.length && n.kids.length === 1 ? n.kids[0] : n);
      });
      return out;
    }
    function depth(n) { return 1 + Math.max(0, Math.max.apply(null, [0].concat(n.kids.map(depth)))); }
    function all(n, out) { out = out || []; n.own.forEach(function (s) { out.push(s); }); n.kids.forEach(function (k) { all(k, out); }); return out; }
    function collapse(n, level) {
      if (level >= 2) { n.own = all(n); n.kids = []; } else n.kids.forEach(function (k) { collapse(k, level + 1); });
    }
    sortKids(rootsAll);
    var roots = squash(rootsAll);
    var guard = 0;
    while (Math.max.apply(null, roots.map(depth)) > 3 && guard++ < 20) {
      var wrap = roots.filter(function (n) { return !n.own.length && n.kids.length; })
        .sort(function (a, b) { return depth(b) - depth(a); })[0];
      if (!wrap) break;
      roots.splice.apply(roots, [roots.indexOf(wrap), 1].concat(wrap.kids));
      roots = squash(roots);
    }
    roots.forEach(function (n) { collapse(n, 1); });
    sortKids(roots);

    function belowOf(n) {
      var z = n.z, g = 0;
      while (z && g++ < 30) { if (z.layout && z.layout.below) return true; z = z.parent ? zBy[z.parent] : null; }
      return false;
    }
    roots.forEach(function (n) { n.band = belowOf(n) ? 1 : 0; });

    /* ---- cells ---- */
    var cell = {};
    var colN = 0;
    roots.filter(function (n) { return n.band === 0; }).forEach(function (n) {
      var groups = [];
      if (n.own.length) groups.push(n.own.slice());
      n.kids.forEach(function (k) { groups.push(k.own.slice()); });
      groups.forEach(function (g) {
        var col = colN++, sys = g.sort(byTouch), ai = -1, ar = 0;
        for (var j = 0; j < sys.length && ai < 0; j++) {
          var nb = arr(nbr[sys[j]]).filter(function (id) { return cell[id] && cell[id].band === 0 && cell[id].col < col; });
          if (nb.length) { ai = j; ar = cell[nb[0]].row; }
        }
        if (ai < 0) ai = 0;
        cell[sys[ai]] = { band: 0, col: col, row: ar };
        var k = 0;
        sys.forEach(function (id, j) {
          if (j === ai) return;
          k++;
          cell[id] = { band: 0, col: col, row: ar + (k % 2 ? -Math.ceil(k / 2) : k / 2) };
        });
      });
    });
    var ncols = Math.max(1, colN);
    // the lower band: one row beneath, in first-touched order, the hub under the last column
    var low = [];
    roots.filter(function (n) { return n.band === 1; }).forEach(function (n) { low = low.concat(all(n)); });
    low.sort(byTouch);
    if (low.length) {
      var lowSet = {}; low.forEach(function (id) { lowSet[id] = 1; });
      var degs = low.map(function (id) { return arr(nbr[id]).filter(function (o) { return lowSet[o]; }).length; });
      var top = Math.max.apply(null, degs), hub = null;
      if (top >= 2 && degs.filter(function (d) { return d === top; }).length === 1) hub = low[degs.indexOf(top)];
      var rest = low.filter(function (id) { return id !== hub; });
      rest.forEach(function (id, j) { cell[id] = { band: 1, col: j, row: 1000 }; });
      if (hub) cell[hub] = { band: 1, col: Math.max(ncols - 1, rest.length), row: 1000 };
    }
    // systems in no frame group at all (cannot happen, but keep the layout total)
    systems.forEach(function (s) { if (!cell[s.id]) cell[s.id] = { band: 0, col: colN++, row: 0 }; });
    // normalise: upper-band rows start at 0
    var minRow = Infinity;
    systems.forEach(function (s) { if (cell[s.id].band === 0) minRow = Math.min(minRow, cell[s.id].row); });
    if (isFinite(minRow) && minRow !== 0) systems.forEach(function (s) { if (cell[s.id].band === 0) cell[s.id].row -= minRow; });

    var hinted = {};
    Object.keys(hints).forEach(function (id) {
      var h = hints[id];
      if (cell[id] && Array.isArray(h) && h.length === 2) { cell[id] = { band: cell[id].band, col: h[0], row: h[1] }; hinted[id] = true; }
    });

    /* ---- sizes: cards from their text, columns from their cards, gaps from the labels that must fit in them ---- */
    var M = {}, nc = 1, CHm = CH;
    systems.forEach(function (s) {
      M[s.id] = measureCard(s); nc = Math.max(nc, cell[s.id].col + 1); CHm = Math.max(CHm, M[s.id].h);
    });
    var colW = [], gap = [], ci;
    for (ci = 0; ci <= nc; ci++) { colW.push(CW); gap.push(COLGAP); }
    systems.forEach(function (s) { colW[cell[s.id].col] = Math.max(colW[cell[s.id].col], M[s.id].w); });
    var PYm = CHm + ROWGAP;
    // frame membership, before the frames exist: the node that owns the system
    var fid = {};
    (function own(list) { list.forEach(function (n) { n.own.forEach(function (id) { fid[id] = n.id; }); own(n.kids); }); })(roots);
    // a labelled link between neighbouring columns on one row is a straight run across the gap: the gap must hold its pill
    var wants = {};
    links.forEach(function (l) {
      var A = cell[l.from], B = cell[l.to];
      if (!l.label || !A || !B || A.band !== B.band || A.row !== B.row || Math.abs(A.col - B.col) !== 1) return;
      var c = Math.min(A.col, B.col), across = fid[l.from] !== fid[l.to] ? 30 : 10;     // frame borders (and their padding) run through the gap
      var w = wants[c] = wants[c] || { full: 0, short: 0 };
      w.full = Math.max(w.full, pillW(l.label, l.ill) + across);
      w.short = Math.max(w.short, pillW(l.label.split(/\s+/)[0], l.ill) + across);
    });
    var spare = BUDGET - (X0 + colW.slice(0, nc).reduce(function (a, b) { return a + b; }, 0) + COLGAP * (nc - 1) + 18);   // 18: the frames overhang the outer cards
    // every labelled gap first gets room for the first word, smallest need first; what is left upgrades them to the full text
    var wc = Object.keys(wants).map(Number), extra = {};
    function need(c, k) { return Math.max(0, wants[c][k] - COLGAP); }
    wc.sort(function (a, b) { return need(a, 'short') - need(b, 'short'); }).forEach(function (c) {
      extra[c] = need(c, 'short') <= spare ? need(c, 'short') : 0; spare -= extra[c];
    });
    wc.sort(function (a, b) { return need(a, 'full') - extra[a] - (need(b, 'full') - extra[b]); }).forEach(function (c) {
      var up = need(c, 'full') - extra[c];
      if (up > 0 && up <= spare) { extra[c] += up; spare -= up; }
    });
    wc.forEach(function (c) { gap[c] = COLGAP + extra[c]; });
    var colX = [X0];
    for (ci = 0; ci < nc; ci++) colX.push(colX[ci] + colW[ci] + gap[ci]);

    var S = {};
    systems.forEach(function (s) {
      var c = cell[s.id], m = M[s.id];
      var x = colX[c.col], y = yOff + Y0 + (c.band === 0 || hinted[s.id] ? c.row : 0) * PYm, w = colW[c.col];
      S[s.id] = { id: s.id, sys: s, x: x, y: y, w: w, h: CHm, cx: x + w / 2, cy: y + CHm / 2, col: c.col, row: c.row, band: c.band,
        name: s.short || s.name, label: m.label, sub: m.sub, tag: s.tag || '', tint: s.tint || null };
    });

    /* ---- arcs in the lower band need lanes under the cards: count them first (frame height depends on it) ---- */
    function between(A, B) {
      var lo = Math.min(A.col, B.col), hi = Math.max(A.col, B.col);
      return systems.some(function (s) { var o = S[s.id]; return o !== A && o !== B && o.band === A.band && o.row === A.row && o.col > lo && o.col < hi; });
    }
    var arcs = [];
    links.forEach(function (l) {
      var A = S[l.from], B = S[l.to];
      if (A && B && A.band === 1 && B.band === 1 && A.row === B.row && A.col !== B.col && between(A, B)) arcs.push(l);
    });
    arcs.sort(function (a, b) { return Math.abs(S[a.from].col - S[a.to].col) - Math.abs(S[b.from].col - S[b.to].col); });
    var arcLane = {}; arcs.forEach(function (l, i) { arcLane[l.id] = i; });

    /* ---- frames ---- */
    var F = [], FBY = {};
    function frame(n, level, hue, parent) {
      var kids = n.kids.map(function (k) { return frame(k, 2, hue, n); });
      var rs = n.own.map(function (id) { return S[id]; }).concat(kids);
      n.own.forEach(function (id) { S[id].frameId = n.id; S[id].frameLabel = n.z ? (n.z.short || n.z.name) : ''; });
      var f = { id: n.id, level: level, hue: hue, parentId: parent ? parent.id : null, hidden: !!n.hidden, band: n.band === undefined ? parent.band : n.band,
        label: n.z ? (n.z.short || n.z.name) : '', kids: kids };
      if (rs.length) {
        var x0 = Math.min.apply(null, rs.map(function (r) { return r.x; })), y0 = Math.min.apply(null, rs.map(function (r) { return r.y; }));
        var x1 = Math.max.apply(null, rs.map(function (r) { return r.x + r.w; })), y1 = Math.max.apply(null, rs.map(function (r) { return r.y + r.h; }));
        var leaf = !kids.length, lower = f.band === 1;
        var px = leaf ? 6 : 8, pt = leaf ? 26 : 24;
        var pb = leaf ? (lower ? 18 + LANE_STEP * Math.max(0, arcs.length - 1) : 8) : 14;
        f.x = x0 - px; f.y = y0 - pt; f.w = x1 - x0 + 2 * px; f.h = y1 - y0 + pt + pb;
      } else { f.x = f.y = f.w = f.h = 0; f.hidden = true; }
      F.push(f); FBY[f.id] = f;
      return f;
    }
    // upper band first: the lower band hangs one fixed gap beneath it
    var attackerRoot = null;
    roots.forEach(function (n) { if (all(n).indexOf(D.attackerId) >= 0) attackerRoot = n; });
    var hueI = 0;
    var upper = roots.filter(function (n) { return n.band === 0; }), lower2 = roots.filter(function (n) { return n.band === 1; });
    function hueFor(n) { return n === attackerRoot ? DANGER : HUES[hueI++ % HUES.length]; }
    var tops = [];
    upper.forEach(function (n) { tops.push(frame(n, 1, hueFor(n), null)); });
    var bottom0 = Math.max.apply(null, [yOff + Y0].concat(F.map(function (f) { return f.hidden ? 0 : f.y + f.h; })));
    if (lower2.length) {
      systems.forEach(function (s) {
        var o = S[s.id];
        if (o.band === 1 && !hinted[s.id]) { o.y = bottom0 + BELOW_GAP; o.cy = o.y + o.h / 2; }
      });
      lower2.forEach(function (n) { tops.push(frame(n, 1, hueFor(n), null)); });
    }
    // draw order: parents before children
    var drawOrder = [];
    function emit(f) { drawOrder.push(f); f.kids.forEach(emit); }
    tops.forEach(emit);

    /* ---- links ---- */
    var upperBottom = Math.max.apply(null, [0].concat(F.filter(function (f) { return !f.hidden && f.band === 0; }).map(function (f) { return f.y + f.h; })));
    var lowerTop = Math.min.apply(null, [1e9].concat(F.filter(function (f) { return !f.hidden && f.band === 1; }).map(function (f) { return f.y; })));
    var laneTop = lowerTop < 1e9 ? (upperBottom + lowerTop) / 2 : null;
    var lowCardsBottom = Math.max.apply(null, [0].concat(systems.map(function (s) { return S[s.id].band === 1 ? S[s.id].y + S[s.id].h : 0; })));
    var L = {};
    links.forEach(function (l) {
      var A = S[l.from], B = S[l.to];
      if (!A || !B) return;
      var pts;
      if (A.band === B.band && A.row === B.row && A.col !== B.col) {
        if (!between(A, B)) pts = A.col < B.col ? [[A.x + A.w, A.cy], [B.x, B.cy]] : [[A.x, A.cy], [B.x + B.w, B.cy]];
        else {
          var ly = (A.band === 1 ? lowCardsBottom : A.y + A.h) + 12 + LANE_STEP * (arcLane[l.id] || 0);
          pts = [[A.cx, A.y + A.h], [A.cx, ly], [B.cx, ly], [B.cx, B.y + B.h]];
        }
      } else if (A.band === B.band && A.col === B.col && A.row !== B.row && !systems.some(function (s) {
        var o = S[s.id]; return o !== A && o !== B && o.band === A.band && o.col === A.col && o.row > Math.min(A.row, B.row) && o.row < Math.max(A.row, B.row);
      })) {
        pts = B.y > A.y ? [[A.cx, A.y + A.h], [B.cx, B.y]] : [[A.cx, A.y], [B.cx, B.y + B.h]];
      } else if (A.band !== B.band && laneTop !== null) {
        var up = A.band < B.band;
        if (Math.abs(A.cx - B.cx) < 1) pts = up ? [[A.cx, A.y + A.h], [B.cx, B.y]] : [[A.cx, A.y], [B.cx, B.y + B.h]];
        else pts = up ? [[A.cx, A.y + A.h], [A.cx, laneTop], [B.cx, laneTop], [B.cx, B.y]] : [[A.cx, A.y], [A.cx, laneTop], [B.cx, laneTop], [B.cx, B.y + B.h]];
      } else if (A.col !== B.col) {
        var left = A.col < B.col ? A : B, rightN = left === A ? B : A, mx = left.x + left.w + gap[left.col] / 2;
        var p0 = [left.x + left.w, left.cy], p3 = [rightN.x, rightN.cy];
        var elbow = [p0, [mx, p0[1]], [mx, p3[1]], p3];
        pts = left === A ? elbow : elbow.slice().reverse();
      } else {
        var xr = A.x + A.w + gap[A.col] / 2;
        pts = [[A.x + A.w, A.cy], [xr, A.cy], [xr, B.cy], [B.x + B.w, B.cy]];
      }
      L[l.id] = { link: l, pts: pts, d: 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L'),
        control: l.kind === 'audit', lab: null };
    });

    /* ---- frame labels: left, or right when a link runs through the left end ---- */
    function segHitsRect(a, b, r) {
      var x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
      return x1 >= r.x && x0 <= r.x + r.w && y1 >= r.y && y0 <= r.y + r.h;
    }
    function linkHits(r, skip) {
      var n = 0, me = skip ? L[skip].link : null;
      Object.keys(L).forEach(function (id) {
        if (id === skip) return;
        // links that share an end with the one being labelled fan out of the same trunk: not a clash
        if (me && (L[id].link.from === me.from || L[id].link.to === me.to || L[id].link.from === me.to || L[id].link.to === me.from)) return;
        var p = L[id].pts;
        for (var i = 0; i + 1 < p.length; i++) if (segHitsRect(p[i], p[i + 1], r)) n++;
      });
      return n;
    }
    drawOrder.forEach(function (f) {
      f.labelW = textW(f.label.length, 11.5, 0.9);
      var left = { x: f.x + 10, y: f.y + 4, w: f.labelW, h: 15 }, right = { x: f.x + f.w - 10 - f.labelW, y: f.y + 4, w: f.labelW, h: 15 };
      f.labelEnd = !f.hidden && linkHits(left) > 0 && linkHits(right) === 0;
      f.labelRect = f.labelEnd ? right : left;
    });

    /* ---- extent before the labels: they must fit inside it ---- */
    var shown = F.filter(function (f) { return !f.hidden; });
    var W = Math.ceil(Math.max.apply(null, shown.map(function (f) { return f.x + f.w; }).concat(systems.map(function (s) { return S[s.id].x + S[s.id].w; })))) + 2;
    var H = Math.ceil(Math.max.apply(null, shown.map(function (f) { return f.y + f.h; }).concat(systems.map(function (s) { return S[s.id].y + S[s.id].h; })))) + 2;

    /* ---- link labels: a free-space test along each route ----
       A pill is free where it touches no card, no frame title, no frame border (it sits wholly inside a frame or
       wholly outside), no placed label, and no link other than the trunk of its own. The full text is tried first
       along the whole route (middle outwards), then its first word; else the label is hidden. */
    var occupied = [], shown0 = shown;
    systems.forEach(function (s) { var o = S[s.id]; occupied.push({ x: o.x - 3, y: o.y - 3, w: o.w + 6, h: o.h + 6 }); });
    drawOrder.forEach(function (f) { if (!f.hidden && f.label) occupied.push(f.labelRect); });
    function overlap(a, b) { return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); }
    function pointAt(pts, f) {
      var tot = 0, i;
      for (i = 0; i + 1 < pts.length; i++) tot += Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]);
      var d = tot * f;
      for (i = 0; i + 1 < pts.length; i++) {
        var seg = Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]);
        if (d <= seg || i + 2 === pts.length) { var t = seg ? d / seg : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]; }
        d -= seg;
      }
      return pts[0];
    }
    var FRACS = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82, 0.1, 0.9];
    for (var fi = 1; fi < 40; fi++) if (FRACS.indexOf(fi / 40) < 0) FRACS.push(fi / 40);
    // links that share an end with the one placed fan out of the same trunk: not a clash (as for frame titles)
    function strictHits(r, skip) {
      var n = 0, me = L[skip].link;
      Object.keys(L).forEach(function (id) {
        if (id === skip) return;
        var o = L[id].link;
        if (o.from === me.from || o.to === me.to || o.from === me.to || o.to === me.from) return;
        var p = L[id].pts;
        for (var i = 0; i + 1 < p.length; i++) if (segHitsRect(p[i], p[i + 1], r)) n++;
      });
      return n;
    }
    function spot(id, w, straddle) {
      var lk = L[id], best = null;
      FRACS.forEach(function (f, k) {
        var p = pointAt(lk.pts, f), r = { x: p[0] - w / 2, y: p[1] - 8, w: w, h: 16 };
        if (r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > H) return;
        for (var i = 0; i < occupied.length; i++) if (overlap(r, occupied[i]) > 0) return;
        if (!straddle) for (var j = 0; j < shown0.length; j++) { var ov = overlap(r, shown0[j]); if (ov > 0 && ov < r.w * r.h) return; }
        if (strictHits(r, id) > 0) return;
        var score = Math.abs(f - 0.5) + linkHits(r, id) * 0.02;
        if (!best || score < best.score - 1e-9) best = { score: score, p: p, rect: r };
      });
      return best;
    }
    var dropped = [], cut = [], tooBig = [];
    Object.keys(L).forEach(function (id) {
      var lk = L[id], text = lk.link.label, ill = !!(lk.link.ill && D.prov && D.prov.mixed);
      lk.ill = ill;
      var tries = text ? [text] : [];
      if (text && text.split(/\s+/)[0] !== text) tries.push(text.split(/\s+/)[0]);
      // clean spots first (full text, then the first word); only then a spot where a frame border runs behind the pill
      for (var q = 0; q < 2 * tries.length && !lk.lab; q++) {
        var k = q % tries.length, w = pillW(tries[k], ill), b = spot(id, w, q >= tries.length);
        if (b) { lk.lab = { x: b.p[0], y: b.p[1], w: w, text: tries[k], full: text, ill: ill }; occupied.push(b.rect); if (k) cut.push(text); }
      }
      if (text && !lk.lab) dropped.push(text);
      if (ill && !lk.lab) {                         // a bare link still carries its mark, where there is room
        var mb = spot(id, 14);
        if (mb) { lk.mark = { x: mb.p[0], y: mb.p[1] }; occupied.push(mb.rect); }
      }
    });

    /* ---- the key's corner ---- */
    var KEY_W = Math.ceil(22 + measure('event under the clock', 11.5, false) * 1.03 + 6);
    var key = null;
    [[0, yOff], [W - KEY_W, yOff], [0, H - KEY_H], [W - KEY_W, H - KEY_H]].some(function (c) {
      var r = { x: c[0], y: c[1], w: KEY_W, h: KEY_H };
      var hit = shown.some(function (f) { return overlap(r, f) > 0; }) || occupied.some(function (o) { return overlap(r, o) > 0; }) || linkHits(r, null) > 0;
      if (!hit) key = { x: c[0], y: c[1] };
      return !hit;
    });
    if (!key && !yOff) return layoutGraph(story, D, KEY_H + 8);
    if (!key) key = { x: 0, y: 0 };

    var frames = drawOrder.filter(function (f) { return !f.hidden; });
    if (W > BUDGET) warnings.push('the graph is ' + W + ' units wide, more than the ' + BUDGET + ' the page draws at a readable size; use replay.layout hints ({ "<system id>": [col, row] }) to stack systems into fewer columns');
    if (dropped.length) warnings.push('no room for ' + (dropped.length === 1 ? 'the link label' : dropped.length + ' link labels') + ' "' + dropped.join('", "') + '" (hidden; the link keeps it as a tooltip); use replay.layout hints to give the links room, or shorten the label');
    if (!Object.keys(hints).length && (systems.length > 12 || frames.length > 8)) {
      warnings.push('the automatic grid may read badly for ' + systems.length + ' systems in ' + frames.length + ' frames; add replay.layout hints');
    }
    return { S: S, Z: frames, L: L, W: W, H: H, key: key, KEY_W: KEY_W, cell: cell, warnings: warnings, dropped: dropped, cut: cut, order: systems.map(function (s) { return s.id; }) };
  }

  /* ---------- drawing ---------- */
  function sysColor(s) { return s.tint === 'secure' ? SECURE : DANGER; }

  function buildGraph(svg, G) {
    var el = EXK.util.el;
    var H = { G: G, nodes: {}, links: {}, labels: {}, cache: {} };
    // the mark of an illustrative record: a small amber diamond (explained once in the page footer)
    function mark(g, cx, cy) {
      el('svg:path', { d: 'M' + cx + ',' + (cy - 4) + 'l4,4l-4,4l-4,-4z', fill: 'none', stroke: '#f5b941', 'stroke-width': 1.3, class: 'ilm' }, g);
    }
    svg.setAttribute('viewBox', '-1 -1 ' + G.W + ' ' + G.H);
    var defs = el('svg:defs', {}, svg), f = el('svg:filter', { id: 'glow', x: '-40%', y: '-60%', width: '180%', height: '220%' }, defs);
    el('svg:feGaussianBlur', { stdDeviation: 6 }, f);
    var kg = el('svg:g', { transform: 'translate(' + G.key.x + ' ' + G.key.y + ')' }, svg);
    function key(y, fill, stroke, w, text, dash) {
      el('svg:rect', { x: 0.5, y: y + 3.5, width: 14, height: 9, rx: 3, fill: fill, stroke: stroke, 'stroke-width': w }, kg);
      el('svg:text', { x: 22, y: y + 12, class: 'gk' }, kg).textContent = text;
    }
    key(0, '#1b2233', DANGER, 1.5, 'reached');
    key(18, '#141c2b', '#2e3a52', 1.2, 'not reached yet');
    key(36, 'none', '#fff', 1.5, 'event under the clock');
    var gz = el('svg:g', {}, svg), gl = el('svg:g', {}, svg), gp = el('svg:g', {}, svg), gb = el('svg:g', {}, svg), gn = el('svg:g', {}, svg);
    G.Z.forEach(function (z) {
      el('svg:rect', { x: z.x, y: z.y, width: z.w, height: z.h, rx: z.level === 1 ? 12 : 9, fill: z.hue, 'fill-opacity': z.level === 1 ? 0.045 : 0.05,
        stroke: z.hue, 'stroke-opacity': z.level === 1 ? 0.34 : 0.24, 'stroke-width': 1, 'stroke-dasharray': z.level === 2 ? '4 3' : 'none', 'data-frame': z.id }, gz);
      if (!z.label) return;
      var t = el('svg:text', { x: z.labelEnd ? z.x + z.w - 10 : z.x + 10, y: z.y + 16, 'text-anchor': z.labelEnd ? 'end' : 'start', class: 'zl', fill: z.hue, 'data-zone': z.id }, gz);
      t.textContent = z.label.toUpperCase();
    });
    Object.keys(G.L).forEach(function (id) {
      var L = G.L[id], col = L.control ? SECURE : DANGER;
      var base = el('svg:path', { d: L.d, fill: 'none', stroke: '#3a4660', 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, gl);
      var lit = el('svg:path', { d: L.d, fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: 0 }, gl);
      var pulse = el('svg:path', { d: L.d, fill: 'none', stroke: col, 'stroke-width': 5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: 0 }, gp);
      H.links[id] = { base: base, lit: lit, pulse: pulse, id: id };
      if (L.lab) {
        var g = el('svg:g', { class: 'lp', opacity: 0, 'data-link': id }, gb);
        el('svg:rect', { x: L.lab.x - L.lab.w / 2, y: L.lab.y - 8, width: L.lab.w, height: 16, rx: 8, fill: '#121826', stroke: col, 'stroke-opacity': 0.7 }, g);
        el('svg:text', { x: L.lab.x + (L.lab.ill ? 6 : 0), y: L.lab.y + 4, 'text-anchor': 'middle', class: 'lt', fill: '#e6edf7' }, g).textContent = L.lab.text;
        if (L.lab.ill) mark(g, L.lab.x - L.lab.w / 2 + 10, L.lab.y);
        H.labels[id] = g;
      } else if (L.mark) {
        var gm = el('svg:g', { class: 'lp', opacity: 0, 'data-link': id }, gb);
        el('svg:circle', { cx: L.mark.x, cy: L.mark.y, r: 7, fill: '#121826', stroke: col, 'stroke-opacity': 0.7 }, gm);
        mark(gm, L.mark.x, L.mark.y);
        H.labels[id] = gm;
      }
      if (L.link.label || L.ill) {      // hover text: the whole label (it may be shortened or hidden), and the mark's meaning
        el('svg:title', {}, base).textContent = (L.link.label || '') + (L.ill ? (L.link.label ? ' ' : '') + '(illustrative record)' : '');
      }
    });
    G.order.forEach(function (id) {
      var n = G.S[id], col = sysColor(n);
      var g = el('svg:g', { class: 'node', tabindex: 0, role: 'button', 'data-id': id, 'aria-label': n.name + (n.tag ? ', ' + n.tag : '') + '. Not reached yet. Show details and filter the stream.' }, gn);
      var glow = el('svg:rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 9, fill: col, filter: 'url(#glow)', opacity: 0 }, g);
      el('svg:rect', { class: 'hit', x: n.x - 3, y: n.y - 3, width: n.w + 6, height: n.h + 6, fill: 'transparent' }, g);
      var body = el('svg:rect', { class: 'body', x: n.x, y: n.y, width: n.w, height: n.h, rx: 9 }, g);
      var nt = el('svg:text', { x: n.x + 10, y: n.y + (n.sub.length ? 22 : n.h / 2 + 4.5), class: 'nn' }, g);
      nt.textContent = n.label;
      if (n.label !== n.name) el('svg:title', {}, g).textContent = n.name;
      n.sub.forEach(function (line, i) { el('svg:text', { x: n.x + 10, y: n.y + 39 + 14 * i, class: 'nr' }, g).textContent = line; });
      var sel = el('svg:rect', { x: n.x - 4, y: n.y - 4, width: n.w + 8, height: n.h + 8, rx: 12, fill: 'none', stroke: '#4cc9f0', 'stroke-width': 2, 'stroke-dasharray': '5 3', opacity: 0, 'pointer-events': 'none' }, g);
      var ring = el('svg:rect', { x: n.x - 4, y: n.y - 4, width: n.w + 8, height: n.h + 8, rx: 12, fill: 'none', stroke: '#fff', 'stroke-width': 2, opacity: 0, 'pointer-events': 'none' }, g);
      H.nodes[id] = { g: g, body: body, glow: glow, ring: ring, sel: sel, col: col, n: n };
    });
    return H;
  }

  /* pure: what is lit at the clock. Everything the events at or before index ci touched. */
  function light(D, ci, clock) {
    var nodes = {}, links = {}, now = null;
    for (var i = 0; i <= ci; i++) {
      D.events[i].nodes.forEach(function (n) { nodes[n] = 1; });
      D.events[i].edges.forEach(function (l) { links[l] = 1; });
    }
    if (ci >= 0) { var e = D.events[ci]; now = { to: e.to, edges: e.edges, attack: e.attack, amp: Math.max(0, 1 - (clock - e.r) / 2.4) }; }
    return { nodes: nodes, links: links, now: now };
  }

  function paintGraph(H, L) {
    var c = H.cache;
    Object.keys(H.nodes).forEach(function (id) {
      var o = H.nodes[id], on = !!L.nodes[id], cur = !!(L.now && L.now.to === id);
      if (c['n' + id] !== on) {
        c['n' + id] = on; o.g.classList.toggle('lit', on); o.g.setAttribute('data-lit', on ? '1' : '0');
        o.glow.setAttribute('opacity', on ? 0.42 : 0); o.body.style.stroke = on ? o.col : '';
      }
      o.ring.setAttribute('opacity', cur ? (0.45 + 0.55 * L.now.amp).toFixed(2) : 0);
      o.g.setAttribute('data-now', cur ? '1' : '0');
    });
    var nowEdges = L.now ? L.now.edges : [];
    Object.keys(H.links).forEach(function (id) {
      var o = H.links[id], on = !!L.links[id];
      if (c['l' + id] !== on) {
        c['l' + id] = on; o.lit.setAttribute('opacity', on ? 0.6 : 0); o.base.setAttribute('data-lit', on ? '1' : '0');
        if (H.labels[id]) H.labels[id].setAttribute('opacity', on ? 1 : 0);
      }
      o.pulse.setAttribute('opacity', nowEdges.indexOf(id) >= 0 ? (0.85 * L.now.amp).toFixed(2) : 0);
    });
  }

  function setSelected(H, id) { Object.keys(H.nodes).forEach(function (k) { H.nodes[k].sel.setAttribute('opacity', k === id ? 1 : 0); }); }

  R.layoutGraph = function (story, D) { return layoutGraph(story, D, 0); };
  R.buildGraph = buildGraph;
  R.light = light;
  R.paintGraph = paintGraph;
  R.setSelected = setSelected;
  R.GRAPH = { CW: CW, CH: CH, PX: PX, PY: PY };
})();
