import SwiftUI
import BoopCore
import BoopDesign

/// The Évad colour world. The approved spike's `.forma` (the violet dusk): the season is about the body's course, and
/// the system map paints its four pillars in their own worlds on top of it.
let evadHue: Hue = .forma

/// The Évad page's sub-pages, presented at page level (boop-ios.md §9).
enum EvadSub: String, Identifiable {
    case modositas, szabalyok, uj
    var id: String { rawValue }
}

/// **Évad** — the second place of the spine (Boop B6, `mezo-r36n9.16`; was Terv): one N-week season that owns the goal,
/// the training block and the weekly slots, with the food, sleep and weight course following from them.
///
/// A spine place, not a ring-opened room: an `NKAreaPage` **without** its own bar (two bottom bars would stack), the
/// inner tabs Évad · Menü · Lista · Hatás at the top of the content, Szabályok in the head's corner. No season yet →
/// the empty state, whose "Megnézem" opens the first-season draft.
struct EvadPage: View {
    @Environment(EvadStore.self) private var store: EvadStore?
    @State private var tab = "Évad"
    @State private var open: EvadSub?

    var body: some View {
        Group {
            if let store, let o = store.overview {
                season(o, store: store)
            } else if let store, store.empty {
                EvadEmpty(start: { open = .uj })
            } else if let problem = store?.problem {
                waiting(headline: "Most nem érem el az évadodat", state: .failed(evadErrorText(problem), {
                    Task { await store?.load(force: true) }
                }))
            } else {
                waiting(headline: "Töltöm az évadodat", state: .loading)
            }
        }
        // keyed on the store: a store replaced after sign-in (or a preview re-made) is read too
        .task(id: store.map(ObjectIdentifier.init)) { await store?.load() }
        // page-level presentations (boop-ios.md §9): the sub-pages hang outside the scroll content
        .fullScreenCover(item: $open) { sub in
            Group {
                switch sub {
                case .modositas: EvadWhatIf(close: { open = nil })
                case .szabalyok: EvadRulesPage(close: { open = nil })
                case .uj: EvadNewSeason(close: { open = nil })
                }
            }
            .environment(store)
        }
        .onAppear {
            #if DEBUG
            // Simulator review: `-evadOpen modositas|szabalyok|uj`, `-evadTab Évad|Menü|Lista|Hatás`.
            if let t = UserDefaults.standard.string(forKey: "evadTab") { tab = t }
            if let o = UserDefaults.standard.string(forKey: "evadOpen").flatMap(EvadSub.init(rawValue:)) {
                Task { try? await Task.sleep(for: .seconds(1.2)); open = o }
            }
            #endif
        }
    }

    private func season(_ o: EvadOverview, store: EvadStore) -> some View {
        let verdict = evadVerdict(o)
        return NKAreaPage(hue: evadHue, name: "Évad", eyebrow: evadEyebrow(o.head), level: evadLevel(o.head),
                          headline: verdict.headline, sentence: verdict.sentence, glyph: "link-deep",
                          actions: [NKAreaAction(glyph: "spark-cream", label: "Szabályok", action: { open = .szabalyok })]) {
            NKAreaTabs(tabs: [NKAreaTab("Évad"), NKAreaTab("Menü"), NKAreaTab("Lista"), NKAreaTab("Hatás")],
                       hue: evadHue, selected: $tab)
                .padding(.horizontal, -18)
            switch tab {
            case "Menü":
                NKNotLiveYet(hue: evadHue, title: "A heti menü hamarosan itt lesz",
                             line: "A kiválasztott receptjeidből, az edzésnapjaidhoz igazítva állítom majd össze a jövő heti menüt.")
            case "Lista":
                NKNotLiveYet(hue: evadHue, title: "A bevásárlólista hamarosan itt lesz",
                             line: "A jóváhagyott menüből készül majd, és minden tétel alatt látod, melyik ételhez kell.")
            case "Hatás":
                NKNotLiveYet(hue: evadHue, title: "A kísérletek hamarosan itt lesznek",
                             line: "Egyszerre egy kísérlet fut majd: megnézzük, tényleg hat-e, amit kipróbálsz.")
            default:
                EvadOverviewTab(o: o, ageText: store.ageText, offline: store.offline, open: { open = $0 })
            }
        }
    }

    /// Loading or failed before any overview: the page's head with one block saying which.
    private func waiting(headline: String, state: NKBlockState) -> some View {
        NKAreaPage(hue: evadHue, name: "Évad", eyebrow: "Évad", level: nil, headline: headline, sentence: "",
                   glyph: "link-deep") {
            NKBare("Az évadod", hue: evadHue, glyph: "link-deep", state: state) { EmptyView() }
        }
    }
}

/// No season yet (screen 13): what a season is, and the draft Boop already put together. Nothing starts without his OK.
struct EvadEmpty: View {
    let start: @MainActor @Sendable () -> Void
    var body: some View {
        NKAreaPage(hue: evadHue, name: "Évad", eyebrow: "Még nincs évadod", level: nil,
                   headline: "Indítsunk egy évadot",
                   sentence: "Egy évad *néhány hétig tart*: benne van a célod, az edzésed, az étkezésed és az alvásod, és mindegyik a többihez igazodik.",
                   glyph: "link-deep") {
            NKNote("A mostani súlycélodból és edzésblokkodból már összeállítottam egy javaslatot. Csak akkor indul el, ha jóváhagyod.", hue: evadHue)
            NKActions([NKAction(glyph: "plus-ink", title: "Megnézem", primary: true, action: start)], hue: evadHue)
        }
    }
}

// MARK: - Small shared pieces

/// The steppers' round buttons: the kit's plus glyph and a drawn minus (no system symbols).
struct EvadStepButton: View {
    let plus: Bool
    let label: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Group {
                if plus { NKGlyph("plus-ink", .white, size: 18) } else { Capsule().fill(.white).frame(width: 15, height: 2.4) }
            }
            .frame(width: 38, height: 38)
            .background(Circle().fill(.white.opacity(0.1)))
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// A red guard line when the engine warns.
struct EvadWarningBox: View {
    let text: String
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            NKGlyph("bolt-ink", NK.under, size: 16)
            Text(text).nkFont(13.5).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(NK.under.opacity(0.12)))
    }
}

/// A plain line of state under a block (a refusal, the "újraszámoltam" note).
struct EvadLine: View {
    let text: String
    var body: some View {
        Text(text).nkFont(13.5).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension View {
    /// Simulator review: `-evadBottom YES` opens a sub-page scrolled to its end (its actions), so a screenshot shows them.
    func evadReviewAnchor() -> some View {
        #if DEBUG
        defaultScrollAnchor(UserDefaults.standard.bool(forKey: "evadBottom") ? .bottom : nil)
        #else
        self
        #endif
    }
}

/// "0,40 kg".
func evadPaceText(_ kg: Double) -> String { String(format: "%.2f kg", kg).replacingOccurrences(of: ".", with: ",") }
