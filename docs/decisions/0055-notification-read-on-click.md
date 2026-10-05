# 0055 — Mark notifications read on row click

- **Status:** Accepted
- **Date:** 2026-09-29
- **Driver:** mezo-d5y2m

## Context

The in-app feed previously marked every notification read when the full page opened. Its frozen
unread highlight concealed that state change, and clicking a specific notification did not record
the action. The owner asked for a clicked notification to become read.

## Decision

Opening the feed does not change read state. Clicking a row in either the header panel or the full
page marks only that notification read, then follows its deeplink. The panel's `Mind olvasott` button
remains the explicit bulk action. The API exposes an idempotent, owner-scoped per-item read endpoint.

## Consequences

The header count and both surfaces use the same live `readAt` cache. A clicked row clears promptly
through an optimistic update; a failed write rolls back that row. The server returns 404 for a
missing or foreign notification ID.

## Alternatives considered

- Keep the automatic bulk read on page open: a click would have no individual effect on that page.
- Mark a row read only in the browser: the read state would return after a reload or another device.
