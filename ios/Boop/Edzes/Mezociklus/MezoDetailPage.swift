import SwiftUI
import BoopCore
import BoopDesign

/// One mezociklus, looked at before anything happens (mezo-r36n9.177, spike `MezoDetailSpike`): a template, a
/// planned run or a closed run. Only the bottom bar starts it, after a confirmation.
struct MezoDetailPage: View {
    let card: MezoCard
    let model: MezociklusokModel
    let plan: PlanClient
    let hue: Hue
    let onBack: () -> Void
    let onStarted: (String) -> Void
    @State private var confirmStart = false
    @State private var showReport = false
    @State private var editor: MezoEditorCover?
    @State private var openingEditor = false
    /// The day cards grow with the text size, so a large Dynamic Type never cuts the day's name.
    @ScaledMetric(relativeTo: .body) private var dayCardHeight: CGFloat = 150

    var body: some View {
        NKAreaSubPage(hue: hue, crumb: "Mezociklusaim", eyebrow: eyebrow, title: card.title, sentence: sentence, onBack: onBack) {
            if !card.loads.isEmpty {
                SpikeHero {
                    VStack(alignment: .leading, spacing: 12) {
                        NKBare("A HETEK ÍVE", hue: hue, glyph: "chart-deep") {
                            SpikeWeeksArc(weeks: mezoTimeline(card), hue: hue)
                        }
                        Text(timelineCaption).nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                    }
                }
            }
            if card.kind == .closed, card.hasReport, let id = card.blockId { reportTeaser(id) }
            if !card.days.isEmpty {
                SpikeCard(label: "A hét napjai", hue: hue, glyph: "dumbbell-ink") {
                    NKCarousel(card.days.enumerated().map { MezoDayItem(index: $0.offset, day: $0.element) }, hue: hue,
                               height: min(dayCardHeight, 360), widthFraction: 0.46) { item in dayCard(item.day) }
                }
            }
            if !card.heat.isEmpty {
                SpikeCard(label: "Mit kapnak az izmok", hue: hue, glyph: "body-cream") {
                    HStack(spacing: 18) {
                        NKBodyMap(mezoHeat(card), hue: hue, views: .both).frame(height: 170).accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(mezoTopGroups(card), id: \.name) { g in
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(g.name).nkFont(13, .semibold).foregroundStyle(.white)
                                    NKLevelBar(level: g.level, hue: hue)
                                }
                                .accessibilityElement(children: .ignore)
                                .accessibilityLabel("\(g.name): \(Int((g.level * 100).rounded())) százalék a legtöbbet dolgozóhoz képest")
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
            Color.clear.frame(height: 20)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { actionBar }
        .confirmationDialog(card.kind == .closed ? "Újrafuttatod: \(card.title)?" : "Elindítod: \(card.title)?",
                            isPresented: $confirmStart, titleVisibility: .visible) {
            Button("Indítás ma") { start() }
            Button("Mégse", role: .cancel) {}
        } message: {
            if let running = model.groups.running {
                Text("A most futó „\(running.title)” lezárul, és zárójelentéssel a lezártak közé kerül.")
            } else {
                Text("Ma indul, az 1. héttől.")
            }
        }
        .fullScreenCover(isPresented: $showReport) {
            if let id = card.blockId { MezoReportPage(blockId: id, plan: plan, hue: hue) { showReport = false } }
        }
        .fullScreenCover(item: $editor) { cover in
            BlockBuilderPage(model: cover.model) { editor = nil; Task { await model.load() } }
        }
    }

    private var eyebrow: String {
        switch card.kind {
        case .running: "Most fut · \(card.currentWeek). hét"
        case .planned: "Következik · \(card.dateText)"
        case .closed: "Lezárt · \(card.dateText)"
        case .template: card.runCount == 0 ? "Sablon · még nem futott" : "Sablon · \(card.runCount)-szor futott"
        }
    }

    private var sentence: String {
        switch card.kind {
        case .template: "Nézd át nyugodtan: semmi nem indul el, amíg nem kéred."
        case .closed: "Így ment, és innen újra is futtathatod, ugyanezzel a tervvel."
        case .planned: "Ez a következő. Elindíthatod korábban is."
        case .running: "Ez fut most."
        }
    }

    private var timelineCaption: String {
        let rest = card.phases.last == "Pihenőhét" ? " · a végén pihenőhét" : ""
        return mezoLine(card) + rest
    }

    private func reportTeaser(_ id: String) -> some View {
        SpikeCard(label: "Hogy sikerült", hue: hue, glyph: "medal-sun") {
            Button { showReport = true } label: {
                HStack(spacing: 16) {
                    MezoRing(value: card.adherence, hue: hue, size: 70)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(teaserLine).nkFont(15, .semibold).foregroundStyle(.white)
                        Text("Zárójelentés és Boop értékelése").nkFont(13).foregroundStyle(.white.opacity(0.6))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "chevron.right").foregroundStyle(.white.opacity(0.45))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Zárójelentés: \(teaserLine)")
            .accessibilityAddTraits(.isButton)
        }
    }

    private var teaserLine: String {
        guard let r = card.blockId.flatMap({ model.reports[$0] }) else { return "Nézd meg, hogy ment" }
        let medals = r.records?.medalCount ?? 0
        let done = r.adherence.flatMap { a in a.completedSessions.flatMap { c in a.plannedSessions.map { "\(c) edzés \(mezoOf($0))" } } }
        return [done, medals > 0 ? "\(medals) új rekord" : nil].compactMap { $0 }.joined(separator: " · ")
            .nonEmpty ?? "Nézd meg, hogy ment"
    }

    private func dayCard(_ d: MezoDayPeek) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(d.name.uppercased()).nkFont(11, .medium, design: .monospaced).tracking(1.4).foregroundStyle(hue.glow)
            Text(d.focus.isEmpty ? "Edzésnap" : d.focus).nkFont(18, design: .serif).foregroundStyle(.white).lineLimit(2)
            Spacer(minLength: 0)
            Text("\(d.exerciseCount) gyakorlat").nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.5))
        }
        .padding(14).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).spikeInner(22)
        .accessibilityElement(children: .combine)
    }

    /// The decision lives at the bottom, after he has seen it. Offline it says why it does nothing.
    private var actionBar: some View {
        VStack(spacing: 8) {
            if let error = model.lastError {
                Text(error).nkFont(13).foregroundStyle(planWarn).frame(maxWidth: .infinity, alignment: .leading)
            } else if model.offline {
                Text("Net nélkül most csak nézni tudod.").nkFont(13).foregroundStyle(.white.opacity(0.6))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            HStack(spacing: 10) {
                if card.kind != .running {
                    MezoButton(title: card.kind == .closed ? "Újrafuttatás" : "Indítás", busy: model.busy) { confirmStart = true }
                        .disabled(model.busy || model.offline)
                }
                MezoButton(title: "Szerkesztés", style: .secondary, busy: openingEditor) { openEditor() }
                    .disabled(model.busy || model.offline || openingEditor)
            }
        }
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 12)
        .background(LinearGradient(colors: [NK.ground.opacity(0), NK.ground.opacity(0.95), NK.ground], startPoint: .top, endPoint: .bottom)
            .ignoresSafeArea(edges: .bottom))
    }

    private func start() {
        Task {
            let started: WireBlock? = switch card.kind {
            case .template: await model.start(template: card)
            case .planned: await model.activate(planned: card)
            case .closed: await model.rerun(closed: card)
            case .running: nil
            }
            if let started { onStarted("Elindult: \(started.title) · 1. hét") }
        }
    }

    private func openEditor() {
        openingEditor = true
        Task {
            if let m = await mezoEditor(for: card, plan: plan) { editor = MezoEditorCover(model: m) }
            openingEditor = false
        }
    }
}

/// The builder cover's item: the model rides on it (a model kept in separate state can be read as nil by a cover
/// built in the same update).
struct MezoEditorCover: Identifiable {
    let id = UUID()
    let model: BlockBuilderModel
}

private struct MezoDayItem: Identifiable {
    let index: Int
    let day: MezoDayPeek
    var id: Int { index }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
