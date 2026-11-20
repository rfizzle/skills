/* Every constant and rule of PATTERNS.md sections 6 (motion that can be read) and 7 (pacing), once, named.
   Pure: no DOM, no GSAP. Values are the flat v3 reference's (KIT-PLAN amendment "Step-end pacing"). */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var EXK = root.EXK = root.EXK || {};

  var T = {};

  /* ---- section 6: motion that can be read ---- */
  T.SPEED_CEILING = 320;    /* stage px per second: the rule; no packet is ever faster */
  T.SPEED_CAP = 315;        /* the design value: peak speed stays just under the ceiling */
  T.MIN_HOP = 1.6;          /* s: shortest hop */
  T.RAMP = 0.15;            /* fraction of a hop spent ramping up (and down) */
  T.PEAK_FACTOR = 1 / (1 - T.RAMP);   /* peak speed / average speed of PACKET_EASE */
  T.PARALLEL_GAP = 1.5;     /* s: parallel flows start at least this far apart */
  T.STREAM_MAX = 4;         /* at most 4 plain packets in a stream */
  T.STREAM_GAP = 0.9;       /* s: at least this far apart */
  T.TAG_MAX_WORDS = 2;      /* a moving tag carries at most this many words */
  T.CAMERA_MIN = 1.2;       /* s: camera moves are at least this slow */
  T.MOTION_START = 1.0;     /* s after the step starts: first packet leaves */
  T.MOTION_START_AFTER_CAMERA = 1.8;  /* s after a camera move ends/starts: motion resumes */

  /* ---- section 7: pacing ---- */
  T.END_AFTER_MOTION = 1.0;     /* next step starts >= last motion end + this */
  T.END_AFTER_LABEL = 0.3;      /* ... >= last label's hold end + this */
  T.BODY_WPS = 3.5;             /* ... >= body shown + words / this */
  T.LABEL_HOLD_MIN = 2.5;       /* earlier labels hold max(2.5, words x 0.4) after arrival */
  T.LABEL_HOLD_WPW = 0.4;
  T.LAST_HOLD_MIN = 1.4;        /* the last label of a step holds max(1.4, words x 0.35) */
  T.LAST_HOLD_WPW = 0.35;
  T.CARD_HOLD_MIN = 2.5;        /* a text card holds max(2.5, words x 0.35) after it has appeared */
  T.CARD_HOLD_WPW = 0.35;
  T.FINAL_HOLD = 3.0;           /* the final step ends this long after its last motion */

  /* ---- chrome and fade timings that belong to the same rhythm ---- */
  T.LABEL_FADE_IN = 0.35;
  T.LABEL_FADE_OUT = 0.35;      /* labelEnd = hold end + this */
  T.BODY_DELAY = 0.8;           /* body appears this long after the step's first motion starts */
  T.BODY_FADE_IN = 0.7;
  T.TITLE_AT = 0.05;
  T.TITLE_FADE_IN = 0.5;
  T.CHROME_FADE_OUT = 0.3;      /* title and body fade out this long, ending just before the next step */
  T.CHROME_OUT_LEAD = 0.35;     /* ... starting this long before the step end */
  T.CALLOUT_OUT_LEAD = 0.5;     /* callouts and extras fade starting this long before the step end */
  T.REST_MARGIN = 0.55;         /* rest is at least this long before the step end (nothing has begun to fade) */

  /* ---- section 8: emphasis ---- */
  T.DIM_TEXT = 0.45;            /* opacity of text not in the active path */
  T.DIM_DUR = 0.4;              /* s, eased */
  T.DIM_EASE = 'power2.inOut';
  T.FOCUS_DIM = 0.35;           /* painter focus: opacity of what the step is not about */

  /* ---- effects (flat v3 values): durations scene/beats.js uses for what it draws besides text ---- */
  T.CAMERA_MOVE = 1.6;          /* s: a step's camera move and a camera beat (>= CAMERA_MIN) */
  T.FOCUS_DUR = 0.8;            /* s: focus dimming at a step start */
  T.INSTANT = 0.001;            /* s: a switch (shown / hidden) written as a fromTo */
  T.PACKET_LINGER = 0.15;       /* s: a packet stays this long after its last arrival, then hides */
  T.RING_LEAD = 0.15;           /* s: an arrival ring starts this long before the packet arrives */
  T.RING_IN = 0.2;              /* s */
  T.RING_HOLD = 0.6;            /* s after the ring starts, it begins to fade */
  T.RING_OUT = 1.0;             /* s */
  T.MARK_LEAD = 0.1;            /* s: a blast-radius marker starts this long before the arrival it marks */
  T.MARK_IN = 0.5;              /* s */
  T.LIT_FADE = 0.6;             /* s: lit links fade at the end of their step */
  T.LIT_AFTER_MOTION = 0.3;     /* lit links fade at the later of last motion + this ... */
  T.LIT_BEFORE_LABEL = 1.0;     /* ... and the last label's end - this */
  T.TRAIL_IN = 0.8;             /* s: a trail (used link, blast radius) fades in when its step's lit links fade */
  T.CRUMB_AFTER_CAMERA = 0.1;   /* s: the breadcrumb appears this long after the camera settles */
  T.CRUMB_OUT_LEAD = 0.5;       /* s: ... and fades this long before the step ends */
  T.CRUMB_MIN = 1.0;            /* s: a breadcrumb shown for less than this is not shown (its fades would overlap) */
  T.TAG_HIDE = 0.12;            /* s: a tag fades out (and back in) this fast while its packet passes behind a node */
  T.PORT_IN = 0.15;             /* s: a port ring lights this long before the packet crosses it ... */
  T.PORT_HOLD = 0.35;           /* ... stays lit this long after ... */
  T.PORT_OUT = 0.6;             /* ... and fades over this */
  T.STREAM_SPACING = 1.1;       /* s between stream packets (>= STREAM_GAP) */
  T.STREAM_SAY_LEAD = 0.8;      /* s: a stream's label appears this long before its first packet leaves */
  T.TALLY_LEAD = 0.5;           /* s: a tally's heading appears this long before the first packet lands */
  T.FOLD = 0.9;                 /* s: a card folds into its system */
  T.PROXY_LEAD = 0.6;           /* s: a proxy badge appears this long before the first packet uses it */
  T.PROXY_IN = 0.5;             /* s */
  T.TRACE_DRAW = 0.7;           /* s: each link of the summary trace draws in this long ... */
  T.TRACE_GAP = 0.45;           /* ... the next one starting this much later */
  T.TRACE_AFTER = 0.4;          /* s: the first shield lands this long after the last trace starts */
  T.SHIELD_SECOND = 2.4;        /* s: the second shield lands this long after the first ... */
  T.SHIELD_GAP = 1.2;           /* ... and each later one this much after the previous */
  T.SHIELD_IN = 0.25;           /* s: a shield appears */
  T.SHIELD_POP = 0.5;           /* s: and scales in */
  T.SHIELD_LABEL_IN = 0.4;      /* s: its label fades in (SHIELD_IN after the shield) */
  T.SUMMARY_FADE_AFTER = 1.2;   /* s after the first shield, the chain (trace, trails, markers) fades back ... */
  T.SUMMARY_FADE = 1.2;         /* ... over this */
  T.SUMMARY_ALL_AFTER = 1.4;    /* s after the last shield label, everything named returns to full */
  T.SUMMARY_END_AFTER = 1.0;    /* s after the last shield lands, the summary's motion ends */

  function wordCount(s) {
    var w = String(s == null ? '' : s).replace(/\n/g, ' ').trim().split(/\s+/).filter(Boolean);
    return w.length;
  }
  T.wordCount = wordCount;

  /* Packet easing: ramp up, constant middle, ramp down. Progress 0..1 -> 0..1. */
  T.PACKET_EASE = function (p) {
    var v = T.PEAK_FACTOR, R = T.RAMP;
    if (p < R) return v * p * p / (2 * R);
    if (p <= 1 - R) return v * (R / 2 + (p - R));
    return 1 - v * (1 - p) * (1 - p) / (2 * R);
  };
  /* inverse of PACKET_EASE: the progress at which the eased fraction f is reached (bisection) */
  T.invPacketEase = function (f) {
    var lo = 0, hi = 1;
    for (var i = 0; i < 40; i++) {
      var m = (lo + hi) / 2;
      if (T.PACKET_EASE(m) < f) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  };

  /* Hop duration from the ON-SCREEN length of the path (stage px, at the camera scale at that time).
     Set from the PEAK speed so the cap holds at every instant. */
  T.hopDuration = function (onScreenLen, minD) {
    return Math.max(minD || T.MIN_HOP, T.PEAK_FACTOR * onScreenLen / T.SPEED_CAP);
  };

  /* A stationary label's required hold after it is shown/arrives. Earlier labels of a step. */
  T.holdFor = function (text) { return Math.max(T.LABEL_HOLD_MIN, wordCount(text) * T.LABEL_HOLD_WPW); };
  /* The last stationary label of a step. */
  T.lastHoldFor = function (text) { return Math.max(T.LAST_HOLD_MIN, wordCount(text) * T.LAST_HOLD_WPW); };
  /* A text card (a finding, a credential) after it has appeared. */
  T.cardHold = function (text) { return Math.max(T.CARD_HOLD_MIN, wordCount(text) * T.CARD_HOLD_WPW); };

  /* First motion of a step, relative to the step start: 1.0 s, or 1.8 s after a camera move. */
  T.motionStart = function (afterCamera) { return afterCamera ? T.MOTION_START_AFTER_CAMERA : T.MOTION_START; };

  /* When the narrative body appears (relative to step start): after the first motion starts. */
  T.bodyAt = function (firstMotion, end) { return Math.min(firstMotion, end) + T.BODY_DELAY; };

  /* Step length (s): the latest of last motion end + 1.0, last label hold end + 0.3 (labelEnd includes
     the label's fade-out, so it is taken back by that), body shown + words / 3.5. The final step ends
     FINAL_HOLD after its last motion. o: {end, labelEnd, firstMotion, bodyWords, final} all relative. */
  T.stepEnd = function (o) {
    var end = o.end || 0, labelEnd = o.labelEnd || 0;
    var bodyR = T.bodyAt(o.firstMotion == null ? end : o.firstMotion, end);
    var len = Math.max(end + T.END_AFTER_MOTION,
      labelEnd - T.LABEL_FADE_OUT + T.END_AFTER_LABEL,
      bodyR + T.BODY_FADE_IN + (o.bodyWords || 0) / T.BODY_WPS);
    if (o.final) len = Math.max(len, end + T.FINAL_HOLD);
    return len;
  };

  /* `rest`: the time (relative to step start) at which the step has finished moving and the title,
     the body and every label are still shown at full strength. Clips and stills end here. It is no
     earlier than the last motion end and the body being fully in, and no later than the first fade-out
     of anything (the last label's hold end, the chrome and callouts fading before the step end). */
  T.restOf = function (o) {
    var len = o.len, end = o.end || 0, labelEnd = o.labelEnd || 0;
    var bodyR = T.bodyAt(o.firstMotion == null ? end : o.firstMotion, end);
    var lo = Math.max(end, bodyR + T.BODY_FADE_IN);
    var hi = len - T.REST_MARGIN;
    if (labelEnd > 0) hi = Math.min(hi, labelEnd - T.LABEL_FADE_OUT - 0.05);
    return Math.min(len - T.REST_MARGIN, Math.max(lo, hi));
  };

  EXK.timing = T;
})();
