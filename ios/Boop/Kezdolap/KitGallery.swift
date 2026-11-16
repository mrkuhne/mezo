#if DEBUG
import SwiftUI
import BoopDesign

/// Every block of the shared area-page kit on one page, with made-up content, so a simulator review can check
/// that each one renders, reads and fits — including the states that are easy to forget (no data, old data, a
/// search with no hit). Review only: `-previewKit YES`. Nothing ships this page.
struct KitGallery: View {
    @State private var tab = "Ma"
    @State private var note: String?

    private let hue = Hue.mozgas

    var body: some View {
        NKAreaPage(
            hue: hue, name: "Edzés", eyebrow: "Edzés · ma", score: 62, headline: "Van még benne több",
            sentence: "A héten *két edzés* van mögötted, a harmadik ma este fér bele.",
            photo: nil,
            tabs: [NKAreaTab("Ma"), NKAreaTab("Terv", badge: 2), NKAreaTab("Gyakorlatok"), NKAreaTab("Előzmények", badge: 11)],
            selectedTab: $tab,
            actions: [NKAreaAction(glyph: "search-ink", label: "Keresés") { note = "Keresés" },
                      NKAreaAction(glyph: "scale-ink", label: "Beállítások") { note = "Beállítások" }],
            onBack: nil
        ) {
            NKHighlight(hue: hue, label: "Ma este", text: "Váll és hát · 52 perc",
                        sub: "Hat gyakorlat, a nyomások nehezebbek a múlt hetinél.",
                        actions: [NKHighlightAction("Kezdjük el") { note = "Kezdjük el" },
                                  NKHighlightAction("Könnyítés", weight: .secondary) { note = "Könnyítés" },
                                  NKHighlightAction("Ma kihagyom", weight: .link) { note = "Kihagyom" }])

            NKBare("A hét", hue: hue, trailing: "3-ból 2") {
                NKStatRow([NKStat(value: "2", unit: "edzés", label: "ezen a héten", hot: true),
                           NKStat(value: "84", unit: "perc", label: "összesen", trend: 1),
                           NKStat(value: "18", unit: "sorozat", label: "nyomás", trend: -1)], hue: hue)
            }

            NKBare("A blokk nyolc hete", hue: hue) {
                NKSteppedBars([NKStepBar(label: "1", value: 0.5), NKStepBar(label: "2", value: 0.62),
                               NKStepBar(label: "3", value: 0.74), NKStepBar(label: "4", value: 0.3, dimmed: true, note: "levezető hét"),
                               NKStepBar(label: "5", value: 0.68), NKStepBar(label: "6", value: 0.8),
                               NKStepBar(label: "7", value: 0.9), NKStepBar(label: "8", value: 0.45)],
                              hue: hue, current: 5)
            }

            NKBare("Heti volumen · vállak", hue: hue) {
                VStack(alignment: .leading, spacing: 10) {
                    NKLevelBar(level: 0.62, hue: hue,
                               ticks: [NKLevelTick(at: 0.35, label: "MEV"), NKLevelTick(at: 0.78, label: "MAV")],
                               labelTicks: true)
                    NKHueText("*14 sorozat* — a minimum fölött, a jó sávban.", hue: hue, size: 13)
                }
            }
            .nkStale(NKStale(age: "2 napja", loud: true))

            NKBare("A nap energiája", hue: hue) {
                NKCurve(values: [0.3, 0.5, 0.72, 0.64, 0.42, 0.55, 0.8, 0.6, 0.35],
                        labels: ["6", "9", "12", "15", "18", "21"], hue: hue, target: 0.6, nowIndex: 5)
            }

            NKBare("Mire ment az idő", hue: hue) {
                NKComposition([NKPart(name: "Nyomás", value: 34, color: hue.glow),
                               NKPart(name: "Húzás", value: 28, color: hue.glow.opacity(0.7)),
                               NKPart(name: "Láb", value: 22, color: hue.glow.opacity(0.45)),
                               NKPart(name: "Core", value: 10, color: .white.opacity(0.45)),
                               NKPart(name: "Bemelegítés", value: 6, color: .white.opacity(0.25))])
            }

            NKBare("A mai gyakorlatok", hue: hue) {
                NKRowList([NKAreaRow(glyph: "dumbbell-ink", title: "Fekvenyomás", sub: "4 × 8 · 62,5 kg",
                                     value: "4", valueSub: "sorozat", level: 0.8, hot: true),
                           NKAreaRow(glyph: "dumbbell-ink", title: "Evezés", sub: "4 × 10 · 55 kg",
                                     value: "4", valueSub: "sorozat", level: 0.6, badge: 1),
                           NKAreaRow(glyph: "dumbbell-ink", title: "Oldalemelés", sub: "3 × 15 · 10 kg",
                                     value: "3", valueSub: "sorozat", level: 0.35,
                                     action: { note = "Oldalemelés" })], hue: hue)
            }

            NKBare("Nincs mivel dolgoznom", hue: hue) { NKNoFreshData() }

            NKBare("A hét napjai", hue: hue) {
                NKHeatStrip(cells: [("H", 0.8), ("K", 0), ("Sze", 0.55), ("Cs", 0), ("P", 0.9), ("Szo", 0.2), ("V", 0)],
                            hue: hue, note: "Három edzésnap, *kettő* közülük nehéz volt.")
            }
            .nkStale(NKStale(age: "frissítve 20 perce"))

            NKBare("Két blokk egymás mellett", hue: hue) {
                NKCompareColumns(leftTitle: "Tavaszi blokk", rightTitle: "Mostani blokk",
                                 lines: [NKCompareLine(label: "Edzések", left: "21", right: "18", favours: -1),
                                         NKCompareLine(label: "Heti volumen", left: "11", right: "14", favours: 1),
                                         NKCompareLine(label: "Rekordok", left: "3", right: "5", favours: 1)],
                                 hue: hue)
            }

            NKBare("Gyakorlattár", hue: hue, trailing: "166") {
                NKSearchableRowList([NKAreaRow(glyph: "dumbbell-ink", title: "Fekvenyomás", sub: "mell · rúd",
                                               terms: ["mell", "nyomás"]),
                                     NKAreaRow(glyph: "dumbbell-ink", title: "Húzódzkodás", sub: "hát · saját testsúly",
                                               terms: ["hát", "húzás"]),
                                     NKAreaRow(glyph: "dumbbell-ink", title: "Guggolás", sub: "láb · rúd",
                                               terms: ["láb"])],
                                    hue: hue, placeholder: "Gyakorlat vagy izomcsoport")
            }

            NKMenuGrid([NKMenuItem(glyph: "plus-ink", name: "Újat kezdenék", sub: "Új blokk vagy egyedi edzés", badge: 2) { note = "Új" },
                        NKMenuItem(glyph: "repeat-deep", name: "Megismétlem", sub: "A legutóbbi edzés újra") { note = "Ismét" },
                        NKMenuItem(glyph: "medal-sun", name: "Rekordjaim", sub: "Amit idén megdöntöttél") { note = "Rekordok" },
                        NKMenuItem(glyph: "book-sage", name: "Sablonok", sub: "Elmentett edzéseid") { note = "Sablonok" }],
                       hue: hue)

            NKAskRow(hue: hue, text: "Kérdezz Boopot az edzéseidről") { note = "Boop" }
        }
        .nkToast($note)
    }
}
#endif
