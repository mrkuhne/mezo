import SwiftUI
import BoopCore
import BoopDesign

// The quick log's own sheets (`mezo-r36n9.154`): each is one screen, one tap to the point, and says in his words what
// happened. Water and the supplements write straight to the server, as the Étel room does; the weight, the night, the
// sport (the Sport room's Log sheet, S6) and the journal line go through the outbox, so they work on a plane.

private let quickEyebrow = "Gyors rögzítés"

extension WhenChoice {
    /// Simulator review: `-previewWhen tegnap` opens the sheets on yesterday (DEBUG only).
    static var previewDefault: WhenChoice {
        #if DEBUG
        if UserDefaults.standard.string(forKey: "previewWhen") == "tegnap" { return .yesterday }
        #endif
        return .now
    }
}

/// "1 dl", "7,5 dl".
func waterLabel(_ ml: Int) -> String {
    let dl = Double(ml) / 100
    return dl == dl.rounded() ? "\(Int(dl)) dl" : String(format: "%.1f dl", dl).replacingOccurrences(of: ".", with: ",")
}

/// "81,4 kg".
func kgText(_ kg: Double) -> String { String(format: "%.1f kg", kg).replacingOccurrences(of: ".", with: ",") }

/// "7 ó 35 p" from hours.
func sleepHoursText(_ hours: Double) -> String {
    let m = Int((hours * 60).rounded())
    return "\(m / 60) ó \(m % 60) p"
}

/// The one button of a quick sheet, riding above the keyboard, with the sheet's problem line over it.
struct QuickFoot: View {
    let title: String
    var busy = false
    var disabled = false
    var error: String?
    let action: () -> Void

    var body: some View {
        VStack(spacing: 6) {
            if let error {
                Text(error).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).frame(maxWidth: .infinity, alignment: .leading)
            }
            NKPill(busy ? "Rögzítem…" : title, glyph: "plus-ink", action: action)
                .disabled(busy || disabled)
                .opacity(disabled ? 0.5 : 1)
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(NK.ground.opacity(0.92))
    }
}

@MainActor private func quickHint(_ text: String) -> some View {
    Text(text).nkFont(12.5).foregroundStyle(.white.opacity(0.5)).frame(maxWidth: .infinity, alignment: .leading)
}

// MARK: - Víz

/// One tap per amount; the Étel room's own counter takes it (the same write, so the room and Ma agree).
struct WaterSheet: View {
    let onDone: (String?) -> Void
    @Environment(\.foodClient) private var food
    @State private var busy = false
    @State private var problem: String?

    /// The amounts on the sheet, in ml — a deci is the unit he thinks in.
    static let amounts = [100, 200, 300, 500, 750]

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: quickEyebrow, title: "Víz") {
            VStack(alignment: .leading, spacing: 12) {
                NKMono("MENNYIT ITTÁL?")
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                    ForEach(Self.amounts, id: \.self) { ml in
                        Button { Task { await send(ml) } } label: {
                            VStack(spacing: 4) {
                                Text(waterLabel(ml)).nkFont(22, .semibold).foregroundStyle(.white)
                                Text("\(ml) ml").nkFont(12).foregroundStyle(.white.opacity(0.55))
                            }
                            .frame(maxWidth: .infinity).frame(height: 74).nkGlass(18)
                        }
                        .buttonStyle(.plain)
                        .disabled(busy)
                    }
                }
                if let problem { Text(problem).nkFont(13.5).foregroundStyle(.white.opacity(0.8)) }
                quickHint("Az Étel szoba Ma lapján ugyanez a számláló áll.")
            }
            .padding(.horizontal, 2)
        }
    }

    private func send(_ ml: Int) async {
        guard let food else { problem = "Most nem tudom elküldeni."; return }
        busy = true
        defer { busy = false }
        let now = Date()
        do {
            try await food.water(ml: ml, date: now, clientRef: UUID(), capturedAt: now)
            onDone("Víz +\(ml) ml")
        } catch FoodFetchError.offline {
            problem = "Nincs net — a vizet csak nettel tudom elküldeni. Próbáld újra, ha van."
        } catch {
            problem = "Nem sikerült elküldeni — próbáld újra."
        }
    }
}

// MARK: - Súly

/// The scale, on the same finger-dragged ruler the player uses (decision #95), opening on the last weight typed here.
struct WeightSheet: View {
    let onDone: (String?) -> Void
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @State private var kg: Double = WeightSheet.lastKg
    @State private var when: WhenChoice = .previewDefault
    @State private var busy = false
    @State private var problem: String?

    /// The last weight typed on this phone: a daily reading is a small nudge, not a search from zero.
    static var lastKg: Double {
        let saved = UserDefaults.standard.double(forKey: "quick.weightKg")
        return saved > 0 ? saved : 80
    }

    var body: some View {
        NKSheetFrame(hue: .forma, eyebrow: quickEyebrow, title: "Súly") {
            VStack(alignment: .leading, spacing: 14) {
                NKScale(label: "SÚLY", value: kg, step: 0.1, range: 30...250, hue: .forma, format: { kgText($0) },
                        onChange: { kg = $0 },
                        onSet: { typed in
                            if let v = Double(typed.replacingOccurrences(of: ",", with: ".")) { kg = min(250, max(30, v)) }
                        })
                WhenRow(eyebrow: "MELYIK NAP", hue: .forma, choice: $when)
                quickHint("Reggel, étkezés előtt a legjobb. Egy napra a legutóbb beírt mérés számít.")
            }
        }
        .safeAreaInset(edge: .bottom) { QuickFoot(title: "Rögzítem", busy: busy, error: problem) { Task { await save() } } }
    }

    private func save() async {
        guard let ritmus else { problem = "Most nem tudom eltenni."; return }
        busy = true
        defer { busy = false }
        let now = BoopClock.now()
        do {
            try await ritmus.captureWeight(kg: kg, at: whenResolved(when, now: now, calendar: .current))
            UserDefaults.standard.set(kg, forKey: "quick.weightKg")
            onDone(whenToast("Súly \(kgText(kg)) rögzítve", choice: when, now: now, calendar: .current))
        } catch {
            problem = "Nem tudtam eltenni a telefonra — próbáld újra."
        }
    }
}

// MARK: - Alvás

/// A night by hand — no watch, or a nap: the two clock times, the length computed from them, and how it felt.
struct SleepLogSheet: View {
    let onDone: (String?) -> Void
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @State private var bed = SleepLogSheet.clock(23, 0)
    @State private var wake = SleepLogSheet.clock(7, 0)
    @State private var quality: Int?
    @State private var when: WhenChoice = .previewDefault
    @State private var busy = false
    @State private var problem: String?

    static func clock(_ h: Int, _ m: Int) -> Date {
        Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: Date()) ?? Date()
    }

    private var bedText: String { clockLabel(bed) }
    private var wakeText: String { clockLabel(wake) }
    private var hours: Double? { sleepDurationHours(bedtime: bedText, wakeup: wakeText) }

    var body: some View {
        NKSheetFrame(hue: .alvas, eyebrow: quickEyebrow, title: "Alvás") {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    timeBox("LEFEKVÉS", $bed)
                    timeBox("ÉBREDÉS", $wake)
                }
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(hours.map(sleepHoursText) ?? "–").nkFont(28, .semibold).foregroundStyle(.white)
                    Text("alvás").nkFont(13).foregroundStyle(.white.opacity(0.55))
                }
                NKInlineStepper(label: "Milyen volt (1–10)", value: quality.map(String.init) ?? "–", hue: .alvas,
                                onDown: { quality = quality.map { max(1, $0 - 1) } },
                                onUp: { quality = min(10, (quality ?? 6) + 1) })
                    .padding(14).nkGlass(16)
                WhenRow(eyebrow: "MELYIK REGGEL ÉBREDTÉL", hue: .alvas, choice: $when)
                if let note = whenSleepNote(when) { quickHint(note) }
                quickHint("Ha az órád mérte az éjszakát, nem kell beírnod — ez a kézi út, például óra nélkül vagy egy délutáni alváshoz. Arra a reggelre kerül, amelyiket választod.")
            }
        }
        .safeAreaInset(edge: .bottom) {
            QuickFoot(title: "Rögzítem", busy: busy, disabled: hours == nil, error: problem) { Task { await save() } }
        }
    }

    /// The night as the server takes it, filed on the chosen morning.
    static func payload(bed: String, wake: String, hours: Double, quality: Int?, morning: String) -> SleepLogPayload {
        SleepLogPayload(date: morning, bedtime: bed, wakeup: wake, durationH: hours, quality: quality)
    }

    private func timeBox(_ label: String, _ selection: Binding<Date>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            NKMono(label)
            DatePicker("", selection: selection, displayedComponents: .hourAndMinute)
                .labelsHidden()
                .datePickerStyle(.compact)
                .colorScheme(.dark)
                .tint(.white)
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading).nkGlass(16)
    }

    private func save() async {
        guard let ritmus, let hours else { problem = "A két időpont egyforma."; return }
        busy = true
        defer { busy = false }
        let now = BoopClock.now()
        let payload = Self.payload(bed: bedText, wake: wakeText, hours: hours, quality: quality,
                                   morning: ritmus.day(of: whenResolved(when, now: now, calendar: .current)))
        do {
            try await ritmus.captureSleep(payload)
            onDone(whenToast("Alvás \(sleepHoursText(hours)) rögzítve", choice: when, now: now, calendar: .current))
        } catch {
            problem = "Nem tudtam eltenni a telefonra — próbáld újra."
        }
    }
}

// MARK: - Napló

/// A line for the day at any hour. The evening close keeps its own question; this is the "egy sor" the web had.
struct JournalSheet: View {
    let onDone: (String?) -> Void
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @State private var text = ""
    @State private var busy = false
    @State private var problem: String?
    @FocusState private var focused: Bool
    @State private var when: WhenChoice = .previewDefault

    private var words: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NKSheetFrame(hue: .alvas, eyebrow: quickEyebrow, title: "Napló") {
            VStack(alignment: .leading, spacing: 12) {
                NKMono("MI TÖRTÉNT?")
                TextField("", text: $text, prompt: Text("Egy sor is elég…").foregroundStyle(.white.opacity(0.4)), axis: .vertical)
                    .lineLimit(3...8)
                    .nkFont(16).foregroundStyle(.white)
                    .focused($focused)
                    .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(18)
                WhenRow(eyebrow: "MELYIK NAP", hue: .alvas, choice: $when)
                quickHint("A Napló oldalon látod a nap sorai között; az esti zárás külön kérdez rá a napra.")
            }
        }
        .safeAreaInset(edge: .bottom) {
            QuickFoot(title: "Mentem", busy: busy, disabled: words.isEmpty, error: problem) { Task { await save() } }
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Kész") { focused = false }
            }
        }
        .onAppear { focused = true }
    }

    private func save() async {
        guard let ritmus, !words.isEmpty else { return }
        busy = true
        defer { busy = false }
        let now = BoopClock.now()
        do {
            try await ritmus.captureJournal(text: words, at: whenResolved(when, now: now, calendar: .current))
            onDone(whenToast("Naplóba írva", choice: when, now: now, calendar: .current))
        } catch {
            problem = "Nem tudtam eltenni a telefonra — próbáld újra."
        }
    }
}

// MARK: - Kiegészítők

/// His supplement groups (reggel · napközben · este…), one tap each — the Étel room's own "Bevettem", from the "+".
struct SupplementsSheet: View {
    let onDone: (String?) -> Void
    @Environment(\.foodClient) private var food
    @State private var store = EtelStore()
    @State private var note: String?

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: quickEyebrow, title: "Kiegészítők") {
            if !store.groupsLoaded {
                quickHint("Töltöm a listádat…")
            } else if store.groups.isEmpty {
                NKNotLiveYet(hue: .fuel, title: "Még nincs kiegészítő listád",
                             line: "Az Étel szoba beállításaiban állítod össze; utána innen egy koppintás a bevétel.")
            } else {
                ForEach(store.groups, id: \.key) { group in row(group) }
                if let note {
                    Text(note).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).frame(maxWidth: .infinity, alignment: .leading)
                }
                quickHint("Egy koppintás az egész csoportot bevettnek jelöli; még egy visszavonja.")
            }
        }
        .task {
            guard let food else { return }
            await store.load(food: food, now: Date(), extras: false)
        }
    }

    private func row(_ group: SupplementGroup) -> some View {
        let taken = store.isTaken(group)
        return HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(group.label).nkFont(16, .semibold).foregroundStyle(.white)
                Text("\(group.count) tétel").nkFont(12.5).foregroundStyle(.white.opacity(0.55))
            }
            Spacer(minLength: 8)
            NKPill(taken ? "Bevéve" : "Bevettem", glyph: taken ? "check-ink" : nil, primary: !taken, wide: false) {
                Task { note = await store.toggle(group) }
            }
            .disabled(store.isBusy(group))
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(18)
    }
}
