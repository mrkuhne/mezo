// ============================================================
// Mezo · értesítés-fajták 3D ikonja (mezo-me75u.3 → mezo-me75u.7).
//
// A fejléc értesítés-panele (`app/AppHeader.tsx`) és a teljes feed oldal
// (`features/me/pages/NotificationFeedPage.tsx`) UGYANAZT a 3D ikont rajzolja egy fajtához —
// a leképezés ezért itt él egyszer, nem két másolatban, amik szétcsúsznának.
//
// A `data/types.ts` fajta-metája clay neveket hordoz. A közös `CLAY_TO_3D` csak a
// kontextusmentes jelentéseket viszi (üveg bible U1 rule 7 / U3 rule 20); ami ITT mást jelent,
// azt ez a térkép nevezi meg a hívásnál. Ami nincs benne, a `ContentIcon` a közös térképen át
// (vagy clay-ként) rajzolja.
// ============================================================
import type { ClayIconName, Icon3DName } from '@/shared/ui/clay'

export const NTF_3D: Partial<Record<ClayIconName, Icon3DName>> = {
  'i-kristaly': 't-orb',     // Jóslatok / prediction_* — a forecast, not a score
  'i-lombik': 't-flask',     // Kísérletek
  'i-termes': 't-harvest',   // habit_formation
  'i-retegek': 't-people',   // graph_candidate (an Emberek-category row)
  'i-muhely': 't-chef',      // konzilium_verdict
  'i-rend': 't-stack',       // memory_note — a stored note, not the Rend chain
  'i-mezo': 't-chat',        // team_edition — a csapat megszólalt a falon (mezo-a9bo7.13)
}

/** The icon name a notification kind's clay glyph renders as (feed `ContentIcon` input). */
export const ntfIcon = (name: ClayIconName): ClayIconName | Icon3DName => NTF_3D[name] ?? name
