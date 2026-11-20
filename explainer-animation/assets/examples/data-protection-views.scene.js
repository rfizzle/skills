/* Tokenization, encryption and masking, as a custom scene (--pattern custom --scene): the "one record, many viewers" pattern.
   The same record is shown as each system that touches it sees it. Three protections are applied to the same record side by
   side, one column each; a row of viewers (systems, roles, a thief with a copy of the store) is stepped through on the
   timeline and all three cards change at once. The audience sees what each viewer can read, what a thief who copies the
   store gets, and what it takes to get the original back. Only this picture's drawing and choreography live here; the
   stage, chrome, step timing, chip and window.anim come from the kit through ctx.

   Story blocks that drive it:  record      { id, name, value, kind }   the fields of one record (kind picks the rule below)
                                protections { id: tokenize | encrypt | mask, name, define, reversible, by, transform, fits, mode? }
                                            transform: a rule per field kind: "keep", "token", "encrypt", "mask" or
                                            { op: "mask", keep: N } (N trailing letters and digits stay); by: who gets the
                                            original back (null when nobody); mode, for mask only: "display" (a rule on
                                            screens, the store keeps the original) or "static" (the store is overwritten)
                                viewers     { id, name, needs }          a system, a role, or the thief
                                access      { viewer, key, vault, unmask, copy }   what each viewer holds: the key, a call to
                                            the token vault, an unmasked screen; copy: reads the store itself, not a screen
   Every record carries `source`. Nothing shown is typed: every view, readable count and comparison cell is computed. The count of
   readable fields stands in each card's footer, one line under the card (with the reason, except for the thief).

   The masking decision this scene shows: DISPLAY masking (mode "display"). The store keeps the original, so a thief with a
   copy of the store reads every field, and a viewer is shown the mask only because a screen rule says so. Static masking
   (mode "static") overwrites the store with the masked value: the thief gets the mask and nobody gets the original back. The
   pure functions do both; the story picks one, and the band and the captions say which.

   Stand-ins are built once from a fixed seed (no randomness at render time): a token keeps the shape of the original (a digit
   for a digit, a letter of the same case for a letter), ciphertext is hex bytes grouped by four, a mask keeps the last letters
   and digits asked for.

   Pure helpers (no DOM; loaded under Node by scripts/views.test.mjs through EXK.views):
     standIns(record, seed?)                          { field id: { token, cipher } }, deterministic
     maskValue(value, keep, ch?)                      the value with all but the last `keep` letters and digits masked
     viewers(list, access)                            each viewer joined with its access flags (throws if one is missing)
     view(record, protection, viewer, stands?)        per field: { id, name, kind, protected, value, shows, readable, why };
                                                      shows: original | token | ciphertext | masked; viewer null: no access
     counts(fieldViews)                               { n, of }: fields readable
     status(fieldViews)                               the short reason shown in a card's footer, right of the count
     recoverers(protection, viewerList)               viewers that can undo the protection (vault or key holders)
     matrix(record, protections, viewerList)          counts for every viewer and protection
     accessText(viewer)                               what a viewer holds, for its chip
     flipStart / flipProgress / mix                   the sweep as a pure function of time: when position i of n changes
     check(data)                                      throws a clear message unless the data tells the story
     layout(box, cols, rows, chips, opts?)            every rectangle, sized to fill box, blocks at least 32 px apart (24 between chips)
   Drawing helpers:
     apply(ctx, c, t)           column c: the record is swept field by field, each character changing as the bar passes
     lookAs(ctx, vi, t, last)   viewer vi: the chip lights, all three cards change to that viewer's view, a caption says why
     steal(ctx, vi, t, last)    lookAs for the thief: the cards are outlined as a copy, the counts tint
   Build-time checks (check): the thief reads no protected field under tokenization or encryption; under masking the stored
   value is what the story says (original for display, masked for static); reversibility matches who holds a key or a vault;
   every protection leaves a viewer who reads every field; the three are never interchangeable (every pair differs for some
   viewer); and the scenario's own claims about its viewers (checkClaims). */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};
  EXK.scenes = EXK.scenes || {};

  /* =============================== pure functions =============================== */
  var SEED = 20260611, HEX = '0123456789abcdef', OPS = { tokenize: ['keep', 'token'], encrypt: ['keep', 'encrypt'], mask: ['keep', 'mask'] };
  var NOBODY = { id: 'nobody', key: false, vault: false, unmask: false, copy: false };

  function rng(seed) {          /* mulberry32: a fixed sequence for a fixed seed */
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shapeOf(s) { return String(s).replace(/[0-9]/g, '9').replace(/[a-z]/g, 'a').replace(/[A-Z]/g, 'A'); }
  function shapeToken(value, r) {
    return String(value).replace(/[0-9a-zA-Z]/g, function (ch) {
      if (/[0-9]/.test(ch)) return String(Math.floor(r() * 10));
      var base = /[a-z]/.test(ch) ? 97 : 65;
      return String.fromCharCode(base + Math.floor(r() * 26));
    });
  }
  function standIns(record, seed) {
    var r = rng(seed === undefined ? SEED : seed), out = {};
    record.forEach(function (f) {
      var tok, tries = 0;
      do { tok = shapeToken(f.value, r); } while (tok === f.value && ++tries < 8);
      var nb = Math.max(4, Math.min(10, Math.ceil(String(f.value).length / 2)), 0), hex = '';
      for (var i = 0; i < nb * 2; i++) hex += HEX.charAt(Math.floor(r() * 16));
      out[f.id] = { token: tok, cipher: hex.replace(/(.{4})(?=.)/g, '$1 ') };
    });
    return out;
  }
  function maskValue(value, keep, ch) {
    ch = ch || '•';
    var s = String(value), total = s.replace(/[^0-9A-Za-z]/g, '').length, seen = 0;
    return s.replace(/[0-9A-Za-z]/g, function (c) { seen++; return seen > total - keep ? c : ch; });
  }
  function ruleOf(protection, field) {
    var r = protection.transform && protection.transform[field.kind];
    if (r === undefined) throw new Error('views: protection "' + protection.id + '" has no transform rule for kind "' + field.kind + '"');
    return typeof r === 'string' ? { op: r, keep: 0 } : { op: r.op, keep: r.keep || 0 };
  }
  function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* what `viewer` sees of every field under `protection`. A viewer of null holds nothing and reads a screen. */
  function view(record, protection, viewer, stands) {
    stands = stands || standIns(record);
    var v = viewer || NOBODY, id = protection.id;
    return record.map(function (f) {
      var r = ruleOf(protection, f), s = stands[f.id];
      var o = { id: f.id, name: f.name, kind: f.kind, protected: r.op !== 'keep' };
      function is(value, shows, why) { o.value = value; o.shows = shows; o.why = why; o.readable = shows === 'original'; return o; }
      if (r.op === 'keep') return is(f.value, 'original', 'left clear on purpose');
      if (id === 'tokenize') {
        if (v.copy) return is(s.token, 'token', 'stored as a token');
        return v.vault ? is(f.value, 'original', 'calls the token vault') : is(s.token, 'token', 'token only, no vault access');
      }
      if (id === 'encrypt') {
        if (v.copy) return is(s.cipher, 'ciphertext', 'stored as ciphertext');
        return v.key ? is(f.value, 'original', 'decrypts with the key') : is(s.cipher, 'ciphertext', 'ciphertext only, no key');
      }
      var masked = maskValue(f.value, r.keep);
      if (protection.mode === 'static') return is(masked, 'masked', 'stored masked, original gone');
      if (v.copy) return is(f.value, 'original', 'stored as the original');
      return v.unmask ? is(f.value, 'original', 'unmasked screen') : is(masked, 'masked', 'masked on screen');
    });
  }
  function counts(fv) { return { n: fv.filter(function (x) { return x.readable; }).length, of: fv.length }; }
  function status(fv) {
    var first = fv.filter(function (x) { return x.protected; })[0] || fv[0];
    return capital(first.why);
  }
  function viewers(list, access) {
    var by = {};
    access.forEach(function (a) { by[a.viewer] = a; });
    return list.map(function (v) {
      var a = by[v.id];
      if (!a) throw new Error('views: viewer "' + v.id + '" has no access record');
      return { id: v.id, name: v.name, needs: v.needs, key: !!a.key, vault: !!a.vault, unmask: !!a.unmask, copy: !!a.copy };
    });
  }
  /* who can undo the protection: a token vault call for tokenization, the key for encryption; a mask has no way back */
  function recoverers(protection, vs) {
    return vs.filter(function (v) {
      if (v.copy) return false;
      return protection.id === 'tokenize' ? v.vault : protection.id === 'encrypt' ? v.key : false;
    });
  }
  function matrix(record, protections, vs, stands) {
    stands = stands || standIns(record);
    return vs.map(function (v) { return protections.map(function (p) { return counts(view(record, p, v, stands)); }); });
  }
  function accessText(v) {
    if (v.copy) return 'Raw copy of the store';
    var parts = [];
    if (v.key) parts.push('Key');
    if (v.vault) parts.push('Vault');
    if (v.unmask) parts.push('Unmasked');
    return parts.length ? parts.join(' · ') : 'No access';
  }

  /* the sweep: position i of n changes when the bar reaches it; progress is time in seconds from the sweep start */
  function flipStart(i, n, span) { return (i / n) * span; }
  function flipProgress(i, n, span, dur, tt) { return Math.max(0, Math.min(1, (tt - flipStart(i, n, span)) / dur)); }
  function mix(f) { return { out: 1 - Math.min(1, 2 * f), 'in': Math.max(0, 2 * f - 1) }; }      /* the old character leaves, then the new arrives: never both */

  function join(names) { return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]; }

  function check(d) {
    function fail(m) { throw new Error('views: ' + m); }
    var record = d.record, ps = d.protections, V;
    if (!record || !record.length) fail('record must list at least one field');
    var seen = {};
    record.forEach(function (f) {
      if (!f || typeof f.id !== 'string' || !f.id) fail('every field needs a string id');
      if (seen[f.id]) fail('duplicate field id "' + f.id + '"');
      seen[f.id] = true;
      if (typeof f.value !== 'string' || !f.value || typeof f.kind !== 'string' || !f.kind || typeof f.name !== 'string' || !f.name) fail('field "' + f.id + '" needs name, value and kind');
    });
    if (!ps || ps.length !== 3 || ['tokenize', 'encrypt', 'mask'].some(function (id) { return !ps.some(function (p) { return p.id === id; }); })) fail('protections must be exactly tokenize, encrypt and mask');
    ps.forEach(function (p) {
      if (typeof p.define !== 'string' || !p.define || typeof p.fits !== 'string' || !p.fits) fail('protection "' + p.id + '" needs define and fits');
      if (typeof p.reversible !== 'boolean') fail('protection "' + p.id + '" needs reversible: true or false');
      if (p.reversible !== (typeof p.by === 'string' && !!p.by)) fail('protection "' + p.id + '": `by` must name who gets the original back exactly when it is reversible');
      if (p.id === 'mask' ? (p.mode !== 'display' && p.mode !== 'static') : p.mode !== undefined) fail('protection "' + p.id + '": `mode` is "display" or "static" for mask, and absent for the others');
      var any = false;
      record.forEach(function (f) {
        var r = ruleOf(p, f);
        if (OPS[p.id].indexOf(r.op) < 0) fail('protection "' + p.id + '" cannot use "' + r.op + '" for kind "' + f.kind + '" (allowed: ' + OPS[p.id].join(', ') + ')');
        if (r.op !== 'keep') any = true;
      });
      if (!any) fail('protection "' + p.id + '" protects no field');
    });
    V = viewers(d.viewers, d.access);
    if (V.filter(function (v) { return v.copy; }).length !== 1) fail('exactly one viewer holds a copy of the store (the thief)');
    var stands = standIns(record);
    record.forEach(function (f) {
      var s = stands[f.id];
      if (s.token === f.value || shapeOf(s.token) !== shapeOf(f.value)) fail('the token for "' + f.id + '" must differ from the original and keep its shape');
      if (!/^[0-9a-f]{4}( [0-9a-f]{1,4})*$/.test(s.cipher)) fail('the ciphertext for "' + f.id + '" must be grouped hex bytes');
    });
    var thief = V.filter(function (v) { return v.copy; })[0];
    ps.forEach(function (p) {
      var fv = view(record, p, thief, stands), prot = fv.filter(function (x) { return x.protected; });
      if (p.id !== 'mask' && prot.some(function (x) { return x.readable; })) fail('the thief reads a protected field under ' + p.id);
      if (p.id === 'mask') {
        if (p.mode === 'display' && !prot.every(function (x) { return x.shows === 'original'; })) fail('display masking must leave the thief the stored originals');
        if (p.mode === 'static' && prot.some(function (x) { return x.readable; })) fail('static masking must leave the thief only masked values');
      }
      if ((recoverers(p, V).length > 0) !== p.reversible) fail('reversibility of "' + p.id + '" does not match who holds the key or the vault');
      if (!V.some(function (v) { return !v.copy && counts(view(record, p, v, stands)).n === record.length; })) fail('no viewer reads every field under ' + p.id + ': the record would be useless');
    });
    var m = matrix(record, ps, V, stands);
    for (var a = 0; a < ps.length; a++) for (var b = a + 1; b < ps.length; b++) {
      if (!m.some(function (row) { return row[a].n !== row[b].n; })) fail(ps[a].id + ' and ' + ps[b].id + ' look the same to every viewer: they would be interchangeable');
    }
  }
  /* what this scenario's own copy says about its viewers (the step bodies and captions); the story must back it */
  function checkClaims(vs) {
    var by = {};
    vs.forEach(function (v) { by[v.id] = v; });
    function fail(m) { throw new Error('views: the copy claims ' + m); }
    var p = by.processor, o = by.order, a = by.analytics, s = by.support, t = by.thief;
    if (!p || !o || !a || !s || !t) fail('the viewers processor, order, analytics, support and thief');
    if (!(p.key && p.vault && p.unmask)) fail('the processor has the key, the vault and unmasked screens');
    if (!(o.key && !o.vault)) fail('the order service holds the key but not the vault');
    if (a.key || a.vault || a.unmask) fail('analytics holds neither the key nor the vault and sees masked screens');
    if (!(s.vault && !s.key && !s.unmask)) fail('support can use the vault, has no key and sees masked screens');
    if (!(t.copy && !t.key && !t.vault)) fail('the thief holds a copy and neither the key nor the vault');
  }

  /* every rectangle, area px, sized to fill box: caption strip, chip row, column headers, cards (rows inside) and a footer line
     under each card; the comparison bands reuse the card-to-footer span. Every pair of blocks stands at least `block` px apart
     (default 32; the columns and the chips 36 and 24), so no outline or ring touches its neighbour. */
  function layout(box, cols, rows, chips, o) {
    o = o || {};
    var gap = o.gap || 36, cgap = o.chipGap || 24, bg = o.block || 32, capH = o.capH || 96, chipH = o.chipH || 72, headH = o.headH || 40, footH = o.footH || 34, pad = bg;
    var colW = (box.w - gap * (cols - 1)) / cols, chipW = (box.w - cgap * (chips - 1)) / chips;
    var yCap = box.y, yChip = yCap + capH + bg, yHead = yChip + chipH + bg, yCard = yHead + headH + bg;
    var cardH = box.y + box.h - yCard - bg - footH, inset = 8, rowH = (cardH - 2 * inset) / rows;
    var yFoot = yCard + cardH + bg, bandsH = box.y + box.h - yCard, nb = o.bands || 3, bandH = (bandsH - (nb - 1) * pad) / nb;
    return {
      box: box, colW: colW, gap: gap, block: bg, rowH: rowH, cardH: cardH,
      cap: { x: box.x, y: yCap, w: box.w, h: capH },
      col: function (c) { return { x: box.x + c * (colW + gap), w: colW }; },
      chip: function (i) { return { x: box.x + i * (chipW + cgap), y: yChip, w: chipW, h: chipH }; },
      head: function (c) { return { x: box.x + c * (colW + gap), y: yHead, w: colW, h: headH }; },
      card: function (c) { return { x: box.x + c * (colW + gap), y: yCard, w: colW, h: cardH }; },
      row: function (c, j) { return { x: box.x + c * (colW + gap), y: yCard + inset + j * rowH, w: colW, h: rowH }; },
      foot: function (c) { return { x: box.x + c * (colW + gap), y: yFoot, w: colW, h: footH }; },
      band: function (r) { return { x: box.x, y: yCard + r * (bandH + pad), w: box.w, h: bandH }; }
    };
  }

  EXK.views = { standIns: standIns, maskValue: maskValue, view: view, counts: counts, status: status, viewers: viewers, recoverers: recoverers, matrix: matrix, accessText: accessText,
    flipStart: flipStart, flipProgress: flipProgress, mix: mix, check: check, checkClaims: checkClaims, layout: layout, shapeOf: shapeOf, SEED: SEED };
  if (typeof document === 'undefined') return;            /* under Node (the unit tests) only the pure helpers are needed */

  /* =============================== the scene =============================== */
  var BOX = { x: 24, y: 4, w: 1872, h: 712 };               /* area px: the whole diagram area but its margins */
  var FONT = 30, PITCH = FONT * 0.64, LABEL = 22, SPAN = 0.9, FLIP = 0.16, FIELD_GAP = 0.6;
  var STYLE = [{ c: 'token', mark: 'circle' }, { c: 'identity', mark: 'square' }, { c: 'accent', mark: 'triangle' }];
  var KIND = { token: 'token', ciphertext: 'ciphertext', masked: 'masked', original: 'original' };
  var STORED = { token: 'tokens', ciphertext: 'ciphertext', masked: 'masked values', original: 'the originals' };
  var D, W;

  function derive(ctx) {
    var d = { record: ctx.block('record'), protections: ctx.block('protections'), viewers: ctx.block('viewers'), access: ctx.block('access') };
    check(d);
    d.V = viewers(d.viewers, d.access);
    checkClaims(d.V);
    d.stands = standIns(d.record);
    d.nf = d.record.length;
    d.def = d.protections.map(function (p) { return view(d.record, p, null, d.stands); });
    d.views = d.V.map(function (v) { return d.protections.map(function (p) { return view(d.record, p, v, d.stands); }); });
    d.vi = {}; d.V.forEach(function (v, i) { d.vi[v.id] = i; });
    d.lay = layout(BOX, d.protections.length, d.nf, d.V.length);
    return d;
  }

  function markEl(ctx, parent, kind, cx, cy, r, color) {
    var a = { fill: color, stroke: ctx.THEME.bg, 'stroke-width': 1.5, 'stroke-linejoin': 'round' };
    if (kind === 'circle') { a.cx = cx; a.cy = cy; a.r = r; return ctx.el('circle', a, parent); }
    if (kind === 'square') { a.x = cx - r * 0.9; a.y = cy - r * 0.9; a.width = r * 1.8; a.height = r * 1.8; a.rx = 2; return ctx.el('rect', a, parent); }
    a.points = cx + ',' + (cy - r * 1.1) + ' ' + (cx + r * 1.15) + ',' + (cy + r * 0.85) + ' ' + (cx - r * 1.15) + ',' + (cy + r * 0.85);
    return ctx.el('polygon', a, parent);
  }
  function T(ctx, parent, str, attrs, key) { return ctx.text.add(parent, str, attrs, key).keep(); }
  function fade(ctx, el, from, to, t, dur) { ctx.tl.fromTo(el, { opacity: from }, { opacity: to, duration: dur === undefined ? 0.4 : dur, ease: 'power2.out' }, t); }
  function colorOf(ctx, c) { return ctx.THEME[STYLE[c].c]; }

  /* ---- build: every card, header, chip and band in its first-state look; all hidden until their step ---- */
  function build(ctx) {
    D = derive(ctx);
    var C = ctx.THEME, lay = D.lay, el = ctx.el;
    W = { cells: [], statusSlot: [], foot: [], chipCur: -1, chips: [], rings: [], copy: [] };
    W.root = el('g', {}, ctx.layers.world);
    W.cardG = []; W.hdrG = [];
    D.protections.forEach(function (p, c) {
      var col = colorOf(ctx, c), cr = lay.card(c), hr = lay.head(c);
      var hg = el('g', { opacity: 0 }, W.root);
      markEl(ctx, hg, STYLE[c].mark, hr.x + 18, hr.y + hr.h / 2, 11, col);
      T(ctx, hg, p.name, { x: hr.x + 42, y: hr.y + hr.h / 2 + 11, 'font-size': 34, 'font-weight': 700, fill: col }, 'head:' + p.id);
      W.hdrG.push(hg);

      var g = el('g', { opacity: 0 }, W.root);
      el('rect', { x: cr.x, y: cr.y, width: cr.w, height: cr.h, rx: 14, fill: C.panel, stroke: col, 'stroke-width': 3 }, g);
      W.cardG.push(g);
      W.cells.push(D.record.map(function (f, j) { return cell(ctx, g, c, j, p, f); }));
      var cp = el('rect', { x: cr.x - 7, y: cr.y - 7, width: cr.w + 14, height: cr.h + 14, rx: 18, fill: 'none', stroke: C.danger, 'stroke-width': 4, 'stroke-dasharray': '14 8', opacity: 0 }, W.root);
      W.copy.push(cp);
      W.statusSlot.push({ els: {}, cur: null, curKey: null, c: c });
      W.foot.push(footer(ctx, c, ctx.count(D.nf, D.nf)));
    });

    /* viewer chips */
    D.V.forEach(function (v, i) {
      var r = lay.chip(i), g = el('g', { opacity: 0 }, W.root);
      var rect = el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 14, fill: C.panel2, stroke: v.copy ? C.danger : C.line, 'stroke-width': 3 }, g);
      var nm = T(ctx, g, v.name, { x: r.x + r.w / 2, y: r.y + 31, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 700, fill: C.text }, 'chip:' + v.id);
      var sb = T(ctx, g, accessText(v), { x: r.x + r.w / 2, y: r.y + 59, 'text-anchor': 'middle', 'font-size': 22, fill: C.muted }, 'chip-sub:' + v.id);
      W.chips.push({ g: g, rect: rect, nm: nm.el, sb: sb.el, copy: v.copy });
    });
    W.chipsG = W.chips.map(function (x) { return x.g; });

    /* the comparison: three fixed rows under the same column headers, every cell from the pure functions */
    W.bands = [];
    var rows = [
      { label: 'Reversible?', cell: function (p) { return [p.reversible ? 'Yes' : 'No', p.by ? 'with ' + p.by : 'a mask cannot be undone']; } },
      { label: 'By whom?', cell: function (p) {
        var names = recoverers(p, D.V).map(function (v) { return v.name; });
        return [names.length ? join(names) : 'No one', names.length ? 'can get the original back' : p.mode === 'display' ? 'the original stays in the store' : 'the original is gone'];
      } },
      { label: 'What a copy of the store gives a thief', cell: function (p, c) {
        var fv = D.views[D.vi.thief][c], cn = counts(fv), shown = {};
        fv.filter(function (x) { return x.protected; }).forEach(function (x) { shown[x.shows] = true; });
        var kinds = Object.keys(shown), clear = fv.filter(function (x) { return !x.protected; }).map(function (x) { return x.name.toLowerCase(); });
        var line2 = 'Stored as ' + kinds.map(function (k) { return STORED[k]; }).join(' and ') + (kinds.indexOf('original') < 0 && clear.length ? '; ' + join(clear) + ' left clear' : '');
        return [ctx.count(cn.n, cn.of).text + ' readable', line2, cn.n > 0 ? C.danger : C.secure];
      } }
    ];
    rows.forEach(function (row, r) {
      var br = lay.band(r), g = el('g', { opacity: 0 }, W.root);
      T(ctx, g, row.label, { x: br.x + 4, y: br.y + 24, 'font-size': 24, 'font-weight': 650, fill: C.muted }, 'band:' + r);
      D.protections.forEach(function (p, c) {
        var cr = lay.col(c), top = br.y + 36, h = br.h - 36, lines = row.cell(p, c);
        el('rect', { x: cr.x, y: top, width: cr.w, height: h, rx: 12, fill: C.panel, stroke: colorOf(ctx, c), 'stroke-width': 3 }, g);
        T(ctx, g, lines[0], { x: cr.x + 22, y: top + h / 2 - 2, 'font-size': 28, 'font-weight': 700, fill: lines[2] || C.text }, 'band:' + r + ':' + c + ':a');
        T(ctx, g, lines[1], { x: cr.x + 22, y: top + h / 2 + 30, 'font-size': 24, fill: C.muted }, 'band:' + r + ':' + c + ':b');
      });
      W.bands.push(g);
    });
    D.protections.forEach(function (p, c) {
      var cr = lay.col(c), top = lay.head(c).y - 4, bot = lay.band(2).y + lay.band(2).h;
      W.rings.push(el('rect', { x: cr.x - 8, y: top, width: cr.w + 16, height: bot - top, rx: 18, fill: 'none', stroke: colorOf(ctx, c), 'stroke-width': 5, opacity: 0 }, W.root));
    });
    W.cap = ctx.hud.caption({ x: lay.cap.x, y: ctx.area.y + lay.cap.y, w: lay.cap.w, h: lay.cap.h });
  }

  /* the footer of a card: one line under it with the count of readable fields (counts up and down), tinted, and, at the
     right, why (the status). Both start hidden; the count is hidden with show/hide. */
  function footer(ctx, c, start) {
    var r = D.lay.foot(c), C = ctx.THEME, f = { c: c, of: start.of, cur: start.n, proxy: { v: start.n }, ink: C.text, shown: false };
    function fmt(v) { return 'Fields readable ' + Math.round(v) + ' of ' + f.of; }
    f.el = T(ctx, W.root, fmt(start.n), { x: r.x + 6, y: r.y + 26, 'font-size': 22, 'font-weight': 700, fill: C.text, opacity: 0 }, 'foot:' + c).el;
    f.fmt = fmt;
    return f;
  }
  function footShow(ctx, c, t) { var f = W.foot[c]; if (!f.shown) { fade(ctx, f.el, 0, 1, t, 0.5); f.shown = true; } }
  function footHide(ctx, c, t) { var f = W.foot[c]; if (f.shown) { fade(ctx, f.el, 1, 0, t, 0.4); f.shown = false; } }
  function footTo(ctx, c, count, t, dur) {
    var f = W.foot[c], from = f.cur;
    f.of = count.of;
    ctx.tl.fromTo(f.proxy, { v: from }, { v: count.n, duration: dur, ease: 'power2.inOut', onUpdate: function () { f.el.textContent = f.fmt(f.proxy.v); } }, t);
    f.cur = count.n;
  }
  function footTint(ctx, c, color, t, dur) {
    var f = W.foot[c];
    if (color === f.ink) return;
    ctx.tl.fromTo(f.el, { fill: f.ink }, { fill: color, duration: dur, ease: 'power1.inOut' }, t);
    f.ink = color;
  }

  /* a character of a value. The mask bullet is drawn as a dot the size of a lowercase letter: the font's own bullet is much smaller
     than the characters around it */
  function glyph(ctx, g, chr, at, fill, opacity, key) {
    if (chr === '\u2022') return ctx.el('circle', { cx: at.x + PITCH / 2, cy: at.y - 10.5, r: 6.5, fill: fill, opacity: opacity }, g);
    return T(ctx, g, chr, Object.assign({ fill: fill, opacity: opacity }, at), key).el;
  }

  /* one field of one card: label, kind tag, and a text per character in a fixed-pitch row. Characters that stay the same are
     drawn once; the others have an "original" element (shown first) and a "protected" element (hidden first) at the same place. */
  function cell(ctx, g, c, j, p, f) {
    var C = ctx.THEME, r = D.lay.row(c, j), x0 = r.x + 24, base = r.y + 62, col = colorOf(ctx, c), dv = D.def[c][j];
    var plain = f.value, prot = dv.protected ? dv.value : f.value, n = Math.max(plain.length, prot.length);
    var o = { c: c, j: j, n: n, x0: x0, lvl: 'plain', chars: [], pl: [], pr: [], protectedField: dv.protected };
    T(ctx, g, f.name, { x: r.x + 24, y: r.y + 22, 'font-size': LABEL, fill: C.muted }, 'lab:' + c + ':' + j);
    o.tagO = T(ctx, g, KIND.original, { x: r.x + r.w - 24, y: r.y + 22, 'text-anchor': 'end', 'font-size': LABEL, fill: C.muted }, 'tagO:' + c + ':' + j).el;
    o.pl.push(o.tagO);
    if (dv.protected) {
      o.tagP = T(ctx, g, KIND[dv.shows], { x: r.x + r.w - 24, y: r.y + 22, 'text-anchor': 'end', 'font-size': LABEL, 'font-weight': 700, fill: col, opacity: 0 }, 'tagP:' + c + ':' + j).el;
      o.pr.push(o.tagP);
    }
    for (var i = 0; i < n; i++) {
      var a = plain.charAt(i) || ' ', b = prot.charAt(i) || ' ', x = x0 + i * PITCH, ch = { i: i, o: null, p: null };
      var at = { x: x, y: base, 'class': 'mono', 'font-size': FONT };
      if (a === b) { if (a !== ' ') T(ctx, g, a, Object.assign({ fill: C.text }, at), 'v:' + c + ':' + j + ':' + i); continue; }
      if (a !== ' ') { ch.o = glyph(ctx, g, a, at, C.text, 1, 'vo:' + c + ':' + j + ':' + i); o.pl.push(ch.o); }
      if (b !== ' ') { ch.p = glyph(ctx, g, b, at, col, 0, 'vp:' + c + ':' + j + ':' + i); o.pr.push(ch.p); }
      o.chars.push(ch);
    }
    if (dv.protected) o.bar = ctx.el('rect', { x: x0 - 4, y: base - 31, width: 8, height: 40, rx: 3, fill: col, opacity: 0 }, g);
    return o;
  }

  /* switch one field between the original and its protected look: the old characters leave, then the new ones arrive */
  function setLevel(ctx, cl, to, t) {
    if (cl.lvl === to || !cl.protectedField) return;
    var hide = to === 'prot' ? cl.pl : cl.pr, show = to === 'prot' ? cl.pr : cl.pl;
    ctx.tl.fromTo(hide, { opacity: 1 }, { opacity: 0, duration: 0.12, ease: 'none' }, t);
    ctx.tl.fromTo(show, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: 'none' }, t + 0.12);
    cl.lvl = to;
  }
  /* a line of text that changes in place: the old text leaves, then the new arrives */
  function swapText(ctx, slot, str, t) {
    if (slot.curKey === str) return;
    var e = slot.els[str];
    if (!e) {
      var r = D.lay.foot(slot.c);
      e = slot.els[str] = T(ctx, W.root, str, { x: r.x + r.w - 6, y: r.y + 26, 'text-anchor': 'end', 'font-size': 22, 'font-weight': 650, fill: colorOf(ctx, slot.c), opacity: 0 }, 'status:' + slot.c + ':' + str).el;
    }
    var lag = 0;
    if (slot.cur) { ctx.tl.fromTo(slot.cur, { opacity: 1 }, { opacity: 0, duration: 0.15, ease: 'none' }, t); lag = 0.15; }
    ctx.tl.fromTo(e, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' }, t + lag);
    slot.cur = e; slot.curKey = str;
  }
  function clearText(ctx, slot, t) {
    if (!slot.cur) return;
    ctx.tl.fromTo(slot.cur, { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'none' }, t);
    slot.cur = null; slot.curKey = null;
  }

  /* apply: column c is swept field by field; within a field a bar crosses left to right and each character changes as it passes.
     Returns the seconds the sweep takes. */
  function apply(ctx, c, t) {
    var k = 0, end = 0;
    W.cells[c].forEach(function (cl) {
      if (!cl.protectedField) return;
      var tf = t + k * FIELD_GAP, nx = cl.n * PITCH;
      ctx.tl.fromTo(cl.bar, { opacity: 0 }, { opacity: 0.9, duration: 0.1, ease: 'none' }, tf - 0.1);
      ctx.tl.fromTo(cl.bar, { x: 0 }, { x: nx, duration: SPAN, ease: 'none' }, tf);
      ctx.tl.fromTo(cl.bar, { opacity: 0.9 }, { opacity: 0, duration: 0.2, ease: 'none' }, tf + SPAN);
      cl.chars.forEach(function (ch) {
        var s = tf + flipStart(ch.i, cl.n, SPAN), h = FLIP / 2;      /* mix(f): out over the first half, in over the second */
        if (ch.o) ctx.tl.fromTo(ch.o, { opacity: 1 }, { opacity: 0, duration: h, ease: 'none' }, s);
        if (ch.p) ctx.tl.fromTo(ch.p, { opacity: 0 }, { opacity: 1, duration: h, ease: 'none' }, s + h);
      });
      var ts = tf + SPAN / 2;
      ctx.tl.fromTo(cl.tagO, { opacity: 1 }, { opacity: 0, duration: 0.12, ease: 'none' }, ts);
      ctx.tl.fromTo(cl.tagP, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: 'none' }, ts + 0.12);
      cl.lvl = 'prot';
      end = Math.max(end, k * FIELD_GAP + SPAN + FLIP);
      k++;
    });
    return end;
  }

  function chipTo(ctx, vi, t) {
    var C = ctx.THEME;
    function paint(i, on) {
      var ch = W.chips[i], col = ch.copy ? C.danger : C.accent, line = ch.copy ? C.danger : C.line;
      ctx.tl.fromTo(ch.rect, { fill: on ? C.panel2 : col, stroke: on ? line : col }, { fill: on ? col : C.panel2, stroke: on ? col : line, duration: 0.3, ease: 'power2.out' }, t);
      ctx.tl.fromTo(ch.nm, { fill: on ? C.text : C.bg }, { fill: on ? C.bg : C.text, duration: 0.3, ease: 'power2.out' }, t);
      ctx.tl.fromTo(ch.sb, { fill: on ? C.muted : C.bg }, { fill: on ? C.bg : C.muted, duration: 0.3, ease: 'power2.out' }, t);
    }
    if (W.chipCur === vi) return;
    if (W.chipCur >= 0) paint(W.chipCur, false);
    paint(vi, true);
    W.chipCur = vi;
  }

  function chipOff(ctx, t) {
    if (W.chipCur < 0) return;
    var ch = W.chips[W.chipCur], C = ctx.THEME, line = ch.copy ? C.danger : C.line, col = ch.copy ? C.danger : C.accent;
    ctx.tl.fromTo(ch.rect, { fill: col, stroke: col }, { fill: C.panel2, stroke: line, duration: 0.3, ease: 'power2.out' }, t);
    ctx.tl.fromTo(ch.nm, { fill: C.bg }, { fill: C.text, duration: 0.3, ease: 'power2.out' }, t);
    ctx.tl.fromTo(ch.sb, { fill: C.bg }, { fill: C.muted, duration: 0.3, ease: 'power2.out' }, t);
    W.chipCur = -1;
  }

  /* lookAs: the chip lights, all three cards change to that viewer's view in the same moment, a caption says why */
  function lookAs(ctx, vi, t, last, o) {
    o = o || {};
    var v = D.V[vi], C = ctx.THEME;
    chipTo(ctx, vi, t);
    var cap = W.cap.say(v.needs, t + 0.2, { head: v.name + ' sees', last: last });
    var done = t + 0.5 + ctx.timing.QUANTITY_MIN;
    D.protections.forEach(function (p, c) {
      var fv = D.views[vi][c], cn = counts(fv);
      fv.forEach(function (x, j) { setLevel(ctx, W.cells[c][j], x.shows === 'original' ? 'plain' : 'prot', t + 0.3 + j * 0.12); });
      if (v.copy) clearText(ctx, W.statusSlot[c], t + 0.2); else swapText(ctx, W.statusSlot[c], status(fv), t + 0.4);     /* a thief's footer is the count alone: the card's tags say what is stored */
      footTo(ctx, c, ctx.count(cn.n, cn.of), t + 0.5, ctx.timing.QUANTITY_MIN);
      footTint(ctx, c, v.copy ? (cn.n > 0 ? C.danger : C.secure) : C.text, t + 0.5, 0.6);
      if (o.outline) fade(ctx, W.copy[c], 0, 1, t + 0.2, 0.4);
    });
    return { visible: cap.visible, readyAt: cap.readyAt, hold: cap.hold, done: done };
  }
  /* steal: the thief's view; the three cards are outlined as copies of the store and the counts tint */
  function steal(ctx, vi, t, last) { return lookAs(ctx, vi, t, last, { outline: true }); }

  function shownAll(ctx, recs, t) { recs.forEach(function (x) { ctx.shown(x, t, Infinity); }); }

  /* the caption of a step's last say stays readable until its readyAt: the kit counts the hold from `end`, so hand it the rest */
  function finish(t0, end, cap) { return { end: end, first: 0.3, hold: Math.max(0, cap.readyAt - t0 - end) }; }

  var ACT = {
    record: function (ctx, st, t0) {
      shownAll(ctx, D.record, t0 + 0.3);
      D.protections.forEach(function (p, c) {
        fade(ctx, W.cardG[c], 0, 1, t0 + 0.3 + c * 0.25, 0.6);
        footShow(ctx, c, t0 + 0.9 + c * 0.25);
      });
      shownAll(ctx, D.viewers.concat(D.access), t0 + 1.0);
      fade(ctx, W.chipsG, 0, 1, t0 + 1.0, 0.6);
      var c = W.cap.say('One customer payment record, held in three places so each copy can be protected differently.', t0 + 1.2, { head: 'The record', last: true });
      return finish(t0, c.visible - t0, c);
    },
    three: function (ctx, st, t0) {
      shownAll(ctx, D.protections, t0 + 0.3);
      var r = 0.4, end = 0, lastCap = null;
      D.protections.forEach(function (p, c) {
        var last = c === D.protections.length - 1, tc = t0 + r;
        fade(ctx, W.hdrG[c], 0, 1, tc, 0.5);
        var cap = W.cap.say(p.define, tc + 0.2, { head: p.name, last: last });
        var ts = tc + 0.9, dur = apply(ctx, c, ts), cn = counts(D.def[c]);
        footTo(ctx, c, ctx.count(cn.n, cn.of), ts + 0.3, Math.max(ctx.timing.QUANTITY_MIN, dur - 0.3));
        var sweepEnd = ts + dur - t0;
        end = Math.max(end, sweepEnd, cap.visible - t0); lastCap = cap;
        r = Math.max(cap.readyAt - t0 - 0.2, sweepEnd + 0.2);
      });
      return finish(t0, end, lastCap);
    },
    processor: function (ctx, st, t0) {
      var a = lookAs(ctx, D.vi.processor, t0 + 0.4, true);
      return finish(t0, Math.max(a.visible, a.done) - t0, a);
    },
    others: function (ctx, st, t0) {
      var ids = ['order', 'analytics', 'support'], r = 0.3, end = 0, lastA = null;
      ids.forEach(function (id, n) {
        var last = n === ids.length - 1, a = lookAs(ctx, D.vi[id], t0 + r, last);
        end = Math.max(end, a.visible - t0, a.done - t0); lastA = a;
        r = a.readyAt - t0 - 0.2;
      });
      return finish(t0, end, lastA);
    },
    thief: function (ctx, st, t0) {
      var a = steal(ctx, D.vi.thief, t0 + 0.3, true);
      return finish(t0, Math.max(a.visible, a.done) - t0, a);
    },
    choose: function (ctx, st, t0) {
      fade(ctx, W.cardG, 1, 0, t0 + 0.2, 0.5);
      fade(ctx, W.copy, 1, 0, t0 + 0.2, 0.5);
      chipOff(ctx, t0 + 0.2);
      D.protections.forEach(function (p, c) { footHide(ctx, c, t0 + 0.2); clearText(ctx, W.statusSlot[c], t0 + 0.2); });
      W.bands.forEach(function (g, r) { fade(ctx, g, 0, 1, t0 + 0.9 + r * 0.5, 0.6); });
      var r = 1.8, end = 0, lastCap = null;
      D.protections.forEach(function (p, c) {
        var last = c === D.protections.length - 1, tc = t0 + r;
        fade(ctx, W.rings[c], 0, 1, tc, 0.3);
        var cap = W.cap.say(p.fits, tc + 0.2, { head: p.name, last: last });
        end = Math.max(end, cap.visible - t0); lastCap = cap;
        if (last) ctx.atStepEnd(function (e) { fade(ctx, W.rings[c], 1, 0, e.t, 0.4); });
        else { r = cap.readyAt - t0 - 0.2; fade(ctx, W.rings[c], 1, 0, cap.readyAt, 0.3); }
      });
      return finish(t0, end, lastCap);
    }
  };

  EXK.scenes.views = {
    build: build,
    step: function (ctx, st, t0) {
      if (!ACT[st.act]) throw new Error('views: step "' + st.id + '" has act "' + st.act + '"; known: ' + Object.keys(ACT).join(', '));
      ctx.emphasise('all', t0 + 0.1);
      var r = ACT[st.act](ctx, st, t0);
      return { end: r.end, firstMotion: r.first, hold: r.hold };
    }
  };
})();
