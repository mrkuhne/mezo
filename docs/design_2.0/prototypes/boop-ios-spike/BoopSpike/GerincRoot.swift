import SwiftUI

// Throwaway spike (mezo-r36n9.12, B2 Gerinc, 2026-11-11): the standalone spine in the Napkelte look.
// One home "Ma" (Reggel → Napközben → Este) + Terv · Napló · Boop, a global "+", proposal cards with
// "miért?", one domain drill-down template. Fake data, no networking.
// Launch: -gerinc YES [-gerincTab 0–3] [-gerincPhase 0|1|2] [-gerincMetric 0–4]
//         [-gerincOpen why|plus|drill|close] [-gerincScroll reggel|napkozben|este]

enum GArg {
    static let d = UserDefaults.standard
    static func int(_ k: String, _ lo: Int, _ hi: Int, _ def: Int = 0) -> Int {
        guard d.object(forKey: k) != nil else { return def }
        return min(hi, max(lo, d.integer(forKey: k)))
    }
    static func str(_ k: String) -> String? { d.string(forKey: k).flatMap { $0.isEmpty ? nil : $0 } }
}

let gBase = Color(hex: 0x0D1218)

/// The three phases of the day. In the spike the "clock" is picked by launch argument or the debug chip.
enum DayPhase: Int, CaseIterable {
    case reggel, napkozben, este
    var name: String { ["Reggel", "Napközben", "Este"][rawValue] }
    var now: Double { [8.17, 13.67, 21.5][rawValue] }           // 08:10 · 13:40 · 21:30
    var nowLabel: String { ["08:10", "13:40", "21:30"][rawValue] }
}

// MARK: - Proposal (the unit of live adjustment)

struct Proposal: Identifiable, Equatable {
    let id: String
    let text: String
    let sub: String
    let accepted: String                     // the quiet line after Elfogadom
    let facts: [(String, String, String)]    // value, unit, label
    let experts: [(Int, String)]             // expert index (GExpert.all), line
    static func == (a: Proposal, b: Proposal) -> Bool { a.id == b.id }

    static let pushWorkout = Proposal(
        id: "push",
        text: "Told 18:30-ra az edzést",
        sub: "17:30-ig tele a naptárad, utána fél óra levegő kell.",
        accepted: "Az edzés 18:30-ra került",
        facts: [("6", "esemény", "a naptárban 9:00 és 17:30 között"), ("78", "", "a mai Formád"), ("7ó 12p", "", "alvás az éjjel")],
        experts: [(1, "A 17:30-as hívás csúszhat. Ha 18:00-kor kezdesz, sietve, bemelegítés nélkül indulsz."),
                  (0, "18:30-as kezdéssel 20:00-ra végzel — a 22:45-ös lefekvés így is belefér."),
                  (2, "A délutáni nasit 16:30 körül edd meg, hogy legyen erőd."),
                  (3, "A check-inben ma délelőtt feszültebb voltál, a félórás szünet segít."),
                  (4, "Múlt héten kétszer is csúszott a hívás. Ha ma nem csúszik, 18:00 is jó lett volna.")])

    static let moreFood = Proposal(
        id: "food",
        text: "Egyél ma +300 kalóriát",
        sub: "Hosszabb lesz az edzés: 75 perc lesz a szokásos 50 helyett.",
        accepted: "A mai keret 2 650 kcal lett",
        facts: [("820", "kcal", "eddig a mai 2 350-ből"), ("75", "perc", "a mai edzés hossza"), ("-0,4", "kg/hét", "a fogyásod üteme, a terv szerint")],
        experts: [(1, "A mai felsőtest-edzés 5 gyakorlattal hosszabb, kb. 280 kalóriát éget el pluszban."),
                  (2, "A +300 kalória legyen vacsora előtt: egy joghurt zabbal 16:30-kor elég."),
                  (0, "Üres gyomorral rosszabbul alszol. A vacsora 20:00-ig legyen meg."),
                  (3, "Tegnap este fáradtan érkeztél haza; az energia most fontosabb a pontos keretnél."),
                  (4, "A heti átlagod így is a cél alatt marad. Ha holnap pihenőnap lesz, ott hozd vissza.")])
}

/// The domain experts appear only as labelled lines inside "miért?" — never as characters.
struct GExpert {
    let name: String, orb: [Color]
    static let all: [GExpert] = [
        GExpert(name: "Alvás", orb: SunMetric.all[1].orb),
        GExpert(name: "Mozgás", orb: SunMetric.all[2].orb),
        GExpert(name: "Étkezés", orb: SunMetric.all[3].orb),
        GExpert(name: "Közérzet", orb: SunMetric.all[4].orb),
        GExpert(name: "Szkeptikus", orb: [Color(hex: 0x2A2F38), Color(hex: 0x6B7280), Color(hex: 0xC9CED6), Color(hex: 0x9AA3AE)]),
    ]
}

// MARK: - Root: the four places + the global "+"

struct GerincRoot: View {
    @State private var tab = GArg.int("gerincTab", 0, 3)
    @State private var phase = DayPhase(rawValue: GArg.int("gerincPhase", 0, 2, 1)) ?? .napkozben
    @State private var plus = GArg.str("gerincOpen") == "plus"
    @State private var why: Proposal? = GArg.str("gerincOpen") == "why" ? .moreFood : nil
    @State private var maPath: [Int] = GArg.str("gerincOpen") == "drill" ? [GArg.int("gerincMetric", 0, 4, 1)] : []
    @State private var decided: [String: Bool] = [:]       // proposal id → accepted?
    @State private var toast: String?

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch tab {
                case 1: GerincPlaceholder(kind: 1)
                case 2: GerincPlaceholder(kind: 2)
                case 3: GerincPlaceholder(kind: 3)
                default:
                    GerincMa(phase: $phase, path: $maPath, decided: $decided,
                             onWhy: { why = $0 }, onToast: show)
                }
            }
            .transition(.opacity)

            if maPath.isEmpty || tab != 0 {
                GerincTabBar(tab: $tab, onPlus: { plus = true })
                    .padding(.bottom, 4)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.85), value: maPath.isEmpty)
        .ignoresSafeArea(.keyboard)
        .preferredColorScheme(.dark)
        .overlay(alignment: .top) {
            if let t = toast {
                HStack(spacing: 8) {
                    AuraGlyph("check-ink", .white, size: 15)
                    Text(t).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                }
                .padding(.horizontal, 16).frame(height: 42)
                .glassEffect(.regular, in: .capsule)
                .padding(.top, 6)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .sensoryFeedback(.success, trigger: toast)
        // page-level presentations (boop-ios.md §9)
        .sheet(isPresented: $plus) {
            GerincPlusSheet(onPick: { t in plus = false; show(t) })
                .presentationDetents([.height(560), .large])
                .presentationBackground(gBase)
                .presentationCornerRadius(34)
                .presentationDragIndicator(.visible)
        }
        .sheet(item: $why) { p in
            GerincWhySheet(p: p, decided: decided[p.id]) { ok in
                decide(p, ok); why = nil
            }
            .presentationDetents([.large])
            .presentationBackground(gBase)
            .presentationCornerRadius(34)
            .presentationDragIndicator(.visible)
        }
        .environment(\.gDecide, { p, ok in decide(p, ok) })
    }

    private func decide(_ p: Proposal, _ ok: Bool) {
        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { decided[p.id] = ok }
        show(ok ? p.accepted : "Rendben, most nem")
    }

    private func show(_ t: String) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { toast = t }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) {
            if toast == t { withAnimation(.easeInOut) { toast = nil } }
        }
    }
}

private struct GDecideKey: EnvironmentKey { static let defaultValue: (Proposal, Bool) -> Void = { _, _ in } }
extension EnvironmentValues {
    var gDecide: (Proposal, Bool) -> Void {
        get { self[GDecideKey.self] }
        set { self[GDecideKey.self] = newValue }
    }
}

/// Icon-only glass bar: Ma · Terv · Napló · Boop, and the "+" as its own glass circle.
struct GerincTabBar: View {
    @Binding var tab: Int
    var onPlus: () -> Void
    private let items: [(String, String)] = [("sun-ink", "Ma"), ("chart-deep", "Terv"), ("book-sage", "Napló"), ("orb", "Boop")]

    var body: some View {
        GlassEffectContainer(spacing: 12) {
            HStack(spacing: 12) {
                HStack(spacing: 0) {
                    ForEach(items.indices, id: \.self) { i in
                        let on = i == tab
                        Group {
                            if items[i].0 == "orb" {
                                StillOrb(colors: SunMetric.all[0].orb, size: 22, level: 0.8)
                                    .saturation(on ? 1 : 0.2).opacity(on ? 1 : 0.6)
                            } else {
                                AuraGlyph(items[i].0, .white.opacity(on ? 1 : 0.45), size: 22)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background { if on { Capsule().fill(.white.opacity(0.12)).padding(.horizontal, 4) } }
                        .contentShape(Rectangle())
                        .onTapGesture { withAnimation(.easeInOut(duration: 0.25)) { tab = i } }
                        .accessibilityLabel(items[i].1)
                        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
                    }
                }
                .padding(5)
                .glassEffect(.regular, in: .capsule)

                Button(action: onPlus) {
                    AuraGlyph("plus-ink", .white, size: 22).frame(width: 58, height: 58)
                }
                .buttonStyle(.plain)
                .glassEffect(.regular.interactive(), in: .circle)
                .accessibilityLabel("Rögzítés")
            }
        }
        .padding(.horizontal, 18)
    }
}

// MARK: - Shared bits

struct GCard: ViewModifier {
    var radius: CGFloat = 26
    func body(content: Content) -> some View {
        content.background(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(.white.opacity(0.07))
                .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(LinearGradient(colors: [.white.opacity(0.16), .white.opacity(0.03)], startPoint: .top, endPoint: .bottom), lineWidth: 1)))
    }
}
extension View { func gCard(_ r: CGFloat = 26) -> some View { modifier(GCard(radius: r)) } }

struct GLabel: View {
    var t: String
    init(_ t: String) { self.t = t }
    var body: some View { Text(t).font(AuraFont.mono(12)).tracking(1.4).foregroundStyle(.white.opacity(0.6)) }
}

struct GPill: View {
    var title: String
    var primary = true
    var glyph: String? = nil
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                if let glyph { AuraGlyph(glyph, primary ? gBase : .white, size: 15) }
                Text(title).font(.system(size: 15, weight: .semibold))
            }
            .foregroundStyle(primary ? gBase : .white)
            .padding(.horizontal, 18).frame(height: 44)
            .background(Capsule().fill(primary ? .white : .white.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }
}

/// A painted head that fades into the page — inner pages, sheets and the placeholders.
struct GHead: View {
    var sky: [Color]
    var height: CGFloat = 330
    var body: some View {
        Color.clear.frame(height: height)
            .overlay { PaintedLandscape(sky: sky) }
            .clipped()
            .mask(LinearGradient(stops: [.init(color: .black, location: 0.55), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))
    }
}

func gPageBackground(_ top: Color) -> some View {
    ZStack {
        gBase
        LinearGradient(colors: [top.mix(with: gBase, by: 0.55), top.mix(with: gBase, by: 0.8), top.mix(with: gBase, by: 0.7)],
                       startPoint: .top, endPoint: .bottom)
    }
}
