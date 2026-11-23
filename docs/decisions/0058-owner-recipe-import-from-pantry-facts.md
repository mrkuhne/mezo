# 0058 — Import owner recipes from pantry facts

- **Status:** Accepted
- **Date:** 2026-11-23
- **Driver:** mezo-hj7ul

## Context

The owner is replacing an older personal recipe collection with recipes from an external meal-planning HTML file. That file supplies ingredient quantities and preparation notes, but its per-food nutrition figures are estimates. Mezo recipes require owner-scoped pantry items and freeze their nutrition facts when saved.

## Decision

Treat the external file as the source for recipe names, quantities, and preparation notes only. Resolve each ingredient to a reviewed item on the owner's pantry shelf. Add a missing product through the owner-authenticated pantry API using its product-label nutrition, source URL, and known allergen states; reuse existing shelf facts for existing foods. Save recipes through the owner-authenticated recipe API with deterministic client references, one serving per source recipe, and no nutrition values copied from the HTML. Product claims that conflict with detailed ingredient lists do not override the ingredient-list allergen evidence.

Keep the operation separate from application startup, seed data, Liquibase, and deployment. Review the exact deletion set after the import. Any later recipe removal must use the owner-scoped delete API, preserve logged meals and other users' data, and back up associated images before deletion.

## Consequences

Recipe energy and macros reflect the selected pantry products, so they can differ substantially from the external plan. Mezo freezes those facts on save; later pantry corrections require the application's normal refresh path. The import is repeatable through its client references. The recipe library remains mixed until the separate deletion review is approved and completed.

## Alternatives considered

- **Copy the HTML's estimated nutrition into new generic pantry rows:** rejected because it would bypass the owner's chosen products and their app nutrition facts.
- **Write directly to production tables or run the import at deployment:** rejected because the owner-scoped APIs enforce ownership, snapshots, allergen rollup, and deliberate deletion review.
