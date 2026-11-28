import SwiftUI
import BoopCore
import BoopDesign

/// Sport → Napló (`mezo-r36n9.205`, spec §5.4): the last four weeks in one hero (sessions, average effort, shoulder,
/// the effort line of the last sessions) and every logged session as a card — a tap opens its correction. A log still
/// waiting on the phone (no net yet) shows as „a telefonon vár" and cannot be corrected until it reaches the server.
struct SportNaplo: View {
    let sessions: [SportSessionRecord]
    let pending: [SportSessionPayload]
    let today: String
    let offline: Bool
    let ageText: String?
    let edit: (SportSessionRecord) -> Void
    let log: () -> Void

    /// Outbox logs the server's list does not have yet.
    private var waiting: [SportSessionPayload] {
        pending.filter { p in !sessions.contains { $0.date == p.date && $0.time == p.time && $0.kind == SportKind(wire: p.sport) } }
    }

    var body: some View {
        if offline {
            VStack(alignment: .leading, spacing: 4) {
                Text("Nincs net — a legutóbb látott naplót mutatom. Javítani és törölni kapcsolattal tudsz.")
                    .nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                if let ageText { NKMono(ageText.uppercased()) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14).nkGlass(20)
            .accessibilityElement(children: .combine)
        }
        if sessions.isEmpty && waiting.isEmpty {
            empty
        } else {
            if !sessions.isEmpty { hero(sportJournalHero(sessions, today: today)) }
            ForEach(Array(waiting.enumerated()), id: \.offset) { _, p in waitingCard(p) }
            ForEach(sessions) { s in
                let c = sportJournalCard(s)
                Button { edit(s) } label: { card(c) }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(c.accessibility)
                    .accessibilityHint("Javítás vagy törlés")
                    .accessibilityAddTraits(.isButton)
            }
        }
    }

    // MARK: - Hero

    private func hero(_ h: SportJournalHero) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            NKMono("AZ ELMÚLT 4 HÉT")
            SportFigures(figures: h.figures)
            if h.rpeLine.count >= 2 {
                SportSpark(values: h.rpeLine)
                    .frame(height: 54)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(h.lineLabel ?? "A megterhelés íve")
            }
            if let s = h.sentence {
                Text(s).nkFont(13).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18).nkGlass(28)
    }

    // MARK: - Cards

    private func card(_ c: SportJournalCard) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    NKMono(c.eyebrow)
                    Text(c.title).font(.nkSerif(21)).foregroundStyle(.white)
                }
                Spacer()
                if let load = c.load {
                    VStack(alignment: .trailing, spacing: 0) {
                        Text("\(load)").font(.nkNumber(30)).foregroundStyle(Hue.sport.glow).monospacedDigit()
                            .lineLimit(1).minimumScaleFactor(0.6)
                        Text("terhelés").nkFont(11).foregroundStyle(.white.opacity(0.55))
                    }
                }
            }
            if !c.chips.isEmpty {
                NKFlowRow { ForEach(c.chips, id: \.self) { SportChipView(text: $0) } }
            }
            if let k = c.kcalLine { Text(k).nkFont(12.5).foregroundStyle(.white.opacity(0.6)) }
            if let n = c.note {
                Text(n).nkFont(13).italic().foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16).nkGlass(24)
        .contentShape(Rectangle())
    }

    private func waitingCard(_ p: SportSessionPayload) -> some View {
        let kind = SportKind(wire: p.sport)
        let eyebrow = ([sportMonthDay(p.date), p.time].compactMap { $0 }).joined(separator: " · ").uppercased()
        return VStack(alignment: .leading, spacing: 8) {
            NKMono(eyebrow)
            Text(kind.name).font(.nkSerif(21)).foregroundStyle(.white)
            HStack(spacing: 6) {
                NKGlyph("clock-ink", .white, size: 13).accessibilityHidden(true)
                Text("A telefonon vár — ha lesz net, elküldöm, utána javíthatod.").nkFont(12.5)
                    .foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16).nkGlass(24)
        .opacity(0.8)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(kind.name), \(eyebrow.lowercased()), a telefonon vár, még nem ment el")
    }

    private var empty: some View {
        VStack(alignment: .leading, spacing: 14) {
            NKGlyph("ball-sun", .white, size: 34).accessibilityHidden(true)
            Text("Még nincs rögzített sportod").nkFont(26, design: .serif).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            Text("Egy edzés vagy meccs után rögzítsd — itt látod majd az alkalmaidat, a megterhelést és azt, hogy bírta a vállad.")
                .nkFont(14.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
            NKPill("Sport rögzítése", glyph: "plus-ink", action: log)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20).nkGlass(28)
    }
}

/// Big numbers that wrap to two columns, then one, when they do not fit.
struct SportFigures: View {
    let figures: [SportFigure]
    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: 22) { items }
            LazyVGrid(columns: [GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading)],
                      alignment: .leading, spacing: 12) { items }
            VStack(alignment: .leading, spacing: 12) { items }
        }
    }
    private var items: some View {
        ForEach(Array(figures.enumerated()), id: \.offset) { _, f in
            VStack(alignment: .leading, spacing: 1) {
                Text(f.value).font(.custom(Lagy.outfitFamily, size: 24, relativeTo: .title2).weight(.medium))
                    .foregroundStyle(f.lit ? Hue.sport.glow : .white).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
                Text(f.label).nkFont(12.5, .medium).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            }
            .accessibilityElement(children: .combine)
        }
    }
}

/// The effort line: 1…10 mapped over the height, oldest left.
private struct SportSpark: View {
    let values: [Double]
    var body: some View {
        GeometryReader { g in
            let lo = max(1, (values.min() ?? 1) - 1), hi = min(10, (values.max() ?? 10) + 1)
            let span = max(1, hi - lo)
            let pt: (Int, Double) -> CGPoint = { i, v in
                CGPoint(x: g.size.width * CGFloat(i) / CGFloat(max(1, values.count - 1)),
                        y: g.size.height * (1 - CGFloat((v - lo) / span)))
            }
            ZStack {
                Path { p in
                    for (i, v) in values.enumerated() { i == 0 ? p.move(to: pt(i, v)) : p.addLine(to: pt(i, v)) }
                }
                .stroke(Hue.sport.glow, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                if let last = values.last {
                    Circle().fill(Hue.sport.glow).frame(width: 7, height: 7).position(pt(values.count - 1, last))
                }
            }
        }
    }
}
