# Pattern 5: object transformation

Reference scenario: **envelope encryption, the key hierarchy, and a key rotation.** Style: flat.

## What the pattern is

The subject is not where something travels but what happens to it: an object changes form
(plaintext to ciphertext, a key wrapped by another key, a token narrowed). The object is the
star, drawn large enough to see its parts; the architecture is a quiet backdrop of two or three
places it can be.

## Mechanism to build

- **Composite objects in data**: an object has a `kind` and `parts`; each part has a label, a
  colour and a state. Objects are drawn as cards at readable size (parts at least 22px text) and
  collapse to a small chip only when they travel.
- **Transform helpers** on the master timeline, each a pure function of progress so `seek(t)` is
  exact:
  - `encrypt(obj, withKey)` / `decrypt`: the key visibly applies (slides over the text field),
    and the text changes from readable to ciphertext character by character, left to right, from
    a fixed seeded sequence (no `Math.random` at render time). The result carries a small chip in
    the key's colour saying which key locked it.
  - `wrap(key, withKey)` / `unwrap`: the inner key card gains an outer shell in the wrapping
    key's colour, labelled with the wrapping key's name and version. Nesting must be visible:
    inner key still discernible inside the shell.
  - `bundle(a, b)`: two objects dock into one envelope card with two labelled compartments.
  - `discard(obj)`: an object in memory is shredded (visibly gone, not just faded), for the
    plaintext data key.
  - `reversion(part, to)`: a part's version label ticks over (v1 to v2) and its colour band
    refreshes, the rest of the object untouched.
- **Places**: three quiet lanes: KMS / HSM, Application (memory), Storage. An object's location
  is which lane it sits in. Lanes are containers with tabs, as in the flat reference.
- **Invariant badge**: a fixed note that states the property that never breaks, lit whenever the
  animation is demonstrating it: "Root key never leaves the HSM".

## Scenario

Keys: Root key (in the HSM, identity colour, never moves), Key-encryption key `KEK v1` (in KMS,
protected by the root key), Data key `DEK` (one per record, token colour). Data: one customer
record with three readable fields.

Steps:
1. `ask`: the application asks KMS for a data key. KMS returns two things: the plaintext DEK and
   the same DEK wrapped by `KEK v1`.
2. `encrypt`: the application encrypts the record with the DEK.
3. `discard`: the plaintext DEK is discarded from memory; only the wrapped copy remains.
4. `store`: ciphertext and wrapped DEK are bundled into one envelope and written to storage.
5. `read`: to read, the application sends only the wrapped DEK to KMS, gets the DEK back,
   decrypts the record, discards the DEK again. The bulk data never went to KMS.
6. `scale`: show a shelf of six envelopes in storage, each with its own DEK, all wrapped by the
   same `KEK v1`: one small key call per record, however large the data.
7. `rotate`: rotation: `KEK v2` appears in KMS. Each envelope's wrapped-key compartment is
   re-wrapped (shell changes to v2, version label ticks) one after another; the ciphertext
   compartments do not change. Make "the data is not re-encrypted" unmistakable.
8. `scope`: what a leak costs: a leaked DEK exposes one record (one envelope outlined in danger);
   the KEK cannot leak in plaintext because it never leaves KMS; the root key never leaves the
   HSM (invariant badge).

Phases: Write, Read, Scale and rotate, What a leak costs.

There are few hops here; the flow rules still apply to those there are. The pacing rules apply to
transforms as they do to hops: a transform takes at least 1.6s, and its result holds
max(2.5s, words x 0.4s) before the next thing moves.
