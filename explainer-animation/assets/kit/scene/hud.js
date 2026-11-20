/* HUD primitives for custom scenes (ctx.hud): fixed panels drawn in stage space with the theme's tokens, every text
   registered with the text layer (data-ov, so the overlap check sees it). Each one starts hidden; show/hide are
   fromTo tweens on the master timeline. Rects are stage px {x, y, w, h}; the diagram area starts at ctx.area.y.
   Numbers are never typed into these helpers: a headline reads ctx.figure(key) or a ctx.count(n, of) (the build warns
   about a number typed into the text of a HUD call).

     hud.panel(rect, {radius?}) -> {g, body, rect, show(t, dur), hide(t, dur), border(color, t, dur)}
         body is a <g> at the panel's top-left: draw the content at local coordinates
     hud.measure({label, key | value, of?, suffix?, sub?, color?, rect?}) -> {panel, show, hide, border, to(v, t, dur)}
         a headline number, 54 px, that stays in one place and changes by counting; value may be a ctx.count(n, of)
     hud.banner(text, color, {rect?}) -> {show, hide}       a pill naming the state shown (28 px)
     hud.legend(rows, {title?, rect?, staged?}) -> {panel, show, hide, rows: [{show(t, dur)}]}
         rows: [{color, label, shape?: 'dot' | 'bar'}] */
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
      var fig = spec.key !== undefined ? ledger.figure(spec.key) : null;
      var start = fig ? fig.value : spec.value;
      var of = spec.of;
      if (start && typeof start === 'object') { of = start.of; start = start.n; }
      if (typeof start !== 'number') throw new Error('hud.measure needs key (a figure) or value (a number or ctx.count)');
      var label = spec.label !== undefined ? spec.label : (fig ? fig.label : '');
      var rect = spec.rect || { x: 28, y: area.y + 12, w: 350, h: spec.sub ? 152 : 118 };
      var p = panel(rect), color = spec.color || C.text;
      function fmt(v) { return Math.round(v) + (of != null ? ' of ' + of : '') + (spec.suffix || ''); }
      fixed(p.body, label, { x: 18, y: 36, fill: C.muted, 'font-size': 22, 'font-weight': 600 }, 'measure-title');
      var val = fixed(p.body, fmt(start), { x: 18, y: 98, fill: color, 'font-size': 54, 'font-weight': 750 }, 'measure-value');
      if (spec.sub) fixed(p.body, spec.sub, { x: 18, y: 138, fill: C.muted, 'font-size': 22 }, 'measure-sub');
      var cur = start, proxy = { v: start }, open = null;
      return {
        panel: p, item: val,
        show: function (t, dur) {
          p.show(t, dur);
          if (fig) open = ledger.note(fig, t, Infinity);
        },
        hide: function (t, dur) { p.hide(t, dur); if (open) open.to = t; },
        border: p.border,
        to: function (v, t, dur) {
          var from = cur;
          tl.fromTo(proxy, { v: from }, { v: v, duration: dur == null ? T.QUANTITY_MIN : dur, ease: 'power2.inOut', onUpdate: function () { val.el.textContent = fmt(proxy.v); } }, t);
          cur = v;
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
      return { item: it, show: function (t, dur) { fadeIn(g, t, dur); }, hide: function (t, dur) { fadeOut(g, t, dur); } };
    }

    function legend(rows, opts) {
      opts = opts || {};
      var rowH = 44, head = opts.title ? 40 : 14, h = head + rows.length * rowH + 10;
      var rect = opts.rect || { x: 28, y: area.y + area.h - h - 12, w: 340, h: h };
      var p = panel(rect);
      if (opts.title) fixed(p.body, opts.title, { x: 18, y: 34, fill: C.muted, 'font-size': 22, 'font-weight': 600 }, 'legend-title');
      var handles = rows.map(function (r, i) {
        var y = head + i * rowH, g = svg('g', opts.staged ? { opacity: 0 } : {}, p.body);
        if (r.shape === 'bar') svg('rect', { x: 18, y: y + 14, width: 28, height: 14, rx: 4, fill: r.color }, g);
        else svg('circle', { cx: 32, cy: y + 21, r: 8, fill: r.color }, g);
        fixed(g, r.label, { x: 62, y: y + 30, 'font-size': 24, 'font-weight': 600 }, 'legend:' + r.label);
        return { show: function (t, dur) { fadeIn(g, t, dur); } };
      });
      return { panel: p, rows: handles, show: p.show, hide: p.hide };
    }

    return { panel: panel, measure: measure, banner: banner, legend: legend };
  };
})();
