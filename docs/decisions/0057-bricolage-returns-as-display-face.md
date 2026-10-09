# 0057 — Bricolage Grotesque returns as the display face

- **Status:** Accepted (supersedes the display-face part of ADR 0018 D2)
- **Date:** 2026-10-09
- **Driver:** mezo-n4wf5.1 (Folyadék F1)

## Context

ADR 0018 D2 retired Bricolage Grotesque and set Geist as both display and body face. The Folyadék
identity (owner decisions 2026-10-08/09) needs a rounder, more characterful display face for the
big numerals and page titles of the light, liquid world.

## Decision

Bricolage Grotesque (variable, opsz 12–96, wght 200–800; `latin` + `latin-ext` woff2 self-hosted
under `frontend/public/fonts/`) returns as `--ff-display`, with Geist as fallback. Geist stays the
body face, Geist Mono the mono face and Fraunces the serif prose face; ADR 0018 D2 stays in force
for those.

## Consequences

Two more woff2 files (~107 kB, `font-display: swap`). Every rule reading `--ff-display` changes
face; `.t-title` now reads the token instead of a hard-coded Fraunces. The italic prose rules that
name Fraunces directly are unchanged.
