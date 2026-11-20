/* One tweened camera proxy {x, y, w, h} in scene px. camTo(t, frame, dur) adds a fromTo tween on the master
   timeline; render() (called from the timeline's update, see shell.publishAnim) hands the proxy to
   painter.applyCamera and text.sync, and drives the mini-map and the edge fade. Knows nothing of the story. */
(function () {
  'use strict';
  var EXK = window.EXK, T = EXK.timing, C = EXK.THEME;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var FULL_VIEW_EPS = 0.06;      /* mini-map and fades appear once the camera is this much tighter than the full view */

  /* makeCamera(tl, painter, text, area, opts) -> camera
     opts: {full: frame, shell, minimap: <svg>, fade: <el>, crumb: <el>}
     camera.cam           live proxy; never keep a reference to its numbers, copy them
     camera.set(frame)    the starting frame (no tween); also the full view if setFull was not called
     camera.setFull(f)    the whole-estate frame: mini-map extent and the 'full' override of seek(t, {camera:'full'})
     camera.camTo(t, frame, dur, ease) -> end time (absolute). Call in time order. dur is at least CAMERA_MIN.
     camera.frameAt(t)    the frame the camera is heading for or resting at at time t (for planning text)
     camera.scale()       stage px per scene px now
     camera.crumb(tl, t0, t1, parts)   breadcrumb text, shown t0..t1
     camera.render()      apply the proxy (idempotent) */
  function makeCamera(tl, painter, text, area, opts) {
    opts = opts || {};
    var cam = { x: 0, y: 0, w: area.w, h: area.h };
    var moves = [], prev = { x: 0, y: 0, w: area.w, h: area.h }, full = opts.full || null, override = null;
    var mmCam = null;

    function norm(f) { return { x: f.x, y: f.y, w: f.w, h: f.w * area.h / area.w }; }   /* frames carry the area's aspect */
    function assign(f) { cam.x = f.x; cam.y = f.y; cam.w = f.w; cam.h = f.h; }

    function setupMinimap() {
      var mm = opts.minimap;
      if (!mm || !full || mmCam) return;
      mm.setAttribute('viewBox', [full.x, full.y, full.w, full.h].join(' '));
      mmCam = document.createElementNS(SVGNS, 'rect');
      mmCam.setAttribute('fill', 'none'); mmCam.setAttribute('stroke', C.accent);
      mmCam.setAttribute('stroke-width', Math.max(2, full.w / 120));
      mm.appendChild(mmCam);
    }

    var camera = {
      cam: cam,
      set: function (f) {
        prev = norm(f); assign(prev); moves = [];
        if (!full) camera.setFull(prev);
      },
      setFull: function (f) { full = norm(f); setupMinimap(); },
      camTo: function (t, frame, dur, ease) {
        dur = Math.max(dur || 0, T.CAMERA_MIN);
        var from = prev, to = norm(frame);
        tl.fromTo(cam, { x: from.x, y: from.y, w: from.w, h: from.h },
          { x: to.x, y: to.y, w: to.w, h: to.h, duration: dur, ease: ease || 'power2.inOut', immediateRender: false }, t);
        moves.push({ t: t, dur: dur, from: from, to: to });
        prev = to;
        return t + dur;
      },
      frameAt: function (t) {
        var f = moves.length ? moves[0].from : prev;
        for (var i = 0; i < moves.length; i++) if (moves[i].t <= t + 1e-6) f = moves[i].to;
        return { x: f.x, y: f.y, w: f.w, h: f.h };
      },
      scale: function () { return area.w / cam.w; },
      crumb: function (tl2, t0, t1, parts) {
        var el = opts.crumb;
        if (!el || !parts || !parts.length) return;
        var d = document.createElement('div'); d.className = 'crumb';
        parts.forEach(function (s, k) {
          if (k) d.appendChild(document.createTextNode('  ›  '));
          if (k === parts.length - 1) { var b = document.createElement('b'); b.textContent = s; d.appendChild(b); }
          else d.appendChild(document.createTextNode(s));
        });
        el.parentNode.appendChild(d);
        tl2.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.5, immediateRender: false }, t0);
        tl2.fromTo(d, { opacity: 1 }, { opacity: 0, duration: 0.4, immediateRender: false }, t1);
      },
      render: function () {
        var c = override === 'full' && full ? full : cam;
        painter.applyCamera(c);
        text.sync(c);
        if (full) {
          var part = Math.max(0, Math.min(1, (full.w - c.w) / (full.w * FULL_VIEW_EPS)));
          if (mmCam) {
            mmCam.setAttribute('x', c.x); mmCam.setAttribute('y', c.y);
            mmCam.setAttribute('width', c.w); mmCam.setAttribute('height', c.h);
          }
          if (opts.minimap) opts.minimap.style.opacity = part;
          if (opts.fade) opts.fade.style.opacity = part;
        }
      }
    };
    /* seek(t, {camera: 'full'}) shows the whole estate; 'step' (or nothing) the camera's own frame */
    if (opts.shell) opts.shell.cameraOverride = function (mode) { override = mode === 'full' ? 'full' : null; };
    setupMinimap();
    return camera;
  }

  EXK.makeCamera = makeCamera;
})();
