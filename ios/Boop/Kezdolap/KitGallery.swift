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
        if UserDefaults.standard.bool(forKey: "previewKitCards") {
            // `-previewKitCards YES`: only the Edzés redesign pieces, on a plain page (reviewable without scrolling).
            ScrollView {
                VStack(spacing: 14) { edzesKit }.padding(.horizontal, 16).padding(.vertical, 60)
            }
            .background(NK.ground.ignoresSafeArea())
            .nkToast($note)
        } else {
            gallery
        }
    }

    private var gallery: some View {
        NKAreaPage(
            hue: hue, name: "Edzés", eyebrow: "Edzés · ma", level: 0.62, display: "62", headline: "Van még benne több",
            sentence: "A héten *két edzés* van mögötted, a harmadik ma este fér bele.",
            photo: nil,
            tabs: [NKAreaTab("Ma"), NKAreaTab("Terv", dot: true), NKAreaTab("Gyakorlatok"), NKAreaTab("Előzmények", badge: 11)],
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

            edzesKit

            NKBare("A hét", hue: hue, trailing: "3-ból 2") {
                NKStatRow([NKStat(value: "13", target: "16", unit: "sorozat", label: "ezen a héten", hot: true),
                           NKStat(value: "84", unit: "perc", label: "összesen", trend: 1, age: "2 napja"),
                           NKStat(value: nil, label: "tonnázs")], hue: hue)
            }

            NKBare("A mezociklus nyolc hete", hue: hue) {
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

            NKBare("Teher és pihenés", hue: hue, glyph: "chart-deep", trailing: "hetente") {
                NKSeasonLoadChart(weeks: (1...12).map { w in
                    let past = w <= 7
                    return NKLoadWeek(label: "\(w).", load: [4.2, 4.6, 5.0, 5.4, 6.0, 6.3, 6.6, 3.6, 3.9, 3.0, 3.8, 3.4][w - 1],
                                      recovery: past ? [5.0, 5.1, 5.0, 5.1, 5.0, 4.7, 4.4][w - 1] : nil,
                                      over: (4...7).contains(w), faint: !past)
                }, nowIndex: 6, hue: hue)
            }

            // the season's first week: only one lived week has recovery — it shows as a short tick, not nothing
            NKBare("Teher és pihenés · 1 megélt hét", hue: hue, glyph: "chart-deep", trailing: "hetente") {
                NKSeasonLoadChart(weeks: (1...8).map { w in
                    NKLoadWeek(label: "\(w).", load: [3.1, 3.6, 3.6, 3.8, 3.4, 3.6, 3.9, 3.0][w - 1],
                               recovery: w == 1 ? 4.2 : nil, over: false, faint: w > 1)
                }, nowIndex: 0, hue: hue)
            }

            NKBare("A jövő heted", hue: hue, glyph: "clock-ink") {
                NKWeekLoadStrip(days: [NKLoadDay(weekday: "H", date: "24.", demand: 0.62, capacity: 0.82, word: "rendben"),
                                       NKLoadDay(weekday: "K", date: "25.", demand: 0.55, capacity: 0.78, word: "laza"),
                                       NKLoadDay(weekday: "Sz", date: "26.", demand: 0.80, capacity: 0.80, word: "szoros"),
                                       NKLoadDay(weekday: "Cs", date: "27.", demand: 1.12, capacity: 0.70, word: "túl sok"),
                                       NKLoadDay(weekday: "P", date: "28.", demand: 0.72, capacity: 0.76, word: "szoros"),
                                       NKLoadDay(weekday: "Sz", date: "29.", demand: 0.30, capacity: 0.85, word: "laza"),
                                       NKLoadDay(weekday: "V", date: "30.", demand: 0.48, capacity: 0.84, word: "laza")],
                                lit: 3, hue: hue)
            }

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
                NKRowList([NKAreaRow(glyph: "dumbbell-ink", title: "Hétfő · Váll és hát", sub: "52 perc",
                                     value: "4", valueSub: "sorozat", level: 0.8, hot: true, state: .done),
                           NKAreaRow(glyph: "dumbbell-ink", title: "Szerda · Láb", sub: "elmaradt",
                                     state: .skipped, chips: ["megfáztam"]),
                           NKAreaRow(glyph: "dumbbell-ink", title: "Péntek · Mell és kar", sub: "48 perc tervezve",
                                     value: "6", valueSub: "gyakorlat", state: .future,
                                     action: { note = "Péntek" })], hue: hue)
            }

            NKBare("Nincs mivel dolgoznom", hue: hue) { NKNoFreshData() }

            NKBare("Épp töltöm", hue: hue, state: .loading) { EmptyView() }

            NKBare("Nem sikerült", hue: hue,
                   state: .failed("Nem értem el a szervert.", { note = "Újra" })) { EmptyView() }

            NKBare("A hét napjai", hue: hue) {
                NKHeatStrip(cells: [("H", 0.8), ("K", 0), ("Sze", 0.55), ("Cs", 0), ("P", 0.9), ("Szo", 0.2), ("V", 0)],
                            hue: hue, note: "Három edzésnap, *kettő* közülük nehéz volt.")
            }
            .nkStale(NKStale(age: "frissítve 20 perce"))

            NKBare("Két mezociklus egymás mellett", hue: hue) {
                NKCompareColumns(leftTitle: "Tavaszi mezociklus", rightTitle: "Mostani mezociklus",
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

            NKBare("Egy hír, amit megnyithatsz", hue: hue, glyph: "search-ink") {
                VStack(alignment: .leading, spacing: 12) {
                    NKNewsCard(hue: hue, holding: "Világ-ETF", sleeve: "10+ év", holdingGlyph: "star-sun",
                               title: "A világ-ETF-ed 1,1%-ot esett a héten", effect: "\u{2212}18\u{00A0}400\u{00A0}Ft",
                               effectNote: "a te részeden", negative: true,
                               verdict: "Egy héten belüli mozgás a 10+ éves pénznél nem jelent semmit.",
                               confidence: 2, confidenceText: "Magas", sourceCount: 6) { note = "Elemzés" }
                    HStack(spacing: 14) {
                        ForEach(0..<3, id: \.self) { NKConfidenceDots(level: $0) }
                    }
                    NKNothingToDo("Ez a pénz 10+ évre szól. Egy heti mozgás nem ok a lépésre.", hue: hue)
                }
            }

            NKMenuGrid([NKMenuItem(glyph: "plus-ink", name: "Újat kezdenék", sub: "Új mezociklus vagy egyedi edzés", badge: 2) { note = "Új" },
                        NKMenuItem(glyph: "repeat-deep", name: "Megismétlem", sub: "A legutóbbi edzés újra") { note = "Ismét" },
                        NKMenuItem(glyph: "medal-sun", name: "Rekordjaim", sub: "Amit idén megdöntöttél") { note = "Rekordok" },
                        NKMenuItem(glyph: "book-sage", name: "Sablonok", sub: "Elmentett edzéseid") { note = "Sablonok" }],
                       hue: hue)

            NKAskRow(hue: hue, text: "Kérdezz Boopot az edzéseidről") { note = "Boop" }
        }
        .nkToast($note)
    }

    @ViewBuilder private var edzesKit: some View {
        // Edzés redesign kit (mezo-r36n9.197.1): the paged hero, section cards with each trailing kind, the inner
        // treatment and the in-card action row.
        NKSectionCard("Következik", hue: hue, glyph: "dumbbell-ink",
                      trailing: .menu(AnyView(NKMoreMenu {
                          Button("Újraindítás") { note = "Újraindítás" }
                          Button("Lezárás") { note = "Lezárás" }
                          Button("Mentés a sablonba") { note = "Sablon" }
                      }))) {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Szerda · Láb").nkFont(17, .semibold).foregroundStyle(.white)
                    Text("Hat gyakorlat, körülbelül 55 perc").nkFont(14).foregroundStyle(.white.opacity(0.65))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .nkInnerCard()
                NKCardActions(primary: NKCardAction("Indítás", glyph: "play.fill") { note = "Indítás" },
                              quiet: [NKCardAction("Csere") { note = "Csere" },
                                      NKCardAction("Kihagyom", enabled: false) { note = "Kihagyom" }],
                              primaryStyle: .hue(hue))
            }
        }

        NKSectionCard("Hol tartasz", hue: hue, trailing: .text("2 órája")) {
            NKCardActions(primary: NKCardAction("Szerkesztés") { note = "Szerkesztés" },
                          quiet: [NKCardAction("Mentés a sablonba") { note = "Sablon" }])
        }

        NKSectionCard("A mezociklus napjai", hue: hue, trailing: .chevron, onOpen: { note = "Napok" }) {
            Text("Öt edzésnap egy héten").nkFont(14).foregroundStyle(.white.opacity(0.75))
        }

        NKSectionCard("Izmok a héten", hue: hue, state: .loading) { EmptyView() }

        NKPagedHero(pages: [AnyView(heroPage("Futó mezociklus", "3. hét · 5. nap", "Hét hétből a harmadik")),
                            AnyView(heroPage("A hét", "13 / 16", "sorozat ezen a héten"))],
                    height: 180)

        NKPagedHero(pages: [AnyView(heroPage("Pihenőnap", "Ma nincs edzés", "Holnap láb jön"))], height: 140)
    }

    private func heroPage(_ label: String, _ big: String, _ sub: String) -> some View {
        VStack(spacing: 6) {
            Text(label.uppercased()).nkFont(12, .semibold).tracking(1.4).foregroundStyle(.white.opacity(0.6))
            Text(big).nkFont(30, .semibold).foregroundStyle(.white).multilineTextAlignment(.center)
            Text(sub).nkFont(14).foregroundStyle(.white.opacity(0.7)).multilineTextAlignment(.center)
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity)
    }
}
#endif
