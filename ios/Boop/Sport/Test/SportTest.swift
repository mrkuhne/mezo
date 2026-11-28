import SwiftUI
import BoopCore
import BoopDesign

/// Sport → Test (`mezo-r36n9.205`, spec §5.5): how the gym and the sport load the body together this week — the Edzés
/// muscle map switched Együtt · Kondi · Röpi, the shoulder after sport over six weeks against the line at 7, the rest
/// between the two on the days that have both, and the hints with their „miért?". Only server numbers; a session that
/// adds no heat is said, never hidden.
struct SportTest: View {
    let body_: SportBodyWeek?
    let shoulder: SportShoulder?
    let gaps: SportGaps?
    let week: SportOverview?
    let offline: Bool
    let why: (SportWhy) -> Void
    let ask: () -> Void
    @State private var mode: SportMapMode
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(body: SportBodyWeek?, shoulder: SportShoulder?, gaps: SportGaps?, week: SportOverview?, offline: Bool,
         why: @escaping (SportWhy) -> Void, ask: @escaping () -> Void) {
        self.body_ = body; self.shoulder = shoulder; self.gaps = gaps; self.week = week; self.offline = offline
        self.why = why; self.ask = ask
        var start = SportMapMode.together
        #if DEBUG
        // Simulator review: `-sportMap Együtt|Kondi|Röpi`.
        switch UserDefaults.standard.string(forKey: "sportMap") {
        case "Kondi": start = .gym
        case "Röpi", "Sport": start = .sport
        default: break
        }
        #endif
        _mode = State(initialValue: start)
    }

    private var sportName: String { sportMapSportName(week) }

    var body: some View {
        if offline {
            Text("Nincs net — a legutóbb látott képet mutatom.")
                .nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14).nkGlass(20)
        }
        if let b = body_ { mapCard(b) }
        if let s = shoulder {
            SportGlassCard("A VÁLLAD · 6 HÉT", trailing: "sport után, 1–10") { shoulderChart(s) }
        }
        if let g = gaps {
            SportGlassCard("PIHENŐ A KETTŐ KÖZÖTT", trailing: "ezen a héten") { rest(g) }
        }
        if let w = week { hints(sportHints(w)) }
        NKAskRow(hue: .sport, text: "Kérdezd meg Boopot a testedről", action: ask)
    }

    // MARK: - The map

    private func mapCard(_ b: SportBodyWeek) -> some View {
        let heat = sportBodyHeat(b, mode).map { NKBodyHeat(muscle: $0.muscle, level: $0.level) }
        return VStack(alignment: .leading, spacing: 14) {
            NKFlowRow {
                ForEach(SportMapMode.allCases, id: \.self) { m in
                    Button {
                        if reduceMotion { mode = m } else { withAnimation(.easeInOut(duration: 0.2)) { mode = m } }
                    } label: { SportChipView(text: m.label(sportName: sportName), on: m == mode) }
                        .buttonStyle(.plain)
                        .frame(minHeight: 44)
                        .accessibilityLabel(m.label(sportName: sportName))
                        .accessibilityAddTraits(m == mode ? .isSelected : [])
                }
            }
            NKBodyMap(heat, hue: mode == .gym ? .mozgas : .sport, views: .both)
                .frame(height: 230).frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(sportMapLabel(b, mode, sportName: sportName))
            Text(sportMapLine(b, mode, sportName: sportName)).nkFont(13).foregroundStyle(.white.opacity(0.75))
                .fixedSize(horizontal: false, vertical: true)
            if let note = sportUnknownNote(b) {
                HStack(alignment: .top, spacing: 8) {
                    NKGlyph("bolt-peach", .white, size: 14).padding(.top, 2).accessibilityHidden(true)
                    Text(note).nkFont(12.5).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .combine)
            }
            let figures = sportTestFigures(b, gaps: gaps)
            if !figures.isEmpty { SportFigures(figures: figures) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18).nkGlass(28)
    }

    // MARK: - A vállad · 6 hét

    private func shoulderChart(_ s: SportShoulder) -> some View {
        let bars = sportShoulderBars(s)
        return VStack(alignment: .leading, spacing: 10) {
            ZStack(alignment: .bottom) {
                GeometryReader { g in
                    let y = g.size.height * (1 - 7.0 / 10)
                    Path { p in p.move(to: CGPoint(x: 0, y: y)); p.addLine(to: CGPoint(x: g.size.width, y: y)) }
                        .stroke(.white.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    Text("7").font(.nkMono(10)).foregroundStyle(.white.opacity(0.5)).position(x: g.size.width - 6, y: y - 8)
                }
                HStack(alignment: .bottom, spacing: 10) {
                    ForEach(Array(bars.enumerated()), id: \.offset) { _, b in
                        if let v = b.value {
                            RoundedRectangle(cornerRadius: 5).fill(b.lit ? Hue.sport.glow : Hue.sport.glow.opacity(0.45))
                                .frame(height: max(4, CGFloat(v / 10) * 100)).frame(maxWidth: .infinity)
                        } else {
                            RoundedRectangle(cornerRadius: 5).fill(.white.opacity(0.08)).frame(height: 4).frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            .frame(height: 100)
            HStack(spacing: 10) {
                ForEach(Array(bars.enumerated()), id: \.offset) { _, b in
                    Text(b.label).nkFont(10.5).foregroundStyle(.white.opacity(b.current ? 0.95 : 0.55))
                        .lineLimit(1).minimumScaleFactor(0.6).frame(maxWidth: .infinity)
                }
            }
            Text(sportShoulderSentence(s)).nkFont(13).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(sportShoulderLabel(s) + " " + sportShoulderSentence(s))
    }

    // MARK: - Pihenő a kettő között

    private func rest(_ g: SportGaps) -> some View {
        let rows = sportRestRows(g)
        return VStack(spacing: 9) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, r in
                HStack(spacing: 10) {
                    Text(r.day).nkFont(13, .semibold).foregroundStyle(.white).frame(width: 38, alignment: .leading)
                    GeometryReader { geo in
                        let x: (Double) -> CGFloat = { geo.size.width * CGFloat((min(23, max(6, $0)) - 6) / 17) }
                        let sorted = r.blocks.sorted { $0.from < $1.from }
                        ZStack(alignment: .leading) {
                            Capsule().fill(.white.opacity(0.06)).frame(height: 8)
                            ForEach(Array(sorted.dropFirst().enumerated()), id: \.offset) { i, b in
                                let prev = sorted[i]
                                if b.from > prev.to {
                                    Rectangle().fill(.white.opacity(0.18)).frame(width: x(b.from) - x(prev.to), height: 2).offset(x: x(prev.to))
                                }
                            }
                            ForEach(Array(sorted.enumerated()), id: \.offset) { _, b in
                                Capsule().fill(b.gym ? sportGymColor : Hue.sport.glow)
                                    .opacity(b.done ? 1 : 0.55)
                                    .frame(width: max(6, x(b.to) - x(b.from)), height: 12).offset(x: x(b.from))
                            }
                        }
                        .frame(maxHeight: .infinity)
                    }
                    .frame(height: 14)
                    Text(r.gap).font(.nkNumber(15)).foregroundStyle(.white.opacity(0.85)).monospacedDigit()
                        .lineLimit(1).minimumScaleFactor(0.7).frame(width: 48, alignment: .trailing)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(r.accessibility)
            }
            HStack(spacing: 14) {
                legend(sportGymColor, "kondi")
                legend(Hue.sport.glow, sportName.lowercased())
                Spacer(minLength: 0)
            }
            .padding(.top, 2)
            .accessibilityHidden(true)
            Text(sportRestSentence(g)).nkFont(13).foregroundStyle(.white.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true).padding(.top, 4)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func legend(_ c: Color, _ text: String) -> some View {
        HStack(spacing: 6) {
            Capsule().fill(c).frame(width: 14, height: 8)
            Text(text).nkFont(11.5).foregroundStyle(.white.opacity(0.6))
        }
    }

    // MARK: - Amire figyelek

    private func hints(_ lines: [SportHintLine]) -> some View {
        SportGlassCard("AMIRE FIGYELEK") {
            VStack(alignment: .leading, spacing: 12) {
                if lines.isEmpty {
                    line("Most nincs mire figyelned: a kondi és a sport jól megfér egymás mellett ezen a héten.", ok: true, why: nil)
                }
                ForEach(Array(lines.enumerated()), id: \.offset) { _, l in
                    line(l.text, ok: l.ok, why: l.source.flatMap(sportWhy))
                }
            }
        }
    }

    private func line(_ text: String, ok: Bool, why w: SportWhy?) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 10) {
                NKGlyph(ok ? "check-ink" : "bolt-peach", .white, size: 16).padding(.top, 2).accessibilityHidden(true)
                Text(text).nkFont(14).foregroundStyle(.white.opacity(0.88)).fixedSize(horizontal: false, vertical: true)
            }
            .accessibilityElement(children: .combine)
            if let w {
                Button { why(w) } label: {
                    Text("miért?").nkFont(13, .semibold).foregroundStyle(Hue.sport.glow)
                        .padding(.leading, 26).frame(minHeight: 32, alignment: .leading).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Miért? \(w.title)")
            }
        }
    }
}

/// The „miért?" page of one Test hint, in the shared why-layout.
struct SportWhySheet: View {
    let why: SportWhy
    var body: some View {
        ScrollView {
            NKWhyBody(title: why.title, sub: why.sub,
                      facts: why.facts.map { (value: $0.value, unit: $0.unit, label: $0.label) },
                      experts: why.experts.map { (label: $0.label, palette: Hue.mozgas.orb, text: $0.text, doubt: $0.doubt) },
                      closing: why.closing)
                .padding(.bottom, 40)
        }
    }
}
