#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

/// The Évad room: its own evening-violet world, bar Most · Hét · Terv · Kísérlet · Boop, every tab opening with the
/// room orb + eyebrow + „what you see here" sentence, its own hero visual, then glass cards.
struct SpikeEvadRoom: View {
    @Binding var tab: String
    let mode: SpikeMostMode
    let back: () -> Void
    let open: (SpikeScreen) -> Void
    let ask: () -> Void
    private let hue = Hue.evad

    static let tabs: [NKAreaTab] = [NKAreaTab("Most", glyph: "most-ink"), NKAreaTab("Hét", glyph: "het-ink"),
                                    NKAreaTab("Terv", glyph: "terv-ink"), NKAreaTab("Kísérlet", glyph: "kiserlet-ink")]

    private var head: (headline: String, sentence: String, glyph: String) {
        switch tab {
        case "Hét": ("Hogy ment, és mi jön?", "Itt nézed át vasárnap a hetet: a terhelést, a jövő hetet és amit Boop tanult.", "het-ink")
        case "Terv": ("Mi a nagy terv?", "Az évad egészben: hol tartasz az évben, mi a cél, és mi mire hat.", "terv-ink")
        case "Kísérlet": ("Kipróbálok valamit", "Egyszerre egy kísérlet fut; Boop őszintén megmondja, hatott-e.", "kiserlet-ink")
        default:
            mode == .early
                ? ("Még nincs mit nézni", "A hét most kezdődött — holnap már látod, hogy indult.", "most-ink")
                : ("Jól megy a hét, csak az alvás csúszik", "Ez a hét eddig, hétfőtől tegnapig: mennyire tartottad az évad tervét.", "most-ink")
        }
    }

    var body: some View {
        let h = head
        let early = mode == .early && tab == "Most"
        NKAreaPage(hue: hue, name: "Évad", eyebrow: "Őszi fogyás · 7. hét a 12-ből",
                   level: early ? nil : 0.78, display: early ? nil : "78",
                   headline: h.headline, sentence: h.sentence, glyph: h.glyph,
                   tabs: Self.tabs, selectedTab: $tab,
                   actions: [NKAreaAction(glyph: "repeat-deep", label: "Frissítés") {}],
                   onBack: back, onAsk: ask) {
            switch tab {
            case "Hét": SpikeHet(open: open)
            case "Terv": SpikeTerv(open: open)
            case "Kísérlet": SpikeKiserlet()
            default: SpikeMost(mode: mode, open: open)
            }
            Color.clear.frame(height: 30)
        }
    }
}

// MARK: - Most

struct SpikeMost: View {
    let mode: SpikeMostMode
    let open: (SpikeScreen) -> Void
    private let hue = Hue.evad

    var body: some View {
        if mode == .sunday {
            sundayCard
        }
        if mode != .early {
            SpikeCard("A hét eddig · hétfő–csütörtök", glyph: "most-ink", chevron: true) {
                VStack(spacing: 16) {
                    SpikeBar(glyph: "bowl-cream", name: "Étel", done: 3, of: 4, unit: "nap a kereten belül", hue: hue)
                    SpikeBar(glyph: "dumbbell-ink", name: "Edzés", done: 2, of: 2, unit: "alkalom megvolt", hue: hue)
                    SpikeBar(glyph: "moon-cream", name: "Alvás", done: 2, of: 4, unit: "éjszaka elég", hue: hue)
                }
            }
        }
        SpikeCard("A hét napjai", glyph: "het-ink", trailing: mode == .early ? "hétfő" : "péntek") {
            SpikeDayDots(days: mode == .early
                         ? [.today, .future, .future, .future, .future, .future, .future]
                         : (mode == .sunday ? [.inPlan, .inPlan, .out, .kimelo, .inPlan, .inPlan, .today]
                                            : [.inPlan, .inPlan, .out, .kimelo, .today, .future, .future]))
        }
        SpikeCard("Ami jön", glyph: "clock-ink") {
            VStack(spacing: 14) {
                SpikeRow(glyph: "dumbbell-ink", title: "Holnap 07:00 · Felsőtest B", sub: "a blokk 3. hete, 52 perc")
                SpikeRow(glyph: "evad-ink", title: "A 9. hét könnyebb lesz", sub: "4 edzés helyett 3 — sűrű a naptárad")
                if mode != .sunday {
                    SpikeRow(glyph: "atnezes-ink", title: "Heti átnézés vasárnap 18:00-tól", sub: "2 nap múlva · kb. 3 perc")
                }
            }
        }
    }

    private var sundayCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                NKGlyph("atnezes-ink", .white, size: 30)
                    .frame(width: 56, height: 56)
                    .background(Circle().fill(LinearGradient(colors: [hue.orb[1], hue.orb[3].opacity(0.8)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                    .shadow(color: hue.glow.opacity(0.7), radius: 14)
                VStack(alignment: .leading, spacing: 3) {
                    NKMono("VASÁRNAP ESTE")
                    Text("Kész a heti átnézés").nkFont(22, design: .serif).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            SpikeLine("Öt rövid lap: hogy ment a hét, mit tanult Boop, és mi jön. Bármikor abbahagyhatod.")
            NKActions([NKAction(title: "Kezdjük", primary: true) { open(.review(1)) },
                       NKAction(title: "Később") {}], hue: hue)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(LinearGradient(colors: [hue.orb[1].opacity(0.45), hue.orb[0].opacity(0.35)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(hue.glow.opacity(0.55), lineWidth: 1.2))
        )
    }
}

// MARK: - Hét

struct SpikeHet: View {
    let open: (SpikeScreen) -> Void
    private let hue = Hue.evad

    var body: some View {
        // Hero: the weekly review.
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 16) {
                SpikeReviewIllustration(page: 0, hue: hue).frame(width: 92, height: 92)
                VStack(alignment: .leading, spacing: 4) {
                    NKMono("HETI ÁTNÉZÉS · 6. HÉT")
                    Text("Kész · vasárnap 19:12").nkFont(20, design: .serif).foregroundStyle(.white)
                    Text("A következő: vasárnap 18:00-tól").nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                }
            }
            HStack(alignment: .top, spacing: 10) {
                Capsule().fill(hue.glow).frame(width: 3)
                Text("„Kevesebb késő esti evés” — a héten 4 napból 3-szor sikerült.")
                    .nkFont(15, design: .serif).foregroundStyle(.white.opacity(0.9))
                    .fixedSize(horizontal: false, vertical: true)
            }
            NKActions([NKAction(glyph: "atnezes-ink", title: "Múlt hét újra") { open(.review(1)) }], hue: hue)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()

        SpikeCard("Teher és pihenés", glyph: "bolt-ink", trailing: "12 hét", chevron: true) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Az 5. héten volt a legnagyobb a teher; azóta a pihenés utolérte.")
                    .nkFont(16, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                NKSeasonLoadChart(weeks: spikeLoadWeeks, nowIndex: 6, hue: hue)
            }
        }

        SpikeCard("A jövő heted", glyph: "het-ink", trailing: "2 javaslat", chevron: true) {
            VStack(alignment: .leading, spacing: 12) {
                NKWeekLoadStrip(days: spikeNextWeek, lit: 1, hue: hue)
                SpikeLine("Kedd és csütörtök szoros: Boop két dolgot tenne át.")
            }
        }

        SpikeCard("Boop javaslata", glyph: "chat-ink") {
            VStack(alignment: .leading, spacing: 12) {
                Text("A 9. hét legyen könnyebb")
                    .nkFont(19, design: .serif).foregroundStyle(.white)
                SpikeLine("Sűrű lesz a naptárad, és kétszer is rövid volt az alvásod. Csak szólok — semmi nem változik magától.")
                NKActions([NKAction(glyph: "chat-ink", title: "Megbeszélem Boop-pal") {}], hue: hue)
            }
        }

        SpikeCard("Amit Boop tanult", glyph: "spark-cream", trailing: "7", chevron: true, action: { open(.sub("tanult")) }) {
            HStack(spacing: 10) {
                learnChip("3", "szám rólad")
                learnChip("2", "minta")
                learnChip("2", "észrevétel")
            }
        }
    }

    private func learnChip(_ n: String, _ word: String) -> some View {
        VStack(spacing: 2) {
            Text(n).font(.custom(Lagy.outfitFamily, size: 26).weight(.light)).foregroundStyle(.white)
            Text(word).nkFont(11.5).foregroundStyle(.white.opacity(0.6)).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.06)))
    }
}

let spikeLoadWeeks: [NKLoadWeek] = [
    NKLoadWeek(label: "1", load: 0.55, recovery: 0.8, over: false, faint: false),
    NKLoadWeek(label: "2", load: 0.68, recovery: 0.78, over: false, faint: false),
    NKLoadWeek(label: "3", load: 0.8, recovery: 0.72, over: true, faint: false),
    NKLoadWeek(label: "4", load: 0.86, recovery: 0.7, over: true, faint: false),
    NKLoadWeek(label: "5", load: 0.95, recovery: 0.66, over: true, faint: false),
    NKLoadWeek(label: "6", load: 0.6, recovery: 0.82, over: false, faint: false),
    NKLoadWeek(label: "7", load: 0.72, recovery: 0.78, over: false, faint: false),
    NKLoadWeek(label: "8", load: 0.78, recovery: nil, over: false, faint: true),
    NKLoadWeek(label: "9", load: 0.5, recovery: nil, over: false, faint: true),
    NKLoadWeek(label: "10", load: 0.8, recovery: nil, over: false, faint: true),
    NKLoadWeek(label: "11", load: 0.84, recovery: nil, over: false, faint: true),
    NKLoadWeek(label: "12", load: 0.6, recovery: nil, over: false, faint: true),
]

let spikeNextWeek: [NKLoadDay] = [
    NKLoadDay(weekday: "H", date: "1.", demand: 0.6, capacity: 0.9, word: "laza"),
    NKLoadDay(weekday: "K", date: "2.", demand: 1.1, capacity: 0.85, word: "szoros"),
    NKLoadDay(weekday: "Sze", date: "3.", demand: 0.7, capacity: 0.9, word: "rendben"),
    NKLoadDay(weekday: "Cs", date: "4.", demand: 1.05, capacity: 0.8, word: "szoros"),
    NKLoadDay(weekday: "P", date: "5.", demand: 0.65, capacity: 0.9, word: "rendben"),
    NKLoadDay(weekday: "Szo", date: "6.", demand: 0.5, capacity: 1.0, word: "laza"),
    NKLoadDay(weekday: "V", date: "7.", demand: 0.3, capacity: 1.0, word: "laza"),
]

// MARK: - Terv

struct SpikeTerv: View {
    let open: (SpikeScreen) -> Void
    private let hue = Hue.evad

    var body: some View {
        // Hero: the year strip.
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                NKMono("2026 · AZ ÉVED")
                Spacer()
                Text("Edzés › Éves terv").nkFont(12).foregroundStyle(.white.opacity(0.55))
                Image(systemName: "chevron.right").nkFont(11, .semibold).foregroundStyle(.white.opacity(0.4))
            }
            SpikeYearStrip(hue: hue).frame(height: 118)
            Text("Az évad a 39. héttől az 50.-ig tart; most a 45. hétnél jársz, a Hipertrófia blokk közepén.")
                .nkFont(13.5).foregroundStyle(.white.opacity(0.72)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()
        .accessibilityElement(children: .combine)

        SpikeCard("Az évad hetei", glyph: "evad-ink", trailing: "7 / 12") {
            SpikeSeasonWeeks(hue: hue)
        }

        SpikeCard("A cél", glyph: "scale-ink", trailing: "Súly szoba", chevron: true) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("82").font(.custom(Lagy.outfitFamily, size: 40).weight(.light)).foregroundStyle(.white)
                    Text("kg · január 18.").nkFont(15).foregroundStyle(.white.opacity(0.7))
                    Spacer()
                    Text("most 84,1").nkFont(13).foregroundStyle(.white.opacity(0.6))
                }
                // NKCurve draws from 0, so the curve is the kilos above 80.
                NKCurve(values: [86.2, 85.9, 85.5, 85.3, 84.9, 84.6, 84.1, 83.7, 83.3, 82.9, 82.5, 82.0].map { $0 - 80 },
                        labels: ["1. hét", "", "", "", "", "", "most", "", "", "", "", "jan. 18."], hue: hue, target: 2,
                        nowIndex: 6, height: 110, planAfterNow: true)
            }
        }

        SpikeCard("Mi mire hat", glyph: "cycle-ink", chevron: true, action: { open(.sub("mimirehat")) }) {
            HStack(spacing: 14) {
                SpikeSystemMap(hue: hue, compact: true).frame(width: 96, height: 96)
                Text("Az Évad mondja meg, mennyit és miért; a szobák azt, mit csinálsz ma; a Súly, mi lett belőle.")
                    .nkFont(14.5, design: .serif).foregroundStyle(.white.opacity(0.88))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }

        SpikeCard("Az évad terve", glyph: "terv-ink") {
            VStack(spacing: 14) {
                SpikeRow(glyph: "dumbbell-ink", title: "Hipertrófia blokk · 4 edzés", sub: "+ 2 röplabda (kedd, csütörtök)", value: "Edzés")
                SpikeRow(glyph: "bowl-cream", title: "2440 / 2270 / 2350 kcal", sub: "edzés- / pihenő- / kettős nap · 165 g fehérje", value: "Étel")
                SpikeRow(glyph: "moon-cream", title: "7 ó 45 p alvás", sub: "lefekvés 22:30 · ébredés 06:30", value: "Alvás")
                SpikeRow(glyph: "scale-ink", title: "84,1 → 82 kg", sub: "heti −0,4 kg · január 18-ig", value: "Súly")
            }
        }

        NKInfoRow("Szabályok — menünap, feldolgozott étel, könnyítő hetek", hue: hue) {}

        NKActions([NKAction(glyph: "repeat-deep", title: "Módosítás", primary: true) {},
                   NKAction(glyph: "plus-ink", title: "Új évad") {}], hue: hue)
    }
}

/// 52 weeks, the year plan's blocks as segments, the season as a bracket over them and „itt tartasz".
struct SpikeYearStrip: View {
    let hue: Hue
    static let blocks: [(from: Int, to: Int, name: String, tone: Double)] = [
        (1, 8, "Alap", 0.35), (9, 10, "", 0.12), (11, 18, "Erő", 0.55), (19, 20, "", 0.12), (21, 30, "Hipertrófia", 0.7),
        (31, 33, "Pihenő", 0.12), (34, 38, "Alap", 0.35), (39, 50, "Hipertrófia", 0.85), (51, 52, "", 0.12),
    ]
    var body: some View {
        Canvas { ctx, size in
            let w = size.width
            let cell = w / 52
            let barY: CGFloat = 46, barH: CGFloat = 26
            for b in Self.blocks {
                let x = CGFloat(b.from - 1) * cell + 0.75
                let r = CGRect(x: x, y: barY, width: CGFloat(b.to - b.from + 1) * cell - 1.5, height: barH)
                let path = Path(roundedRect: r, cornerRadius: 5)
                if b.from == 39 {
                    ctx.fill(path, with: .linearGradient(Gradient(colors: [hue.orb[1], hue.glow]), startPoint: CGPoint(x: r.minX, y: 0), endPoint: CGPoint(x: r.maxX, y: 0)))
                } else {
                    ctx.fill(path, with: .color(.white.opacity(b.tone * 0.42)))
                }
            }
            // week ticks
            for i in 0...52 where i % 4 == 0 {
                let x = CGFloat(i) * cell
                ctx.stroke(Path { p in p.move(to: CGPoint(x: x, y: barY + barH + 4)); p.addLine(to: CGPoint(x: x, y: barY + barH + 8)) },
                           with: .color(.white.opacity(0.3)), lineWidth: 1)
            }
            // the season's bracket
            let sx = CGFloat(38) * cell, ex = CGFloat(50) * cell
            ctx.stroke(Path { p in
                p.move(to: CGPoint(x: sx, y: barY - 4)); p.addLine(to: CGPoint(x: sx, y: barY - 12))
                p.addLine(to: CGPoint(x: ex, y: barY - 12)); p.addLine(to: CGPoint(x: ex, y: barY - 4))
            }, with: .color(hue.glow), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            ctx.draw(Text("ÉVAD").font(.system(size: 10, weight: .semibold, design: .monospaced)).foregroundStyle(hue.glow),
                     at: CGPoint(x: (sx + ex) / 2, y: barY - 22))
            // itt tartasz
            let nx = CGFloat(44.5) * cell
            ctx.stroke(Path { p in p.move(to: CGPoint(x: nx, y: barY - 2)); p.addLine(to: CGPoint(x: nx, y: barY + barH + 14)) },
                       with: .color(.white), lineWidth: 2)
            ctx.fill(Path(ellipseIn: CGRect(x: nx - 4, y: barY + barH + 12, width: 8, height: 8)), with: .color(.white))
            ctx.draw(Text("itt tartasz").font(.system(size: 11, weight: .medium)).foregroundStyle(.white),
                     at: CGPoint(x: min(nx, w - 32), y: barY + barH + 30))
            // months
            let months = ["J", "F", "M", "Á", "M", "J", "J", "A", "Sz", "O", "N", "D"]
            for (i, m) in months.enumerated() {
                let x = (CGFloat(i) + 0.5) * w / 12
                ctx.draw(Text(m).font(.system(size: 10, design: .monospaced)).foregroundStyle(.white.opacity(0.45)),
                         at: CGPoint(x: x, y: 10))
            }
            // block names (only the wide ones)
            for b in Self.blocks where !b.name.isEmpty && b.to - b.from >= 7 && b.from != 39 {
                let cx = (CGFloat(b.from - 1) + CGFloat(b.to - b.from + 1) / 2) * cell
                ctx.draw(Text(b.name).font(.system(size: 9, weight: .medium)).foregroundStyle(.white.opacity(0.7)),
                         at: CGPoint(x: cx, y: barY + barH / 2))
            }
        }
        .accessibilityLabel("Az éved 52 hete: az évad a 39. héttől az 50.-ig, most a 45. hétnél tartasz")
    }
}

/// Weeks 1…12 of the season: done, this one, the lighter week with its reason, the end.
struct SpikeSeasonWeeks: View {
    let hue: Hue
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 4) {
                ForEach(1...12, id: \.self) { w in
                    VStack(spacing: 6) {
                        cell(w)
                        Text("\(w)").nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(w == 7 ? 1 : 0.5))
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            HStack(spacing: 8) {
                Circle().fill(Color(hex: 0x9FC7D6)).frame(width: 8, height: 8)
                Text("9. hét könnyebb — sűrű naptár").nkFont(12.5).foregroundStyle(.white.opacity(0.7))
            }
            HStack(spacing: 8) {
                NKGlyph("terv-ink", .white.opacity(0.7), size: 12)
                Text("Az évad vége: január 18. · utána súlytartás").nkFont(12.5).foregroundStyle(.white.opacity(0.7))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Az évad 12 hete: 6 kész, most a 7. hét, a 9. hét könnyebb, vége január 18-án")
    }

    @ViewBuilder private func cell(_ w: Int) -> some View {
        let shape = RoundedRectangle(cornerRadius: 6, style: .continuous)
        if w < 7 {
            shape.fill(LinearGradient(colors: [hue.orb[2], hue.orb[1]], startPoint: .top, endPoint: .bottom)).frame(height: 34)
        } else if w == 7 {
            shape.stroke(.white, lineWidth: 2).frame(height: 34).overlay(shape.fill(hue.glow.opacity(0.35)).padding(3))
        } else if w == 9 {
            shape.fill(Color(hex: 0x9FC7D6).opacity(0.35)).frame(height: 22).overlay(shape.stroke(Color(hex: 0x9FC7D6), lineWidth: 1)).frame(height: 34, alignment: .bottom)
        } else if w == 12 {
            shape.stroke(.white.opacity(0.35), style: StrokeStyle(lineWidth: 1.2, dash: [3, 3])).frame(height: 34)
                .overlay(NKGlyph("terv-ink", .white.opacity(0.75), size: 13))
        } else {
            shape.stroke(.white.opacity(0.25), style: StrokeStyle(lineWidth: 1.2, dash: [3, 3])).frame(height: 34)
        }
    }
}

/// The system map: Évad in the middle feeding Étel, Edzés and Alvás, all three flowing into Súly.
struct SpikeSystemMap: View {
    let hue: Hue
    var compact = false
    var body: some View {
        Canvas { ctx, size in
            let w = size.width, h = size.height
            let c = CGPoint(x: w / 2, y: h * 0.42)
            let r = min(w, h) * (compact ? 0.36 : 0.34)
            let nodes: [(CGPoint, Hue?, String)] = [
                (CGPoint(x: c.x - r, y: c.y - r * 0.55), .fuel, "Étel"),
                (CGPoint(x: c.x + r, y: c.y - r * 0.55), .mozgas, "Edzés"),
                (CGPoint(x: c.x - r * 0.95, y: c.y + r * 0.7), .alvas, "Alvás"),
                (CGPoint(x: c.x + r * 0.95, y: c.y + r * 0.7), .suly, "Súly"),
            ]
            let line = StrokeStyle(lineWidth: compact ? 1.5 : 2, lineCap: .round, dash: compact ? [] : [5, 5])
            for (i, n) in nodes.enumerated() where i < 3 {
                ctx.stroke(Path { p in p.move(to: c); p.addLine(to: n.0) }, with: .color(hue.glow.opacity(0.75)), style: line)
                ctx.stroke(Path { p in p.move(to: n.0); p.addQuadCurve(to: nodes[3].0, control: CGPoint(x: (n.0.x + nodes[3].0.x) / 2, y: max(n.0.y, nodes[3].0.y) + r * 0.35)) },
                           with: .color(.white.opacity(0.22)), style: StrokeStyle(lineWidth: compact ? 1 : 1.5, lineCap: .round))
            }
            let big: CGFloat = compact ? 26 : 70, small: CGFloat = compact ? 16 : 44
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - big / 2, y: c.y - big / 2, width: big, height: big)),
                     with: .radialGradient(Gradient(colors: [hue.orb[2], hue.orb[1], hue.orb[0]]), center: c, startRadius: 0, endRadius: big / 2))
            if !compact {
                ctx.draw(Text("Évad").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white), at: c)
            }
            for n in nodes {
                let col = n.1?.orb ?? hue.orb
                ctx.fill(Path(ellipseIn: CGRect(x: n.0.x - small / 2, y: n.0.y - small / 2, width: small, height: small)),
                         with: .radialGradient(Gradient(colors: [col[2], col[1], col[0]]), center: n.0, startRadius: 0, endRadius: small / 2))
                if !compact {
                    ctx.draw(Text(n.2).font(.system(size: 12, weight: .medium)).foregroundStyle(.white), at: CGPoint(x: n.0.x, y: n.0.y + small / 2 + 12))
                }
            }
        }
        .accessibilityLabel("Az Évad hat az Ételre, az Edzésre és az Alvásra; mindhárom a Súlyon látszik")
    }
}

// MARK: - Kísérlet

struct SpikeKiserlet: View {
    private let hue = Hue.evad
    var body: some View {
        // Hero: the running experiment.
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 16) {
                ZStack {
                    Circle().stroke(.white.opacity(0.12), lineWidth: 9)
                    Circle().trim(from: 0, to: 9.0 / 14)
                        .stroke(LinearGradient(colors: [hue.orb[1], hue.glow], startPoint: .top, endPoint: .bottom),
                                style: StrokeStyle(lineWidth: 9, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 0) {
                        Text("9").font(.custom(Lagy.outfitFamily, size: 30).weight(.light)).foregroundStyle(.white)
                        Text("/ 14 nap").nkFont(11).foregroundStyle(.white.opacity(0.6))
                    }
                }
                .frame(width: 96, height: 96)
                VStack(alignment: .leading, spacing: 4) {
                    NKMono("FUT · MÉG 5 NAP")
                    Text("Este 21 után nincs képernyő — mélyebb lesz az alvás?")
                        .nkFont(18, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                }
            }
            HStack(spacing: 5) {
                ForEach(0..<14, id: \.self) { i in
                    Capsule()
                        .fill(i < 9 ? (i == 4 ? NK.under.opacity(0.7) : hue.glow) : .white.opacity(0.14))
                        .frame(height: 16)
                }
            }
            SpikeLine("9 napból 8-at jelöltél be. Az eredményt a 14. nap után mutatom, összevetve az előtte lévő két héttel.")
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()

        SpikeCard("Amit mérünk", glyph: "chart-deep") {
            VStack(spacing: 14) {
                SpikeRow(glyph: "moon-cream", title: "Mélyalvás percei", sub: "eddig +11 perc az előző két héthez képest")
                SpikeRow(glyph: "heart-cream", title: "Reggeli pulzus", sub: "még nincs elég adat a döntéshez")
            }
        }

        SpikeCard("Korábbi kísérletek", glyph: "book-sage", trailing: "2") {
            VStack(spacing: 14) {
                SpikeRow(glyph: "check-ink", title: "Fehérjés reggeli → kevesebb nassolás", sub: "bevált · szabály lett")
                SpikeRow(glyph: "clock-ink", title: "Kávé csak 14 óra előtt", sub: "nem dőlt el — túl kevés nap")
            }
        }

        NKActions([NKAction(glyph: "plus-ink", title: "Új kísérlet") {}], hue: hue)
        SpikeLine("Egyszerre egy kísérlet fut — az újat a mostani vége után indíthatod.", size: 12.5, opacity: 0.55)
    }
}

// MARK: - No season yet

struct SpikeNoSeason: View {
    let back: () -> Void
    private let hue = Hue.evad
    var body: some View {
        NKAreaPage(hue: hue, name: "Évad", eyebrow: "Évad · még nincs", level: nil, display: nil,
                   headline: "Indítsunk egy évadot",
                   sentence: "Egy évad néhány hét egy céllal: mennyit eszel, mennyit edzel, mennyit alszol — és miért.",
                   glyph: "evad-ink", onBack: back) {
            VStack(spacing: 18) {
                SpikeEmptyIllustration(hue: hue).frame(height: 170)
                VStack(alignment: .leading, spacing: 10) {
                    Text("Öt lépés, kb. két perc").nkFont(20, design: .serif).foregroundStyle(.white)
                    SpikeLine("Megadod a célt és a heteket; Boop kiszámolja a kereteket, és megmutatja, mi mire hat. Utána itt látod hétről hétre, hogy állsz.")
                    NKActions([NKAction(title: "Megnézem", primary: true) {}], hue: hue)
                }
            }
            .padding(18)
            .nkGlass()
        }
    }
}

/// Empty state: a path of weeks rising to the evening sun, nothing on it yet.
struct SpikeEmptyIllustration: View {
    let hue: Hue
    var body: some View {
        Canvas { ctx, size in
            let w = size.width, h = size.height
            let sun = CGPoint(x: w * 0.68, y: h * 0.45)
            ctx.fill(Path(ellipseIn: CGRect(x: sun.x - 46, y: sun.y - 46, width: 92, height: 92)),
                     with: .radialGradient(Gradient(colors: [hue.orb[3], hue.orb[1].opacity(0.6), .clear]), center: sun, startRadius: 4, endRadius: 60))
            ctx.fill(Path { p in
                p.move(to: CGPoint(x: 0, y: h * 0.72))
                p.addCurve(to: CGPoint(x: w, y: h * 0.62), control1: CGPoint(x: w * 0.3, y: h * 0.55), control2: CGPoint(x: w * 0.6, y: h * 0.78))
                p.addLine(to: CGPoint(x: w, y: h)); p.addLine(to: CGPoint(x: 0, y: h)); p.closeSubpath()
            }, with: .color(hue.orb[0].opacity(0.9)))
            for i in 0..<8 {
                let t = CGFloat(i) / 7
                let x = w * (0.12 + t * 0.5), y = h * (0.9 - t * 0.28)
                ctx.stroke(Path(roundedRect: CGRect(x: x - 7, y: y - 7, width: 14, height: 14), cornerRadius: 4),
                           with: .color(.white.opacity(0.35 + 0.05 * Double(i))), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2]))
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Second-level pages

struct SpikeMiMireHat: View {
    let back: () -> Void
    private let hue = Hue.evad
    var body: some View {
        NKAreaSubPage(hue: hue, crumb: "Évad › Terv", eyebrow: "Mi mire hat", title: "Hogyan függ össze minden",
                      sentence: "Egy kép arról, hogy az évad hogyan jut el a tányérodig, az edzésedig és az ágyadig.", onBack: back) {
            SpikeSystemMap(hue: hue).frame(height: 280)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity)
                .nkGlass()
            VStack(alignment: .leading, spacing: 10) {
                NKMono("EGY MONDATBAN")
                Text("Az Évad mondja meg, mennyit és miért; az Étel, az Edzés és az Alvás szoba azt, mit csinálsz ma; a Súly szoba mutatja, mi lett belőle.")
                    .nkFont(19, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            SpikeCard("A rétegek", glyph: "terv-ink") {
                VStack(spacing: 14) {
                    SpikeRow(glyph: "terv-ink", title: "Év", sub: "52 hét blokkokban — az Edzés › Éves tervben szerkeszted")
                    SpikeRow(glyph: "evad-ink", title: "Évad", sub: "néhány hét: a cél, a futó blokk, étel, alvás")
                    SpikeRow(glyph: "het-ink", title: "Hét", sub: "vasárnap este a heti átnézés")
                    SpikeRow(glyph: "sun-ink", title: "Nap", sub: "a szobák: mit csinálsz ma")
                }
            }
        }
    }
}

struct SpikeTanult: View {
    let back: () -> Void
    private let hue = Hue.evad
    var body: some View {
        NKAreaSubPage(hue: hue, crumb: "Évad › Hét", eyebrow: "Amit Boop tanult", title: "Hét dolog, amit már tudok rólad",
                      sentence: "Számok a tested hétköznapjairól, minták a heteidből, és amit Boop észrevett.", onBack: back) {
            SpikeCard("Mennyit bírsz", glyph: "bolt-ink", trailing: "3 szám") {
                NKStatRow([NKStat(value: "2590", unit: "kcal", label: "valódi napi égetés", hot: true),
                           NKStat(value: "3,4", unit: "óra", label: "edzés egy héten"),
                           NKStat(value: "2", unit: "nap", label: "sűrű nap után pihenő")], hue: hue)
            }
            SpikeCard("Amit a mozgatásokból tanultam", glyph: "repeat-deep", trailing: "2 minta") {
                VStack(spacing: 14) {
                    SpikeRow(glyph: "check-ink", title: "Keddről szerdára tett edzés", sub: "4-ből 4-szer megcsináltad — jól működik")
                    SpikeRow(glyph: "clock-ink", title: "Röplabda utáni reggeli edzés", sub: "3-ból 2-szer kimaradt — Boop már nem javasolja")
                }
            }
            SpikeCard("Amit Boop észrevett", glyph: "spark-cream", trailing: "2") {
                VStack(spacing: 14) {
                    SpikeRow(glyph: "moon-cream", title: "Rövid éjszaka után többet eszel", sub: "átlagosan +280 kcal a következő napon")
                    SpikeRow(glyph: "bowl-cream", title: "Hétvégén csúszik a vacsora", sub: "szombaton átlag 21:40")
                }
            }
        }
    }
}
#endif
