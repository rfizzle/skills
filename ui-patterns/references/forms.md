# Forms

## Rules

- **Labels**: every field has a visible `<label>` tied to it. Placeholder text
  is a hint at most, never the label. Group related controls (radio sets,
  an address) in a `fieldset` with a `legend`.
- **Ask less**: only fields the task needs. Mark the optional ones
  "(optional)" rather than starring the required ones; if most fields are
  optional, question the form.
- **Right control**: radios for up to about five visible choices, a select
  or combobox for more, a checkbox for one yes/no, a switch only for a
  setting that applies immediately. Use the matching `type`, `inputmode` and
  `autocomplete` values so browsers, password managers and phones help.
- **Hints before errors**: format rules ("For example, 2026-03-14") sit under
  the label, linked with `aria-describedby`, before the user gets them wrong.
- **Validate on submit**, and per field on blur only after the first submit
  or once the field has been left with a value. Never on every keystroke,
  and never disable the submit button to signal invalid input.
- **Errors**: on submit with errors, show an error summary at the top
  listing each problem as a link to its field, move focus to the summary,
  and prefix the page title with "Error: ". Each field shows its own message
  in text, linked by `aria-describedby`, with `aria-invalid="true"`. The
  message says what to do: "Enter a date after today", not "Invalid input".
- **Keep input**: a failed submit or a server error never clears what the
  user typed. Server-side validation errors map back to the same fields.
- **Submitting**: the submit button shows progress and ignores repeat
  activation while the request is in flight; a retryable request carries an
  idempotency key so a double submit cannot create two records.
- **Do not ask twice**: information entered earlier in the same process is
  pre-filled or selectable (WCAG 3.3.7).
- **Long forms**: one topic per step, with a step indicator and a check
  answers page before the final submit. Unsaved changes warn before the
  user navigates away.

## Checklist

- [ ] Every control has a visible, programmatically associated label; groups use `fieldset`/`legend`.
- [ ] Optional fields are marked "(optional)"; no field is there without a need.
- [ ] Inputs use the right `type`, `inputmode` and `autocomplete`.
- [ ] Hints are visible before input and linked with `aria-describedby`.
- [ ] Validation runs on submit (and blur after that), never per keystroke.
- [ ] Error summary with links, focus moved to it, page title prefixed "Error: ".
- [ ] Each field error is text, linked, with `aria-invalid`, and says how to fix it.
- [ ] Failed submits keep every value the user entered.
- [ ] Submit shows progress and cannot double-submit.
- [ ] Stories: `Default`, `WithErrors`, `Submitting`, `WithLongContent`.
