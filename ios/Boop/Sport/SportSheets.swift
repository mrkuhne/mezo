import SwiftUI
import BoopCore
import BoopDesign

/// Sport → „Sport rögzítése" (`mezo-r36n9.203`, spec §5.6): after a session the watch recorded, the time, length and
/// kcal come pre-filled from Apple Health („Az órádról") and he marks only the effort (+ sets and shoulder for
/// volleyball); without a watch he picks the sport and the length. Saved on the phone first (`OutboxKind.sportSession`)
/// and sent when the net allows; the room shows it as done at once.
struct SportLogSheet: View {
    let tonight: SportTonight?
    let saved: (SportSessionPayload) -> Void
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var kind: SportKind
    @State private var minutes: Int
    @State private var rpe: Int
    @State private var sets = 5
    @State private var shoulder = 6
    @State private var note = ""
    @State private var busy = false
    @State private var problem: String?

    init(tonight: SportTonight?, lastRpe: Int, saved: @escaping (SportSessionPayload) -> Void) {
        self.tonight = tonight; self.saved = saved
        _kind = State(initialValue: tonight?.sportKind ?? .volleyball)
        _minutes = State(initialValue: tonight?.health?.minutes ?? tonight?.durationMin ?? 90)
        _rpe = State(initialValue: (1...10).contains(lastRpe) ? lastRpe : 6)
    }

    /// The watch's workout, when tonight has one — and only for a session not logged yet.
    private var health: SportHealthWorkout? { tonight?.moment == "DONE" ? nil : tonight?.health }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                NKMono("SPORT RÖGZÍTÉSE")
                Text(title).nkFont(28, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                if let h = health {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 6) {
                            NKGlyph("check-ink", .white, size: 14).accessibilityHidden(true)
                            Text("Az órádról").nkFont(13, .semibold).foregroundStyle(.white)
                        }
                        ViewThatFits(in: .horizontal) {
                            HStack(alignment: .top, spacing: 22) { watchFigures(h) }
                            VStack(alignment: .leading, spacing: 10) { watchFigures(h) }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16).nkGlass(22)
                } else {
                    NKFlowRow {
                        ForEach(SportKind.chips, id: \.self) { k in
                            Button { kind = k } label: { SportChipView(text: k.name, on: k == kind) }
                                .buttonStyle(.plain)
                                .accessibilityLabel(k.name)
                                .accessibilityAddTraits(k == kind ? .isSelected : [])
                        }
                    }
                    row("Mennyi ideig?") {
                        SportStepper(text: sportClock(minutes), less: "Rövidebb", more: "Hosszabb",
                                     down: { minutes = max(15, minutes - 15) }, up: { minutes = min(300, minutes + 15) })
                    }
                }
                row("Milyen nehéz volt?", sub: sportEffortWord(rpe)) { effortRow }
                if kind.hasSetsAndShoulder {
                    row("Hány szettet játszottál?") {
                        SportStepper(text: "\(sets)", less: "Kevesebb szett", more: "Több szett",
                                     down: { sets = max(0, sets - 1) }, up: { sets = min(50, sets + 1) })
                    }
                    row("Hogy bírta a vállad?", sub: shoulder >= 7 ? "erősen terhelt" : "rendben") {
                        SportStepper(text: "\(shoulder)", less: "Kevesebb", more: "Több",
                                     down: { shoulder = max(1, shoulder - 1) }, up: { shoulder = min(10, shoulder + 1) })
                    }
                }
                row("Jegyzet") {
                    TextField("", text: $note, prompt: Text("például: sok ütés a hálónál").foregroundStyle(.white.opacity(0.4)), axis: .vertical)
                        .nkFont(15).foregroundStyle(.white).padding(12)
                        .background(RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.07)))
                        .accessibilityLabel("Jegyzet")
                }
                if let problem { Text(problem).nkFont(13.5).foregroundStyle(Hue.sport.glow) }
                NKPill(busy ? "Mentem…" : "Mentés", glyph: "check-ink") { Task { await save() } }
                    .disabled(busy)
                    .padding(.top, 6)
            }
            .padding(22)
        }
    }

    private var title: String {
        guard let h = health else { return "Mit sportoltál?" }
        return "\(kind.name) · ma\(sportStartClock(h).map { " \($0)" } ?? "")"
    }

    @ViewBuilder private func watchFigures(_ h: SportHealthWorkout) -> some View {
        figure(sportClock(h.minutes), sportRange(h) ?? "az órádról")
        if let kcal = h.kcal { figure("\(kcal)", "kcal", lit: true) }
        if let hr = h.avgHr { figure("\(hr)", "átlagpulzus") }
    }

    private func figure(_ value: String, _ label: String, lit: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value).font(.custom(Lagy.outfitFamily, size: 24, relativeTo: .title2).weight(.medium))
                .foregroundStyle(lit ? Hue.sport.glow : .white).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
            Text(label).nkFont(12.5, .medium).foregroundStyle(.white.opacity(0.75))
        }
        .accessibilityElement(children: .combine)
    }

    /// One to ten; two rows of five at the accessibility sizes.
    private var effortRow: some View {
        let rows: [ClosedRange<Int>] = typeSize.isAccessibilitySize ? [1...5, 6...10] : [1...10]
        return VStack(spacing: 6) {
            ForEach(rows, id: \.lowerBound) { r in
                HStack(spacing: 4) {
                    ForEach(Array(r), id: \.self) { n in
                        Button { rpe = n } label: {
                            Text("\(n)").nkFont(14, n == rpe ? .semibold : .regular)
                                .foregroundStyle(n == rpe ? NK.ground : .white.opacity(0.85))
                                .frame(maxWidth: .infinity, minHeight: 40)
                                .background(RoundedRectangle(cornerRadius: 10).fill(n == rpe ? Hue.sport.glow : .white.opacity(0.08)))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Megterhelés \(n)")
                        .accessibilityAddTraits(n == rpe ? .isSelected : [])
                    }
                }
            }
        }
    }

    private func row<C: View>(_ title: String, sub: String? = nil, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).nkFont(15.5, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                Spacer()
                if let sub { Text(sub).nkFont(13).foregroundStyle(Hue.sport.glow) }
            }
            c()
        }
    }

    private func save() async {
        guard let ritmus else { problem = "Most nem tudom eltenni."; return }
        busy = true
        defer { busy = false }
        let now = BoopClock.now()
        let h = health
        let payload = SportSessionPayload(
            sport: kind.rawValue, date: ritmus.day(of: now),
            time: h.flatMap { sportStartClock($0) } ?? tonight?.time ?? clockLabel(now),
            durationMinutes: h?.minutes ?? minutes,
            setsPlayed: kind.hasSetsAndShoulder ? sets : nil, rpe: Double(rpe),
            shoulderStrain: kind.hasSetsAndShoulder ? shoulder : nil,
            notes: note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : note,
            kcalOverride: h?.kcal)
        do {
            try await ritmus.captureSport(payload)
            saved(payload)
        } catch {
            problem = "Nem tudtam eltenni a telefonra — próbáld újra."
        }
    }
}

/// − value + with whole-word VoiceOver labels.
private struct SportStepper: View {
    let text: String
    let less: String, more: String
    let down: () -> Void, up: () -> Void
    var body: some View {
        HStack(spacing: 18) {
            step("−", less, down)
            Text(text).font(.nkNumber(30)).foregroundStyle(.white).frame(minWidth: 44).lineLimit(1).minimumScaleFactor(0.6)
            step("+", more, up)
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .contain)
    }
    private func step(_ t: String, _ label: String, _ a: @escaping () -> Void) -> some View {
        Button(action: a) {
            Text(t).font(.system(size: 22, weight: .medium)).foregroundStyle(.white)
                .frame(width: 48, height: 44).background(Circle().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// Sport → „Ma kihagyom" (spec §5.6): eight reasons; illness or injury does not count as a skip, and the gym follows.
struct SportSkipSheet: View {
    let tonight: SportTonight?
    let skip: (SportSkipReason) async throws -> Void
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var reason: SportSkipReason = .TIRED
    @State private var busy = false
    @State private var problem: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                NKMono(eyebrow)
                Text("Kihagyod a mai \(sportAccusative(kind))?").nkFont(28, design: .serif).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Az ok nem kötelező, de segít: betegségnél nem számít kihagyásnak, és a kondit is ehhez igazítom.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
                let perRow = typeSize.isAccessibilitySize ? 1 : 2
                let all = SportSkipReason.allCases
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(stride(from: 0, to: all.count, by: perRow)), id: \.self) { i in
                        HStack(spacing: 8) {
                            ForEach(all[i..<min(i + perRow, all.count)], id: \.self) { r in
                                Button { reason = r } label: {
                                    Text(r.label).nkFont(14.5, r == reason ? .semibold : .regular)
                                        .foregroundStyle(r == reason ? NK.ground : .white)
                                        .padding(.horizontal, 12)
                                        .frame(maxWidth: .infinity, minHeight: 46)
                                        .background(Capsule().fill(r == reason ? Hue.sport.glow : .white.opacity(0.09)))
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(r.label)
                                .accessibilityAddTraits(r == reason ? .isSelected : [])
                            }
                        }
                    }
                }
                if let problem { Text(problem).nkFont(13.5).foregroundStyle(Hue.sport.glow).fixedSize(horizontal: false, vertical: true) }
                NKPill(busy ? "Küldöm…" : "Kihagyom") { Task { await send() } }
                    .disabled(busy)
                    .padding(.top, 6)
            }
            .padding(22)
        }
    }

    private var kind: SportKind { tonight?.sportKind ?? .other }
    private var eyebrow: String {
        let part = tonight?.time.map { "MA · \($0)" } ?? "MA"
        return "\(part) · \(kind.name.uppercased())"
    }

    private func send() async {
        busy = true
        defer { busy = false }
        do {
            try await skip(reason)
        } catch let e as PlanFetchError where e == .offline {
            problem = "Nincs net — a kihagyáshoz kapcsolat kell. Próbáld újra, ha van net."
        } catch {
            problem = "Most nem sikerült — próbáld újra."
        }
    }
}
