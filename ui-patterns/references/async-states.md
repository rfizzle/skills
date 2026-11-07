# Async states

Every region that loads, saves or can fail has five states. Each is designed,
reachable from props, and has a story.

## Rules

- **Loading**: a skeleton in the shape of the content for anything over a
  short delay (about 300 ms); no spinner flash for fast responses. Keep the
  layout stable so content does not jump when it arrives. Set `aria-busy` on
  the region; do not announce every load.
- **Empty**: a real state, not an error. Say what would be here and the
  next step ("No reports yet. Create one"). Distinguish "nothing exists" from
  "nothing matches your filters".
- **Error**: say what failed in plain words, what the user can do, and offer
  Retry where retrying can help. Keep any data already shown. Map transport
  errors to human messages (a 403 is "You do not have access", not "403").
  Never show a stack trace or raw problem body; log the detail, show the
  `title` of an RFC 9457 problem at most.
- **Partial**: some sections loaded, some failed or are still loading. Each
  region owns its state, so one failure does not blank the page. Say which
  part is missing.
- **Success**: the content. After a save, confirm it as in `feedback.md`.
- **Stale and refreshing**: when refreshing data already shown, keep it on
  screen with a quiet indicator rather than returning to the skeleton.
- **Optimistic updates** only when the action almost never fails and is
  reversible; on failure, roll back visibly and say so.
- **Cancellation**: navigating away or changing filters cancels the
  in-flight request; a late response never overwrites newer state.
- **End-to-end hook**: the screen root's `data-loaded` is `true` only once the
  primary data has settled (success, empty or error).

## Checklist

- [ ] Loading uses a layout-stable skeleton and `aria-busy`, no flash on fast loads.
- [ ] Empty says what would be here and the next step; no-results is separate.
- [ ] Error is plain language, offers Retry where useful, keeps shown data.
- [ ] No raw status codes, stack traces or problem bodies reach the user.
- [ ] One failing region does not blank the page (partial state handled).
- [ ] Refresh keeps existing content visible.
- [ ] Superseded requests are cancelled; late responses are ignored.
- [ ] `data-loaded` flips only when primary data has settled.
- [ ] Stories: `Loading`, `Empty`, `LoadError`, `Partial`, `Default`.
