/* Estate layout: the tree of zones and systems laid out in abstract ground units. Pure: no DOM,
   no GSAP, no painter. Port of the flat v3 measure/place (bottom-up measure, top-down place);
   container bounds come from their children plus padding (PATTERNS.md section 9).

   EXK.layout.layoutEstate(story, sizes?) -> {
     B:      { id: box }        every zone, every system and the implicit 'root'
     boxes:  [box]              zones (containers), in tree order (parents before children)
     nodes:  [box]              systems, in tree order
     root:   box                the implicit row holding the top-level zones
     world:  {x, y, w, h}       root plus margin
     full:   {x, y, w, h}       the world centred in a frame of sizes.aspect (the full view)
     sizes:  the sizes used
     problems: [{path, message, fix}]   hints that could not be honoured
   }
   box = { id, type: 'box'|'node', x, y, w, h, cx, cy, depth, parent, kids: [ids], label, short,
           a (anchor line, relative to y), dir, pad: {l,r,t,b}, tab: {w,h}|null, caps }
   depth: root 0, top-level zones 1, ... (the iso slab level of a zone is depth - 1).

   Layout hints (zone.layout / system.layout): dir 'row'|'col' (default alternates by depth,
   root is a row), gap, pad {l,r,t,b} (overrides), caps (tab in capitals), main (the anchor
   child: rows align children on it, cols use it as their anchor), dx / dy (shift inside a col /
   row), below: <sibling id> with belowGap (in a row: this child leaves the row and sits under
   that sibling; its x is dx from the parent's content left, as in the flat v3 'services' row).

   Isometric branch (sizes 'iso', or sizes.iso true). The same tree algorithm, with three changes that suit a
   diamond seen from above (the iso v3 reference's ground plan), none of which touches the flat output:
   - hints: a zone's or system's layout.iso, when present, replaces its layout block (the flat hints are written
     for a wide flat frame); without it the flat hints apply;
   - below: the child starts under its sibling (x = the sibling's x + dx), and the sibling's slot in the row
     widens to hold the run below it, so later siblings move right instead of overlapping; cols: n (a row
     wrapped every n children, as a grid);
   - the top-level zones in the root row are stretched to the row's height (the reference's Internet strip
     beside the account), keeping their children where they are. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};

  var SIZES = {
    // flat v3: NW, NH, PAD, TOPPAD, TABH, LFS, MARGIN, ASPECT; the root row's gap was 110
    flat: { nodeW: 240, nodeH: 132, pad: 22, topPad: 56, tabH: 44, labelFs: 34, tabs: true,
            margin: 24, gap: 60, rootGap: 110, aspect: 8 / 3 },
    // iso v3: blocks have a 100x100 footprint, slabs grow by PAD 30 and carry no tab
    iso: { nodeW: 100, nodeH: 100, pad: 30, topPad: 30, tabH: 0, labelFs: 0, tabs: false,
           margin: 24, gap: 60, rootGap: 110, aspect: 16 / 9, iso: true }
  };

  function merge(base, over) {
    var o = {}, k;
    for (k in base) o[k] = base[k];
    for (k in over || {}) o[k] = over[k];
    return o;
  }
  function tabW(label, fs, caps) { return label.length * fs * (caps ? 0.68 : 0.56); }

  // Builds the tree: zones by parent, systems by zone; zones first then systems, each in story order.
  function buildTree(story, problems, iso) {
    function hintOf(r) { var l = r.layout || {}; return iso && l.iso ? l.iso : l; }
    var zones = story.zones || [], systems = story.systems || [];
    var T = { root: { id: 'root', type: 'box', kind: 'root', label: null, kids: [], hint: {} } };
    zones.forEach(function (z) {
      T[z.id] = { id: z.id, type: 'box', label: z.name, short: z.short || z.name, kids: [], hint: hintOf(z) };
    });
    systems.forEach(function (s) {
      T[s.id] = { id: s.id, type: 'node', label: s.name, short: s.short || s.name, hint: hintOf(s) };
    });
    zones.forEach(function (z, i) {
      var p = z.parent && T[z.parent] && T[z.parent].type === 'box' ? z.parent : 'root';
      if (z.parent && p === 'root') problems.push({ path: 'zones[' + i + '].parent', message: 'unknown zone ' + z.parent + ', placed at the top level', fix: 'use an id from zones[]' });
      T[p].kids.push(T[z.id]);
    });
    systems.forEach(function (s, i) {
      var p = s.zone && T[s.zone] && T[s.zone].type === 'box' ? s.zone : 'root';
      if (p === 'root') problems.push({ path: 'systems[' + i + '].zone', message: 'unknown zone ' + s.zone + ', placed at the top level', fix: 'use an id from zones[]' });
      T[p].kids.push(T[s.id]);
    });
    return T;
  }

  function measure(b, depth, S, problems) {
    var h = b.hint;
    b.depth = depth;
    if (b.type === 'node') { b.w = S.nodeW; b.h = S.nodeH; b.a = S.nodeH / 2; return; }
    var isRoot = b.id === 'root';
    var hasTab = !!(b.label && S.tabs);
    var p = b.pad = isRoot ? { l: 0, r: 0, t: 0, b: 0 } : { l: S.pad, r: S.pad, t: hasTab ? S.topPad : S.pad, b: S.pad };
    if (h.pad) for (var k in h.pad) p[k] = h.pad[k];
    b.dir = h.dir || (depth % 2 === 0 ? 'row' : 'col');
    b.gap = h.gap != null ? h.gap : (isRoot ? S.rootGap : S.gap);
    b.caps = !!h.caps;
    b.kids.forEach(function (c) { measure(c, depth + 1, S, problems); });
    var cw = 0, ch = 0, a, kids = b.kids;
    if (b.dir === 'row') {
      var ids = {};
      kids.forEach(function (c) { ids[c.id] = c; });
      var flow = [], under = [];
      kids.forEach(function (c) {
        if (c.hint.below != null) {
          if (ids[c.hint.below] && ids[c.hint.below].hint.below == null && c.hint.below !== c.id) { under.push(c); return; }
          problems.push({ path: c.id + '.layout.below', message: c.hint.below + ' is not a sibling in the same row, ignored', fix: 'name a sibling of ' + c.id + ' that stays in the row' });
        }
        flow.push(c);
      });
      var A = 0;
      flow.forEach(function (c) { A = Math.max(A, c.a); });
      if (S.iso && h.cols > 0 && !under.length) {
        isoGrid(b, flow, h.cols);
        cw = b.cw; ch = b.ch; A = b.ga;
      } else {
        flow.forEach(function (c, i) {
          if (i) cw += b.gap;
          c.rx = cw; c.ry = A - c.a + (c.hint.dy || 0);
          cw += S.iso ? Math.max(c.w, underRun(c, under, b.gap)) : c.w;
          ch = Math.max(ch, c.ry + c.h);
        });
        var run = {};   // below-children of one sibling continue in a row
        under.forEach(function (c) {
          var t = ids[c.hint.below], g = c.hint.belowGap != null ? c.hint.belowGap : b.gap;
          var x0 = run[t.id] != null ? run[t.id] + b.gap : (S.iso ? t.rx : 0) + (c.hint.dx || 0);
          c.rx = x0; c.ry = t.ry + t.h + g + (c.hint.dy || 0);
          run[t.id] = c.rx + c.w;
          cw = Math.max(cw, c.rx + c.w); ch = Math.max(ch, c.ry + c.h);
        });
      }
      a = p.t + A;
    } else {
      var main = null;
      kids.forEach(function (c, i) {
        if (i) ch += b.gap;
        c.ry = ch; c.rx = c.hint.dx || 0; ch += c.h; cw = Math.max(cw, c.rx + c.w);
        if (c.hint.main && !main) main = c;
      });
      a = p.t + (main ? main.ry + main.a : ch / 2);
    }
    b.cw = cw; b.ch = ch; b.a = a;
    if (S.iso && isRoot && b.dir === 'row') stretchRoot(b);
    b.w = p.l + cw + p.r; b.h = p.t + ch + p.b;
    b.tab = null;
    if (hasTab) {
      b.tab = { w: Math.round(tabW(b.label, S.labelFs, b.caps) + 44), h: S.tabH };
      b.w = Math.max(b.w, b.tab.w + 40);
    }
  }

  /* iso: the width a sibling's slot needs for the run of below-children under it */
  function underRun(t, under, gap) {
    var w = 0, n = 0;
    under.forEach(function (c) {
      if (c.hint.below !== t.id) return;
      w += (n ? gap : (c.hint.dx || 0)) + c.w; n++;
    });
    return w;
  }
  /* iso: a row wrapped every `cols` children, uniform cells, each child centred in its cell */
  function isoGrid(b, kids, cols) {
    var cwid = 0, chei = 0;
    kids.forEach(function (c) { cwid = Math.max(cwid, c.w); chei = Math.max(chei, c.h); });
    var n = Math.min(cols, kids.length), rows = Math.ceil(kids.length / cols);
    kids.forEach(function (c, i) {
      var col = i % cols, row = Math.floor(i / cols);
      c.rx = col * (cwid + b.gap) + (cwid - c.w) / 2 + (c.hint.dx || 0);
      c.ry = row * (chei + b.gap) + (chei - c.h) / 2 + (c.hint.dy || 0);
    });
    b.cw = n * cwid + (n - 1) * b.gap; b.ch = rows * chei + (rows - 1) * b.gap;
    b.ga = kids.length ? kids[0].ry + kids[0].a : b.ch / 2;     /* anchor line: the first row */
  }
  /* iso: top-level zones stretched to the root row's height; their padding absorbs the shift, so children stay put */
  function stretchRoot(b) {
    b.kids.forEach(function (c) {
      if (c.type !== 'box' || c.hint.below != null) return;
      c.pad.t += c.ry; c.pad.b += b.ch - c.ry - c.h;
      c.h = b.ch; c.ry = 0;
    });
  }

  function place(b, x, y, B, order, parent) {
    b.x = x; b.y = y; b.cx = x + b.w / 2; b.cy = y + b.h / 2; b.parent = parent;
    B[b.id] = b; order.push(b);
    if (b.type === 'node') return;
    var p = b.pad, ox = x + p.l + (b.w - p.l - p.r - b.cw) / 2, oy = y + p.t;
    b.kids.forEach(function (c) { place(c, ox + c.rx, oy + c.ry, B, order, b.id); });
  }

  // Strips the working fields so the output is plain data.
  function finish(b) {
    var o = { id: b.id, type: b.type, x: b.x, y: b.y, w: b.w, h: b.h, cx: b.cx, cy: b.cy,
              depth: b.depth, parent: b.parent, label: b.label, short: b.short || b.label, a: b.a };
    if (b.type === 'box') {
      o.kids = b.kids.map(function (c) { return c.id; });
      o.dir = b.dir; o.pad = b.pad; o.tab = b.tab; o.caps = b.caps;
    }
    return o;
  }

  function layoutEstate(story, sizes) {
    var S = typeof sizes === 'string' ? SIZES[sizes] : merge(SIZES.flat, sizes);
    var problems = [];
    var T = buildTree(story, problems, !!S.iso);
    measure(T.root, 0, S, problems);
    var B = {}, order = [];
    place(T.root, S.margin, S.margin, B, order, null);
    var out = {};
    order.forEach(function (b) { out[b.id] = finish(b); });
    var world = { x: 0, y: 0, w: out.root.w + 2 * S.margin, h: out.root.h + 2 * S.margin };
    return {
      B: out,
      boxes: order.filter(function (b) { return b.type === 'box' && b.id !== 'root'; }).map(function (b) { return out[b.id]; }),
      nodes: order.filter(function (b) { return b.type === 'node'; }).map(function (b) { return out[b.id]; }),
      root: out.root, world: world, full: fullOf(world, S.aspect), sizes: S, problems: problems
    };
  }

  // The world centred in a frame of the given aspect (w / h), never cropping it.
  function fullOf(world, aspect) {
    var fw = Math.max(world.w, world.h * aspect);
    return { x: world.x + world.w / 2 - fw / 2, y: world.y + world.h / 2 - fw / aspect / 2, w: fw, h: fw / aspect };
  }

  // Containment and sibling checks -> [{kind: 'outside'|'overlap', ids: [..], message}]
  function checkLayout(estate) {
    var B = estate.B, out = [];
    Object.keys(B).forEach(function (id) {
      var b = B[id];
      if (b.type !== 'box') return;
      b.kids.forEach(function (k) {
        var c = B[k];
        if (c.x < b.x - 1e-6 || c.y < b.y - 1e-6 || c.x + c.w > b.x + b.w + 1e-6 || c.y + c.h > b.y + b.h + 1e-6) {
          out.push({ kind: 'outside', ids: [k, id], message: k + ' outside ' + id });
        }
      });
      for (var i = 0; i < b.kids.length; i++) for (var j = i + 1; j < b.kids.length; j++) {
        var p = B[b.kids[i]], q = B[b.kids[j]];
        if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) {
          out.push({ kind: 'overlap', ids: [p.id, q.id], message: 'siblings overlap: ' + p.id + ' / ' + q.id });
        }
      }
    });
    return out;
  }

  EXK.layout = { SIZES: SIZES, layoutEstate: layoutEstate, fullOf: fullOf, checkLayout: checkLayout };
})();
