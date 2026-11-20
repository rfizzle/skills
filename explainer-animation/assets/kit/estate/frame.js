/* Camera frames over a laid-out estate (EXK.layout). Pure: no DOM, no GSAP. references/rules.md:
   frame by container, never slice a visible border (containers enclosing the whole frame become
   the breadcrumb), proxies for off-frame endpoints.

   EXK.frame.frameFor(estate, stepOrSpec, area?) -> frame
     stepOrSpec: a step (its .frame is used) or a spec: 'full' | {hold: [ids], grow?: 'down'|'up', zoom?: number}
     area: the diagram area in stage px, default {w: 1920, h: 720}; the frame has its aspect
   frame = { x, y, w, h,              ground units
             zoom,                    stage px per ground unit (area.w / w)
             full: bool,              the full view (also when a fit reaches 97% of its width)
             hold: [ids], grow,       as asked
             cut: [ids], enclosing: [ids], inside: [ids],   frameAudit of the result
             crumb: [names],          breadcrumb, outer to inner ([] at full view)
             widened: [ids],          containers added to the hold so none is sliced
             issues: [{level, kind, message, fix}] }
   Rule: the held boxes plus 8 units (with grow 'down' extended up to just under the nearest edge
   above, so the approach corridor shows; 'up' likewise downward) are fitted to the aspect with
   LABEL_ROOM (150 stage px) free for labels and tallies, no tighter than ZOOM_CAP (1.3) unless the
   spec sets `zoom`. Without grow the room is above and below and the frame is centred on the held
   content. With grow the room is on the grow side only (that is where the step puts its labels; the
   corridor side is the approach) and the frame is anchored at the corridor edge, so the border just
   beyond the corridor is out of frame. Spare width goes to the left (up to 300 stage px, for the proxy
   badge of an off-frame source and the lanes arriving from it) instead of being split evenly. If a container border is cut, the frame first slides (smallest move keeping the
   hold in view); failing that the cut container joins the hold and it fits again. A 'grow' frame
   is the author accepting the cuts it makes; they are reported, not repaired.
   frameAudit(estate, f) -> {cut, enclosing, inside}   crumbFor(estate, f) -> [names]
   proxyPoint(route, f, end 'a'|'b') -> null when that end is in view, else {x, y, side, s, f}:
   where the route crosses the frame edge nearest that end (the proxy badge's anchor). */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};

  var M = 8, FULL_AT = 0.97, AREA = { w: 1920, h: 720 };
  var LABEL_ROOM = 150;     /* stage px kept free above and below the held content, for its labels and tallies */
  var PROXY_ROOM = 300;     /* stage px kept free at the left of a grow frame, where the proxy badge of an off-frame source sits (flat painter PROXY_W) */
  var ZOOM_CAP = 1.3;       /* stage px per ground unit: a close-up is no tighter than this unless the frame sets zoom */

  /* the held bounds fitted to the area with label room, no tighter than the cap (or exactly the frame's own zoom
     when it sets one, as long as the bounds still fit). Without grow the room is above and below and the frame is
     centred on the bounds. With grow 'down' (or 'up') the bounds already reach the approach corridor on the other
     side, so the room is kept on the grow side only and the frame is anchored to the corridor edge: the picture
     opens away from the corridor, where the step's labels and tallies go, and the border just beyond the corridor
     stays out of frame. */
  function fitRoom(bb, aspect, area, zoom, grow) {
    var w = bb.x1 - bb.x0, h = bb.y1 - bb.y0, cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, fw;
    var sides = grow ? 1 : 2;
    if (zoom > 0) fw = Math.max(w, h * aspect, area.w / zoom);
    else fw = Math.max(w, aspect * h / (1 - sides * LABEL_ROOM / area.h), area.w / ZOOM_CAP);
    var fh = fw / aspect;
    if (grow) {
      /* spare width goes to the left, up to PROXY_ROOM, so the proxy badge and the incoming lanes have room; at least a fade's worth stays at the right */
      var k = area.w / fw, slack = fw - w, left = Math.min(Math.max(slack / 2, PROXY_ROOM / k), Math.max(slack / 2, slack - 56 / k));
      return { x: bb.x0 - left, y: grow === 'down' ? bb.y0 : bb.y1 - fh, w: fw, h: fh };
    }
    return { x: cx - fw / 2, y: cy - fh / 2, w: fw, h: fh };
  }

  function frameAudit(estate, f) {
    var res = { cut: [], enclosing: [], inside: [] };
    estate.boxes.forEach(function (b) {
      var ix = b.x < f.x + f.w && b.x + b.w > f.x && b.y < f.y + f.h && b.y + b.h > f.y;
      if (!ix) return;
      var whole = b.x >= f.x && b.y >= f.y && b.x + b.w <= f.x + f.w && b.y + b.h <= f.y + f.h;
      var encl = f.x >= b.x && f.y >= b.y && f.x + f.w <= b.x + b.w && f.y + f.h <= b.y + b.h;
      if (whole) res.inside.push(b.id); else if (encl) res.enclosing.push(b.id); else res.cut.push(b.id);
    });
    return res;
  }

  function crumbFor(estate, f) {
    if (f.full) return [];
    var cx = f.x + f.w / 2, cy = f.y + f.h / 2, a = [];
    estate.boxes.forEach(function (b) {
      var whole = b.x >= f.x && b.y >= f.y && b.x + b.w <= f.x + f.w && b.y + b.h <= f.y + f.h;
      if (!whole && cx > b.x && cx < b.x + b.w && cy > b.y && cy < b.y + b.h) a.push(b);
    });
    a.sort(function (p, q) { return p.depth - q.depth; });
    return a.map(function (b) { return b.short || b.label; });
  }

  // bounds {x0, y0, x1, y1} -> frame {x, y, w, h} of the aspect, never smaller than the bounds
  function fit(bb, aspect, grow) {
    var w = bb.x1 - bb.x0, h = bb.y1 - bb.y0;
    if (w / h < aspect) { var nw = h * aspect; return { x: bb.x0 - (nw - w) / 2, y: bb.y0, w: nw, h: h }; }
    var nh = w / aspect;
    if (grow === 'down') return { x: bb.x0, y: bb.y0, w: w, h: nh };
    if (grow === 'up') return { x: bb.x0, y: bb.y1 - nh, w: w, h: nh };
    return { x: bb.x0, y: bb.y0 - (nh - h) / 2, w: w, h: nh };
  }
  function union(bb, b, m) {
    return { x0: Math.min(bb.x0, b.x - m), y0: Math.min(bb.y0, b.y - m), x1: Math.max(bb.x1, b.x + b.w + m), y1: Math.max(bb.y1, b.y + b.h + m) };
  }

  // the edge line nearest the held bounds on the grow side's opposite (the approach corridor)
  function approach(estate, raw, grow, frameH) {
    var best = null;
    estate.boxes.concat(estate.nodes).forEach(function (b) {
      if (b.x + b.w <= raw.x0 || b.x >= raw.x1) return;
      [b.y, b.y + b.h].forEach(function (e) {
        if (grow === 'down' && e < raw.y0 - 0.5 && (best === null || e > best)) best = e;
        if (grow === 'up' && e > raw.y1 + 0.5 && (best === null || e < best)) best = e;
      });
    });
    if (best === null || Math.abs(best - (grow === 'down' ? raw.y0 : raw.y1)) > 0.35 * frameH) return null;
    return grow === 'down' ? best + 4 : best - 4;
  }

  function slide(estate, f, bb, cut) {
    var xs = [f.x], ys = [f.y];
    cut.forEach(function (id) {
      var c = estate.B[id];
      [c.x, c.x + c.w].forEach(function (e) { xs.push(e - M, e + M, e - f.w + M, e - f.w - M); });
      [c.y, c.y + c.h].forEach(function (e) { ys.push(e - M, e + M, e - f.h + M, e - f.h - M); });
    });
    xs = xs.filter(function (x) { return x <= bb.x0 + 1e-6 && x + f.w >= bb.x1 - 1e-6; });
    ys = ys.filter(function (y) { return y <= bb.y0 + 1e-6 && y + f.h >= bb.y1 - 1e-6; });
    var pairs = [];
    xs.forEach(function (x) { ys.forEach(function (y) { pairs.push([x, y]); }); });
    pairs.sort(function (p, q) {
      return (Math.abs(p[0] - f.x) + Math.abs(p[1] - f.y)) - (Math.abs(q[0] - f.x) + Math.abs(q[1] - f.y)) || p[0] - q[0] || p[1] - q[1];
    });
    for (var i = 0; i < pairs.length; i++) {
      var g = { x: pairs[i][0], y: pairs[i][1], w: f.w, h: f.h };
      if (!frameAudit(estate, g).cut.length) return g;
    }
    return null;
  }

  function frameFor(estate, stepOrSpec, area) {
    area = area || AREA;
    var spec = stepOrSpec && typeof stepOrSpec === 'object' && !Array.isArray(stepOrSpec.hold) && 'frame' in stepOrSpec ? stepOrSpec.frame : stepOrSpec;
    var aspect = area.w / area.h, full = EXK.layout.fullOf(estate.world, aspect), issues = [], widened = [];
    var hold = spec && spec !== 'full' && Array.isArray(spec.hold) ? spec.hold.filter(function (id) {
      if (estate.B[id] && id !== 'root') return true;
      issues.push({ level: 'warning', kind: 'hold', message: 'hold names unknown id ' + id + ', ignored', fix: 'use a zone or system id' });
      return false;
    }) : [];
    var grow = spec && spec.grow ? spec.grow : null;
    var f = null;
    if (hold.length) {
      var raw = null;
      hold.forEach(function (id) {
        var b = estate.B[id];
        raw = raw ? { x0: Math.min(raw.x0, b.x), y0: Math.min(raw.y0, b.y), x1: Math.max(raw.x1, b.x + b.w), y1: Math.max(raw.y1, b.y + b.h) }
          : { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h };
      });
      var bb = { x0: raw.x0 - M, y0: raw.y0 - M, x1: raw.x1 + M, y1: raw.y1 + M };
      if (grow === 'down' || grow === 'up') {
        var e = approach(estate, raw, grow, (bb.x1 - bb.x0) / aspect);
        if (e !== null) { if (grow === 'down') bb.y0 = Math.min(bb.y0, e); else bb.y1 = Math.max(bb.y1, e); }
      } else if (grow) {
        issues.push({ level: 'warning', kind: 'grow', message: 'grow ' + grow + ' is not one of down, up; ignored', fix: 'use "down" or "up"' });
        grow = null;
      }
      for (var it = 0; it < 16; it++) {
        f = fitRoom(bb, aspect, area, spec.zoom, grow);
        if (f.w >= full.w * FULL_AT) { f = null; break; }
        if (grow) break;
        var cut = frameAudit(estate, f).cut;
        if (!cut.length) break;
        var g = slide(estate, f, bb, cut);
        if (g) { f = g; break; }
        cut.forEach(function (id) { widened.push(id); bb = union(bb, estate.B[id], M); });
      }
    }
    var isFull = !f;
    if (isFull) f = { x: full.x, y: full.y, w: full.w, h: full.h };
    var au = frameAudit(estate, f);
    var out = { x: f.x, y: f.y, w: f.w, h: f.h, zoom: area.w / f.w, full: isFull, hold: hold, grow: grow,
                cut: au.cut, enclosing: au.enclosing, inside: au.inside, crumb: [], widened: widened, issues: issues };
    out.crumb = crumbFor(estate, out);
    return out;
  }

  function inFrame(p, f) { return p[0] >= f.x && p[0] <= f.x + f.w && p[1] >= f.y && p[1] <= f.y + f.h; }

  // where the route crosses into the frame, walking from the given end
  function proxyPoint(route, f, end) {
    var pts = end === 'b' ? route.pts.slice().reverse() : route.pts;
    if (inFrame(pts[0], f)) return null;
    var acc = 0, len = route.len || 0;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], l = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      if (l > 0) {
        var best = null;
        [['left', 0, f.x], ['right', 0, f.x + f.w], ['top', 1, f.y], ['bottom', 1, f.y + f.h]].forEach(function (s) {
          var k = s[1], d = b[k] - a[k];
          if (Math.abs(d) < 1e-9) return;
          var t = (s[2] - a[k]) / d;
          if (t < 0 || t > 1) return;
          var p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          if (!inFrame(p, { x: f.x - 1e-6, y: f.y - 1e-6, w: f.w + 2e-6, h: f.h + 2e-6 })) return;
          if (!best || t < best.t) best = { t: t, p: p, side: s[0] };
        });
        if (best) {
          var s0 = acc + best.t * l;
          return { x: best.p[0], y: best.p[1], side: best.side, s: end === 'b' ? len - s0 : s0, f: len ? (end === 'b' ? len - s0 : s0) / len : 0 };
        }
      }
      acc += l;
    }
    return null;
  }

  EXK.frame = { AREA: AREA, frameFor: frameFor, fit: fit, frameAudit: frameAudit, crumbFor: crumbFor, proxyPoint: proxyPoint };
})();
