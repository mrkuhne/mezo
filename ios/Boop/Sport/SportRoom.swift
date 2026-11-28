import SwiftUI
import BoopCore
import BoopDesign

/// The Sport room (`mezo-r36n9.203`, spec `2026-11-27-boop-sport-design.md` §5.1): the eleventh area, right after Edzés,
/// on the shared area page in its own coral world — Ma · Hét · Napló · Test in the bar, the head's orb carrying the
/// week's sport done / planned. The gym and the sport are two separate layers of every day. Data: `SportStore` (cache
/// first). Hét, Napló and Test arrive in S4/S5 and show the not-live-yet block until then.
struct SportRoom: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.closeRoom) private var closeRoom
    @Environment(\.openDestination) private var openDestination
    @Environment(SportStore.self) private var store: SportStore?
    @SceneStorage("sport.tab") private var selected: String = "Ma"
    @State private var toast: String?
    @State private var sheet: SportRoomSheet?

    init() {
        #if DEBUG
        // Simulator review: `-sportTab Hét|Napló|Test` opens that tab, `-sportSheet log|skip` that sheet.
        let d = UserDefaults.standard
        _selected = SceneStorage(wrappedValue: d.string(forKey: "sportTab") ?? "Ma", "sport.tab")
        _sheet = State(initialValue: d.string(forKey: "sportSheet").flatMap(SportRoomSheet.init(rawValue:)))
        #endif
    }

    private enum Shown { case loading, empty, error(PlanFetchError), week(SportOverview) }

    private var shown: Shown {
        if let o = store?.week { return sportIsEmpty(o) ? .empty : .week(o) }
        if let p = store?.problem { return .error(p) }
        return .loading
    }

    private var head: (String, String) {
        switch shown {
        case .empty: return ("Még nincs sportod", "Add meg, mikor sportolsz, és mellé teszem a kondit.")
        case .loading: return ("A sportod", "Töltöm a hetedet…")
        case .error(let p):
            return ("A sportodat most nem érem el", p == .offline ? "Nincs net, és még nincs elmentett adatom." : "A szerver most nem válaszolt.")
        case .week(let o): let h = sportHead(o); return (h.headline, h.sentence)
        }
    }

    var body: some View {
        let h = head
        let ring = store?.ring
        let recorded = store?.week.map { sportMoment($0) == .recorded } ?? false
        NKAreaPage(hue: .sport, name: "Sport", eyebrow: areaEyebrow(.sport, tab: selected),
                   level: ring?.level, display: ring?.level == nil ? nil : ring?.display,
                   headline: h.0, sentence: h.1, glyph: areaGlyph(.sport),
                   tabs: [NKAreaTab("Ma", badge: recorded ? 1 : 0), NKAreaTab("Hét"), NKAreaTab("Napló"), NKAreaTab("Test")],
                   selectedTab: $selected,
                   actions: [NKAreaAction(glyph: "plus-ink", label: "Sport rögzítése") { sheet = .log },
                             NKAreaAction(glyph: "clock-ink", label: "Heti rend") { selected = "Hét" }],
                   onBack: { if let closeRoom { closeRoom() } else { dismiss() } },
                   onAsk: { openDestination(.chat) }) {
            if store?.offline == true, store?.week != nil {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Nincs net — a legutóbb látott hetedet mutatom. A rögzítés így is megy, később elküldöm.")
                        .nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                    if let age = store?.ageText { NKMono(age.uppercased()) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14).nkGlass(20)
                .accessibilityElement(children: .combine)
            }
            switch selected {
            case "Hét":
                NKNotLiveYet(hue: .sport, title: "A heti rended hamarosan itt lesz",
                             line: "Itt adod meg, mikor sportolsz, és itt látod a hetet két sávban: kondi és sport. A következő lépésben érkezik.")
            case "Napló":
                NKNotLiveYet(hue: .sport, title: "A sportnaplód hamarosan itt lesz",
                             line: "Itt látod majd az elmúlt hetek alkalmait, a megterhelést és a trendet.")
            case "Test":
                NKNotLiveYet(hue: .sport, title: "Hamarosan itt látod, hogyan bírja a tested",
                             line: "Melyik izmodat terheli a kondi és a sport együtt, hogy bírja a vállad, és mennyi pihenő jut két alkalom közé.")
            default:
                switch shown {
                case .loading: SportLoading()
                case .empty: SportEmpty { selected = "Hét" }
                case .error: SportError { Task { await store?.load(force: true) } }
                case .week(let o):
                    SportMa(week: o, open: { sheet = $0 }, undo: undoSkip, ask: { openDestination(.chat) })
                }
            }
            Color.clear.frame(height: 10)
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(RoomSwipeBack().frame(width: 0, height: 0).accessibilityHidden(true))
        .nkToast($toast)
        .task { await store?.load(force: true) }
        // page-level presentation (boop-ios.md §9)
        .sheet(item: $sheet) { s in
            Group {
                switch s {
                case .log:
                    SportLogSheet(tonight: store?.week?.tonight, lastRpe: store?.lastRpe ?? 6) { payload in
                        store?.noteLogged(payload)
                        sheet = nil
                        toast = "Elmentve — \(sportArticle(SportKind(wire: payload.sport).inSentence)) bekerült a napodba"
                    }
                case .skip:
                    SportSkipSheet(tonight: store?.week?.tonight) { reason in
                        guard let store else { throw PlanFetchError.server }
                        try await store.skip(reason)
                        sheet = nil
                        toast = "Kihagyva — Visszavonás a kártyán"
                    }
                }
            }
            .presentationDetents([.large])
            .presentationBackground(NK.ground)
            .presentationCornerRadius(34)
            .presentationDragIndicator(.visible)
        }
    }

    private func undoSkip() {
        Task {
            do throws(PlanFetchError) {
                try await store?.undoSkip()
                toast = "Visszavontam — újra a tervben van"
            } catch {
                toast = error == .offline ? "Nincs net — a visszavonáshoz kapcsolat kell." : "Most nem sikerült visszavonni."
            }
        }
    }
}

enum SportRoomSheet: String, Identifiable { case log, skip; var id: String { rawValue } }

// MARK: - States (spike copy)

private struct SportEmpty: View {
    let start: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            NKGlyph("ball-sun", .white, size: 34).accessibilityHidden(true)
            Text("Mikor sportolsz?").nkFont(26, design: .serif).foregroundStyle(.white)
            Text("Írd be a heti rendedet — például röpi hétfőn 18:00-kor. Utána mellé teszem a kondit, és röpi után az órád adataiból kitöltöm a naplót.")
                .nkFont(14.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
            NKPill("Heti rend megadása", glyph: "plus-ink", action: start)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20).nkGlass(28)
    }
}

private struct SportLoading: View {
    var body: some View {
        VStack(spacing: 14) {
            ForEach(0..<3, id: \.self) { i in
                RoundedRectangle(cornerRadius: 24).fill(.white.opacity(0.06)).frame(height: i == 0 ? 220 : 110)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Töltöm")
    }
}

private struct SportError: View {
    let retry: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nem érem el a sportodat").nkFont(22, design: .serif).foregroundStyle(.white)
            Text("A szerver most nem válaszolt. A rögzítés így is megy, elteszem és később elküldöm.")
                .nkFont(14).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            NKPill("Újra", primary: false, action: retry)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20).nkGlass(28)
    }
}
