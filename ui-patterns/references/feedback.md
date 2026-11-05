# Feedback

## Rules

- **Inline first.** Feedback appears where the user is looking: a field
  error under the field, a save confirmation next to the saved thing, a
  region error in the region. Inline feedback stays until it is no longer
  true.
- **Toasts only for** brief, non-critical confirmation of an action whose
  result is not otherwise visible ("Report scheduled"), or to carry Undo.
  Never for errors the user must act on, never for anything they must read
  in full, and never as the only record of what happened.
- **Toast behaviour**: does not take focus; stays at least 5 seconds and
  longer for longer text; pauses on hover and focus; has a close button;
  is reachable by keyboard while visible; does not cover primary actions or
  the focused element. A toast with an action (Undo) stays until dismissed
  or for at least 10 seconds.
- **Banners** for page- or app-level conditions (read-only mode, degraded
  service). Persistent, dismissible only if the condition is not critical.
- **Severity by role**: `info`, `success`, `warning`, `danger` intent tokens,
  always with an icon or text that says the severity. Colour alone never
  conveys it.
- **Screen-reader announcements**:
  - A polite live region (`role="status"` or `aria-live="polite"`) for
    confirmations, result counts and background progress.
  - An assertive region (`role="alert"`) only for errors that block the
    task right now; not for validation messages shown on submit, where
    focus moves to the error summary instead.
  - The live region exists in the DOM before its text changes; inserting a
    region already filled is often not announced.
  - Announce once, briefly. Do not announce what focus movement already
    says.
- **Progress**: under a second, nothing; up to about ten seconds, an
  indeterminate indicator on the control or region; longer, a determinate
  progress bar with text and, if possible, a way to leave and come back.

## Checklist

- [ ] Feedback appears next to its cause; toasts only for non-critical confirmation or Undo.
- [ ] No actionable error appears only in a toast.
- [ ] Toasts never steal focus, pause on hover/focus, and can be closed by keyboard.
- [ ] Severity is shown with icon or text plus intent token, not colour alone.
- [ ] Polite region for status; `role="alert"` only for blocking errors.
- [ ] Live regions are mounted before their content changes.
- [ ] Long work shows determinate progress with text.
- [ ] Stories cover each feedback variant and `WithLongContent`.
