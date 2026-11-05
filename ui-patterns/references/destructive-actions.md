# Destructive actions

Deleting, revoking, overwriting, sending, or anything else that is hard to
reverse.

## Rules

- **Prefer undo.** If the action can be reversed for a while (soft delete,
  delayed send), do it immediately and offer Undo in a toast or inline for
  at least 10 seconds. Undo beats a confirmation dialog, which users learn
  to click through.
- **Otherwise confirm, with names.** When it cannot be undone, confirm in a
  modal dialog that names the object and the consequence: title "Delete
  report 'Q3 access summary'?", body "This removes it for everyone. This
  cannot be undone." The confirm button repeats the verb ("Delete report"),
  never "OK" or "Yes".
- **Scale the friction** to the damage. For irreversible, wide-impact
  actions (deleting a project, revoking all keys), require typing the
  object's name to enable the confirm button.
- **Bulk actions** state the count and scope in the dialog ("Delete 12
  reports?"), and list or link the affected items when the count is small.
- **Visual weight**: the destructive button uses the `danger` intent, but is
  not the most prominent button on an everyday page. Keep it away from the
  routine primary action.
- **Dialog focus**: the dialog opens with focus on the least destructive
  control (Cancel) or the dialog heading; Escape and Cancel close it without
  acting; focus returns to the control that opened it, or to a sensible
  place if that control was deleted.
- **After the action**: confirm what happened in text, remove or update the
  item in place, and move focus somewhere sensible (the next item, the list
  heading). A failed destructive action leaves the item untouched and says so.
- **Server side**: the API enforces authorisation and idempotency; the
  dialog is a UX safeguard, not a security control.

## Checklist

- [ ] Reversible actions act immediately with Undo; no needless dialog.
- [ ] Irreversible actions confirm with the object's name and the consequence.
- [ ] Confirm button names the verb; never "OK" or "Yes".
- [ ] Friction scales with impact; wide-impact actions require typing the name.
- [ ] Bulk confirmations state count and scope.
- [ ] Initial focus is on Cancel or the heading; Escape cancels; focus returns sensibly.
- [ ] Outcome is confirmed in text; failure leaves the item intact and is reported.
- [ ] Stories: `Default`, `Confirming`, `Failed`, and `Undo` where it applies.
