# Nap → Mai, companion-first — design note (owner change 2026-09-11)

Owner directive (2026-09-11): the app's default landing (`/nap`, Nap → Mai) becomes a pure
**companion entry**:

- the **3D companion** (the living Titanium form, `TitanScene`/`TitanCompanion`) as the centrepiece;
- **below it a text input** to write to Mezo; a **mic control starts speech recognition / voice
  input** ("ha rányomsz, induljon el a hangfelismerő");
- **no tiles** — the next-step card and the six tiles are removed. This is the base screen on open.

Everything the tiles used to reach (víz, alvás, étkezés, edzés, rutin, napló, quick-log, stb.) is
now reached through the **navigation** (the Titanium nav slice, mezo-jkh4) and the domains' tabs.

## Coupling / sequence

This is coupled to the nav slice: removing the tiles is only safe once the nav gives access to
every domain and its four destinations. **Nav ships first (mezo-jkh4); then this companion-first
Nap Mai.**

## Interaction (build, then owner-approve running)

- The input is a composer with a mic affordance. Submitting text OR finishing a voice capture
  sends the message to the Mezo companion conversation and takes the user into the conversation
  view (Beszélgetés, `/nap/uzenetek`) where Mezo replies — reusing the existing chat/voice infra
  (`QuickInputSheet` voice flow, the Mezo thread), not a new inline chat engine. (If the owner
  wants the reply inline on the landing instead, adjust after seeing it running.)
- Keep a short daypart greeting for the "presence that knows me" identity; drop everything else.
- Honor reduced-motion (static companion) and the dark Titanium shell.

## Preservation

The removed tiles' capabilities are not deleted — they move to the nav tabs / quick picker. A
preservation check: every daily function (water one-tap, sleep, intake, workout, routine, journal,
check-in, stack) remains reachable in ≤2 taps via the nav after the tiles are gone.

## Status

Recorded 2026-09-11. Slice starts after the nav slice (mezo-jkh4) lands. bd issue to be filed when
the nav merges.
