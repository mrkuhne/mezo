---
name: verify
description: How to runtime-verify mezo frontend changes end-to-end — build/launch/drive recipe for the mock-mode PWA surface.
---

# mezo frontend verify recipe

- **Launch (no backend needed):** `cd frontend && VITE_USE_MOCK=true pnpm dev` (background) → http://localhost:5180. Real mode needs the Spring backend on :8090 (`docker compose up -d` + `./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata`).
- **Drive:** chrome-devtools MCP. Resize to 430×932 for phone layout. `take_snapshot` (a11y tree) beats screenshots for asserting structure; screenshots for visual evidence.
- **Mock-state gotcha:** all mock data (incl. gamification XP/coins/streak) lives in the TanStack cache — session-local. Hard reload / `navigate_page` resets to the seed; in-app `Link` navigation preserves it. Plan interaction sequences on ONE loaded page.
- **Date duality:** the mock world-date is a fixed const (displays "Máj 22") but log mutations + gamification use the REAL system date (`localDateString()`); new entries land in the real-dated week rows.
- **Toast capture:** ToastProvider shows one `.toast` (top:70px) for 3.2s. Screenshot round-trips usually miss it — poll `document.querySelector('.toast')?.textContent` via `evaluate_script` right after the triggering click.
- **Useful flows:** quick log via the FAB ("Gyors logolás") tiles; weight log = /me/weight → "Súly naplózása" → "Mentés"; check-in = /today "Hogy vagy ma?" tile → 4-step wizard (value clicks auto-advance, ~600ms animation) → "Mentés · 14:00".
