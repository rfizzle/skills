/* Shared responsibility, as a custom scene (--pattern custom --scene): the "ownership overlay" pattern.
   A fixed grid of things that need an owner, coloured by who owns each: who takes what, the cells nobody owns or that
   two parties each assume the other owns, and what closing those gaps takes. The picture does not move; the overlay
   does. Only the grid's own drawing and choreography live here; the stage, chrome, step timing, chip and window.anim
   come from the kit through ctx.

   Story blocks that drive it:  parties  { id, name }                three of them (the colour and mark palette has three)
                                layers   { id, name }                rows, the stack from the bottom up
                                duties   { id, name }                columns, what has to be done at each layer
                                cells    { layer, duty, owner, note? }   owner: a party id, "none", or a list of two party ids
                                                                      (a disputed cell); note: why a gap falls through
                                fixes    { layer, duty, party, takes }   one per gap: who takes it and what that takes
   Every record carries `source`. Nothing shown is typed: counts, gaps and coverage are computed from the cells.

   A party is told apart by a colour, a fill pattern (dots, lines, grid) and a mark (circle, square, triangle), so it
   reads without colour. A gap is hatched diagonally in the warning colour; a disputed cell is split down the middle
   between the two parties' patterns, each with its own mark, and "Disputed" over the join.

   Pure helpers (no DOM; loaded under Node by scripts/ownership.test.mjs through EXK.ownership):
     ownersOf(cell) / kindOf(cell)             [] | [id] | [id, id]  and  'none' | 'owned' | 'disputed'
     check(data)                               throws a clear message unless the data tells the story (see below)
     counts(parties, cells)                    { party id: cells that party alone owns }
     gaps(layers, duties, cells)               the unowned and disputed cells, bottom row first, left to right
     applyFixes(cells, fixes)                  the cells after each gap is given to its fixing party
     coverage(cells, fixes?)                   { owned, total }: cells with exactly one owner, before or after the fixes
     layout(layers, duties, box, opts?)        cell, row header and column header rectangles that fill box
   Drawing helpers:
     reveal(ctx, party, t0, r)   one party's cells fill in, with its legend count and the headline ticking up
     gapsOn(ctx, t0, r)          unowned cells outlined and hatched, disputed cells split; each gap's note is read in turn
     fix(ctx, t0, r)             each gap is assigned: the cell takes its owner's fill and a "newly owned" mark, the
                                 headline counts up and the gap measure counts down
   Build-time checks (check): every layer and duty pair has exactly one cell; owners name real parties; at least one
   unowned and one disputed cell; every gap has exactly one fix, a disputed cell goes to one of its two parties; after the
   fixes no gap remains.
   Headline measure, fixed in one place: "Owned: N of M" (ctx.count). A second measure: "Gaps: N". */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};
  EXK.scenes = EXK.scenes || {};

  /* =============================== pure ownership functions =============================== */
  function isList(o) { return Array.isArray(o); }
  function ownersOf(c) { return c.owner === 'none' ? [] : isList(c.owner) ? c.owner.slice() : [c.owner]; }
  function kindOf(c) { return c.owner === 'none' ? 'none' : isList(c.owner) ? 'disputed' : 'owned'; }
  function key(layer, duty) { return layer + '|' + duty; }
  function ids(list) { return list.map(function (x) { return x.id; }); }

  function check(d) {
    function fail(m) { throw new Error('ownership: ' + m); }
    var parties = d.parties, layers = d.layers, duties = d.duties, cells = d.cells, fixes = d.fixes;
    if (!parties || parties.length !== 3) fail('parties must list exactly three (the palette has three colours, patterns and marks)');
    function unique(list, what) {
      var seen = {};
      list.forEach(function (x) {
        if (!x || typeof x.id !== 'string' || !x.id) fail('every ' + what + ' needs a string id');
        if (seen[x.id]) fail('duplicate ' + what + ' id "' + x.id + '"');
        seen[x.id] = true;
      });
      return seen;
    }
    var pid = unique(parties, 'party'), lid = unique(layers, 'layer'), did = unique(duties, 'duty');
    if (!layers.length || !duties.length) fail('layers and duties must not be empty');
    var seen = {};
    cells.forEach(function (c) {
      if (!lid[c.layer]) fail('a cell names layer "' + c.layer + '", which is not in layers');
      if (!did[c.duty]) fail('a cell names duty "' + c.duty + '", which is not in duties');
      var k = key(c.layer, c.duty), where = '"' + c.layer + '" / "' + c.duty + '"';
      if (seen[k]) fail('two cells for ' + where);
      seen[k] = c;
      if (typeof c.owner === 'string' && c.owner !== 'none' && !pid[c.owner]) fail('cell ' + where + ' has owner "' + c.owner + '", which is not a party, "none" or a list of two party ids');
      if (isList(c.owner)) {
        if (c.owner.length !== 2 || c.owner[0] === c.owner[1] || !pid[c.owner[0]] || !pid[c.owner[1]]) fail('cell ' + where + ': a disputed owner is a list of two different party ids');
      } else if (typeof c.owner !== 'string') fail('cell ' + where + ' has no owner');
      if (kindOf(c) !== 'owned' && !(typeof c.note === 'string' && c.note)) fail('gap cell ' + where + ' needs a note: why it falls through');
    });
    layers.forEach(function (l) { duties.forEach(function (u) { if (!seen[key(l.id, u.id)]) fail('no cell for layer "' + l.id + '" and duty "' + u.id + '"'); }); });
    var gs = gaps(layers, duties, cells);
    if (!gs.some(function (g) { return g.kind === 'none'; })) fail('the example needs at least one unowned cell');
    if (!gs.some(function (g) { return g.kind === 'disputed'; })) fail('the example needs at least one disputed cell');
    var fx = {};
    (fixes || []).forEach(function (f) {
      var k = key(f.layer, f.duty), c = seen[k];
      if (!c || kindOf(c) === 'owned') fail('a fix names "' + f.layer + '" / "' + f.duty + '", which is not a gap');
      if (fx[k]) fail('two fixes for "' + f.layer + '" / "' + f.duty + '"');
      if (!pid[f.party]) fail('fix for "' + f.layer + '" / "' + f.duty + '" names party "' + f.party + '", which is not a party');
      if (kindOf(c) === 'disputed' && c.owner.indexOf(f.party) < 0) fail('fix for the disputed cell "' + f.layer + '" / "' + f.duty + '" must go to one of its two parties');
      if (typeof f.takes !== 'string' || !f.takes) fail('fix for "' + f.layer + '" / "' + f.duty + '" needs `takes`: what it takes');
      fx[k] = f;
    });
    gs.forEach(function (g) { if (!fx[key(g.layer, g.duty)]) fail('gap "' + g.layer + '" / "' + g.duty + '" has no fix'); });
    var after = applyFixes(cells, fixes || []);
    if (gaps(layers, duties, after).length) fail('gaps remain after the fixes');
  }

  function counts(parties, cells) {
    var out = {};
    parties.forEach(function (p) { out[p.id] = 0; });
    cells.forEach(function (c) { if (kindOf(c) === 'owned') out[c.owner]++; });
    return out;
  }
  function gaps(layers, duties, cells) {
    var by = {}, out = [];
    cells.forEach(function (c) { by[key(c.layer, c.duty)] = c; });
    layers.forEach(function (l) {
      duties.forEach(function (u) {
        var c = by[key(l.id, u.id)];
        if (c && kindOf(c) !== 'owned') out.push({ layer: l.id, duty: u.id, kind: kindOf(c), owners: ownersOf(c), note: c.note, cell: c });
      });
    });
    return out;
  }
  function applyFixes(cells, fixes) {
    var fx = {};
    fixes.forEach(function (f) { fx[key(f.layer, f.duty)] = f; });
    return cells.map(function (c) {
      var f = fx[key(c.layer, c.duty)];
      if (!f) return c;
      var o = {};
      for (var k in c) o[k] = c[k];
      o.owner = f.party;
      return o;
    });
  }
  function coverage(cells, fixes) {
    var cs = fixes ? applyFixes(cells, fixes) : cells;
    return { owned: cs.filter(function (c) { return kindOf(c) === 'owned'; }).length, total: cs.length };
  }
  /* box = {x, y, w, h}: the row headers take headW on the left, the column headers headH on top, the cells share the
     rest evenly, inset by gap/2 so neighbours do not touch. Layers run bottom up, so layer 0 is the bottom row. */
  function layout(layers, duties, box, opts) {
    opts = opts || {};
    var headW = opts.headW || 300, headH = opts.headH || 48, gap = opts.gap || 6, nr = layers.length, nc = duties.length;
    var rowH = (box.h - headH) / nr, colW = (box.w - headW) / nc;
    function rowY(i) { return box.y + headH + (nr - 1 - i) * rowH; }
    return {
      box: box, headW: headW, headH: headH, gap: gap, rowH: rowH, colW: colW, font: opts.font || 22,
      cell: function (i, j) { return { x: box.x + headW + j * colW + gap / 2, y: rowY(i) + gap / 2, w: colW - gap, h: rowH - gap }; },
      rowHead: function (i) { return { x: box.x, y: rowY(i) + gap / 2, w: headW - 10, h: rowH - gap }; },
      colHead: function (j) { return { x: box.x + headW + j * colW + gap / 2, y: box.y, w: colW - gap, h: headH - 6 }; }
    };
  }

  EXK.ownership = { ownersOf: ownersOf, kindOf: kindOf, check: check, counts: counts, gaps: gaps, applyFixes: applyFixes, coverage: coverage, layout: layout };
  if (typeof document === 'undefined') return;            /* under Node (the unit tests) only the pure helpers are needed */

  /* =============================== the scene =============================== */
  var BOX = { x: 24, y: 136, w: 1872, h: 520 };            /* the grid, area px; the strip above holds the measures and the label */
  var D, W;
  var STYLE = [{ c: 'accent', pat: 'dots', mark: 'circle' }, { c: 'identity', pat: 'lines', mark: 'square' }, { c: 'token', pat: 'grid', mark: 'triangle' }];
  var HALO = { 'paint-order': 'stroke', 'stroke-linejoin': 'round' };

  function join(names) { return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]; }

  function derive(ctx) {
    var d = { parties: ctx.block('parties'), layers: ctx.block('layers'), duties: ctx.block('duties'), cells: ctx.block('cells'), fixes: ctx.block('fixes') };
    check(d);
    d.pIdx = {}; d.parties.forEach(function (p, i) { d.pIdx[p.id] = i; });
    d.by = {}; d.cells.forEach(function (c) { d.by[key(c.layer, c.duty)] = c; });
    d.fix = {}; d.fixes.forEach(function (f) { d.fix[key(f.layer, f.duty)] = f; });
    d.after = applyFixes(d.cells, d.fixes);
    d.gaps = gaps(d.layers, d.duties, d.cells);
    d.counts0 = counts(d.parties, d.cells);
    d.counts1 = counts(d.parties, d.after);
    d.cov0 = coverage(d.cells); d.cov1 = coverage(d.cells, d.fixes);
    d.lay = layout(d.layers, d.duties, BOX);
    d.lName = {}; d.layers.forEach(function (l) { d.lName[l.id] = l.name; });
    d.uName = {}; d.duties.forEach(function (u) { d.uName[u.id] = u.name; });
    d.pName = {}; d.parties.forEach(function (p) { d.pName[p.id] = p.name; });
    return d;
  }

  /* opacity, tracked per element so every tween starts from where the last one left it (build order is time order) */
  function fade(ctx, el, to, t, dur) {
    var from = el.__v === undefined ? 0 : el.__v;
    if (from === to) return;
    ctx.tl.fromTo(el, { opacity: from }, { opacity: to, duration: dur === undefined ? 0.4 : dur, ease: 'power2.out' }, t);
    el.__v = to;
  }
  /* ---- marks and patterns: what tells the parties apart besides colour ---- */
  function markEl(ctx, parent, kind, cx, cy, r, color) {
    var a = { fill: color, stroke: ctx.THEME.bg, 'stroke-width': 1.5, 'stroke-linejoin': 'round' };
    if (kind === 'circle') { a.cx = cx; a.cy = cy; a.r = r; return ctx.el('circle', a, parent); }
    if (kind === 'square') { a.x = cx - r * 0.9; a.y = cy - r * 0.9; a.width = r * 1.8; a.height = r * 1.8; a.rx = 2; return ctx.el('rect', a, parent); }
    a.points = cx + ',' + (cy - r * 1.1) + ' ' + (cx + r * 1.15) + ',' + (cy + r * 0.85) + ' ' + (cx - r * 1.15) + ',' + (cy + r * 0.85);
    return ctx.el('polygon', a, parent);
  }
  function defs(ctx, parent) {
    var C = ctx.THEME, df = ctx.el('defs', {}, parent);
    D.parties.forEach(function (p, i) {
      var s = STYLE[i], col = C[s.c], pt = ctx.el('pattern', { id: 'own-pat-' + i, width: 14, height: 14, patternUnits: 'userSpaceOnUse' }, df);
      ctx.el('rect', { width: 14, height: 14, fill: col, 'fill-opacity': 0.2 }, pt);
      if (s.pat === 'dots') ctx.el('circle', { cx: 7, cy: 7, r: 2.3, fill: col, 'fill-opacity': 0.85 }, pt);
      else if (s.pat === 'lines') ctx.el('path', { d: 'M0,7 H14', stroke: col, 'stroke-width': 2.4, 'stroke-opacity': 0.75 }, pt);
      else ctx.el('path', { d: 'M0,7 H14 M7,0 V14', stroke: col, 'stroke-width': 1.8, 'stroke-opacity': 0.75 }, pt);
    });
    var h = ctx.el('pattern', { id: 'own-hatch', width: 14, height: 14, patternUnits: 'userSpaceOnUse' }, df);
    ctx.el('rect', { width: 14, height: 14, fill: C.danger, 'fill-opacity': 0.07 }, h);
    ctx.el('path', { d: 'M-3,3 L3,-3 M0,14 L14,0 M11,17 L17,11', stroke: C.danger, 'stroke-width': 2.6, 'stroke-opacity': 0.8 }, h);
  }
  function patUrl(i) { return 'url(#own-pat-' + i + ')'; }
  function halo(ctx, extra) {
    var a = { stroke: ctx.THEME.bg, 'stroke-width': 7, 'font-size': 24, 'font-weight': 650 };
    for (var k in HALO) a[k] = HALO[k];
    for (var e in extra) a[e] = extra[e];
    return a;
  }
  function checkPath(ctx, parent, cx, cy, s) {
    return ctx.el('path', { d: 'M' + (cx - s * 0.45) + ',' + cy + ' L' + (cx - s * 0.1) + ',' + (cy + s * 0.38) + ' L' + (cx + s * 0.5) + ',' + (cy - s * 0.4), fill: 'none', stroke: ctx.THEME.bg, 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
  }
  function badge(ctx, parent, cx, cy) {
    ctx.el('circle', { cx: cx, cy: cy, r: 14, fill: ctx.THEME.secure, stroke: ctx.THEME.bg, 'stroke-width': 2 }, parent);
    checkPath(ctx, parent, cx, cy, 20);
  }

  /* the elements added to parent since `before` children: a cell's shapes, which dim as one group (ctx.group) */
  function since(parent, before) { return Array.prototype.slice.call(parent.childNodes, before); }
  /* a cell filled by one party: pattern, party-coloured outline, mark and the party's name; `new` adds the "newly owned" badge.
     g carries the scene's own opacity tweens; the shapes sit in a group that emphasis dims on its own channel. */
  function fillCell(ctx, parent, r, pi, k, isNew) {
    var C = ctx.THEME, s = STYLE[pi], col = C[s.c], g = ctx.el('g', { opacity: 0 }, parent);
    ctx.el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 10, fill: patUrl(pi), stroke: col, 'stroke-width': 3 }, g);
    markEl(ctx, g, s.mark, r.x + 32, r.y + r.h / 2, 12, col);
    if (isNew) badge(ctx, g, r.x + r.w - 26, r.y + 26);
    var grp = ctx.group(since(g, 0), 'cell-shape:' + k);
    var tx = ctx.text.add(g, D.parties[pi].name, halo(ctx, { x: r.x + 60, y: r.y + r.h / 2 + 8 }), 'cell:' + k);
    g.__v = 0;
    return { g: g, text: tx, grp: grp };
  }
  /* an unowned cell: dashed warning outline, diagonal hatch; a disputed one split down the middle between the two parties,
     each half with its pattern and mark, "Disputed" centred over the join */
  function gapCell(ctx, parent, r, gp, k) {
    var C = ctx.THEME, g = ctx.el('g', { opacity: 0 }, parent), label, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    if (gp.kind === 'none') {
      ctx.el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 10, fill: 'url(#own-hatch)', stroke: C.danger, 'stroke-width': 4, 'stroke-dasharray': '12 7' }, g);
      label = 'No owner';
    } else {
      var a = D.pIdx[gp.owners[0]], b = D.pIdx[gp.owners[1]];
      ctx.el('rect', { x: r.x, y: r.y, width: r.w / 2, height: r.h, fill: patUrl(a) }, g);
      ctx.el('rect', { x: cx, y: r.y, width: r.w / 2, height: r.h, fill: patUrl(b) }, g);
      ctx.el('line', { x1: cx, y1: r.y, x2: cx, y2: r.y + r.h, stroke: C.danger, 'stroke-width': 4 }, g);
      ctx.el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 10, fill: 'none', stroke: C.danger, 'stroke-width': 4, 'stroke-dasharray': '12 7' }, g);
      markEl(ctx, g, STYLE[a].mark, r.x + 30, cy, 11, C[STYLE[a].c]);
      markEl(ctx, g, STYLE[b].mark, r.x + r.w - 30, cy, 11, C[STYLE[b].c]);
      label = 'Disputed';
    }
    var grp = ctx.group(since(g, 0), 'gap-shape:' + k);
    var tx = ctx.text.add(g, label, halo(ctx, { x: cx, y: cy + 8, 'text-anchor': 'middle', fill: C.text }), 'gap:' + k);
    g.__v = 0;
    return { g: g, text: tx, grp: grp };
  }
  function ring(ctx, k, r, color) {
    var id = k + '|' + color;
    if (!W.rings[id]) W.rings[id] = ctx.el('rect', { x: r.x - 5, y: r.y - 5, width: r.w + 10, height: r.h + 10, rx: 14, fill: 'none', stroke: ctx.THEME[color], 'stroke-width': 6, opacity: 0 }, W.Lring);
    return W.rings[id];
  }

  /* ---- the legend: one row of marks (hud.legend, direction row): each party with its live count, then the overlay marks ---- */
    function legend(ctx) {
    var C = ctx.THEME, area = ctx.area, total = D.cov0.total;
    var rows = D.parties.map(function (pt, i) {
      var s = STYLE[i];
      return { label: pt.name, color: C[s.c], count: ctx.count(0, total), swatch: function (g, box) {
        ctx.el('rect', { x: 0, y: 0, width: box.w, height: box.h, rx: 6, fill: patUrl(i), stroke: C[s.c], 'stroke-width': 3 }, g);
        markEl(ctx, g, s.mark, box.w / 2, box.h / 2, 9, C[s.c]);
      } };
    });
    rows.push({ label: 'No owner', staged: true, swatch: function (g, box) {
      ctx.el('rect', { x: 0, y: 0, width: box.w, height: box.h, rx: 6, fill: 'url(#own-hatch)', stroke: C.danger, 'stroke-width': 3, 'stroke-dasharray': '8 5' }, g);
    } });
    rows.push({ label: 'Disputed', staged: true, swatch: function (g, box) {
      ctx.el('rect', { x: 0, y: 0, width: box.w / 2, height: box.h, fill: patUrl(1) }, g);
      ctx.el('rect', { x: box.w / 2, y: 0, width: box.w / 2, height: box.h, fill: patUrl(2) }, g);
      ctx.el('line', { x1: box.w / 2, y1: 0, x2: box.w / 2, y2: box.h, stroke: C.danger, 'stroke-width': 3 }, g);
      ctx.el('rect', { x: 0, y: 0, width: box.w, height: box.h, rx: 6, fill: 'none', stroke: C.danger, 'stroke-width': 3 }, g);
    } });
    rows.push({ label: 'Newly owned', staged: true, swatch: function (g, box) { badge(ctx, g, box.w / 2, box.h / 2); } });
    W.leg = ctx.hud.legend(rows, { direction: 'row', rect: { x: 28, y: area.y + area.h - 58, w: 1864, h: 52 }, gap: 40 });
  }

  /* ---- build: the whole grid in its empty look, every overlay hidden until its step ---- */
  function build(ctx) {
    D = derive(ctx);
    var C = ctx.THEME, el = ctx.el, lay = D.lay;
    W = { rows: [], fills: {}, gapc: {}, rings: {}, owned: 0, gapN: 0, own: D.parties.map(function () { return 0; }) };
    W.root = el('g', {}, ctx.layers.world);
    defs(ctx, W.root);
    W.Lbase = el('g', {}, W.root); W.Lfill = el('g', {}, W.root); W.Lgap = el('g', {}, W.root); W.Lring = el('g', {}, W.root);

    /* column headers */
    W.cols = el('g', { opacity: 0 }, W.Lbase); W.cols.__v = 0;
    D.duties.forEach(function (u, j) {
      var r = lay.colHead(j);
      ctx.text.add(W.cols, u.name, { x: r.x + r.w / 2, y: r.y + r.h / 2 + 9, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 700, fill: C.text }, 'col:' + u.id).keep();
    });
    /* rows: a header and the empty cells, one group per layer so the stack builds bottom up */
    D.layers.forEach(function (l, i) {
      var g = el('g', { opacity: 0 }, W.Lbase), rh = lay.rowHead(i);
      g.__v = 0;
      el('rect', { x: rh.x, y: rh.y, width: rh.w, height: rh.h, rx: 10, fill: C.panel2, stroke: C.line, 'stroke-width': 2 }, g);
      var probe = el('text', { 'class': 'sans', 'font-size': lay.font, 'font-weight': 650 }, g);
      probe.textContent = l.name;
      var fits = probe.getBBox().width <= rh.w - 28, lines = [l.name];
      g.removeChild(probe);
      if (!fits) {
        var mid = l.name.length / 2, cut = -1;
        for (var q = 0; q < l.name.length; q++) if (l.name[q] === ' ' && (cut < 0 || Math.abs(q - mid) < Math.abs(cut - mid))) cut = q;
        if (cut > 0) lines = [l.name.slice(0, cut), l.name.slice(cut + 1)];
      }
      var ys = lines.length === 1 ? [rh.y + rh.h / 2 + 8] : [rh.y + rh.h / 2 - 9, rh.y + rh.h / 2 + 20];
      lines.forEach(function (s, n) { ctx.text.add(g, s, { x: rh.x + 16, y: ys[n], 'font-size': lay.font, 'font-weight': 650, fill: C.text }, 'row:' + l.id + ':' + n).keep(); });
      D.duties.forEach(function (u, j) {
        var r = lay.cell(i, j);
        el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 10, fill: C.panel, stroke: C.line, 'stroke-width': 2 }, g);
      });
      W.rows.push(g);
    });
    /* fills and overlays, one per cell that needs them */
    D.layers.forEach(function (l, i) {
      D.duties.forEach(function (u, j) {
        var k = key(l.id, u.id), c = D.by[k], r = lay.cell(i, j);
        if (kindOf(c) === 'owned') W.fills[k] = fillCell(ctx, W.Lfill, r, D.pIdx[c.owner], k, false);
        else {
          W.gapc[k] = gapCell(ctx, W.Lgap, r, D.gaps.filter(function (g) { return g.layer === l.id && g.duty === u.id; })[0], k);
          W.fills[k] = fillCell(ctx, W.Lfill, r, D.pIdx[D.fix[k].party], k, true);
        }
      });
    });

    /* fixed panels: the headline, the gap measure, the label panel, the legend (all hidden until a step shows them) */
    W.m1 = ctx.hud.measure({ label: 'Owned', value: ctx.count(0, D.cov0.total), color: C.text, rect: { x: 28, y: ctx.area.y + 8, w: 350, h: 118 } });
    W.m2 = ctx.hud.measure({ label: 'Gaps', value: ctx.count(0, D.gaps.length), of: false, color: C.secure, rect: { x: 398, y: ctx.area.y + 8, w: 220, h: 118 } });
    W.cap = ctx.hud.caption({ x: 638, y: ctx.area.y + 8, w: 1254, h: 118 });
    legend(ctx);
  }

  function cellsOf(party) {      /* the cells one party owns outright, bottom row first */
    var out = [];
    D.layers.forEach(function (l) { D.duties.forEach(function (u) { var c = D.by[key(l.id, u.id)]; if (kindOf(c) === 'owned' && c.owner === party) out.push(key(l.id, u.id)); }); });
    return out;
  }
  function gapHead(g) { return D.lName[g.layer] + ', ' + D.uName[g.duty] + (g.kind === 'none' ? ': no owner' : ': disputed'); }
  function fillItems(keys) { return keys.map(function (k) { return [W.fills[k].text, W.fills[k].grp]; }); }
  function gapItems() { return D.gaps.map(function (g) { var c = W.gapc[key(g.layer, g.duty)]; return [c.text, c.grp]; }); }
  function gapKeys() { return D.gaps.map(function (g) { return key(g.layer, g.duty); }); }
  function shownAll(ctx, recs, t) { recs.forEach(function (x) { ctx.shown(x, t, Infinity); }); }

  /* reveal: one party's cells fill in, bottom row first; its legend count and the headline tick up as they land */
  function reveal(ctx, party, t0, r) {
    var T = ctx.timing, pi = D.pIdx[party], ks = cellsOf(party), step = 0.17;
    ks.forEach(function (k, n) { fade(ctx, W.fills[k].g, 1, t0 + r + n * step, 0.45); });
    var span = Math.max(T.QUANTITY_MIN, (ks.length - 1) * step + 0.45);
    W.owned += ks.length;
    W.m1.to(W.owned, t0 + r, span);
    W.own[pi] = ks.length;
    W.leg.rows[pi].count(ctx.count(ks.length, D.cov0.total), t0 + r, span);
    return r + span;
  }
  function layerList(party) {
    var seen = {}, out = [];
    D.layers.forEach(function (l) { D.duties.forEach(function (u) { var c = D.by[key(l.id, u.id)]; if (kindOf(c) === 'owned' && c.owner === party && !seen[l.id]) { seen[l.id] = true; out.push(l.name); } }); });
    return out;
  }
  /* one party at a time: its cells fill in and a label names the layers it takes */
  function partyBeat(ctx, party, t0, r, last) {
    var end = reveal(ctx, party, t0, r), text = layerList(party).join(', ');
    var c = W.cap.say(text, t0 + r + 0.2, { head: D.pName[party] + ' owns', last: last });
    var done = Math.max(end, c.visible - t0);
    return { end: done, hold: c.hold, next: done + c.hold };      /* the next party's cells start as this text finishes its hold */
  }

  /* gaps: unowned cells outlined and hatched, disputed cells split; each note appears in turn and is read standing still */
  function gapsOn(ctx, t0, r) {
    var T = ctx.timing, res = null;
    W.m2.show(t0 + 0.3);
    W.leg.rows.slice(D.parties.length, D.parties.length + 2).forEach(function (row) { row.show(t0 + 0.4, 0.5); });
    D.gaps.forEach(function (g, n) {
      var k = key(g.layer, g.duty), tb = t0 + r, rg = ring(ctx, k, D.lay.cell(D.layers.map(ids1).indexOf(g.layer), D.duties.map(ids1).indexOf(g.duty)), 'danger');
      fade(ctx, W.gapc[k].g, 1, tb, 0.5); fade(ctx, rg, 1, tb, 0.4);
      W.gapN = n + 1;
      W.m2.to(W.gapN, tb + 0.2, T.QUANTITY_MIN);
      if (n === 0) W.m2.tint(ctx.THEME.danger, tb + 0.2, 0.6);        /* from zero (secure) to a count of problems */
      var last = n === D.gaps.length - 1, c = W.cap.say(g.note, tb + 0.5, { head: gapHead(g), last: last });
      if (last) ctx.atStepEnd(function (e) { fade(ctx, rg, 0, e.t, 0.4); }); else fade(ctx, rg, 0, c.readyAt, 0.4);
      if (!last) r = c.readyAt - 0.5 - t0;
      else res = { end: c.visible - t0, hold: c.hold };
    });
    return res;
  }
  function ids1(x) { return x.id; }

  /* fix: each gap is assigned; the cell takes its new owner's fill and a "newly owned" mark; the measures count */
  function fix(ctx, t0, r) {
    var T = ctx.timing, res = null;
    W.leg.rows[D.parties.length + 2].show(t0 + 0.4, 0.5);
    D.gaps.forEach(function (g, n) {
      var k = key(g.layer, g.duty), f = D.fix[k], pi = D.pIdx[f.party], tb = t0 + r;
      var rg = ring(ctx, k, D.lay.cell(D.layers.map(ids1).indexOf(g.layer), D.duties.map(ids1).indexOf(g.duty)), 'secure');
      var text = D.pName[f.party] + ' to ' + f.takes;
      fade(ctx, rg, 1, tb, 0.4);
      var last = n === D.gaps.length - 1, c = W.cap.say(text, tb + 0.3, { head: D.lName[g.layer] + ', ' + D.uName[g.duty], last: last });
      var tc = c.visible + 0.3;                              /* the label is read, then the cell changes hands */
      fade(ctx, W.gapc[k].g, 0, tc, 0.3); fade(ctx, W.fills[k].g, 1, tc + 0.3, 0.6);
      W.owned++; W.gapN--;
      W.m1.to(W.owned, tc, T.QUANTITY_MIN); W.m2.to(W.gapN, tc, T.QUANTITY_MIN);
      W.leg.rows[pi].count(ctx.count(++W.own[pi], D.cov0.total), tc, T.QUANTITY_MIN);
      if (W.gapN === 0) W.m2.tint(ctx.THEME.secure, tc, 0.6);        /* nothing left to close: zero is the good colour */
      if (last) ctx.atStepEnd(function (e) { fade(ctx, rg, 0, e.t, 0.4); }); else fade(ctx, rg, 0, c.readyAt, 0.4);
      if (!last) r = c.readyAt - 0.3 - t0;
      else res = { end: c.visible - t0, hold: c.hold };
    });
    return res;
  }

  var ACT = {
    stack: function (ctx, st, t0) {
      shownAll(ctx, D.layers.concat(D.duties, D.cells), t0 + 0.3);
      fade(ctx, W.cols, 1, t0 + 0.2, 0.5);
      W.rows.forEach(function (g, i) { fade(ctx, g, 1, t0 + 0.5 + i * 0.22, 0.5); });
      W.m1.show(t0 + 0.4);
      var text = 'Rows are layers of the stack, columns are the jobs at each layer', c = W.cap.say(text, t0 + 1.2, { head: 'How to read it' });
      var end = Math.max(c.visible - t0, 0.5 + (D.layers.length - 1) * 0.22 + 0.5);
      return { end: end, first: 0.2, hold: c.hold };
    },
    provider: function (ctx, st, t0) {
      shownAll(ctx, D.parties, t0 + 0.3);
      W.leg.show(t0 + 0.3, 0.5);
      var b = partyBeat(ctx, 'provider', t0, 0.6, true);
      return { end: b.end, first: 0.6, hold: b.hold };
    },
    ours: function (ctx, st, t0) {
      var a = partyBeat(ctx, 'platform', t0, 0.5, false), b = partyBeat(ctx, 'product', t0, a.next, true);
      return { end: b.end, first: 0.5, hold: b.hold };
    },
    gaps: function (ctx, st, t0) {
      shownAll(ctx, D.gaps.map(function (g) { return g.cell; }), t0 + 0.3);
      var res = gapsOn(ctx, t0, 0.8);
      return { end: res.end, first: 0.4, hold: res.hold };
    },
    assign: function (ctx, st, t0) {
      shownAll(ctx, D.fixes, t0 + 0.3);
      var res = fix(ctx, t0, 0.6);
      return { end: res.end, first: 0.4, hold: res.hold };
    },
    rule: function (ctx, st, t0) {
      var text = 'Owned went from ' + ctx.count(D.cov0.owned, D.cov0.total).text + ' to ' + ctx.count(D.cov1.owned, D.cov1.total).text;
      var c = W.cap.say(text, t0 + 0.7, { head: 'Before and after the fixes', last: true });
      return { end: c.visible - t0, first: 0.5, hold: c.hold };
    }
  };

  /* what the step is about stays at full, the rest dims */
  function active(st) {
    if (st.act === 'provider') return fillItems(cellsOf('provider'));
    if (st.act === 'ours') return fillItems(cellsOf('platform').concat(cellsOf('product')));
    if (st.act === 'gaps') return gapItems();
    if (st.act === 'assign') return gapItems().concat(fillItems(gapKeys()));
    return 'all';
  }

  EXK.scenes.ownership = {
    build: build,
    step: function (ctx, st, t0) {
      ctx.emphasise(active(st), t0 + 0.1);
      var r = ACT[st.act](ctx, st, t0);
      return { end: r.end, firstMotion: r.first, hold: r.hold };
    }
  };
})();
