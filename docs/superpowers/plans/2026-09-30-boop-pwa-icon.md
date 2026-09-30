# Boop PWA icon and avatar nose — mezo-akskj

## Approved design

The owner chose option C: three Boops on warm dark graphite, with the left character blue, the
center lavender and the right sage. The nose is the smaller of the two rounded black triangle
options shown in `boop-kisebb-haromszog-preview.png` on 2026-09-30. The installed app and browser
tab are named **Boop**. Existing product copy and route names are outside this icon change.

## Implementation

- [x] Add the approved nose to all seven shared Boop variants and all five living prototypes.
- [x] Use the approved three-character vector as the source for PWA, maskable, Apple and favicon
      images. Keep the maskable foreground within its safe area.
- [x] Set manifest name, short name, Apple home-screen name and browser title to Boop.
- [x] Update the design-system reference, prototype registry and asset-generation notes.
- [x] Run the Boop test, full frontend tests in both explicit modes, build, icon inspection, docs
      lint and CODEMAP check.

After the local gates, merge and push through the root git workflow, then verify the live version.

## Kész, ha…

All seven in-app avatars have the same approved nose, the five living prototypes show it, and the
installed PWA, iOS icon and favicon carry option C. Small icons stay legible, reduced motion does
not affect the static icon, and existing screens and controls continue to work.
