import SwiftUI
import BoopCore
import BoopDesign

/// The gym's colour in the two-lane pictures: the Edzés world's own glow, so the two read as two areas.
let sportGymColor = Hue.mozgas.glow

/// Sport → Ma (`mezo-r36n9.203`, the approved spike's Ma): the hero for tonight's moment (before · the watch recorded
/// it · logged · skipped, or „Ma nincs sport" + the next one), the day as two kinds of blocks, the week carousel,
/// what Boop watches, and the ask row. Every word comes from `SportLogic`.
struct SportMa: View {
    let week: SportOverview
    let open: (SportRoomSheet) -> Void
    let undo: () -> Void
    let ask: () -> Void
    @Environment(\.dynamicTypeSize) private var typeSize
    /// The week row's height: given (a carousel never measures its cards), growing with the text size.
    @ScaledMetric(relativeTo: .body) private var dayCardHeight: CGFloat = 112

    private var big: Bool { typeSize.isAccessibilitySize }

    var body: some View {
        let hero = sportHero(week)
        heroCard(hero)
        dayStrip(sportStrip(week))
        weekCarousel(sportWeekCards(week))
        hints(sportHints(week))
        NKAskRow(hue: .sport, text: "Kérdezd meg Boopot a sportodról") { ask() }
    }

    // MARK: - Hero

    private func heroCard(_ h: SportHero) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            let title = VStack(alignment: .leading, spacing: 4) {
                NKMono(h.eyebrow)
                Text(h.title).nkFont(30, design: .serif).foregroundStyle(.white)
                if let line = h.line {
                    Text(line).nkFont(13.5).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
                }
            }
            .accessibilityElement(children: .combine)
            if big {
                VStack(alignment: .leading, spacing: 14) { ring; title }
            } else {
                HStack(alignment: .center, spacing: 18) { ring; title; Spacer(minLength: 0) }
            }
            if !h.figures.isEmpty { figures(h.figures) }
            if let note = h.note {
                Text(note).nkFont(13).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
            }
            if !h.chips.isEmpty {
                NKFlowRow {
                    ForEach(Array(h.chips.enumerated()), id: \.offset) { _, c in SportChipView(text: c.text, on: c.on) }
                }
            }
            switch h.moment {
            case .before:
                pills {
                    NKPill("Ma kihagyom", primary: false) { open(.skip) }
                    NKPill("Rögzítem most", glyph: "plus-ink") { open(.log) }
                }
            case .recorded:
                NKPill("Kiegészítem", glyph: "check-ink") { open(.log) }
            case .skipped where h.canUndo:
                NKPill("Visszavonás", primary: false, action: undo)
            default:
                EmptyView()
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(28)
    }

    @ViewBuilder private func pills<C: View>(@ViewBuilder _ c: () -> C) -> some View {
        if big { VStack(spacing: 10) { c() } } else { HStack(spacing: 10) { c() } }
    }

    private func figures(_ fs: [SportFigure]) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: 22) { ForEach(Array(fs.enumerated()), id: \.offset) { _, f in bigNumber(f) } }
            LazyVGrid(columns: [GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading)],
                      alignment: .leading, spacing: 12) {
                ForEach(Array(fs.enumerated()), id: \.offset) { _, f in bigNumber(f) }
            }
            VStack(alignment: .leading, spacing: 12) { ForEach(Array(fs.enumerated()), id: \.offset) { _, f in bigNumber(f) } }
        }
    }

    private func bigNumber(_ f: SportFigure) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(f.value).font(.custom(Lagy.outfitFamily, size: 24, relativeTo: .title2).weight(.medium))
                .foregroundStyle(f.lit ? Hue.sport.glow : .white).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
            Text(f.label).nkFont(12.5, .medium).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }

    /// The week's sport: the lit share is what is done.
    private var ring: some View {
        let share = sportRing(week.weekCount).level ?? 0
        return ZStack {
            Circle().stroke(.white.opacity(0.10), lineWidth: 10)
            Circle().trim(from: 0, to: share)
                .stroke(AngularGradient(colors: [Hue.sport.glow.opacity(0.6), Hue.sport.glow, Color(hex: 0xFFD7B0)], center: .center),
                        style: StrokeStyle(lineWidth: 10, lineCap: .round))
                .rotationEffect(.degrees(-90))
            NKGlyph("ball-sun", .white, size: 30)
        }
        .frame(width: 84, height: 84)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(sportRingLabel(week.weekCount))
    }

    // MARK: - A napod

    @ViewBuilder private func dayStrip(_ s: SportStrip) -> some View {
        if !s.blocks.isEmpty || !s.legendOnly.isEmpty {
            SportGlassCard("A NAPOD", trailing: s.trailing) {
                VStack(alignment: .leading, spacing: 12) {
                    if !s.blocks.isEmpty {
                        GeometryReader { g in
                            let w = g.size.width
                            let x: (Double) -> CGFloat = { h in CGFloat((min(23, max(6, h)) - 6) / 17) * w }
                            ZStack(alignment: .topLeading) {
                                Capsule().fill(.white.opacity(0.08)).frame(height: 8).offset(y: 22)
                                ForEach(Array(s.blocks.enumerated()), id: \.offset) { _, b in
                                    block(b, from: x(b.from), to: x(b.to))
                                }
                                ForEach([6, 12, 18, 23], id: \.self) { h in
                                    Text("\(h)").nkFont(10.5).foregroundStyle(.white.opacity(0.45))
                                        .offset(x: x(Double(h)) - 6, y: 40).accessibilityHidden(true)
                                }
                            }
                        }
                        .frame(height: 56)
                    }
                    NKFlowRow(spacing: 16) {
                        ForEach(Array((s.blocks + s.legendOnly).enumerated()), id: \.offset) { _, b in legend(b) }
                    }
                }
            }
        }
    }

    private func block(_ b: SportStripBlock, from: CGFloat, to: CGFloat) -> some View {
        let color = b.gym ? sportGymColor : Hue.sport.glow
        return VStack(alignment: .leading, spacing: 4) {
            Text(b.time).nkFont(11, .semibold).foregroundStyle(.white.opacity(0.8)).lineLimit(1).fixedSize()
            RoundedRectangle(cornerRadius: 6).fill(b.done ? color : color.opacity(0.35))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(color, lineWidth: b.done ? 0 : 1.5))
                .frame(width: max(18, to - from), height: 14)
        }
        .offset(x: from, y: 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(sportStripLabel(b))
    }

    private func legend(_ b: SportStripBlock) -> some View {
        HStack(spacing: 6) {
            Circle().fill(b.gym ? sportGymColor : Hue.sport.glow).frame(width: 8, height: 8)
            Text(b.legend).nkFont(12.5).foregroundStyle(.white.opacity(0.8))
            if b.done { NKGlyph("check-ink", .white, size: 12) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(b.legend)\(b.done ? ", kész" : "")")
    }

    // MARK: - Ezen a héten

    /// **Ezen a héten** — the week's days as a carousel with dots. Bare, not a card: a carousel is never inside a
    /// card (owner, 2026-11-28, mezo-r36n9.223).
    private func weekCarousel(_ cards: [SportDayCard]) -> some View {
        NKBare("Ezen a héten", hue: .sport) {
            NKCarousel(cards, hue: .sport, height: min(dayCardHeight, 300), widthFraction: big ? 0.86 : 0.44,
                       initial: cards.first(where: \.today)?.id) { dayCard($0) }
        }
    }

    private func dayCard(_ d: SportDayCard) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(d.name).nkFont(15, .semibold).foregroundStyle(.white)
                Spacer()
                if d.today { Text("MA").font(.nkMono(10, .semibold)).foregroundStyle(Hue.sport.glow) }
            }
            ForEach(Array(d.lines.enumerated()), id: \.offset) { _, l in laneRow(l) }
            if d.lines.isEmpty { Text("pihenő").nkFont(12.5).foregroundStyle(.white.opacity(0.5)) }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .nkGlass(20)
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(d.today ? Hue.sport.glow.opacity(0.7) : .clear, lineWidth: 1.5))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(sportCardLabel(d))
    }

    private func laneRow(_ l: SportCardLine) -> some View {
        let color = l.gym ? sportGymColor : Hue.sport.glow
        return HStack(spacing: 6) {
            Circle().fill(l.done ? color : color.opacity(0.3)).frame(width: 8, height: 8)
                .overlay(Circle().stroke(color, lineWidth: l.done ? 0 : 1))
            Text(l.text).nkFont(12).foregroundStyle(.white.opacity(l.done ? 0.95 : 0.7))
                .lineLimit(big ? 3 : 1).minimumScaleFactor(0.8)
        }
    }

    // MARK: - Amire figyelek

    private func hints(_ lines: [SportHintLine]) -> some View {
        SportGlassCard("AMIRE FIGYELEK") {
            VStack(alignment: .leading, spacing: 10) {
                if lines.isEmpty {
                    hint("Most nincs mire figyelned: a kondi és a sport jól megfér egymás mellett ezen a héten.", ok: true)
                }
                ForEach(Array(lines.enumerated()), id: \.offset) { _, l in hint(l.text, ok: l.ok) }
            }
        }
    }

    private func hint(_ text: String, ok: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            NKGlyph(ok ? "check-ink" : "bolt-peach", .white, size: 16).padding(.top, 2).accessibilityHidden(true)
            Text(text).nkFont(14).foregroundStyle(.white.opacity(0.88)).fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Shared bits

/// A labelled glass card in the Sport world.
struct SportGlassCard<C: View>: View {
    let label: String
    var trailing: String?
    @ViewBuilder let content: () -> C
    init(_ label: String, trailing: String? = nil, @ViewBuilder _ content: @escaping () -> C) {
        self.label = label; self.trailing = trailing; self.content = content
    }
    var body: some View {
        NKBare(label, hue: .sport, trailing: trailing, content: content)
            .padding(.horizontal, 16).padding(.vertical, 12)
            .nkGlass(24)
    }
}

/// A chip: on = picked (the hue fills it).
struct SportChipView: View {
    let text: String
    var on = false
    var body: some View {
        Text(text).nkFont(12.5, on ? .semibold : .regular)
            .foregroundStyle(on ? NK.ground : .white.opacity(0.9))
            .padding(.horizontal, 10).frame(minHeight: 28)
            .background(Capsule().fill(on ? Hue.sport.glow : .white.opacity(0.1)))
            .fixedSize()
            .accessibilityAddTraits(on ? .isSelected : [])
    }
}
