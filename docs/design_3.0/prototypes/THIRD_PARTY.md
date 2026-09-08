# Third-party attribution

The isolated Mezo UX Lab uses **Bible Strong Avatar Lab** by Samuel Montlouis:
https://github.com/smontlouis/bible-strong-avatar-lab

Packages: `@bible-strong/avatar-react@0.1.0` and `@bible-strong/avatar-core@0.1.0`.
License: **GNU Affero General Public License v3.0**, copy in [LICENSE](LICENSE), copied unchanged from the installed avatar-react package. The package metadata for this isolated prototype declares `AGPL-3.0-only`. This does not change the license or dependencies of the production Mezo app. Preserve upstream notices if distributing the runtime; this repository folder contains the prototype source used with it.

The `Mezo Clay` avatar definition is a new custom definition using the public runtime schema. It is not an upstream sample or an automatically converted Studio project.

Other dependencies: React/React DOM (MIT), Vite (MIT), Lucide React icons (ISC). Exact versions and transitive dependencies are pinned in `package-lock.json`; their license notices accompany their installed packages. DM Sans, Manrope and Newsreader are served via Google Fonts and distributed under the SIL Open Font License.

Exercise photographs in `public/train/` are copies of seven existing paired assets from `frontend/public/exercises/`. Their upstream is yuhonas/free-exercise-db, public domain under the Unlicense, as recorded in [ADR 0020](../../decisions/0020-vendor-public-domain-exercise-imagery.md). See [training coverage](../train-coverage.md) for the source-to-exercise mapping. These pairs form a labelled two-image study, not a licensed video collection.
