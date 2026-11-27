#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// MARK: - Nap room

/// The Nap room: a normal ring room, bar Ma · Napok · Boop. Ma = today's page (summary, timeline, wall); Napok = the
/// last 14 days (yesterday's Napló place).
struct SpikeNapRoom: View {
    @Binding var tab: String
    let back: () -> Void
    let ask: () -> Void
    private let hue = Hue.alvas

    var body: some View {
        NKAreaPage(hue: hue, name: "Nap", eyebrow: tab == "Napok" ? "Nap · az elmúlt 14 nap" : "Nap · péntek, november 27.",
                   level: 0.46, display: "46",
                   headline: tab == "Napok" ? "Két hét visszafelé" : "Nyugodt nap, este röplabda",
                   sentence: tab == "Napok" ? "Minden nap egy sor: mit ettél, edzettél, hogy aludtál. Egy napra koppintva megnyílik."
                                            : "A napod 46 %-a foglalt. Délelőtt van a csend, este a röplabda.",
                   glyph: tab == "Napok" ? "napok-ink" : "sun-ink",
                   tabs: [NKAreaTab("Ma"), NKAreaTab("Napok", glyph: "napok-ink")], selectedTab: $tab,
                   onBack: back, onAsk: ask) {
            if tab == "Napok" { napok } else { ma }
            Color.clear.frame(height: 30)
        }
    }

    @ViewBuilder private var ma: some View {
        SpikeCard("Mai nap", glyph: "sun-ink", hue: hue) {
            VStack(alignment: .leading, spacing: 10) {
                NKCurve(values: [40, 55, 72, 80, 74, 66, 60, 70, 62, 45, 30],
                        labels: ["6", "", "9", "", "12", "", "15", "", "18", "", "21"], hue: hue, nowIndex: 5, height: 110, planAfterNow: true)
                HStack(spacing: 14) {
                    pin("dumbbell-ink", "07:00 edzés · kész")
                    pin("bowl-cream", "12:30 ebéd")
                    pin("bolt-ink", "19:00 röplabda")
                }
            }
        }
        NKHighlight(hue: hue, label: "Most", text: "Ebéd előtt: igyál egy pohár vizet",
                    sub: "Ma még 0,6 liter — délután edzés-nap kerete van.",
                    actions: [NKHighlightAction("Víz rögzítése") {}])
        SpikeCard("Amit ma észrevettem", glyph: "spark-cream", hue: hue) {
            VStack(spacing: 14) {
                SpikeRow(glyph: "moon-cream", title: "7 ó 20 p alvás", sub: "25 perccel kevesebb az évad igényénél", hue: hue)
                SpikeRow(glyph: "heart-cream", title: "Nyugalmi pulzus 54", sub: "a szokásosnál kicsit jobb", hue: hue)
            }
        }
        SpikeCard("Este", glyph: "moon-cream", trailing: "21:00-tól", hue: hue) {
            SpikeLine("Esti levezetés és a nap lezárása — kb. egy perc.")
        }
    }

    @ViewBuilder private var napok: some View {
        SpikeCard("Két hét egy pillantásra", glyph: "napok-ink", hue: hue) {
            NKHeatStrip(cells: [("H", 0.8), ("K", 0.7), ("Sze", 0.4), ("Cs", 0.9), ("P", 0.6), ("Szo", 0.5), ("V", 0.75),
                                ("H", 0.85), ("K", 0.65), ("Sze", 0.35), ("Cs", 0.2), ("P", 0.7), ("Szo", 0.8), ("V", 0.6)],
                        hue: hue, note: "minél világosabb, annál jobban ment a nap")
        }
        SpikeCard("Ez a hét", glyph: "het-ink", hue: hue) {
            VStack(spacing: 14) {
                dayRow("Csütörtök, nov. 26.", "kímélő nap · gyomorrontás", ["bowl-cream"])
                dayRow("Szerda, nov. 25.", "1980 kcal · röplabda · 6 ó 40 p", ["bowl-cream", "bolt-ink", "moon-cream"])
                dayRow("Kedd, nov. 24.", "2310 kcal · Felsőtest A · 7 ó 55 p", ["bowl-cream", "dumbbell-ink", "moon-cream"])
                dayRow("Hétfő, nov. 23.", "2240 kcal · 8 ó 05 p", ["bowl-cream", "moon-cream"])
            }
        }
        SpikeCard("Múlt hét", glyph: "book-sage", trailing: "nov. 16–22.", hue: hue) {
            VStack(spacing: 14) {
                dayRow("Vasárnap, nov. 22.", "2150 kcal · 8 ó 20 p", ["bowl-cream", "moon-cream"])
                dayRow("Szombat, nov. 21.", "2600 kcal · Alsótest B", ["bowl-cream", "dumbbell-ink"])
                dayRow("Péntek, nov. 20.", "2280 kcal · 7 ó 10 p", ["bowl-cream", "moon-cream"])
            }
        }
    }

    private func pin(_ g: String, _ t: String) -> some View {
        HStack(spacing: 5) {
            NKGlyph(g, hue.glow, size: 12)
            Text(t).nkFont(11).foregroundStyle(.white.opacity(0.7)).lineLimit(1).minimumScaleFactor(0.7)
        }
    }

    private func dayRow(_ title: String, _ sub: String, _ glyphs: [String]) -> some View {
        HStack(spacing: 12) {
            HStack(spacing: -6) {
                ForEach(glyphs, id: \.self) { g in
                    NKGlyph(g, .white.opacity(0.85), size: 13).frame(width: 28, height: 28)
                        .background(Circle().fill(hue.orb[1].opacity(0.55))).overlay(Circle().stroke(.black.opacity(0.25)))
                }
            }
            .frame(width: 70, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).nkFont(15, .medium).foregroundStyle(.white)
                Text(sub).nkFont(12.5).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 4)
            Image(systemName: "chevron.right").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.35))
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Étel room

/// The Étel room's Hét tab, where the weekly menu and the shopping list live now (moved from Évad).
struct SpikeEtelRoom: View {
    let back: () -> Void
    @State private var tab = "Hét"
    private let hue = Hue.fuel

    var body: some View {
        NKAreaPage(hue: hue, name: "Étel", eyebrow: "Étel · Hét", level: 0.64, display: "64",
                   headline: "A heted és a jövő heti menü",
                   sentence: "Itt van a jövő heti menü és a bevásárlólista — az évad receptjeiből, az évad kereteire.",
                   photo: NKPhoto.konyha, glyph: "bowl-cream",
                   tabs: ["Ma", "Receptek", "Kamra", "Hét"].map { NKAreaTab($0) }, selectedTab: $tab,
                   onBack: back, onAsk: {}) {
            // Hero: next week's menu.
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    NKMono("JÖVŐ HETI MENÜ · DEC. 1–7.")
                    Spacer()
                    Text("javaslat").nkFont(12, .semibold).foregroundStyle(NK.ground)
                        .padding(.horizontal, 10).frame(height: 24).background(Capsule().fill(hue.glow))
                }
                Text("21 étkezés, átlag 2350 kcal — még nem hagytad jóvá.")
                    .nkFont(19, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                VStack(spacing: 10) {
                    menuDay("H", "Csirkés bulgur, sült zöldség", "dumbbell-ink")
                    menuDay("K", "Lencsefőzelék, tükörtojás", "bolt-ink")
                    menuDay("Sze", "Pisztráng, édesburgonya", "dumbbell-ink")
                    menuDay("Cs", "Pulykás tortilla", "bolt-ink")
                }
                Text("+ 3 nap · reggelik és uzsonnák a menü lapon").nkFont(12.5).foregroundStyle(.white.opacity(0.55))
                NKActions([NKAction(title: "Jóváhagyom", primary: true) {}, NKAction(glyph: "repeat-deep", title: "Cserék") {}], hue: hue)
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()

            SpikeCard("Bevásárlólista", glyph: "check-ink", trailing: "12 / 31", hue: hue, chevron: true) {
                VStack(alignment: .leading, spacing: 12) {
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(.white.opacity(0.1))
                            Capsule().fill(hue.glow).frame(width: g.size.width * 12 / 31)
                        }
                    }
                    .frame(height: 8)
                    NKFlowRow(spacing: 8, rowSpacing: 8) {
                        ForEach(["Zöldség 4", "Hús, hal 3", "Tejtermék 2", "Kamra 2", "Pékáru 1"], id: \.self) { c in
                            Text(c).nkFont(12.5).foregroundStyle(.white.opacity(0.8))
                                .padding(.horizontal, 10).frame(height: 28)
                                .background(Capsule().fill(.white.opacity(0.08)))
                        }
                    }
                    SpikeLine("19 tétel van még hátra · korábbi listák a lista lapon", size: 12.5, opacity: 0.55)
                }
            }

            SpikeCard("A hét eddig", glyph: "chart-deep", hue: hue) {
                NKSteppedBars([NKStepBar(label: "H", value: 0.92), NKStepBar(label: "K", value: 0.98),
                               NKStepBar(label: "Sze", value: 1.12), NKStepBar(label: "Cs", value: 0.5, dimmed: true, note: "kímélő"),
                               NKStepBar(label: "P", value: 0.45), NKStepBar(label: "Szo", value: 0, dimmed: true), NKStepBar(label: "V", value: 0, dimmed: true)],
                              hue: hue, current: 4)
            }

            NKInfoRow("Az évad receptjei — 24 engedélyezett recept", hue: hue) {}
            Color.clear.frame(height: 30)
        }
    }

    private func menuDay(_ d: String, _ meal: String, _ g: String) -> some View {
        HStack(spacing: 12) {
            Text(d).nkFont(12, .semibold, design: .monospaced).foregroundStyle(.white.opacity(0.7)).frame(width: 30, alignment: .leading)
            Text(meal).nkFont(15).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.8)
            Spacer(minLength: 4)
            NKGlyph(g, hue.glow, size: 14)
        }
        .padding(.vertical, 2)
    }
}
#endif
