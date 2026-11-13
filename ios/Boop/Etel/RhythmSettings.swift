import SwiftUI
import BoopCore
import BoopDesign

// "Napi ritmus" (B4 Task 14): how many times a day he eats (default 3 meals + 2 snacks, owner decision 21) and the
// time of the last caffeine (`fuel_settings`). The planner's windows, the day plan and the caffeine habit read both.

/// 5 → "3 étkezés + 2 nasi": the first three occasions are the meals, the rest snacks.
func rhythmSummary(_ perDay: Int) -> String {
    let snacks = max(0, perDay - 3)
    return snacks == 0 ? "3 étkezés, nasi nélkül" : "3 étkezés + \(snacks) nasi"
}

/// `HH:mm` → minutes after midnight; nil when it is not a time.
func cutoffMinutes(_ text: String) -> Int? {
    let p = text.split(separator: ":")
    guard p.count == 2, p[0].count == 2, p[1].count == 2, let h = Int(p[0]), let m = Int(p[1]), (0..<24).contains(h), (0..<60).contains(m) else { return nil }
    return h * 60 + m
}

func cutoffText(minutes: Int) -> String { String(format: "%02d:%02d", (minutes / 60) % 24, minutes % 60) }

@MainActor @Observable
final class RhythmModel {
    var meals = 5
    var cutoff = "14:00"
    private(set) var saved: FuelSettings?
    private(set) var problem: FoodFetchError?
    private(set) var loading = false
    private(set) var saving = false
    private let food: FoodClient

    init(food: FoodClient) { self.food = food }

    var loaded: Bool { saved != nil }
    var dirty: Bool { saved != nil && saved != FuelSettings(mealsPerDay: meals, caffeineCutoff: cutoff) }

    func load() async {
        loading = true; defer { loading = false }
        do {
            let s = try await food.fuelSettings()
            saved = s; meals = s.mealsPerDay; cutoff = s.caffeineCutoff; problem = nil
        } catch let e as FoodFetchError { problem = e } catch { problem = .server }
    }

    func save() async -> String {
        guard loaded else { return "Előbb be kell töltenem a napirendedet — próbáld újra" }
        guard cutoffMinutes(cutoff) != nil else { return "A koffein-stop időpontja nem jó" }
        saving = true; defer { saving = false }
        do {
            saved = try await food.setFuelSettings(FuelSettings(mealsPerDay: meals, caffeineCutoff: cutoff))
            return "Elmentettem — a napirendet újraszámolom."
        } catch FoodFetchError.offline { return "Nincs net — a változtatások itt maradnak, próbáld újra, amint van."
        } catch { return "Nem sikerült elmenteni — próbáld újra." }
    }
}

struct RhythmSheet: View {
    let food: FoodClient?
    let onSaved: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var model: RhythmModel?
    @State private var message: String?

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: "BEÁLLÍTÁS", title: "Napi ritmus") {
            if let m = model { content(m) } else { EtelCard { EtelProblem(text: "A napirendedet most nem érem el.", detail: .unauthorized) } }
        }
        .task {
            guard model == nil, let food else { return }
            let m = RhythmModel(food: food)
            model = m
            await m.load()
        }
    }

    @ViewBuilder private func content(_ m: RhythmModel) -> some View {
        if m.loading && !m.loaded {
            EtelCard { Text("A napirended betöltése folyamatban").nkFont(14).foregroundStyle(.white.opacity(0.55)).redacted(reason: .placeholder) }
        } else if !m.loaded {
            EtelCard { EtelProblem(text: "A napirendedet most nem látom, ezért nem is írom át.", detail: m.problem, retry: { Task { await m.load() } }) }
        } else {
            EtelCard("ÉTKEZÉS NAPONTA") {
                Stepper(value: Binding(get: { m.meals }, set: { m.meals = $0 }), in: 3...6) {
                    Text(rhythmSummary(m.meals)).nkFont(16, .medium).foregroundStyle(.white)
                }
                .accessibilityValue("\(m.meals) alkalom naponta")
                Text("Ennyi ablakra osztom a napot. A ritmus vezet, nem korlátoz: bármelyik ablak utólag is logolható.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            }
            EtelCard("KOFFEIN-STOP") {
                DatePicker("Utolsó koffein", selection: Binding(get: { dateFor(m.cutoff) }, set: { m.cutoff = cutoffText(minutes: minutes(of: $0)) }),
                           displayedComponents: .hourAndMinute)
                    .nkFont(16).foregroundStyle(.white).tint(.white).colorScheme(.dark)
                Text("Ezután már nem javaslok koffeint. A Mai sor, a napi terv és a koffein-szokás is ezt az időt nézi.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            }
            if let message { EtelNote(text: message) }
            NKPill(m.saving ? "Mentem…" : "Mentem", primary: m.dirty && !m.saving) {
                guard m.dirty, !m.saving else { return }
                Task {
                    let text = await m.save()
                    if m.dirty { message = text } else { onSaved(text); dismiss() }
                }
            }
            .disabled(!m.dirty || m.saving)
        }
    }

    private func dateFor(_ text: String) -> Date {
        let mins = cutoffMinutes(text) ?? 14 * 60
        return Calendar.current.date(bySettingHour: mins / 60, minute: mins % 60, second: 0, of: Date()) ?? Date()
    }

    private func minutes(of date: Date) -> Int {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (c.hour ?? 0) * 60 + (c.minute ?? 0)
    }
}
