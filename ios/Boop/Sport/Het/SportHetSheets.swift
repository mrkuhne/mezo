import SwiftUI
import BoopCore
import BoopDesign

/// Sport → Hét → a recurring slot (`mezo-r36n9.204`, spike `SportSlotSheet`): the eleven sports, the day tiles, start
/// and length steppers, edzés or meccs, the place, the „Ez változik" box (the gap to that day's gym, a same-day clash)
/// and delete. Saving sends the whole rhythm; a failed save keeps the sheet open with what he entered and a retry.
struct SportSlotSheet: View {
    let isNew: Bool
    let others: [SportSlot]
    let week: SportOverview?
    let save: (SportSlot) async throws -> Void
    let delete: (SportSlot) async throws -> Void
    @State private var slot: SportSlot
    @State private var place: String
    @State private var busy = false
    @State private var problem: String?

    init(slot: SportSlot, isNew: Bool, others: [SportSlot], week: SportOverview?,
         save: @escaping (SportSlot) async throws -> Void, delete: @escaping (SportSlot) async throws -> Void) {
        self.isNew = isNew; self.others = others; self.week = week; self.save = save; self.delete = delete
        _slot = State(initialValue: slot)
        _place = State(initialValue: slot.location ?? "")
    }

    private var edited: SportSlot { var s = slot; s.location = place; return s }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                NKMono(isNew ? "ÚJ RENDSZERES ALKALOM" : "RENDSZERES ALKALOM")
                Text(isNew ? "Mikor sportolsz?" : sportSlotTitle(slot)).font(.nkSerif(28)).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                SportFormRow("Milyen sport?") { SportKindChips(selected: $slot.sport) }
                SportFormRow("Melyik nap?") {
                    HStack(spacing: 6) {
                        ForEach(0..<7, id: \.self) { d in
                            SportTile(text: sportDayTiles[d], on: d == slot.dayOfWeek, label: sportDayNames[d]) { slot.dayOfWeek = d }
                        }
                    }
                }
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .top, spacing: 14) { timeRows }
                    VStack(alignment: .leading, spacing: 18) { timeRows }
                }
                SportFormRow("Edzés vagy meccs?") { SportMatchToggle(match: Binding(get: { slot.isMatch }, set: { slot.kind = $0 ? "match" : "training" })) }
                SportFormRow("Hol?") { SportPlaceField(text: $place) }
                let effect = sportSlotEffect(edited, others: others, week: week)
                VStack(alignment: .leading, spacing: 8) {
                    NKMono("EZ VÁLTOZIK")
                    Text(effect.text).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                    if let c = effect.clash { Text(c).nkFont(13.5).foregroundStyle(Hue.sport.glow).fixedSize(horizontal: false, vertical: true) }
                }
                .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(20)
                .accessibilityElement(children: .combine)
                if let problem { SportSheetProblem(text: problem) }
                NKPill(busy ? "Mentem…" : problem != nil ? "Újra próbálom" : isNew ? "Felveszem" : "Mentés", glyph: "check-ink") {
                    Task { await run { try await save(edited) } }
                }
                .disabled(busy)
                .padding(.top, 4)
                if !isNew {
                    Button { Task { await run { try await delete(slot) } } } label: {
                        Text("Alkalom törlése").nkFont(15, .medium).foregroundStyle(Hue.sport.glow).frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .disabled(busy)
                }
            }
            .padding(22)
        }
        #if DEBUG
        // Simulator review: `-sportAutoSave YES` presses the save button once (with `-sportSaveFail YES`: the failed state).
        .task { if UserDefaults.standard.bool(forKey: "sportAutoSave") { await run { try await save(edited) } } }
        #endif
    }

    @ViewBuilder private var timeRows: some View {
        SportFormRow("Kezdés") {
            SportHetStepper(value: slot.time, less: "Korábban", more: "Később",
                            minus: { slot.time = sportShiftTime(slot.time, by: -15) }, plus: { slot.time = sportShiftTime(slot.time, by: 15) })
        }
        SportFormRow("Hossz") {
            SportHetStepper(value: sportLength(slot.durationMin), less: "Rövidebb", more: "Hosszabb",
                            minus: { slot.durationMin = max(15, slot.durationMin - 15) }, plus: { slot.durationMin = min(360, slot.durationMin + 15) })
        }
    }

    private func run(_ op: () async throws -> Void) async {
        busy = true
        defer { busy = false }
        do {
            try await op()
            problem = nil
        } catch {
            problem = sportSaveProblem(error)
        }
    }
}

/// Sport → Hét → a one-off event (`mezo-r36n9.204`): a new one is entered here (sport, day, start, length, edzés or
/// meccs, place); an existing one opens read-only with delete (the server has no edit for events).
struct SportEventSheet: View {
    let existing: SportEvent?
    let today: String
    let create: (SportEventDraft) async throws -> Void
    let delete: (SportEvent) async throws -> Void
    @State private var draft: SportEventDraft
    @State private var place = ""
    @State private var busy = false
    @State private var problem: String?

    init(existing: SportEvent?, today: String, create: @escaping (SportEventDraft) async throws -> Void,
         delete: @escaping (SportEvent) async throws -> Void) {
        self.existing = existing; self.today = today; self.create = create; self.delete = delete
        _draft = State(initialValue: SportEventDraft(date: sportAddDays(today, 7), time: "09:00", durationMin: 120, kind: "match"))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                NKMono(existing == nil ? "ÚJ ESEMÉNY" : "EGYSZERI ESEMÉNY")
                if let e = existing { shown(e) } else { form }
                if let problem { SportSheetProblem(text: problem) }
                if let e = existing {
                    Button { Task { await run { try await delete(e) } } } label: {
                        Text(busy ? "Törlöm…" : problem != nil ? "Újra próbálom a törlést" : "Esemény törlése")
                            .nkFont(15, .medium).foregroundStyle(Hue.sport.glow).frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .disabled(busy)
                } else {
                    NKPill(busy ? "Mentem…" : problem != nil ? "Újra próbálom" : "Felveszem", glyph: "check-ink") {
                        var d = draft
                        d.location = place
                        Task { await run { try await create(d) } }
                    }
                    .disabled(busy)
                    .padding(.top, 4)
                }
            }
            .padding(22)
        }
    }

    private func shown(_ e: SportEvent) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(sportEventTitle(e)).font(.nkSerif(28)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text("\(sportEventDateLabel(e.date)) · \(sportEventLine(e))").nkFont(15).foregroundStyle(.white.opacity(0.8))
                .fixedSize(horizontal: false, vertical: true)
            Text(sportEventEffect).nkFont(13.5).foregroundStyle(Hue.sport.glow).fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder private var form: some View {
        Text("Mikor lesz?").font(.nkSerif(28)).foregroundStyle(.white).accessibilityAddTraits(.isHeader)
        SportFormRow("Milyen sport?") { SportKindChips(selected: $draft.sport) }
        SportFormRow("Melyik nap?") {
            SportHetStepper(value: sportEventDateLabel(draft.date), less: "Egy nappal korábban", more: "Egy nappal később",
                            minus: { if draft.date > today { draft.date = sportAddDays(draft.date, -1) } },
                            plus: { if draft.date < sportAddDays(today, 365) { draft.date = sportAddDays(draft.date, 1) } })
        }
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: 14) { timeRows }
            VStack(alignment: .leading, spacing: 18) { timeRows }
        }
        SportFormRow("Edzés vagy meccs?") { SportMatchToggle(match: Binding(get: { draft.kind == "match" }, set: { draft.kind = $0 ? "match" : "training" })) }
        SportFormRow("Hol?") { SportPlaceField(text: $place) }
        VStack(alignment: .leading, spacing: 8) {
            NKMono("EZ VÁLTOZIK")
            Text("\(sportEventDateLabel(draft.date).prefix(1).uppercased() + sportEventDateLabel(draft.date).dropFirst()) \(draft.time)-kor \(draft.sportKind.name.lowercased()), \(sportLength(draft.durationMin)). \(sportEventEffect)")
                .nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(20)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var timeRows: some View {
        SportFormRow("Kezdés") {
            SportHetStepper(value: draft.time, less: "Korábban", more: "Később",
                            minus: { draft.time = sportShiftTime(draft.time, by: -15) }, plus: { draft.time = sportShiftTime(draft.time, by: 15) })
        }
        SportFormRow("Hossz") {
            SportHetStepper(value: sportLength(draft.durationMin), less: "Rövidebb", more: "Hosszabb",
                            minus: { draft.durationMin = max(15, draft.durationMin - 15) }, plus: { draft.durationMin = min(360, draft.durationMin + 15) })
        }
    }

    private func run(_ op: () async throws -> Void) async {
        busy = true
        defer { busy = false }
        do {
            try await op()
            problem = nil
        } catch {
            problem = sportSaveProblem(error)
        }
    }
}

/// What a failed write says (the sheet stays open; nothing he entered is lost).
func sportSaveProblem(_ error: Error) -> String {
    (error as? PlanFetchError) == .offline
        ? "Nincs net — nem tudtam elmenteni. Amit beírtál, itt marad; próbáld újra, ha van kapcsolat."
        : "Most nem sikerült elmenteni. Amit beírtál, itt marad; próbáld újra."
}

// MARK: - Shared form bits

private struct SportFormRow<C: View>: View {
    let title: String
    @ViewBuilder let content: () -> C
    init(_ title: String, @ViewBuilder _ content: @escaping () -> C) { self.title = title; self.content = content }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).nkFont(15.5, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The eleven sports as chips that wrap whole words.
private struct SportKindChips: View {
    @Binding var selected: String
    var body: some View {
        NKFlowRow {
            ForEach(SportKind.chips, id: \.self) { k in
                let on = SportKind(wire: selected) == k
                Button { selected = k.rawValue } label: { SportChipView(text: k == .other ? "Egyéb" : k.name, on: on) }
                    .buttonStyle(.plain)
                    .frame(minHeight: 44)
                    .accessibilityLabel(k == .other ? "Egyéb" : k.name)
                    .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
    }
}

private struct SportTile: View {
    let text: String
    let on: Bool
    let label: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(text).nkFont(14, on ? .semibold : .regular)
                .foregroundStyle(on ? NK.ground : .white.opacity(0.85))
                .lineLimit(1).minimumScaleFactor(0.5)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(RoundedRectangle(cornerRadius: 12).fill(on ? Hue.sport.glow : .white.opacity(0.08)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

private struct SportMatchToggle: View {
    @Binding var match: Bool
    var body: some View {
        HStack(spacing: 8) {
            ForEach([false, true], id: \.self) { m in
                Button { match = m } label: {
                    Text(m ? "Meccs" : "Edzés").nkFont(14.5, m == match ? .semibold : .regular)
                        .foregroundStyle(m == match ? NK.ground : .white)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(Capsule().fill(m == match ? Hue.sport.glow : .white.opacity(0.09)))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(m == match ? .isSelected : [])
            }
        }
    }
}

private struct SportPlaceField: View {
    @Binding var text: String
    var body: some View {
        TextField("", text: $text, prompt: Text("például: Sportcsarnok").foregroundStyle(.white.opacity(0.4)))
            .nkFont(15).foregroundStyle(.white).padding(12)
            .background(RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.07)))
            .accessibilityLabel("Hol")
    }
}

/// − value + (spike stepper), whole-word VoiceOver labels.
private struct SportHetStepper: View {
    let value: String
    let less: String, more: String
    let minus: () -> Void, plus: () -> Void
    var body: some View {
        HStack(spacing: 10) {
            step("−", less, minus)
            Text(value).font(.nkNumber(20)).foregroundStyle(.white).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
                .frame(maxWidth: .infinity)
                .accessibilityLabel(value)
            step("+", more, plus)
        }
        .accessibilityElement(children: .contain)
    }
    private func step(_ t: String, _ label: String, _ a: @escaping () -> Void) -> some View {
        Button(action: a) {
            Text(t).font(.system(size: 20, weight: .medium)).foregroundStyle(.white)
                .frame(width: 44, height: 44).background(Circle().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

private struct SportSheetProblem: View {
    let text: String
    var body: some View {
        Text(text).nkFont(13.5).foregroundStyle(Hue.sport.glow).fixedSize(horizontal: false, vertical: true)
            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 14).fill(Hue.sport.glow.opacity(0.12)))
            .accessibilityAddTraits(.isStaticText)
    }
}
