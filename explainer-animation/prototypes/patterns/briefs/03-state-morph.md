# Pattern 3: state morph, current architecture to target architecture

Reference scenario: **from VPN to zero-trust access.** Style: flat.

## What the pattern is

One diagram changes from the current state to the target state while the audience watches, so
they can see what is retired, what is new, what stays and what moves. Then the consequence of the
change is demonstrated on the new diagram.

## Mechanism to build

- **Two states in data**: every node, container and edge has `in: ['current']`, `['target']` or
  both, and may have a different position or parent in each state. Layout is computed per state.
- **Morph** (one step, on the master timeline, about 5 to 6 seconds, staged in this order so it
  can be followed): things only in `current` are struck (a "retired" mark), hold, then fade and
  shrink out; things in both glide from their current position to their target position (same
  element, so identity is obvious); containers resize with them; things only in `target` grow in
  with a "new" badge that persists for the rest of the step; edges re-route last.
- **State banner**: fixed strip in the diagram area's top-left: "Today" then "Target".
- **Change legend**: a small fixed panel that appears with the morph: counts of Retired, New,
  Kept, each with its mark, and stays through the following steps.
- **Before and after measure**: one number that the change improves, shown in the same place in
  both states (here: "apps reachable after sign-in").
- The demonstration steps after the morph reuse the flow helpers on the target layout.

## Scenario

Today: Remote user (laptop) -> VPN concentrator -> flat internal network containing Wiki,
HR app, Finance app, Admin console, Customer DB. Once on the VPN, the laptop can reach all five.

Target: Remote user and their device -> Access proxy (identity-aware), which asks a Policy
engine; the policy engine consults the Identity provider (who is this, MFA) and Device posture
(managed, patched). Each app sits behind the proxy on its own; there is no network to be "on".
The VPN concentrator is retired. The five apps are kept.

Steps:
1. `today`: the user connects to the VPN and opens the Wiki.
2. `reach`: what the VPN grants: all five apps light as reachable ("5 of 5 reachable").
3. `problem`: a stolen laptop or stolen VPN credential gets the same reach; show the danger
   colour spreading to the same five.
4. `morph`: the morph described above.
5. `allow`: a request for the Wiki: proxy asks policy; identity OK, device OK; allowed; only the
   Wiki lights ("1 of 5 reachable, per request").
6. `deny`: the same user asks for the Finance app from an unmanaged device: identity OK, device
   not OK; denied at the proxy; nothing behind it is touched. Show the decision as a small card
   with the two checks.
7. `changed`: full view of the target with the legend and the before/after measure side by side.

Phases: Today, The problem, The change, What it buys.

Colour: legitimate flows accent, attacker danger, policy and identity checks identity colour,
allowed and controls secure.
