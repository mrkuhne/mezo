import SwiftUI
import BoopCore
import BoopDesign

// "Kihagyod?" (B4 Task 14, spike ESkipSheet): a planned window's Kihagyom asks for a reason — the same chips the web app
// has, plus free text for Egyéb — and writes the MEAL skip, so the skipped kcal leave the day's budget. Under it, kímélő
// mode: no kcal target and the day stops being judged, on and off in one tap. Adherence-neutral copy: a skip is never a
// failure, and nothing here counts a streak.

/// The reason chips and the server reason each one writes.
let skipChips: [(label: String, reason: SkipReason)] = [
    ("Nem vagyok éhes", .notHungry), ("Nincs időm", .noTime), ("Gyomorrontás", .stomach),
    ("Beteg vagyok", .illness), ("Úton vagyok", .travel), ("Egyéb", .other),
]

/// Skips one planned window and says what happened. `reason == nil` is a skip with no reason (allowed). Only Egyéb
/// carries the free text.
func skipWindow(_ window: PlanWindow, in plan: FuelPlan, reason: SkipReason?, text: String, food: FoodClient) async -> EtelOutcome {
    let note = text.trimmingCharacters(in: .whitespacesAndNewlines)
    do {
        try await food.skip(window: window, in: plan, reason: reason ?? .none, reasonText: note.isEmpty ? nil : note)
    } catch FoodFetchError.offline {
        return EtelOutcome(ok: false, text: "Nincs net — ehhez kell")
    } catch FoodFetchError.rejected {
        return EtelOutcome(ok: false, text: "Ezt az étkezést már nem lehet kihagyni — csak a mai és az elmúlt 7 nap ablakai mennek.")
    } catch {
        return EtelOutcome(ok: false, text: "Nem sikerült kihagyni — próbáld újra")
    }
    var parts = ["\(window.label) kihagyva"]
    if let reason, let chip = skipChips.first(where: { $0.reason == reason }) { parts.append(chip.label) }
    if let kcal = window.budget?.kcal, kcal > 0 { parts.append("\(huInt(Int(kcal.rounded()))) kcal kiesett a napból") }
    return EtelOutcome(ok: true, text: parts.joined(separator: " · "))
}

/// Takes a skipped window back. The toast is for the owner.
func undoSkipWindow(_ window: PlanWindow, in plan: FuelPlan, food: FoodClient) async -> EtelOutcome {
    do { try await food.undoSkip(window: window, in: plan) }
    catch FoodFetchError.offline { return EtelOutcome(ok: false, text: "Nincs net — ehhez kell") }
    catch { return EtelOutcome(ok: false, text: "Nem sikerült visszavonni — próbáld újra") }
    return EtelOutcome(ok: true, text: "\(window.label) újra a tervedben")
}

/// The kímélő choices the owner can switch on: illness, stomach bug, travel.
let kimeloChoices: [(reason: SkipReason, label: String)] = [(.illness, "Beteg vagyok"), (.stomach, "Gyomorrontás"), (.travel, "Úton vagyok")]

/// What an open kímélő period does to the day, in the words of its kind (travel estimates; it does not drop the target).
func kimeloSentence(_ category: String) -> String {
    switch category {
    case "INJURY": "A fehérje a legfontosabb; a keretet a szinten tartáshoz igazítom."
    case "TRAVEL": "Úton vagy: a keretet becsülöm, és a napot nem értékelem szigorúan. Egyél, ami kijön."
    default: "Ma nincs kalóriacél, és a napot nem értékelem. Egyél, ami jólesik."
    }
}

struct SkipSheet: View {
    /// The window to skip; nil opens only the kímélő card (from the settings list).
    let window: PlanWindow?
    let store: EtelStore
    let food: FoodClient?
    /// Called with the toast when the sheet is done (the room reloads).
    let onDone: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var picked: SkipReason?
    @State private var text = ""
    @State private var busy = false
    @State private var message: String?
    @State private var kimelo: KimeloPeriod?
    @State private var kimeloState: KimeloLoad = .loading
    @State private var kind: SkipReason = .illness

    private enum KimeloLoad { case loading, ready, failed }

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: window.map { "\($0.label.uppercased()) · \($0.from)" } ?? "KÍMÉLŐ MÓD",
                     title: window == nil ? "Kímélő mód" : "Kihagyod?") {
            if let window { skipCard(window) }
            kimeloCard
            if let message { EtelNote(text: message) }
        }
        .task { await loadKimelo() }
    }

    // MARK: the skip

    private func skipCard(_ w: PlanWindow) -> some View {
        EtelCard {
            Text("Mondd meg, miért — így nem számolom hibának, és a kerete sem marad ott lógva.")
                .nkFont(14.5).lineSpacing(3).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            EtelChoiceChips(options: skipChips.map { (id: $0.reason, label: $0.label) }, selected: picked) { picked = picked == $0 ? nil : $0 }
            if picked == .other {
                TextField("", text: $text, prompt: Text("Mi történt? (nem kötelező)").foregroundStyle(.white.opacity(0.4)), axis: .vertical)
                    .nkFont(15).foregroundStyle(.white).tint(.white).lineLimit(1...3)
                    .padding(.horizontal, 14).padding(.vertical, 12).background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.07)))
                    .accessibilityLabel("A kihagyás oka")
            }
            if let kcal = w.budget?.kcal, kcal > 0 {
                Text("A \(w.label.lowercased()) \(huInt(Int(kcal.rounded()))) kcal-os kerete kiesik a mai napból; a többi étkezésed nem lesz nagyobb.")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
            }
            NKPill(busy ? "Kihagyom…" : "Kihagyom") { Task { await skip(w) } }.disabled(busy)
        }
    }

    private func skip(_ w: PlanWindow) async {
        guard let food, let plan = store.plan else { message = "Most nem tudom kihagyni — a mai tervet nem látom."; return }
        busy = true; defer { busy = false }
        let outcome = await skipWindow(w, in: plan, reason: picked, text: text, food: food)
        if outcome.ok { onDone(outcome.text); dismiss() } else { message = outcome.text }
    }

    // MARK: kímélő mode

    private var kimeloCard: some View {
        EtelCard("KÍMÉLŐ MÓD") {
            switch kimeloState {
            case .loading:
                Text("Megnézem, be van-e kapcsolva").nkFont(14).foregroundStyle(.white.opacity(0.55)).redacted(reason: .placeholder)
            case .failed:
                EtelProblem(text: "Most nem látom, be van-e kapcsolva a kímélő mód.", retry: { Task { await loadKimelo() } })
            case .ready:
                if let k = kimelo { on(k) } else { off }
            }
        }
    }

    private var off: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ha beteg vagy, vagy úton, kapcsold be: nem értékelem a napot, és a keretet a helyzetedhez igazítom. Egy koppintással kikapcsolod.")
                .nkFont(13.5).lineSpacing(2).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            EtelChoiceChips(options: kimeloChoices.map { (id: $0.reason, label: $0.label) },
                            selected: kind) { kind = $0 }
            Button { Task { await turnOn() } } label: {
                Text(busy ? "Bekapcsolom…" : "Bekapcsolom mára").nkFont(14.5, .medium).foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 46).background(Capsule().fill(.white.opacity(0.12)))
            }
            .buttonStyle(.plain).disabled(busy)
        }
    }

    private func on(_ k: KimeloPeriod) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Be van kapcsolva: \(kimeloWord(k.category)) · \(k.dayIndex). nap.").nkFont(15, .medium).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            Text(kimeloSentence(k.category))
                .nkFont(13.5).lineSpacing(2).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            Button { Task { await turnOff() } } label: {
                Text(busy ? "Kikapcsolom…" : "Kikapcsolom").nkFont(14.5, .semibold).foregroundStyle(NK.ground)
                    .frame(maxWidth: .infinity, minHeight: 46).background(Capsule().fill(.white.opacity(0.95)))
            }
            .buttonStyle(.plain).disabled(busy)
        }
    }

    private func loadKimelo() async {
        kimeloState = .loading
        do { kimelo = try await store.kimelo(); kimeloState = .ready } catch { kimeloState = .failed }
    }

    private func turnOn() async {
        busy = true; defer { busy = false }
        let outcome = await store.startKimelo(kind)
        if outcome.ok { onDone(outcome.text); dismiss() } else { message = outcome.text; await loadKimelo() }
    }

    private func turnOff() async {
        busy = true; defer { busy = false }
        let outcome = await store.endKimelo()
        if outcome.ok { onDone(outcome.text); dismiss() } else { message = outcome.text }
    }
}

/// The recovery period's kind in the owner's words.
func kimeloWord(_ category: String) -> String {
    switch category {
    case "ILLNESS": "beteg vagy"
    case "STOMACH": "gyomorrontás"
    case "INJURY": "sérülés"
    case "TRAVEL": "úton vagy"
    default: "kímélő mód"
    }
}
