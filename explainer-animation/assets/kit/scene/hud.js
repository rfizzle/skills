/* HUD primitives for custom scenes (ctx.hud): fixed panels drawn in stage space with the theme's tokens, every text
   registered with the text layer (data-ov, so the overlap check sees it). Each one starts hidden; show/hide are
   fromTo tweens on the master timeline. Rects are stage px {x, y, w, h}; the diagram area starts at ctx.area.y.
   Numbers are never typed into these helpers: a headline reads ctx.figure(key) or a ctx.count(n, of) (the build warns
   about a number typed into the text of a HUD call).

     hud.panel(rect, {radius?}) -> {g, body, rect, show(t, dur), hide(t, dur), border(color, t, dur)}
         body is a <g> at the panel's top-left: draw the content at local coordinates
     hud.measure({label, key | value, of?, suffix?, sub?, color?, rect?}) -> {panel, show, hide, border, to(v, t, dur), tint(color, t, dur)}
         a headline number, 54 px, that stays in one place and changes by counting. value: a ctx.count(n, of) (reads
         "n of of"), a ctx.figure(key) handle, or a number computed in the scene (never a literal: the build warns);
         of: false drops " of M" from a count; to(v) takes a number or a ctx.count; tint(color, t, dur) changes the
         number's colour over time (a count of problems that reaches zero turns to the secure colour)
     hud.banner(text, color, {rect?}) -> {show, hide, hideAtStepEnd(dur?)}   a pill naming the state shown (28 px); hideAtStepEnd
         keeps it through the step's rest and fades it at the start of the next step (not on the last)
     hud.legend(rows, {title?, rect?, staged?, direction?: 'column' | 'row', gap?, swatchW?}) -> {panel, show, hide, rows}
         rows: [{label, color?, shape?: 'dot' | 'bar', swatch?, count?, countOf?, countColor?, staged?}], handle per row
         {g, show(t, dur), count(v, t, dur)}. swatch: an SVG fragment string or a callback (g, {w, h}) drawing in a
         swatchW x 30 box (default 46); count: a ctx.count(n, of) that can change later with row.count(ctx.count(n, of), t);
         direction 'row' lays items left to right and wraps to a new line when one does not fit rect.w (rect.h must hold
         the lines: the call says how tall); staged on a row overrides staged on the legend
     hud.caption(rect | panel, {radius?}) -> {panel, say(text, t, {head?, last?}), clear(t), hide(t), show(t), readyAt()}
         text that changes over time in one place: a small heading and a sentence (shrunk to fit). say() shows the panel if
         it is hidden, fades the old text out and the new one in (two seek-safe fromTo tweens, never visible together) and
         returns {visible, hold, readyAt}: a text may not be replaced or cleared before readyAt (it stays readable standing
         still for ctx.timing.holdFor(text), or lastHoldFor when last: true); an earlier call throws. Every state is
         registered with the text layer, so the overlap check sees it. The last text said in a step stays through the step's
         rest (stills and clip endings are taken there); clear(t) and hide(t) asked for before rest take effect at the start
         of the next step, and a step that says nothing clears the old text and hides the panel at its start. run() throws at
         boot when the panel is on screen with no text at some step's rest */
(function () {
  'use strict';
  var EXK = window.EXK, T = EXK.timing, C = EXK.THEME, U = EXK.util;

  EXK.makeHud = function (o) {
    var ctx = o.ctx, layer = o.layer, tl = o.tl, ledger = o.ledger, area = ctx.area;
    function fixed(parent, str, attrs, key) { return ctx.text.add(parent, str, attrs, key).keep(); }     /* HUD text is never dimmed */
    function svg(tag, attrs, parent) { return U.el('svg:' + tag, attrs, parent); }
    function fadeIn(g, t, dur) { tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: dur == null ? 0.6 : dur, ease: 'power2.out' }, t); }
    function fadeOut(g, t, dur) { tl.fromTo(g, { opacity: 1 }, { opacity: 0, duration: dur == null ? 0.4 : dur, ease: 'power1.in' }, t); }

    function panel(rect, opts) {
      var g = svg('g', { opacity: 0 }, layer);
      var box = svg('rect', { x: rect.x, y: rect.y, width: rect.w, height: rect.h, rx: (opts && opts.radius) || 18, fill: C.panel, stroke: C.line, 'stroke-width': 3 }, g);
      var body = svg('g', { transform: 'translate(' + rect.x + ',' + rect.y + ')' }, g);
      return {
        g: g, body: body, rect: rect,
        show: function (t, dur) { fadeIn(g, t, dur); },
        hide: function (t, dur) { fadeOut(g, t, dur); },
        border: function (color, t, dur) { tl.fromTo(box, { stroke: C.line }, { stroke: color, duration: dur == null ? 0.6 : dur }, t); }
      };
    }

    function measure(spec) {
      var st = EXK.patterns.custom.measureStart(spec, ledger.figure), fig = st.fig, start = st.n, of = st.of;
      var label = spec.label !== undefined ? spec.label : (fig ? fig.label : '');
      var rect = spec.rect || { x: 28, y: area.y + 12, w: 350, h: spec.sub ? 152 : 118 };
      var p = panel(rect), color = spec.color || C.text;
      function fmt(v) { return Math.round(v) + (of != null ? ' of ' + of : '') + (spec.suffix || ''); }
      fixed(p.body, label, { x: 18, y: 36, fill: C.muted, 'font-size': 22, 'font-weight': 600 }, 'measure-title');
      var val = fixed(p.body, fmt(start), { x: 18, y: 98, fill: color, 'font-size': 54, 'font-weight': 750 }, 'measure-value');
      if (spec.sub) fixed(p.body, spec.sub, { x: 18, y: 138, fill: C.muted, 'font-size': 22 }, 'measure-sub');
      var cur = start, proxy = { v: start }, open = null, ink = color;
      return {
        panel: p, item: val,
        show: function (t, dur) {
          p.show(t, dur);
          if (fig) open = ledger.note(fig, t, Infinity);
        },
        hide: function (t, dur) { p.hide(t, dur); if (open) open.to = t; },
        border: p.border,
        tint: function (c, t, dur) {
          tl.fromTo(val.el, { fill: ink }, { fill: c, duration: dur == null ? 0.6 : dur, ease: 'power1.inOut' }, t);
          ink = c;
        },
        to: function (v, t, dur) {
          var from = cur, n = v;
          if (v && typeof v === 'object') { n = v.n; of = v.of; }
          tl.fromTo(proxy, { v: from }, { v: n, duration: dur == null ? T.QUANTITY_MIN : dur, ease: 'power2.inOut', onUpdate: function () { val.el.textContent = fmt(proxy.v); } }, t);
          cur = n;
        }
      };
    }

    function banner(text, color, opts) {
      var col = color || C.accent, r = (opts && opts.rect) || { x: 28, y: area.y + 12, h: 52 };
      var g = svg('g', { opacity: 0 }, layer);
      var box = svg('rect', { x: r.x, y: r.y, height: r.h || 52, rx: 26, fill: C.panel, stroke: col, 'stroke-width': 3 }, g);
      svg('circle', { cx: r.x + 30, cy: r.y + (r.h || 52) / 2, r: 7, fill: col }, g);
      var it = fixed(g, text, { x: r.x + 50, y: r.y + (r.h || 52) / 2 + 10, fill: col, 'font-size': 28, 'font-weight': 650 }, 'banner:' + text);
      box.setAttribute('width', Math.ceil(it.el.getBBox().width) + 50 + 24);
      return { item: it, show: function (t, dur) { fadeIn(g, t, dur); }, hide: function (t, dur) { fadeOut(g, t, dur); },
        hideAtStepEnd: function (dur) { ctx.atStepEnd(function (e) { fadeOut(g, e.t, dur); }); } };
    }

    var probeEl = null;
    function textW(str, px, weight) {
      if (!probeEl) probeEl = svg('text', { 'class': 'sans', opacity: 0, visibility: 'hidden' }, layer);
      probeEl.setAttribute('font-size', px); probeEl.setAttribute('font-weight', weight);
      probeEl.textContent = str;
      return Math.ceil(probeEl.getBBox().width);
    }
    function fragment(g, markup) {
      var doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + markup + '</svg>', 'image/svg+xml');
      Array.prototype.slice.call(doc.documentElement.childNodes).forEach(function (n) { g.appendChild(document.importNode(n, true)); });
    }

    function legend(rows, opts) {
      opts = opts || {};
      var dir = opts.direction || 'column', rowH = 44, swW = opts.swatchW || 46, SW_H = 30;
      if (dir !== 'row' && dir !== 'column') throw new Error('hud.legend: direction is "row" or "column", not "' + dir + '"');
      var top = opts.title ? 40 : (dir === 'row' ? 4 : 14), bottom = dir === 'row' ? 4 : 10;
      var info = rows.map(function (r) {
        var sw = r.swatch ? swW : 28, lw = textW(r.label, 24, 600), cnt = r.count, cn = null, cw = 0;
        if (cnt !== undefined) {
          cn = cnt && typeof cnt === 'object' ? cnt : { n: cnt, of: null };
          cw = textW(String(r.countOf ? cn.n + ' of ' + cn.of : (cn.of != null ? cn.of : cn.n)), 24, 750);
        }
        return { sw: sw, lw: lw, cn: cn, cw: cw, w: sw + (r.swatch ? 12 : 16) + lw + (cn ? 14 + cw : 0) };
      });
      var width = opts.rect ? opts.rect.w : (dir === 'row' ? 1864 : 340);
      var lay = EXK.patterns.custom.legendLayout({ widths: info.map(function (i) { return i.w; }), width: width, direction: dir, gap: opts.gap, rowH: rowH, top: top, bottom: bottom });
      var rect = opts.rect || { x: 28, y: area.y + area.h - lay.height - (dir === 'row' ? 6 : 12), w: width, h: lay.height };
      if (lay.height > rect.h + 1e-9) throw new Error('hud.legend: the rows need ' + lay.lines + ' line(s) and a panel ' + lay.height + ' px tall in a ' + rect.w + ' px width; the rect is ' + rect.h + ' px tall. Make rect.h at least ' + lay.height + ', or widen it');
      var dy = dir === 'row' && opts.rect && !opts.title ? Math.max(0, (rect.h - lay.height) / 2) : 0;     /* a row in a tall rect sits in its middle */
      var p = panel(rect, dir === 'row' ? { radius: 14 } : undefined);
      if (opts.title) fixed(p.body, opts.title, { x: 18, y: 34, fill: C.muted, 'font-size': 22, 'font-weight': 600 }, 'legend-title');
      var handles = rows.map(function (r, i) {
        var at = lay.pos[i], f = info[i], cy = at.y + dy + 21, staged = r.staged !== undefined ? r.staged : opts.staged;
        var g = svg('g', staged ? { opacity: 0 } : {}, p.body), lx = at.x + f.sw + (r.swatch ? 12 : 16), h = { g: g };
        if (r.swatch) {
          var sg = svg('g', { transform: 'translate(' + at.x + ',' + (cy - SW_H / 2) + ')' }, g);
          if (typeof r.swatch === 'function') r.swatch(sg, { w: f.sw, h: SW_H }); else fragment(sg, String(r.swatch));
        } else if (r.shape === 'bar') svg('rect', { x: at.x, y: cy - 7, width: 28, height: 14, rx: 4, fill: r.color }, g);
        else svg('circle', { cx: at.x + 14, cy: cy, r: 8, fill: r.color }, g);
        fixed(g, r.label, { x: lx, y: cy + 9, 'font-size': 24, 'font-weight': 600 }, 'legend:' + r.label);
        h.show = function (t, dur) { fadeIn(g, t, dur); };
        if (f.cn) {
          var ccol = r.countColor || r.color || C.text, cof = f.cn.of, cur = f.cn.n, proxy = { v: cur };
          var fmtc = function (v) { return Math.round(v) + (r.countOf && cof != null ? ' of ' + cof : ''); };
          var ct = fixed(g, fmtc(cur), { x: lx + f.lw + 14, y: cy + 9, 'font-size': 24, 'font-weight': 750, fill: ccol }, 'legend-count:' + r.label);
          h.count = function (v, t, dur) {
            var n = v && typeof v === 'object' ? v.n : v, from = cur;
            if (v && typeof v === 'object') cof = v.of;
            tl.fromTo(proxy, { v: from }, { v: n, duration: dur == null ? T.QUANTITY_MIN : dur, ease: 'power2.inOut', onUpdate: function () { ct.el.textContent = fmtc(proxy.v); } }, t);
            cur = n;
          };
        }
        return h;
      });
      return { panel: p, rows: handles, show: p.show, hide: p.hide };
    }

    /* caption: text that changes over time in one place (a heading and a sentence); the clock decides when it may change.
       The rest rule lives here: the last text said in a step stays through the step's rest; a clear or hide asked for before
       rest waits for the next step (replaced by its first say, or cleared at its start when it says nothing). */
    function caption(target, opts) {
      var p = target && target.body && target.rect ? target : panel(target, opts), rect = p.rect;
      var clock = EXK.patterns.custom.captionClock(T), on = false, n = 0, cur = null;
      var log = [], pend = null, carry = null, saidIn = -1;
      p.g.setAttribute('data-caption', '');                  /* marks the panel for the rest-frame check */
      function make(text, head) {
        n++;
        var els = [];
        if (head) els.push(fixed(p.body, head, { x: 22, y: 36, 'font-size': 22, 'font-weight': 600, fill: C.muted, opacity: 0 }, 'caption-head:' + n).el);
        var b = fixed(p.body, text, { x: 22, y: head ? 86 : rect.h / 2 + 10, 'font-size': 30, 'font-weight': 650, opacity: 0 }, 'caption:' + n);
        for (var s = 30; s > 24 && b.el.getBBox().width > rect.w - 44; s--) b.el.setAttribute('font-size', s - 1);
        els.push(b.el);
        return els;
      }
      function tween(els, from, to, t, dur) { tl.fromTo(els, { opacity: from }, { opacity: to, duration: dur, ease: 'power2.out' }, t); }
      function setPanel(want, t, dur) {
        if (want === on) return;
        on = want; log.push({ kind: 'panel', on: want, t: t });
        if (want) p.show(t, 0.4); else p.hide(t, dur || 0.35);
      }
      function applyClear(t, hide) {
        var c = clock.clear(t);
        if (c) { if (cur) { tween(cur, 1, 0, c.outAt, c.outDur); cur = null; } log.push({ kind: 'clear', start: c.outAt }); }
        if (hide) setPanel(false, t, 0.25);
      }
      function ask(what, t, hide) { clock.check(what, t); pend = { t: t, hide: hide || (pend && pend.hide) }; }
      var api = {
        panel: p, log: log,
        say: function (text, t, o) {
          if (typeof o === 'string') o = { head: o };
          o = o || {};
          if (pend) { applyClear(pend.t, pend.hide); pend = null; }
          if (carry) { applyClear(Math.max(ctx.stepStart, clock.readyAt()), carry.hide); carry = null; }
          var c = clock.say(text, t, !!o.last), els = make(text, o.head);
          if (c.outAt !== null && cur) tween(cur, 1, 0, c.outAt, c.outDur);
          setPanel(true, c.inAt);
          tween(els, 0, 1, c.inAt, c.inDur);
          log.push({ kind: 'say', start: c.outAt !== null ? c.outAt : c.inAt, visible: c.visible });
          cur = els; saidIn = ctx.stepIndex;
          return { visible: c.visible, hold: c.hold, readyAt: c.readyAt };
        },
        clear: function (t) { ask('clear', t, false); },
        show: function (t) { setPanel(true, t); },
        hide: function (t) { ask('hide', t, true); },
        readyAt: clock.readyAt,
        /* the seam calls this when a step's length and rest are known */
        endStep: function (e) {
          if (saidIn === e.index) {
            if (pend) {
              if (pend.t >= e.rest - 1e-9) applyClear(pend.t, pend.hide);
              else if (!e.last) carry = { hide: pend.hide };
              pend = null;
            }
          } else if (carry || cur) {
            applyClear(Math.max(e.t0, clock.readyAt()), carry ? carry.hide : true);
            carry = null; pend = null;
          }
        }
      };
      if (o.captions) o.captions.push(api);
      return api;
    }

    return { panel: panel, measure: measure, banner: banner, legend: legend, caption: caption };
  };
})();
