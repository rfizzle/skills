/* Defence in depth, as a custom scene (--pattern custom --scene): the "barriers between threats and consequences" pattern
   (a bow-tie). Threats stand in a column at the left, the event to be avoided is the knot in the middle, the consequences
   stand at the right. Between each threat and the event are prevention barriers; between the event and each consequence
   are mitigation barriers. An attack is a path from a threat through its barriers; each barrier holds, is weak, or is
   missing today. The audience sees that no single control is the defence, where today's layers are thin, and what adding
   one barrier changes. Only the diagram's own drawing and choreography live here; the stage, chrome, step timing, chip and
   window.anim come from the kit through ctx.

   Story blocks that drive it:  threats       { id, name }             a column at the left
                                event         { id, name }             exactly one record (a block of one)
                                consequences  { id, name }             a column at the right
                                barriers      { id, name, side, on, state, owner }
                                                side: prevent | mitigate; on: the threat ids (prevent) or consequence ids
                                                (mitigate) it stands in front of; state: strong | weak | missing; owner: a role.
                                                The ORDER of the array is the order along a path: from a threat toward the
                                                event, and from the event toward a consequence.
                                attempts      { id, step, threat, when, expect }
                                                which threat is tried in which step; when: today | plan (which barrier states
                                                apply); expect: held | through (checked at build time)
                                additions     { id, barrier, change, state }
                                                change: new (the barrier was missing) | stronger (it was weak); state: strong
   Every record carries `source`. Nothing shown is typed: the counts and what each attempt meets come from the barriers.

   The rule of the pattern: a threat with no barrier is an error naming the threat (so is a consequence with none): the
   picture would claim the event is one step from it. A barrier stops an attack only when it is strong: a weak barrier lets
   it through (with a visible mark) and a missing one is not there. The first strong barrier on a path is where it stops.
   A barrier is told apart by its look, never by colour alone: strong is a solid bar, weak a thin dashed outline, missing an
   empty outline. Every bar carries its number (a bow-tie has more barrier names than the lines have room for, at 22 px or
   more). The barriers on the path being shown carry their names beside the bar, placed clear of every line, bar, box and
   pill (placeNames); the others stay as quiet numbered bars. The full numbered list stands in the top strip in the first
   and the last step, where the audience has time; the legend at the bottom is only the key to the four looks, on one line.

   Pure helpers (no DOM; loaded under Node by scripts/barriers.test.mjs through EXK.bowtie):
     pathOf(d, id, bars?)            the ordered barriers on one threat's or consequence's path
     statesAfter(d) / statesBefore   { barrier id: state }, with the additions applied or not
     trace(path, states)             { stops: [{ barrier, outcome: held | slips | absent }], stopAt, reached }
     reaching(d, states)             { n, of, ids }: threat paths that reach the event
     unmitigated(d, states)          { n, of, ids }: consequence paths with no strong barrier
     describe(tr, lane)              the sentence the caption says for one attempt
     slots(d, side)                  { slotOf: { barrier id: column }, n }: columns by the longest path to each barrier
     layout(d, box)                  rectangles, lines and bar positions that fill box
     placeNames(d, lay, picks, w, pillLanes?)   where the names of one group of bars go: a rectangle per pick, clear of lines, bars,
                                     boxes, pill positions and each other; throws a message naming the bar when none is free
     check(d)                        throws a message that names what to fix unless the data tells the story
   Drawing helpers:
     attempt(ctx, threat, t0, o)     a slow unlabelled dot travels the line; it stops at the first strong barrier with a
                                     "Held here" mark, or passes weak and missing ones ("Slips past", "Not there") and
                                     reaches the event; the caption carries the words. o.fan lights the consequence lines
     fanOut(ctx, t0)                 the consequence lines light from the event as far as their strong barriers
     land(ctx, ids, t0)              barriers land (new) or turn strong (stronger) with a mark, the measures count
   Build-time checks (check): at least one barrier per threat and per consequence; ids and sides agree; additions change a
   weak or missing barrier; each attempt does what it is said to do; at least one path gets through today and none after
   the additions; no consequence is left unmitigated after them.
   Headline measure, fixed in one place: "Threat paths reaching the event: N of M" (ctx.count). A second measure:
   "Consequences left unmitigated: N of M". */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};
  EXK.scenes = EXK.scenes || {};

  var BAR_W = 40, BAR_H = 48, MIN_GAP = 80;

  /* =============================== pure barrier functions =============================== */
  function ids(list) { return list.map(function (x) { return x.id; }); }
  function pathOf(d, id, bars) {
    return (bars || d.barriers).filter(function (b) { return b.on.indexOf(id) >= 0; });
  }
  function statesBefore(d) { var s = {}; d.barriers.forEach(function (b) { s[b.id] = b.state; }); return s; }
  function statesAfter(d) {
    var s = statesBefore(d);
    (d.additions || []).forEach(function (a) { s[a.barrier] = a.state; });
    return s;
  }
  function outcomeOf(state) { return state === 'strong' ? 'held' : state === 'weak' ? 'slips' : 'absent'; }
  /* walk a path: the first strong barrier stops it; weak and missing ones let it through */
  function trace(path, states) {
    var stops = [], stopAt = -1;
    for (var i = 0; i < path.length; i++) {
      var o = outcomeOf(states[path[i].id]);
      stops.push({ barrier: path[i], outcome: o });
      if (o === 'held') { stopAt = i; break; }
    }
    return { stops: stops, stopAt: stopAt, reached: stopAt < 0 };
  }
  function reaching(d, states) {
    var out = d.threats.filter(function (t) { return trace(pathOf(d, t.id), states).reached; });
    return { n: out.length, of: d.threats.length, ids: ids(out) };
  }
  function unmitigated(d, states) {
    var out = d.consequences.filter(function (c) { return trace(pathOf(d, c.id), states).reached; });
    return { n: out.length, of: d.consequences.length, ids: ids(out) };
  }
  function lower(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  /* the caption sentence for one attempt: what it passes and where it stops (one line, no counts) */
  function describe(tr) {
    var passed = tr.stops.filter(function (s) { return s.outcome !== 'held'; }).map(function (s) {
      return s.outcome === 'slips' ? 'weak ' + lower(s.barrier.name) : 'no ' + lower(s.barrier.name);
    });
    var held = tr.stopAt >= 0 ? tr.stops[tr.stopAt].barrier : null;
    if (held && !passed.length) return 'Held at once by ' + lower(held.name) + '.';
    if (held) return 'Past ' + passed.join(' and ') + ', then held by ' + lower(held.name) + '.';
    return 'Past ' + passed.join(' and ') + '.';
  }

  /* barrier columns: a barrier sits one column past the barrier before it on every path it is on (the longest path), so
     shared barriers line up and no two barriers on one path share a column. The array order is the order on every path,
     so one pass in that order is enough. */
  function slots(d, side) {
    var lanes = (side === 'prevent' ? d.threats : d.consequences), slotOf = {}, n = 0;
    var all = d.barriers.filter(function (b) { return b.side === side; });
    all.forEach(function (b) {
      var s = 0;
      lanes.forEach(function (l) {
        var path = pathOf(d, l.id).filter(function (x) { return x.side === side; }), i = path.indexOf(b);
        if (i > 0) s = Math.max(s, slotOf[path[i - 1].id] + 1);
      });
      slotOf[b.id] = s;
      n = Math.max(n, s + 1);
    });
    return { slotOf: slotOf, n: n };
  }

  function yAt(line, x) { return line.y1 + (line.y2 - line.y1) * (x - line.x1) / (line.x2 - line.x1); }

  /* box = {x, y, w, h} (area px). Threats in a column at the left, consequences at the right, the event in the middle
     with the lines attached along its sides; bars sit on the lines at their columns. */
  function layout(d, box, opts) {
    opts = opts || {};
    var boxW = opts.boxW || 300, evW = opts.evW || 250, nT = d.threats.length, nC = d.consequences.length;
    var rowT = box.h / nT, rowC = box.h / nC, boxH = Math.min(opts.boxH || 84, Math.min(rowT, rowC) - 16);
    var evH = Math.min(box.h - 8, opts.evH || 300), cy = box.y + box.h / 2;
    var ev = { x: box.x + (box.w - evW) / 2, y: cy - evH / 2, w: evW, h: evH };
    function attachY(i, n) { var step = n > 1 ? Math.min(opts.attachStep || 74, (evH - 80) / (n - 1)) : 0; return cy + (i - (n - 1) / 2) * step; }
    var th = {}, co = {}, lane = {}, bars = {}, sp = slots(d, 'prevent'), sm = slots(d, 'mitigate');
    d.threats.forEach(function (t, i) {
      var r = th[t.id] = { x: box.x, y: box.y + rowT * (i + 0.5) - boxH / 2, w: boxW, h: boxH };
      lane[t.id] = { side: 'prevent', x1: r.x + r.w, y1: r.y + r.h / 2, x2: ev.x, y2: attachY(i, nT), box: r };
    });
    d.consequences.forEach(function (c, i) {
      var r = co[c.id] = { x: box.x + box.w - boxW, y: box.y + rowC * (i + 0.5) - boxH / 2, w: boxW, h: boxH };
      lane[c.id] = { side: 'mitigate', x1: ev.x + ev.w, y1: attachY(i, nC), x2: r.x, y2: r.y + r.h / 2, box: r };
    });
    var minGap = Infinity, byCol = {};
    Object.keys(lane).forEach(function (id) {
      var l = lane[id], sd = l.side === 'prevent' ? sp : sm;
      bars[id] = pathOf(d, id).filter(function (b) { return b.side === l.side; }).map(function (b) {
        var s = sd.slotOf[b.id], x = l.x1 + (l.x2 - l.x1) * (s + 1) / (sd.n + 1), p = { barrier: b.id, lane: id, slot: s, x: x, y: yAt(l, x) };
        (byCol[l.side + s] = byCol[l.side + s] || []).push(p.y);
        return p;
      });
    });
    Object.keys(byCol).forEach(function (k) {
      var ys = byCol[k].sort(function (a, b) { return a - b; });
      for (var i = 1; i < ys.length; i++) minGap = Math.min(minGap, ys[i] - ys[i - 1]);
    });
    return { box: box, th: th, co: co, ev: ev, lane: lane, bars: bars, nPrevent: sp.n, nMitigate: sm.n, slotOf: Object.assign({}, sp.slotOf, sm.slotOf), minGap: minGap, boxH: boxH };
  }

  /* names beside bars. picks: [{lane, barrier}]; w(name) the text width in px. Returns [{lane, barrier, x, y, w, h, anchor}]
     where (x, y) is the text's start (the middle for anchor 'middle') and y the baseline. Candidates run below the bar first, then
     above the pill that may stand over it; the first rectangle clear of every obstacle wins. */
  var NAME_LH = 27, NAME_PAD = 6;
  /* one line, then the split into two lines that makes the wider line narrowest */
  function nameForms(name, w) {
    var forms = [{ lines: [name], w: w(name) }], words = name.split(' '), best = null;
    for (var i = 1; i < words.length; i++) {
      var l1 = words.slice(0, i).join(' '), l2 = words.slice(i).join(' '), m = Math.max(w(l1), w(l2));
      if (!best || m < best.w) best = { lines: [l1, l2], w: m };
    }
    if (best) forms.push(best);
    return forms;
  }
  function segHitsRect(s, r) {
    var n = Math.max(2, Math.ceil(Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / 3));
    for (var i = 0; i <= n; i++) {
      var x = s.x1 + (s.x2 - s.x1) * i / n, y = s.y1 + (s.y2 - s.y1) * i / n;
      if (x > r.x - 5 && x < r.x + r.w + 5 && y > r.y - 5 && y < r.y + r.h + 5) return true;
    }
    return false;
  }
  function rectsHit(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
  function placeNames(d, lay, picks, w, pillLanes) {
    var obs = [], segs = [], out = [];
    Object.keys(lay.lane).forEach(function (id) { var l = lay.lane[id]; segs.push({ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 }); });
    Object.keys(lay.th).forEach(function (id) { obs.push(lay.th[id]); });
    Object.keys(lay.co).forEach(function (id) { obs.push(lay.co[id]); });
    obs.push(lay.ev);
    var live = {};                                         /* the lines whose pills stand with this group: the picks' lines unless told */
    (pillLanes || picks.map(function (pk) { return pk.lane; })).forEach(function (id) { live[id] = true; });
    Object.keys(lay.bars).forEach(function (id) {
      lay.bars[id].forEach(function (p) {
        obs.push({ x: p.x - BAR_W / 2 - 5, y: p.y - BAR_H / 2 - 5, w: BAR_W + 10, h: BAR_H + 10 });
        if (live[id]) obs.push({ x: p.x - 82, y: p.y - BAR_H / 2 - 35, w: 164, h: 34 });      /* the pill that stands over it */
      });
    });
    var bx = lay.box, cands = [];
    picks.forEach(function (pk) {
      var p = lay.bars[pk.lane].filter(function (q) { return q.barrier === pk.barrier; })[0];
      if (!p) throw new Error('bowtie: barrier "' + pk.barrier + '" is not on the line of "' + pk.lane + '"');
      var hb = BAR_H / 2, list = [];
      nameForms(d.byId[pk.barrier].name, w).forEach(function (form) {
        var h = form.lines.length * NAME_LH, tries = [];
        [6, 30].forEach(function (dy) {
          tries.push({ a: 'middle', x: p.x, top: p.y + hb + dy });
          tries.push({ a: 'start', x: p.x - 26, top: p.y + hb + dy });
          tries.push({ a: 'end', x: p.x + 26, top: p.y + hb + dy });
        });
        [0, 26].forEach(function (dy) {
          tries.push({ a: 'middle', x: p.x, top: p.y - hb - 40 - h - dy });
          tries.push({ a: 'start', x: p.x - 26, top: p.y - hb - 40 - h - dy });
          tries.push({ a: 'end', x: p.x + 26, top: p.y - hb - 40 - h - dy });
        });
        tries.forEach(function (c) {
          var x0 = c.a === 'middle' ? c.x - form.w / 2 : c.a === 'start' ? c.x : c.x - form.w;
          var r = { x: x0 - NAME_PAD, y: c.top, w: form.w + 2 * NAME_PAD, h: h };
          if (r.x < 8 || r.x + r.w > 1912 || r.y < bx.y - 6 || r.y + r.h > bx.y + bx.h + 10) return;
          if (obs.some(function (o) { return rectsHit(r, o); }) || segs.some(function (sg) { return segHitsRect(sg, r); })) return;
          list.push({ lane: pk.lane, barrier: pk.barrier, a: c.a, x: c.x, y: c.top + NAME_LH - 7, lines: form.lines, rect: r });
        });
      });
      cands.push(list);
    });
    /* the first combination (in preference order) whose rectangles stay clear of each other */
    function pick(i, chosen) {
      if (i === cands.length) return chosen;
      for (var k = 0; k < cands[i].length; k++) {
        var c = cands[i][k];
        if (chosen.some(function (o) { return rectsHit(c.rect, o.rect); })) continue;
        var got = pick(i + 1, chosen.concat([c]));
        if (got) return got;
      }
      return null;
    }
    out = pick(0, []);
    if (!out) throw new Error('bowtie: no free place beside the bars for ' + picks.map(function (pk) { return '"' + d.byId[pk.barrier].name + '" on "' + pk.lane + '"'; }).join(', ') + '; widen the diagram, shorten a name or move a bar');
    return out;
  }

  function check(d) {
    function fail(m) { throw new Error('bowtie: ' + m); }
    function need(name) { if (!Array.isArray(d[name]) || !d[name].length) fail('the story needs a non-empty "' + name + '" block'); return d[name]; }
    var threats = need('threats'), cons = need('consequences'), bars = need('barriers');
    if (!Array.isArray(d.event) || d.event.length !== 1) fail('"event" must hold exactly one record (the one event to be avoided)');
    var seen = {};
    threats.concat(cons, d.event, bars, d.attempts || [], d.additions || []).forEach(function (x) {
      if (!x || typeof x.id !== 'string' || !x.id) fail('every record needs a string id');
      if (seen[x.id]) fail('duplicate id "' + x.id + '"');
      seen[x.id] = true;
    });
    var isT = {}, isC = {}, byId = {};
    threats.forEach(function (t) { isT[t.id] = t; });
    cons.forEach(function (c) { isC[c.id] = c; });
    bars.forEach(function (b) {
      byId[b.id] = b;
      if (typeof b.name !== 'string' || !b.name) fail('barrier "' + b.id + '" needs a name');
      if (b.side !== 'prevent' && b.side !== 'mitigate') fail('barrier "' + b.id + '": side is "prevent" or "mitigate", not "' + b.side + '"');
      if (['strong', 'weak', 'missing'].indexOf(b.state) < 0) fail('barrier "' + b.id + '": state is "strong", "weak" or "missing", not "' + b.state + '"');
      if (typeof b.owner !== 'string' || !b.owner) fail('barrier "' + b.id + '" needs an owner (a role)');
      if (!Array.isArray(b.on) || !b.on.length) fail('barrier "' + b.id + '" stands in front of nothing: list threat or consequence ids in "on"');
      b.on.forEach(function (o) {
        if (b.side === 'prevent' && !isT[o]) fail('barrier "' + b.id + '" is a prevention barrier but stands in front of "' + o + '", which is not a threat');
        if (b.side === 'mitigate' && !isC[o]) fail('barrier "' + b.id + '" is a mitigation barrier but stands in front of "' + o + '", which is not a consequence');
      });
    });
    threats.forEach(function (t) {
      if (!pathOf(d, t.id).length) fail('threat "' + t.name + '" has no barrier on its path. A threat with no barrier is an error: add a prevention barrier whose "on" lists "' + t.id + '", or remove the threat');
    });
    cons.forEach(function (c) {
      if (!pathOf(d, c.id).length) fail('consequence "' + c.name + '" has no barrier between it and the event. A consequence with no barrier is an error: add a mitigation barrier whose "on" lists "' + c.id + '", or remove it');
    });
    slots(d, 'prevent'); slots(d, 'mitigate');
    (d.additions || []).forEach(function (a) {
      var b = byId[a.barrier];
      if (!b) fail('addition "' + a.id + '" names barrier "' + a.barrier + '", which is not in barriers');
      if (b.state === 'strong') fail('addition "' + a.id + '" adds "' + b.name + '", which is already strong: an addition makes a weak or missing barrier strong');
      if (a.state !== 'strong') fail('addition "' + a.id + '": state must be "strong"');
      if (a.change !== (b.state === 'missing' ? 'new' : 'stronger')) fail('addition "' + a.id + '": change is "' + (b.state === 'missing' ? 'new' : 'stronger') + '" for a ' + b.state + ' barrier, not "' + a.change + '"');
    });
    var before = statesBefore(d), after = statesAfter(d), r0 = reaching(d, before), r1 = reaching(d, after);
    if (r0.n < 1) fail('no attack gets through today, so there is nothing to fix; make one barrier weak or missing');
    if (r1.n > 0) fail('after the additions the threat "' + d.threats.filter(function (t) { return r1.ids.indexOf(t.id) >= 0; })[0].name + '" still gets through; add or strengthen a barrier on its path');
    var u1 = unmitigated(d, after);
    if (u1.n > 0) fail('after the additions the consequence "' + d.consequences.filter(function (c) { return u1.ids.indexOf(c.id) >= 0; })[0].name + '" is still left unmitigated; strengthen a mitigation barrier on its path');
    if (unmitigated(d, before).n < 1) fail('every consequence is already softened today; make one mitigation barrier weak or missing');
    (d.attempts || []).forEach(function (a) {
      if (!isT[a.threat]) fail('attempt "' + a.id + '" tries "' + a.threat + '", which is not a threat');
      if (a.when !== 'today' && a.when !== 'plan') fail('attempt "' + a.id + '": when is "today" or "plan"');
      var tr = trace(pathOf(d, a.threat), a.when === 'plan' ? after : before), got = tr.reached ? 'through' : 'held';
      if (a.expect !== got) fail('attempt "' + a.id + '" on "' + isT[a.threat].name + '" is said to be ' + a.expect + ' ' + (a.when === 'plan' ? 'after the additions' : 'today') + ' but it is ' + got + '; change the attempt or the barriers');
    });
    (d.steps || []).length && (d.attempts || []).forEach(function (a) {
      if (!d.steps.some(function (s) { return s.id === a.step; })) fail('attempt "' + a.id + '" is in step "' + a.step + '", which is not a step');
    });
  }

  EXK.bowtie = { pathOf: pathOf, statesBefore: statesBefore, statesAfter: statesAfter, trace: trace, reaching: reaching, unmitigated: unmitigated, describe: describe, slots: slots, layout: layout, placeNames: placeNames, check: check, yAt: yAt };
  if (typeof document === 'undefined') return;            /* under Node (the unit tests) only the pure helpers are needed */

  /* =============================== the scene =============================== */
  var STRIP_H = 146, KEY_H = 52, KEY_W = 760;      /* the top strip (measures, caption, the numbered list) and the one-line key at the bottom */
  var SPEED = 230, DOT_R = 9;
  var D, W;
  var HALO = { stroke: '#0b0f17', 'stroke-width': 5, 'paint-order': 'stroke', 'stroke-linejoin': 'round' };
  var LINE = '#5b6a88';

  function derive(ctx) {
    var d = { threats: ctx.block('threats'), event: ctx.block('event'), consequences: ctx.block('consequences'), barriers: ctx.block('barriers'),
      attempts: ctx.block('attempts'), additions: ctx.block('additions'), steps: ctx.story.steps };
    check(d);
    d.s0 = statesBefore(d); d.s1 = statesAfter(d);
    d.num = {}; d.barriers.forEach(function (b, i) { d.num[b.id] = i + 1; });
    d.byId = {}; d.barriers.concat(d.threats, d.consequences).forEach(function (x) { d.byId[x.id] = x; });
    d.add = {}; d.additions.forEach(function (a) { d.add[a.barrier] = a; });
    d.r0 = reaching(d, d.s0); d.r1 = reaching(d, d.s1); d.u0 = unmitigated(d, d.s0); d.u1 = unmitigated(d, d.s1);
    var area = ctx.area;
    var box = { x: 24, y: 8 + STRIP_H + 14, w: 1872, h: area.h - (8 + STRIP_H + 14) - KEY_H - 20 };
    d.lay = layout(d, box, { evH: box.h - 8, attachStep: 116 });
    if (d.lay.minGap < MIN_GAP) throw new Error('bowtie: the bars on neighbouring lines are only ' + Math.round(d.lay.minGap) + ' px apart (needs ' + MIN_GAP + '): too many threats or consequences for the diagram area; split the story');
    return d;
  }

  function fade(ctx, el, to, t, dur) {
    var from = el.__v === undefined ? 0 : el.__v;
    if (from === to) return;
    ctx.tl.fromTo(el, { opacity: from }, { opacity: to, duration: dur === undefined ? 0.4 : dur, ease: 'power2.out' }, t);
    el.__v = to;
  }
  function halo(extra) { var a = {}, k; for (k in HALO) a[k] = HALO[k]; for (k in extra) a[k] = extra[k]; return a; }

  /* greedy word wrap at a font size, measured in the page */
  function wrap(ctx, parent, str, maxW, size, weight) {
    var probe = ctx.el('text', { 'class': 'sans', 'font-size': size, 'font-weight': weight, opacity: 0 }, parent), words = str.split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      var tryS = cur ? cur + ' ' + w : w;
      probe.textContent = tryS;
      if (cur && probe.getBBox().width > maxW) { lines.push(cur); cur = w; } else cur = tryS;
    });
    lines.push(cur);
    parent.removeChild(probe);
    return lines;
  }
  function textLines(ctx, parent, str, cx, cy, maxW, size, weight, fill, key, items) {
    var lines = wrap(ctx, parent, str, maxW, size, weight), lh = size * 1.28, y0 = cy - (lines.length - 1) * lh / 2 + size * 0.34;
    lines.forEach(function (s, i) {
      items.push(ctx.text.add(parent, s, { x: cx, y: y0 + i * lh, 'text-anchor': 'middle', 'font-size': size, 'font-weight': weight, fill: fill }, key + ':' + i));
    });
  }

  /* ---- one bar: three looks, told apart without colour: solid, thin dashed outline, empty outline ---- */
  function barShape(ctx, parent, state, p) {
    var C = ctx.THEME, a = { x: p.x - BAR_W / 2, y: p.y - BAR_H / 2, width: BAR_W, height: BAR_H, rx: 7 };
    if (state === 'strong') { a.fill = C.secure; a.stroke = C.bg; a['stroke-width'] = 2; }
    else if (state === 'weak') { a.fill = C.panel; a.stroke = C.token; a['stroke-width'] = 3; a['stroke-dasharray'] = '6 5'; }
    else { a.fill = 'none'; a.stroke = C.muted; a['stroke-width'] = 2; }
    var g = ctx.el('g', { opacity: 0 }, parent);
    ctx.el('rect', a, g);
    return g;
  }
  function plusMark(ctx, parent, cx, cy) {
    var g = ctx.el('g', { opacity: 0 }, parent);
    ctx.el('circle', { cx: cx, cy: cy, r: 11, fill: ctx.THEME.accent, stroke: ctx.THEME.bg, 'stroke-width': 2 }, g);
    ctx.el('path', { d: 'M' + (cx - 5) + ',' + cy + ' H' + (cx + 5) + ' M' + cx + ',' + (cy - 5) + ' V' + (cy + 5), stroke: ctx.THEME.bg, 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }, g);
    return g;
  }

  /* ---- pills: a short mark beside a barrier (the caption carries the words) ---- */
  function pill(ctx, key, x, y, str, color) {
    if (W.pills[key]) return W.pills[key];
    var g = ctx.el('g', { opacity: 0 }, W.Lfx), probe = ctx.el('text', { 'class': 'sans', 'font-size': 22, 'font-weight': 700, opacity: 0 }, g);
    probe.textContent = str;
    var w = Math.ceil(probe.getBBox().width) + 28;
    g.removeChild(probe);
    ctx.el('rect', { x: x - w / 2, y: y - 16, width: w, height: 32, rx: 16, fill: ctx.THEME.panel2, stroke: color, 'stroke-width': 3 }, g);
    ctx.text.add(g, str, { x: x, y: y + 7.5, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, fill: ctx.THEME.text }, 'pill:' + key).keep();
    g.__v = 0;
    return (W.pills[key] = g);
  }
  var OUT = { held: ['Held here', 'secure'], softened: ['Softened here', 'secure'], slips: ['Slips past', 'token'], absent: ['Not there', 'danger'] };
  function outcomePill(ctx, lane, bp, outcome, side) {
    var o = outcome === 'held' && side === 'mitigate' ? 'softened' : outcome;
    return pill(ctx, 'out:' + lane + ':' + bp.barrier + ':' + o, bp.x, bp.y - BAR_H / 2 - 18, OUT[o][0], ctx.THEME[OUT[o][1]]);
  }

  /* ---- build: the whole bow-tie in its first-state look; every lane hidden until the first step ---- */
  function build(ctx) {
    D = derive(ctx);
    var C = ctx.THEME, el = ctx.el, L = D.lay;
    W = { lane: {}, items: {}, bar: {}, pills: {}, names: {}, lit: {}, rings: {}, nBar: 0 };
    W.root = el('g', {}, ctx.layers.world);
    W.Llane = el('g', {}, W.root); W.Lev = el('g', {}, W.root); W.Ltxt = el('g', {}, W.root); W.Lfx = el('g', {}, W.root);

    function arrow(parent, x, y, dx, color) {
      el('polygon', { points: x + ',' + y + ' ' + (x - dx * 16) + ',' + (y - 9) + ' ' + (x - dx * 16) + ',' + (y + 9), fill: color }, parent);
    }
    Object.keys(L.lane).forEach(function (id) {
      var l = L.lane[id], rec = D.byId[id], g = el('g', { opacity: 0 }, W.Llane), tg = el('g', { opacity: 0 }, W.Ltxt), items = [];
      g.__v = 0; tg.__v = 0;
      el('path', { d: 'M' + l.x1 + ',' + l.y1 + ' L' + l.x2 + ',' + l.y2, stroke: LINE, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, g);
      var ang = Math.atan2(l.y2 - l.y1, l.x2 - l.x1);
      el('polygon', { points: '0,0 -16,-9 -16,9', fill: LINE, transform: 'translate(' + l.x2 + ',' + l.y2 + ') rotate(' + (ang * 180 / Math.PI) + ')' }, g);
      var r = l.box;
      el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 12, fill: C.panel, stroke: '#7284ab', 'stroke-width': 3 }, g);
      textLines(ctx, tg, rec.name, r.x + r.w / 2, r.y + r.h / 2, r.w - 28, 24, 650, C.text, 'name:' + id, items);
      W.bar[id] = [];
      L.bars[id].forEach(function (p) {
        var b = D.byId[p.barrier], a = D.add[b.id], shapes = {};
        shapes[b.state] = barShape(ctx, g, b.state, p);
        shapes[b.state].__v = 1; shapes[b.state].setAttribute('opacity', 1);
        if (a) { shapes[a.state] = barShape(ctx, g, a.state, p); shapes[a.state].__v = 0; }
        var mark = a ? plusMark(ctx, g, p.x + BAR_W / 2 - 2, p.y + BAR_H / 2 - 2) : null;
        if (mark) mark.__v = 0;
        items.push(ctx.text.add(tg, String(D.num[b.id]), halo({ x: p.x, y: p.y + 8, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 750 }), 'num:' + id + ':' + b.id));
        W.bar[id].push({ id: b.id, p: p, shapes: shapes, mark: mark });
      });
      items.unshift(ctx.group(g, 'lane:' + id));
      W.lane[id] = { g: g, tg: tg };
      W.items[id] = items;
    });

    /* the event: the knot in the middle */
    var ev = L.ev, eg = el('g', { opacity: 0 }, W.Lev), etg = el('g', { opacity: 0 }, W.Ltxt), eitems = [];
    eg.__v = 0; etg.__v = 0;
    el('rect', { x: ev.x, y: ev.y, width: ev.w, height: ev.h, rx: 40, fill: C.panel2, stroke: '#7284ab', 'stroke-width': 4 }, eg);
    textLines(ctx, etg, D.event[0].name, ev.x + ev.w / 2, ev.y + ev.h / 2, ev.w - 40, 28, 750, C.text, 'event', eitems);
    eitems.unshift(ctx.group(eg, 'event'));
    W.ev = { g: eg, tg: etg }; W.items.event = eitems;
    W.evRing = el('rect', { x: ev.x - 9, y: ev.y - 9, width: ev.w + 18, height: ev.h + 18, rx: 48, fill: 'none', stroke: C.danger, 'stroke-width': 7, opacity: 0 }, W.Lfx);
    W.evRing.__v = 0;
    W.dot = el('circle', { cx: 0, cy: 0, r: DOT_R, fill: C.danger, stroke: C.bg, 'stroke-width': 2, opacity: 0 }, W.Lfx);
    W.dot.__v = 0;

    /* fixed panels: the headlines, the label panel, the legend (all hidden until a step shows them) */
    var sy = ctx.area.y + 8;
    W.m1 = ctx.hud.measure({ label: 'Threat paths reaching the event', value: ctx.count(0, D.r0.of), color: C.danger, rect: { x: 28, y: sy, w: 430, h: STRIP_H } });
    W.m2 = ctx.hud.measure({ label: 'Consequences left unmitigated', value: ctx.count(0, D.u0.of), color: C.token, rect: { x: 478, y: sy, w: 430, h: STRIP_H } });
    W.cap = ctx.hud.caption({ x: 928, y: sy, w: 964, h: STRIP_H });
    numberedList(ctx, { x: 28, y: sy, w: 880, h: STRIP_H });
    legend(ctx);
  }

  /* the full numbered list of barriers, two columns, in the strip where the measures stand (first and last step only) */
  function numberedList(ctx, rect) {
    var C = ctx.THEME, per = Math.ceil(D.barriers.length / 2), colW = rect.w / 2;
    W.list = ctx.hud.panel(rect);
    D.barriers.forEach(function (b, i) {
      var col = Math.floor(i / per), row = i % per, x = 22 + col * colW, y = 30 + row * 27;
      ctx.text.add(W.list.body, String(D.num[b.id]), { x: x + 28, y: y, 'text-anchor': 'end', 'font-size': 21, 'font-weight': 750, fill: C.muted }, 'list-num:' + b.id).keep();
      ctx.text.add(W.list.body, b.name, { x: x + 42, y: y, 'font-size': 21, 'font-weight': 600, fill: C.text }, 'list-name:' + b.id).keep();
    });
  }

  function legend(ctx) {
    var C = ctx.THEME;
    function mini(state) {
      return function (g, box) {
        var a = { x: box.w / 2 - 9, y: 1, width: 18, height: box.h - 2, rx: 4 };
        if (state === 'strong') { a.fill = C.secure; a.stroke = C.bg; a['stroke-width'] = 1; }
        else if (state === 'weak') { a.fill = C.panel; a.stroke = C.token; a['stroke-width'] = 3; a['stroke-dasharray'] = '5 4'; }
        else { a.fill = 'none'; a.stroke = C.muted; a['stroke-width'] = 2; }
        ctx.el('rect', a, g);
      };
    }
    var rows = [
      { label: 'Holds', swatch: mini('strong'), color: C.secure },
      { label: 'Weak, lets through', swatch: mini('weak'), color: C.token },
      { label: 'Missing', swatch: mini('missing'), color: C.muted },
      { label: 'New', swatch: function (g, box) {
        ctx.el('circle', { cx: box.w / 2, cy: box.h / 2, r: 11, fill: C.accent }, g);
        ctx.el('path', { d: 'M' + (box.w / 2 - 5) + ',' + box.h / 2 + ' H' + (box.w / 2 + 5) + ' M' + box.w / 2 + ',' + (box.h / 2 - 5) + ' V' + (box.h / 2 + 5), stroke: C.bg, 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }, g);
      }, color: C.accent }
    ];
    W.leg = ctx.hud.legend(rows, { direction: 'row', rect: { x: 28, y: ctx.area.y + ctx.area.h - KEY_H - 6, w: KEY_W, h: KEY_H }, gap: 30, swatchW: 34 });
  }

  /* ---- helpers shared by the steps ---- */
  function laneItems(ids2) { return ids2.map(function (id) { return W.items[id]; }); }
  function shownAll(ctx, recs, t) { recs.forEach(function (x) { ctx.shown(x, t, Infinity); }); }
  function showLane(ctx, key, t) {
    var o = key === 'event' ? W.ev : W.lane[key];
    fade(ctx, o.g, 1, t, 0.5); fade(ctx, o.tg, 1, t, 0.5);
  }
  function barOf(laneId, barrierId) { return W.bar[laneId].filter(function (b) { return b.id === barrierId; })[0]; }
  function hide2(ctx, el, t, dur) { fade(ctx, el, 0, t, dur === undefined ? 0.4 : dur); }

  /* the names of a group of bars, beside the bars, shown together; one group per key (built once, faded as often as asked) */
  var probeText = null;
  function nameWidth(ctx, str) {
    if (!probeText) probeText = ctx.el('text', { 'class': 'sans', 'font-size': 22, 'font-weight': 650, opacity: 0 }, W.Ltxt);
    probeText.textContent = str;
    return Math.ceil(probeText.getBBox().width);
  }
  function barNames(ctx, key, picks, pillLanes) {
    if (W.names[key]) return W.names[key];
    var C = ctx.THEME, g = ctx.el('g', { opacity: 0 }, W.Ltxt);
    g.__v = 0;
    placeNames(D, D.lay, picks, function (str) { return nameWidth(ctx, str); }, pillLanes).forEach(function (n) {
      n.lines.forEach(function (str, i) {
        ctx.text.add(g, str, halo({ x: n.x, y: n.y + i * 27, 'text-anchor': n.a, 'font-size': 22, 'font-weight': 650, fill: C.text }), 'bar-name:' + key + ':' + n.barrier + ':' + i).keep();
      });
    });
    return (W.names[key] = g);
  }
  function lanePicks(lane, only) {
    return D.lay.bars[lane].filter(function (p) { return !only || only.indexOf(p.barrier) >= 0; }).map(function (p) { return { lane: lane, barrier: p.barrier }; });
  }
  /* a barrier on several lines is named once, on the first line it stands on */
  function oncePicks(bids) { return bids.map(function (b) { return { lane: D.byId[b].on[0], barrier: b }; }); }

  /* an attempt: a slow unlabelled dot travels the threat's line (never over SPEED px/s) and stops at the first strong barrier
     with a "Held here" mark, or passes the weak and missing ones with their marks and reaches the event. The caption says
     it. Returns times relative to nothing: absolute seconds in the master timeline. */
  function attempt(ctx, threat, t0, o) {
    o = o || {};
    var T = ctx.timing, l = D.lay.lane[threat], tr = trace(pathOf(D, threat), o.states || D.s0), t = t0;
    var cx = l.x1 + 6, cy = l.y1, text = describe(tr), nm = barNames(ctx, 'att:' + threat, lanePicks(threat));
    fade(ctx, nm, 1, t0 + 0.1, 0.4);
    ctx.tl.fromTo(W.dot, { opacity: 0, x: cx, y: cy }, { opacity: 1, x: cx, y: cy, duration: 0.3, ease: 'power2.out' }, t);
    W.dot.__v = 1;
    t += 0.4;
    var firstStop = t, pills = [];
    function move(x, dur0) {
      var y = yAt(l, x), dur = Math.max(dur0 || 0.8, Math.hypot(x - cx, y - cy) / SPEED);
      ctx.tl.fromTo(W.dot, { x: cx, y: cy }, { x: x, y: y, duration: dur, ease: 'none' }, t);
      cx = x; cy = y; t += dur;
    }
    var say = null;
    tr.stops.forEach(function (s, i) {
      var bp = L_bar(threat, s.barrier.id);
      move(bp.x - BAR_W / 2 - DOT_R - 8);
      if (i === 0) say = W.cap.say(text, Math.max(t0 + 0.3, t - 0.6), { head: D.byId[threat].name, last: !!o.last });
      var pl = outcomePill(ctx, threat, bp, s.outcome, 'prevent');
      fade(ctx, pl, 1, t, 0.3); pills.push(pl);
      if (s.outcome === 'held') {
        ctx.tl.fromTo(W.dot, { opacity: 1 }, { opacity: 0.35, duration: 0.4 }, t + 0.1);
        t += 0.6;
      } else {
        t += 0.5;
        move(bp.x + BAR_W / 2 + DOT_R + 8, 0.5);
      }
    });
    var arrive = null;
    if (tr.reached) {
      move(l.x2 - 4, 0.8);
      arrive = t;
      fade(ctx, W.evRing, 1, t, 0.4);
    }
    fade(ctx, W.dot, 0, t + 0.5, 0.4);
    var end = t + 0.3, c = say;
    var out = { end: end, arrive: arrive, first: 0.3, say: c, tr: tr, cleanup: Math.max(c.visible, end) + c.hold, pills: pills, names: nm };
    return out;
  }
  function L_bar(laneId, barrierId) { return D.lay.bars[laneId].filter(function (p) { return p.barrier === barrierId; })[0]; }
  function cleanup(ctx, at, a) {
    a.pills.forEach(function (p) { fade(ctx, p, 0, at, 0.4); });
    fade(ctx, a.names, 0, at, 0.4);
    fade(ctx, W.evRing, 0, at, 0.4);
  }
  /* what the last attempt of a step shows stays through the step's rest and goes at the start of the next step */
  function cleanupAtEnd(ctx, a) { ctx.atStepEnd(function (e) { cleanup(ctx, e.t, a); }); }

  /* fanOut: the consequence lines light from the event as far as their strong barriers; what is reached is marked */
  function fanOut(ctx, t0) {
    var C = ctx.THEME, res = { end: t0, pills: [], reached: [], softened: [] }, T = ctx.timing;
    D.consequences.forEach(function (c) {
      var l = D.lay.lane[c.id], tr = trace(pathOf(D, c.id), D.s0), bp = null, xEnd = l.x2 - 2;
      if (tr.stopAt >= 0) { bp = L_bar(c.id, tr.stops[tr.stopAt].barrier.id); xEnd = bp.x - BAR_W / 2 - 4; }
      var len = Math.hypot(xEnd - l.x1, yAt(l, xEnd) - l.y1), dur = Math.max(1.6, len / SPEED);
      var g = W.lit[c.id] = ctx.el('g', { opacity: 0 }, W.Lfx);
      var line = ctx.el('path', { d: 'M' + l.x1 + ',' + l.y1 + ' L' + xEnd + ',' + yAt(l, xEnd), stroke: C.danger, 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round' }, g);
      fade(ctx, g, 1, t0, 0.01);
      ctx.tl.fromTo(line, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: dur, ease: 'none' }, t0);
      tr.stops.forEach(function (s) {
        var p = L_bar(c.id, s.barrier.id), at = t0 + dur * Math.min(1, Math.max(0, (p.x - l.x1) / (xEnd - l.x1)));
        var pl = outcomePill(ctx, c.id, p, s.outcome, 'mitigate');
        fade(ctx, pl, 1, s.outcome === 'held' ? t0 + dur : at, 0.3); res.pills.push(pl);
      });
      if (tr.reached) {
        var r = l.box, rg = ctx.el('rect', { x: r.x - 6, y: r.y - 6, width: r.w + 12, height: r.h + 12, rx: 16, fill: 'none', stroke: C.danger, 'stroke-width': 7, opacity: 0 }, W.Lfx);
        rg.__v = 0; fade(ctx, rg, 1, t0 + dur, 0.4); res.pills.push(rg);
        var pl2 = pill(ctx, 'reach:' + c.id, r.x + r.w / 2, r.y - 24, 'Reached', C.danger);
        fade(ctx, pl2, 1, t0 + dur, 0.3); res.pills.push(pl2);
        res.reached.push(c);
      } else res.softened.push(c);
      res.pills.push(g);
      res.end = Math.max(res.end, t0 + dur);
    });
    res.arrive = res.end;
    return res;
  }

  function land(ctx, barrierIds, t0) {
    var C = ctx.THEME, end = t0;
    barrierIds.forEach(function (bid) {
      var a = D.add[bid], b = D.byId[bid];
      Object.keys(W.bar).forEach(function (lid) {
        var inst = barOf(lid, bid);
        if (!inst) return;
        fade(ctx, inst.shapes[b.state], 0, t0, 0.8);
        fade(ctx, inst.shapes[a.state], 1, t0, 0.8);
        fade(ctx, inst.mark, 1, t0 + 0.4, 0.5);
        var pl = pill(ctx, 'add:' + lid + ':' + bid, inst.p.x, inst.p.y - BAR_H / 2 - 18, a.change === 'new' ? 'New' : 'Stronger', C.accent);
        fade(ctx, pl, 1, t0 + 0.6, 0.3);
        (land.pills = land.pills || []).push(pl);
      });
      end = Math.max(end, t0 + 1.2);
    });
    return end;
  }

  /* ---- the steps ---- */
  function attemptsOf(step) { return D.attempts.filter(function (a) { return a.step === step; }); }
  function sequence(ctx, step, t0, r, states) {
    var list = attemptsOf(step), cur = t0 + r, results = [];
    list.forEach(function (a, i) {
      var last = i === list.length - 1;
      ctx.shown(a, cur, Infinity);
      var res = attempt(ctx, a.threat, cur, { states: states, last: last });
      results.push(res);
      if (res.arrive !== null) {
        W.nReach++;
        W.m1.to(ctx.count(W.nReach, D.r0.of), res.arrive + 0.2, ctx.timing.QUANTITY_MIN);
      }
      if (!last) { cleanup(ctx, res.cleanup, res); cur = res.cleanup + 0.3; }
    });
    return results;
  }

  var ACT = {
    picture: function (ctx, st, t0) {
      shownAll(ctx, D.threats.concat(D.event, D.consequences, D.barriers), t0 + 0.3);
      var n = 0, t = t0 + 0.3;
      showLane(ctx, 'event', t); t += 0.3;
      D.threats.forEach(function (x) { showLane(ctx, x.id, t + n++ * 0.25); });
      D.consequences.forEach(function (x) { showLane(ctx, x.id, t + n++ * 0.25); });
      W.leg.show(t0 + 0.8, 0.5);
      W.list.show(t0 + 0.8, 0.5);
      var c = W.cap.say('Barriers stand on every line, before the event and after it.', t0 + 1.0, { head: 'How to read it', last: true });
      var fin = Math.max(c.visible, t0 + 0.3 + n * 0.25 + 0.8);
      ctx.atStepEnd(function (e) { W.list.hide(e.t, 0.4); });
      return { end: fin - t0, first: 0.3, hold: c.hold };
    },
    held: function (ctx, st, t0) {
      ctx.emphasise(laneItems(attemptsOf(st.id).map(function (a) { return a.threat; })), t0 + 0.1);
      W.m1.show(t0 + 0.7); W.m2.show(t0 + 0.7);
      var r = sequence(ctx, st.id, t0, 0.6, D.s0)[0];
      cleanupAtEnd(ctx, r);
      return { end: Math.max(r.end, r.say.visible) - t0, first: 0.6, hold: r.say.hold };
    },
    through: function (ctx, st, t0) {
      var as = attemptsOf(st.id).map(function (a) { return a.threat; });
      ctx.emphasise(laneItems(as.concat('event')), t0 + 0.1);
      W.nReach = 0;
      var rs = sequence(ctx, st.id, t0, 0.8, D.s0), r = rs[rs.length - 1];
      cleanupAtEnd(ctx, r);
      return { end: Math.max(r.end, r.say.visible) - t0, first: 0.8, hold: r.say.hold };
    },
    cost: function (ctx, st, t0) {
      ctx.emphasise(laneItems(['event'].concat(D.consequences.map(function (c) { return c.id; }))), t0 + 0.1);
      var f = fanOut(ctx, t0 + 0.8), nm = barNames(ctx, 'cost', oncePicks(D.barriers.filter(function (b) { return b.side === 'mitigate'; }).map(function (b) { return b.id; })));
      fade(ctx, nm, 1, t0 + 0.8, 0.5);
      W.m2.to(ctx.count(f.reached.length, D.u0.of), f.arrive + 0.2, ctx.timing.QUANTITY_MIN);
      var names = function (list) { return list.map(function (c) { return lower(c.name); }).join(' and '); };
      var text = f.reached.length ? names(f.reached) + ' is reached; ' + names(f.softened) + ' softened.' : 'Every consequence is softened.';
      text = text.charAt(0).toUpperCase() + text.slice(1);
      var c = W.cap.say(text, f.arrive + 0.2, { head: 'What the leak costs', last: true });
      var fin = Math.max(f.arrive + ctx.timing.QUANTITY_MIN + 0.2, c.visible);
      ctx.atStepEnd(function (e) { f.pills.concat(nm).forEach(function (p) { fade(ctx, p, 0, e.t, 0.4); }); });
      return { end: fin - t0, first: 0.8, hold: c.hold };
    },
    add: function (ctx, st, t0) {
      var T = ctx.timing, lanesOf = function (bid) { return D.byId[bid].on; }, aLeast = D.additions[0], aDetect = D.additions[1];
      var items = lanesOf(aLeast.barrier).concat(lanesOf(aDetect.barrier), 'event');
      ctx.emphasise(laneItems(items), t0 + 0.1);
      shownAll(ctx, D.additions, t0 + 0.3);
      var tl = t0 + 0.6, res;
      /* 1. the new barrier lands */
      var end1 = land(ctx, [aLeast.barrier], tl), b1 = D.byId[aLeast.barrier];
      var c1 = W.cap.say(b1.name + '. Owner: ' + b1.owner + '.', tl + 0.3, { head: 'Added' });
      var n1 = barNames(ctx, 'add:' + aLeast.barrier, oncePicks([aLeast.barrier]), D.byId[aLeast.barrier].on);
      fade(ctx, n1, 1, tl + 0.4, 0.4);
      /* 2. the same attempt, replayed, is held */
      var at = attemptsOf(st.id)[0], t2 = Math.max(c1.readyAt, end1 + 0.8);
      land.pills.forEach(function (p) { fade(ctx, p, 0, t2 - 0.3, 0.3); });
      fade(ctx, n1, 0, t2 - 0.3, 0.3);
      res = attempt(ctx, at.threat, t2, { states: D.s1 });
      ctx.shown(at, t2, Infinity);
      W.m1.to(ctx.count(D.r1.n, D.r0.of), res.end + 0.2, T.QUANTITY_MIN);
      cleanup(ctx, res.cleanup, res);
      /* 3. the weak mitigation is strengthened */
      var b2 = D.byId[aDetect.barrier], t3 = res.cleanup + 0.4;
      var end3 = land(ctx, [aDetect.barrier], t3);
      var c3 = W.cap.say(b2.name + '. Owner: ' + b2.owner + '.', t3 + 0.3, { head: 'Strengthened', last: true });
      W.m2.to(ctx.count(D.u1.n, D.u0.of), t3 + 1.0, T.QUANTITY_MIN);
      var fin = Math.max(c3.visible, t3 + 1.0 + T.QUANTITY_MIN);
      var n3 = barNames(ctx, 'add:' + aDetect.barrier, oncePicks([aDetect.barrier]), D.byId[aDetect.barrier].on);
      fade(ctx, n3, 1, t3 + 0.4, 0.4);
      var landed = land.pills.slice(-2);
      ctx.atStepEnd(function (e) { landed.concat(n3).forEach(function (p) { fade(ctx, p, 0, e.t, 0.4); }); });
      return { end: fin - t0, first: 0.6, hold: c3.hold };
    },
    layers: function (ctx, st, t0) {
      var t = t0 + 0.3, first = true, c, res = null;
      D.threats.forEach(function (th, i) {
        var path = pathOf(D, th.id), states = D.s1, last = i === D.threats.length - 1;
        ctx.emphasise(laneItems([th.id, 'event']), t);
        var names = path.map(function (b) { return lower(b.name); });
        var text = names.join(', then ') + '.';
        text = text.charAt(0).toUpperCase() + text.slice(1);
        c = W.cap.say(text, t + 0.3, { head: th.name + ': the layers in its way', last: last });
        t = c.readyAt;
        res = c;
      });
      ctx.emphasise('all', res.visible + 0.3);
      W.m1.hide(t0 + 0.2, 0.4); W.m2.hide(t0 + 0.2, 0.4);
      W.list.show(t0 + 0.8, 0.5);
      return { end: res.visible - t0, first: 0.3, hold: res.hold };
    }
  };

  EXK.scenes.bowtie = {
    build: build,
    step: function (ctx, st, t0) {
      var r = ACT[st.act](ctx, st, t0);
      return { end: r.end, firstMotion: r.first, hold: r.hold };
    }
  };
})();
