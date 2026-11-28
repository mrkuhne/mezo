import SwiftUI
import BoopCore
import BoopDesign

// The gym catch-up (`mezo-r36n9.161`, spec §3.6): a past template day booked „Megvolt" with the plan's numbers. The
// sheet shows the day's prescribed sets as of today, lets one weight per exercise be typed before booking, asks when
// it started, and queues one booking the outbox sends — offline-first, like every other write.

@MainActor @Observable
final class WorkoutAsPlannedModel {
    let date: String
    let title: String
    private(set) var workout: TodayWorkout?
    private(set) var loading = true
    private(set) var problem: String?
    /// One weight per exercise, typed on the sheet (the prescription's otherwise).
    var overrides: [UUID: Double] = [:]
    /// The exercise whose weight field is open.
    var editing: UUID?
    var startedAt: Date
    private(set) var planTime = true
    private(set) var booking = false

    @ObservationIgnored private let templateSessionId: UUID?
    @ObservationIgnored private let train: TrainClient?
    @ObservationIgnored private let calendar: Calendar
    @ObservationIgnored private var sessionTime: String?

    init(templateSessionId: UUID?, date: String, title: String, train: TrainClient?, calendar: Calendar = .current) {
        self.templateSessionId = templateSessionId; self.date = date; self.title = title; self.train = train; self.calendar = calendar
        startedAt = asPlannedDefaultTime(session: nil, on: date, calendar: calendar)
    }

    var rows: [AsPlannedRow] { workout.map { asPlannedRows($0, overrides: overrides) } ?? [] }
    var startLabel: String { whenLabel(.other(startedAt), now: BoopClock.now(), withTime: true, calendar: calendar) }

    func load() async {
        guard let train else { loading = false; problem = "Most nem érem el az edzéstervet."; return }
        loading = true
        do {
            let w = try await train.todayWorkout(templateSessionId: templateSessionId)
            workout = w
            problem = nil
        } catch {
            problem = "Most nem érem el az edzéstervet — próbáld újra, ha van net."
        }
        loading = false
    }

    /// The day's planned session time (from the brief, when the room knows it) as the default start.
    func useSessionTime(_ time: String?) {
        sessionTime = time
        if planTime { startedAt = asPlannedDefaultTime(session: time, on: date, calendar: calendar) }
    }

    func pickPlanTime() { planTime = true; startedAt = asPlannedDefaultTime(session: sessionTime, on: date, calendar: calendar) }
    func pickOtherTime() { planTime = false }

    func setWeight(_ text: String, for exercise: UUID) {
        let cleaned = text.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces)
        if let kg = Double(cleaned), kg > 0 { overrides[exercise] = kg } else { overrides[exercise] = nil }
    }

    var payload: WorkoutAsPlannedPayload? {
        workout.flatMap { asPlannedPayload(workout: $0, date: date, startedAt: startedAt, overrides: overrides) }
    }

    /// Books the day: the queue keeps it, the net sends it; the room re-reads on the tick.
    func book(ritmus: RitmusEnvironment?) async -> String? {
        guard let payload, let ritmus, !booking else { problem = "Most nem tudom könyvelni."; return nil }
        booking = true
        defer { booking = false }
        do {
            try await ritmus.captureWorkoutAsPlanned(payload)
            return whenToast("Edzés könyvelve", choice: .other(startedAt), now: BoopClock.now(), calendar: calendar)
        } catch {
            problem = "Nem tudtam eltenni a telefonra — próbáld újra."
            return nil
        }
    }
}

/// The Megvolt sheet.
struct WorkoutAsPlannedSheet: View {
    let onDone: (String?) -> Void
    @State private var model: WorkoutAsPlannedModel
    @State private var weightText = ""
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @Environment(MorningStore.self) private var morning: MorningStore?

    init(templateSessionId: UUID?, date: String, title: String, train: TrainClient?, onDone: @escaping (String?) -> Void) {
        self.onDone = onDone
        _model = State(initialValue: WorkoutAsPlannedModel(templateSessionId: templateSessionId, date: date, title: title, train: train))
    }

    private var dayWord: String {
        guard let env = ritmus else { return model.date }
        return NaploDate.label(model.date, today: env.today, calendar: env.calendar).lowercased()
    }

    var body: some View {
        NKSheetFrame(hue: .mozgas, eyebrow: "Edzés pótlása · \(dayWord)", title: model.workout?.title ?? model.title,
                     closable: !model.booking) {
            VStack(alignment: .leading, spacing: 14) {
                if model.loading {
                    Text("Nézem a terv sorozatait…").nkFont(14).foregroundStyle(.white.opacity(0.6))
                } else if let problem = model.problem, model.workout == nil {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(problem).nkFont(14).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
                        NKPill("Újra", primary: false) { Task { await model.load() } }
                    }
                    .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(24)
                } else {
                    sets
                    when
                    Text("A terv számaival könyvelem; a súlyt gyakorlatonként itt átírhatod, utána már nem.")
                        .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
                    if let problem = model.problem {
                        Text(problem).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            QuickFoot(title: "Megvolt", busy: model.booking, disabled: model.payload == nil) {
                Task { if let toast = await model.book(ritmus: ritmus) { onDone(toast) } }
            }
        }
        .task {
            await model.load()
            model.useSessionTime(morning?.brief?.day.session?.plannedTime ?? morning?.brief?.day.session?.time)
        }
        .interactiveDismissDisabled(model.booking)
    }

    private var sets: some View {
        VStack(alignment: .leading, spacing: 0) {
            NKMono("A TERV SOROZATAI").padding(.bottom, 10)
            ForEach(Array(model.rows.enumerated()), id: \.element.id) { k, r in
                if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                Button {
                    if model.editing == r.id { model.editing = nil } else { model.editing = r.id; weightText = "" }
                } label: {
                    HStack(spacing: 10) {
                        Text(r.name).nkFont(15, .medium).foregroundStyle(.white).lineLimit(1)
                        Spacer(minLength: 8)
                        Text(r.setsText).nkFont(12.5, design: .monospaced)
                            .foregroundStyle(r.needsWeight ? .white.opacity(0.5) : Hue.mozgas.glow)
                    }
                    .frame(minHeight: 40)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint("A súly átírása")
                .frameProbe("asp.\(r.name)")
                if model.editing == r.id {
                    HStack(spacing: 10) {
                        TextField("", text: $weightText, prompt: Text("kg").foregroundStyle(.white.opacity(0.4)))
                            .keyboardType(.decimalPad).nkFont(16).foregroundStyle(.white)
                            .onChange(of: weightText) { model.setWeight(weightText, for: r.id) }
                        Text("kg").nkFont(13).foregroundStyle(.white.opacity(0.55))
                        Button("Kész") { model.editing = nil }.nkFont(13, .semibold).foregroundStyle(.white).buttonStyle(.plain)
                    }
                    .padding(12).background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(.white.opacity(0.06)))
                    .padding(.bottom, 8)
                }
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(24)
    }

    private var when: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                NKGlyph("clock-ink", .white.opacity(0.7), size: 14)
                NKMono("MIKOR")
                Spacer(minLength: 8)
                Text(model.startLabel).nkFont(13, .medium).foregroundStyle(Hue.mozgas.glow)
            }
            HStack(spacing: 8) {
                chip("A terv ideje", on: model.planTime) { model.pickPlanTime() }
                chip("Más időpont", on: !model.planTime) { model.pickOtherTime() }
            }
            if !model.planTime {
                DatePicker("Mikor", selection: Binding(get: { model.startedAt }, set: { model.startedAt = $0 }),
                           displayedComponents: [.hourAndMinute])
                    .datePickerStyle(.compact).labelsHidden().colorScheme(.dark).tint(Hue.mozgas.glow)
                    .environment(\.locale, Locale(identifier: "hu_HU"))
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(24)
    }

    private func chip(_ text: String, on: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text).nkFont(12.5, .medium).foregroundStyle(on ? NK.ground : .white.opacity(0.85))
                .padding(.horizontal, 12).frame(minHeight: 34)
                .background(Capsule().fill(on ? .white.opacity(0.92) : .white.opacity(0.08)))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
        .frameProbe("asp.chip.\(text)")
    }
}
