#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY spike (mezo-r36n9.113): screens 1–4 — the empty builder with „Új blokk", the Alapok step, the candidate
// cards, and the per-muscle „miért?" sheet.

// MARK: - 1 · Nincs futó blokk

struct ETEmptyState: View {
    let flow: ETFlow
    var body: some View {
        ZStack {
            PlanSky(height: 340)
            VStack(alignment: .leading, spacing: 14) {
                PlanCloseButton { flow.go(nil) }
                Spacer()
                PlanMark(.calendar, color: planHue.glow, size: 34)
                Text("Nincs futó blokkod").nkFont(28, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                Text("Indíts egy újat: megmondod, hány hétre és mennyi időd van egy edzésre, én pedig hozok két-három lehetőséget, mindegyiknél azzal, hogy miért.")
                    .nkFont(15).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
                VStack(alignment: .leading, spacing: 4) {
                    Button { flow.intake = .fresh; flow.blocked = nil; flow.go(.alapok) } label: {
                        Text("Új blokk").nkFont(16, .semibold).foregroundStyle(NK.ground)
                            .padding(.horizontal, 28).frame(minHeight: 52).background(Capsule().fill(.white))
                    }
                    .buttonStyle(PressStyle())
                    Button { flow.go(.terkep) } label: {
                        HStack(spacing: 6) {
                            Text("Éves terv").nkFont(15, .medium)
                            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                        }
                        .foregroundStyle(planHue.glow)
                        .frame(minHeight: 44).padding(.horizontal, 4)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 6)
                Spacer(); Spacer()
            }
            .padding(.horizontal, 24).padding(.top, 8)
        }
    }
}

// MARK: - 2 · Alapok

struct ETAlapokPage: View {
    let flow: ETFlow
    @State private var position = ScrollPosition()

    var body: some View {
        ZStack {
            PlanSky(height: 260)
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    ETHead(eyebrow: flow.intake.fromMap ? "ÚJ BLOKK · 1/2 · AZ ÉVES TERVBŐL" : "ÚJ BLOKK · 1/2",
                           title: "Alapok",
                           sentence: flow.intake.fromMap
                               ? "Az éves terved 3. blokkja: Mell + váll. Kitöltöttem, amit tudok; átállíthatod."
                               : "Három dolog kell, a többit én számolom.",
                           back: true) { flow.go(flow.intake.fromMap ? .kovetkezik : .ures) }

                    VStack(alignment: .leading, spacing: 12) {
                        ETLabel("Hány hét", trailing: "az utolsó könnyítő")
                        HStack(spacing: 6) {
                            ForEach(4...8, id: \.self) { w in
                                ETChoice(text: "\(w)", on: flow.intake.weeks == w, sub: "hét") { flow.intake.weeks = w }
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        ETLabel("Meddig tarthat egy edzés")
                        HStack(spacing: 6) {
                            ForEach([45, 60, 75, 90], id: \.self) { m in
                                ETChoice(text: "\(m)", on: flow.intake.minutes == m, sub: "perc") { flow.intake.minutes = m; flow.blocked = nil }
                            }
                        }
                        Text("Pihenővel, bemelegítéssel együtt. Ha egy lehetőség hosszabb, megmutatom, de nem vágok le a heti sorozatokból.")
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        ETLabel("Edzésnapok")
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text("az évadodból:").nkFont(14).foregroundStyle(.white.opacity(0.6))
                            Text("H · K · Cs · P").nkFont(20, .medium).foregroundStyle(.white)
                        }
                        Text("Az Évad oldalon állíthatod át; amíg a blokk fut, ezek a napok maradnak.")
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                    .nkGlass(22)

                    VStack(alignment: .leading, spacing: 12) {
                        ETLabel("Izmok", trailing: "mire figyeljünk")
                        ETBudgetBar(intake: flow.intake)
                        VStack(spacing: 0) {
                            ForEach(Array(ETIntake.muscles.enumerated()), id: \.element) { i, m in
                                if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                                VStack(alignment: .leading, spacing: 8) {
                                    ETTierRow(name: planMuscleName(m), tier: flow.intake.tiers[m] ?? .grow,
                                              disabled: { flow.intake.blockReason(m, to: $0) != nil }) { t in
                                        if let reason = flow.intake.blockReason(m, to: t) {
                                            flow.blocked = ETBlocked(muscle: m, text: reason)
                                        } else {
                                            flow.intake.tiers[m] = t
                                            flow.blocked = nil
                                        }
                                    }
                                    if let b = flow.blocked, b.muscle == m {
                                        HStack(alignment: .top, spacing: 8) {
                                            PlanMark(.shield, color: planWarn, size: 14).padding(.top, 2)
                                            Text(b.text).nkFont(13).foregroundStyle(planWarn).fixedSize(horizontal: false, vertical: true)
                                        }
                                        .transition(.opacity)
                                    }
                                }
                                .padding(.vertical, 10)
                            }
                        }
                        .animation(.snappy, value: flow.blocked)
                        .padding(.horizontal, 16).padding(.vertical, 6)
                        .nkGlass(22)
                        Text("Hangsúly: itt építünk a legtöbbet. Építés: rendesen nő. Tartás: megtartja, amit eddig felépítettél.")
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 30)
            }
            .scrollPosition($position)
            .scrollIndicators(.hidden)
            .modifier(ETInitialScroll(position: $position))
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            ETBottomBar(title: "Mutasd a lehetőségeket") { flow.go(.jeloltek) }
        }
    }
}

/// One muscle and the builder's three-way tier switch: a fixed name column, so every row lines up at any width.
struct ETTierRow: View {
    let name: String
    let tier: MuscleTier
    var disabled: (MuscleTier) -> Bool = { _ in false }
    let set: (MuscleTier) -> Void

    var body: some View {
        HStack(spacing: 10) {
            Text(name).nkFont(15).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.8)
                .frame(width: 96, alignment: .leading)
            ETTierSwitch(tier: tier, disabled: disabled, set: set).frame(maxWidth: 240)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }
}

/// Tartás · Építés · Hangsúly — the builder's switch (`BuilderTierSwitch`), copied.
struct ETTierSwitch: View {
    let tier: MuscleTier
    var disabled: (MuscleTier) -> Bool = { _ in false }
    let set: (MuscleTier) -> Void
    private let all: [MuscleTier] = [.maintain, .grow, .emphasize]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(all, id: \.self) { item in
                Button { withAnimation(.snappy) { set(item) } } label: {
                    Text(item.hungarian).nkFont(12.5, .semibold)
                        .foregroundStyle(item == tier ? NK.ground : .white.opacity(disabled(item) ? 0.22 : 0.7))
                        .lineLimit(1).minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity, minHeight: 34)
                        .background { if item == tier { Capsule().fill(item == .maintain ? .white : planTierColor(item)) } }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(item == tier ? .isSelected : [])
                .accessibilityHint(disabled(item) ? "Most nem fér bele a heti keretbe" : "")
            }
        }
        .padding(3)
        .background(Capsule().fill(.white.opacity(0.08)))
    }
}

/// „Heti keret": the heaviest week's sets against what fits in the training days × minutes, split by tier colour,
/// with the Hangsúly counter.
struct ETBudgetBar: View {
    let intake: ETIntake
    var compact = false

    private var over: Bool { intake.used > intake.capacity }
    private var full: Bool { intake.capacity - intake.used < 2 }

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 7 : 10) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                if compact {
                    Text("HETI KERET").nkFont(10, .semibold, design: .monospaced).tracking(1.2).foregroundStyle(.white.opacity(0.6))
                }
                Text("\(intake.used)").font(.nkNumber(compact ? 18 : 28)).foregroundStyle(over ? planWarn : .white)
                    .contentTransition(.numericText())
                Text("/ \(intake.capacity) sorozat").nkFont(compact ? 12 : 14).foregroundStyle(.white.opacity(0.75))
                    .lineLimit(1).fixedSize()
                Spacer(minLength: 6)
                emphasisCounter
            }
            GeometryReader { geo in
                let total = CGFloat(max(intake.capacity, intake.used))
                HStack(spacing: 2) {
                    segment(intake.sets(.emphasize), total, geo.size.width, planTierColor(.emphasize))
                    segment(intake.sets(.grow), total, geo.size.width, planTierColor(.grow))
                    segment(intake.sets(.maintain), total, geo.size.width, .white.opacity(0.55))
                    Spacer(minLength: 0)
                }
                .frame(width: geo.size.width, alignment: .leading)
                .background(Capsule().fill(.white.opacity(0.08)))
                .clipShape(Capsule())
            }
            .frame(height: compact ? 6 : 10)
            if !compact {
                Text(over ? "Túllépi a keretet: vegyél le egy izmot Tartásra, vagy adj hozzá időt."
                          : (full ? "A keret tele: feljebb csak úgy tehetsz egy izmot, ha egy másikat lejjebb veszel."
                                  : "a legnehezebb héten · \(etTrainingDays) × \(intake.minutes) perc · még \(intake.capacity - intake.used) sorozat fér bele"))
                    .nkFont(12, design: over || full ? .default : .monospaced)
                    .foregroundStyle(over ? planWarn : .white.opacity(0.55))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(compact ? 12 : 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(compact ? 18 : 22)
        .animation(.snappy, value: intake.used)
        .accessibilityElement(children: .combine)
    }

    private var emphasisCounter: some View {
        let n = intake.emphasizeCount
        return HStack(spacing: 5) {
            Text("Hangsúly").nkFont(compact ? 11 : 12).foregroundStyle(.white.opacity(0.65))
            Text("\(n) / \(etEmphasizeMax)").nkFont(compact ? 11 : 12, .semibold, design: .monospaced)
                .foregroundStyle(n >= etEmphasizeMax ? NK.ground : .white.opacity(0.9))
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(Capsule().fill(n >= etEmphasizeMax ? planTierColor(.emphasize) : .white.opacity(0.14)))
        }
        .lineLimit(1).fixedSize()
    }

    private func segment(_ sets: Int, _ total: CGFloat, _ width: CGFloat, _ color: Color) -> some View {
        Rectangle().fill(color).frame(width: max(0, width * CGFloat(sets) / total - 2))
    }
}

// MARK: - 3 · Jelöltek

struct ETJeloltekPage: View {
    let flow: ETFlow
    @State private var position = ScrollPosition()
    @State private var showClosest = false

    var body: some View {
        ZStack {
            PlanSky(height: 260)
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if flow.nothingFits {
                        ETHead(eyebrow: "ÚJ BLOKK · 2/2", title: "Nincs jó lehetőség",
                               sentence: "3 nap, legfeljebb \(flow.intake.minutes) perc, \(flow.intake.weeks) hét, 2 izom Hangsúlyon.",
                               back: true) { flow.go(.alapok) }
                        nothingFitsCard
                        closest
                    } else {
                        ETHead(eyebrow: "ÚJ BLOKK · 2/2", title: "Két jó lehetőség",
                               sentence: "4 nap, legfeljebb \(flow.intake.minutes) perc, \(flow.intake.weeks) hét. Csak olyat mutatok, ami minden szabálynak megfelel.",
                               back: true) { flow.go(.alapok) }
                        ForEach(etCandidates) { c in
                            ETCandidateCard(candidate: c, limit: flow.intake.minutes, selected: flow.chosen == c.id) {
                                withAnimation(.snappy) { flow.chosen = c.id }
                            }
                        }
                        Text("A percek pihenővel és bemelegítéssel együtt értendők. Mindkettőben minden izom legalább kétszer kap munkát hetente, és egy izom sem kap két egymást követő napon nehéz adagot.")
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).padding(.horizontal, 4)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 30)
            }
            .scrollPosition($position)
            .scrollIndicators(.hidden)
            .modifier(ETInitialScroll(position: $position))
        }
        .sensoryFeedback(.selection, trigger: flow.chosen)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if !flow.nothingFits {
                ETBottomBar(title: "Ezzel kezdem") { flow.go(.miert) }
            }
        }
    }

    private var nothingFitsCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            PlanMark(.timer, color: planHue.glow, size: 26)
            Text("Ebbe az időbe most nem fér bele jó terv").nkFont(23, design: .serif).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            Text("A legrövidebb felosztásnál is kb. 58 perc lenne egy nap, a határod \(flow.intake.minutes) perc. Hibás tervet nem ajánlok, inkább megmutatom, min múlik.")
                .nkFont(14).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            Text("EZ MEGOLDANÁ").nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(planHue.glow)
                .padding(.top, 4)
            VStack(spacing: 8) {
                fix("Legyen 60 perc", "két jó lehetőség lesz belőle") {
                    flow.intake.minutes = 60; flow.nothingFits = false
                }
                fix("Egy izom Hangsúly helyett Építés", "az Alapoknál állíthatod") { flow.go(.alapok) }
                fix("Legyen 4 nap", "az Évad oldalon") {}
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(26)
    }

    private func fix(_ title: String, _ sub: String, _ action: @escaping () -> Void) -> some View {
        Button { withAnimation(.snappy) { action() } } label: {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).nkFont(15, .semibold).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                    Text(sub).nkFont(12).foregroundStyle(.white.opacity(0.5))
                }
                Spacer(minLength: 6)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.08)))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// The closest plan, kept apart and grey: never offered as a normal choice.
    private var closest: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button { withAnimation(.snappy) { showClosest.toggle() } } label: {
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("a legközelebbi, ha mégis kéred").nkFont(13).foregroundStyle(.white.opacity(0.55))
                        Text("\(etClosest.name) · ~\(etClosest.longest) perc · \(etClosest.longest - flow.intake.minutes) perccel hosszabb")
                            .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.4))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 6)
                    Image(systemName: showClosest ? "chevron.up" : "chevron.down").font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.4))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if showClosest {
                ETDayBars(minutes: etClosest.minutes, limit: flow.intake.minutes)
                Button {} label: {
                    Text("Mégis ezt kérem").nkFont(14, .medium).foregroundStyle(.white.opacity(0.7))
                        .padding(.horizontal, 18).frame(minHeight: 40)
                        .background(Capsule().stroke(.white.opacity(0.25), lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(.white.opacity(0.1), style: StrokeStyle(lineWidth: 1, dash: [4, 4])))
        .opacity(0.85)
    }
}

struct ETCandidateCard: View {
    let candidate: ETCandidate
    let limit: Int
    let selected: Bool
    let select: () -> Void

    private var over: Bool { candidate.longest > limit }

    var body: some View {
        Button(action: select) {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top, spacing: 10) {
                    VStack(alignment: .leading, spacing: 5) {
                        if candidate.recommended {
                            Text("AJÁNLOTT").nkFont(9, .semibold, design: .monospaced).tracking(1.2)
                                .foregroundStyle(NK.ground)
                                .padding(.horizontal, 7).padding(.vertical, 3)
                                .background(Capsule().fill(planHue.glow))
                        } else if over {
                            Text("TÚLLÉPI A \(limit) PERCET").nkFont(9, .semibold, design: .monospaced).tracking(1.2)
                                .foregroundStyle(planWarn)
                                .padding(.horizontal, 7).padding(.vertical, 3)
                                .background(Capsule().fill(planWarn.opacity(0.16)))
                        }
                        Text(candidate.name).nkFont(22, design: .serif).foregroundStyle(.white)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(candidate.sub).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                    }
                    Spacer(minLength: 6)
                    VStack(alignment: .trailing, spacing: 0) {
                        Text("~\(candidate.longest)").font(.nkNumber(34)).foregroundStyle(over ? planWarn : .white)
                        Text("perc").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                    }
                    selectMark
                }
                ETDayBars(minutes: candidate.minutes, limit: limit)
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(candidate.why, id: \.self) { ETWhyLine(line: $0) }
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(.white.opacity(selected ? 0.1 : 0.04)))
            .nkGlass(26)
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(.white.opacity(selected ? 0.85 : 0), lineWidth: 1.5))
            .contentShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private var selectMark: some View {
        ZStack {
            Circle().stroke(.white.opacity(selected ? 0 : 0.3), lineWidth: 1.5)
            if selected {
                Circle().fill(.white)
                PlanMark(.check, color: NK.ground, size: 13)
            }
        }
        .frame(width: 24, height: 24)
    }
}

/// The week as seven columns: each training day's minutes as a bar against the limit line, rest days as a dash.
struct ETDayBars: View {
    let minutes: [Int?]
    let limit: Int
    private let top: CGFloat = 80

    var body: some View {
        HStack(alignment: .bottom, spacing: 5) {
            ForEach(Array(minutes.enumerated()), id: \.offset) { i, m in
                VStack(spacing: 5) {
                    if let m {
                        Text("\(m)").nkFont(12, .medium).foregroundStyle(m > limit ? planWarn : .white.opacity(0.9))
                            .lineLimit(1).fixedSize()
                    }
                    ZStack(alignment: .bottom) {
                        RoundedRectangle(cornerRadius: 4).fill(.white.opacity(0.05)).frame(height: 44)
                        if let m {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(m > limit ? planWarn.opacity(0.85) : .white.opacity(0.32))
                                .frame(height: max(6, 44 * CGFloat(m) / top))
                        }
                    }
                    .frame(height: 44)
                    Text(etWeekdays[i]).nkFont(10, .semibold, design: .monospaced)
                        .foregroundStyle(.white.opacity(m == nil ? 0.3 : 0.65)).lineLimit(1).fixedSize()
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(m.map { "\(etWeekdays[i]): kb. \($0) perc" } ?? "\(etWeekdays[i]): pihenőnap")
            }
        }
        .overlay(alignment: .bottom) {
            // The limit line across the bars, at the limit's height above the bars' floor (day label 12 + spacing 5).
            Rectangle().fill(.white.opacity(0.45))
                .frame(height: 1)
                .mask(HStack(spacing: 3) { ForEach(0..<40, id: \.self) { _ in Rectangle().frame(width: 4) } })
                .padding(.bottom, 17 + 44 * CGFloat(limit) / top)
                .accessibilityHidden(true)
        }
        .padding(.top, 4)
    }
}

// MARK: - 4 · The chosen block, one muscle a row, and the „miért?" sheet

struct ETMusclesPage: View {
    let flow: ETFlow

    var body: some View {
        ZStack {
            PlanSky(height: 200)
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    ETHead(eyebrow: "EGY HÉT · IZMONKÉNT", title: etCandidates[flow.chosen].name,
                           sentence: "Mindegyik izom a sávjában. Koppints egyre, és megmutatom, miért ennyi.",
                           back: true) { flow.go(.jeloltek) }
                    ETBudgetBar(intake: .fresh, compact: true)
                    VStack(spacing: 0) {
                        ForEach(Array(etMuscles.enumerated()), id: \.element.id) { i, m in
                            if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                            Button { flow.sheetMuscle = m.muscle } label: { row(m) }.buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 16).padding(.vertical, 4)
                    .nkGlass(24)
                }
                .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 30)
            }
            .scrollIndicators(.hidden)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            ETBottomBar(title: "Tovább az építőbe") { flow.go(nil) }
        }
        .sheet(item: Binding(get: { flow.sheetMuscle.flatMap { m in etMuscles.first { $0.muscle == m } } },
                             set: { flow.sheetMuscle = $0?.muscle })) { m in
            ETWhySheet(row: m)
                .presentationDetents([.large])
                .presentationBackground(NK.ground)
                .presentationCornerRadius(34)
                .presentationDragIndicator(.visible)
        }
    }

    private func row(_ m: ETMuscleRow) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 5) {
                Text(planMuscleName(m.muscle)).nkFont(16).foregroundStyle(.white)
                PlanTierPill(tier: m.tier)
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 3) {
                    Text("\(m.sets)").font(.nkNumber(24)).foregroundStyle(.white)
                    Text("/ hét").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                }
                Text("sáv \(m.low)–\(m.high)").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
            }
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.35))
        }
        .padding(.vertical, 11)
        .contentShape(Rectangle())
    }
}

struct ETWhySheet: View {
    let row: ETMuscleRow
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .firstTextBaseline) {
                    Text(planMuscleName(row.muscle)).nkFont(30, design: .serif).foregroundStyle(.white)
                    Spacer()
                    PlanTierPill(tier: row.tier)
                }
                PlanArcGauge(value: row.sets, band: etBand(row.low, row.high), inside: row.inside)
                    .frame(height: 124)
                    .overlay(alignment: .bottom) {
                        VStack(spacing: 0) {
                            Text("\(row.sets)").nkFont(44, .medium).foregroundStyle(.white)
                            Text("sorozat hetente").nkFont(11).foregroundStyle(.white.opacity(0.5))
                        }
                    }
                NKFlowRow(spacing: 6, rowSpacing: 6) {
                    PlanPill("Sáv \(row.low)–\(row.high)", color: planTierColor(row.tier == .maintain ? .grow : row.tier), mark: .target)
                    ForEach(Array(row.spread.enumerated()), id: \.offset) { PlanPill("\($0.element.0) \($0.element.1)", mark: .calendar) }
                }

                if let hint = row.hint {
                    HStack(alignment: .top, spacing: 10) {
                        PlanMark(.flame, color: planWarn, size: 18).padding(.top, 1)
                        Text(hint).nkFont(13.5).foregroundStyle(.white.opacity(0.88)).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(planWarn.opacity(0.1)))
                }

                block("Mi ez a sáv",
                      "Az a heti kemény sorozatszám, amitől ez az izom még nő, és amit még jól kipihensz. \(row.low) alatt lassabban fejlődik, \(row.high) fölött már inkább csak fáraszt.")
                block("Honnan jön",
                      "Kutatások szerint edzett embereknél izmonként heti 12–20 kemény sorozat jó tartomány: több sorozat több növekedést hoz, egy határig. A te sávod ebből a becslésből jön; Hangsúly szinten a felső részéhez közelítünk.")
                block("És a Tartás",
                      "Ahol egy izom csak Tartást kap, ott a növelő adag nagyjából harmada is megtartja a méretét. Ezért egyik izom sem megy le nullára, akkor sem, ha épp nincs fókuszban.")
                Text("Forrás: összefoglaló kutatások a heti sorozatszám és az izomnövekedés kapcsolatáról (2017, 2022), és a megtartó edzésről (2011).")
                    .nkFont(11.5).foregroundStyle(.white.opacity(0.42)).fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 2)
            }
            .padding(.horizontal, 22).padding(.top, 28).padding(.bottom, 30)
        }
        .scrollIndicators(.hidden)
        .preferredColorScheme(.dark)
    }

    private func block(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased()).nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(planHue.glow)
            Text(text).nkFont(13.5).foregroundStyle(.white.opacity(0.78)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.05)))
    }
}
#endif
