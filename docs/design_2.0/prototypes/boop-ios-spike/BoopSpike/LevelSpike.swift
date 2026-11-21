import SwiftUI

// Levél spike — launch: -level YES [-levelTab 0–3] [-levelState normal|empty|loading|failed|rulesOnly|disconnected]
//                       [-levelScroll 0–4 (Ma tab: 0 top · 1 Határidős · 2 Csomagok · 3 Akciók · 4 A többi)]
//                       [-levelAcct ok|stalled]   (Fiókok connected state)
// Fake data, no networking, nothing shipped.

enum LevelState: String { case normal, empty, loading, failed, rulesOnly, disconnected }

struct LevelRoot: View {
    @State private var tab = EArg.int("levelTab", 0, 3)
    let state = LevelState(rawValue: EArg.str("levelState") ?? "normal") ?? .normal
    let scroll = EArg.int("levelScroll", 0, 4)
    let stalled = EArg.str("levelAcct") == "stalled"
    private var m: EMetric { EMetric.all[7] }
    private let tabNames = ["Ma", "Figyelt", "Szabályok", "Fiókok"]
    private let tabGlyphs = ["sun-ink", "search-ink", "scale-ink", "repeat-deep"]
    private let anchors = ["top", "hatar", "csomag", "akcio", "tobbi"]

    private var verdict: String {
        guard tab == 0 else { return ["", "Még nem figyelek semmit", "Te döntöd el, mibe nézek bele", "Egy külön postafiók a Boopnak"][tab] }
        switch state {
        case .empty: return "Ma nincs dolgod"
        case .loading: return "Átnézem a postát"
        case .failed: return "Most nem érem el a postát"
        case .disconnected: return "Még nincs postafiókod"
        default: return "Két dolgot nézz meg"
        }
    }
    private var sentence: String {
        switch tab {
        case 1: return "A termékek és az árak figyelése később jön."
        case 2: return "Bankot, hivatalt és belépőkódot gép soha nem olvas."
        case 3: return state == .disconnected ? "Hat lépés, és a levelek maguktól jönnek." : "Utolsó átnézés ma reggel 08:00-kor volt."
        default:
            switch state {
            case .empty: return "Reggel óta 12 levél jött, mind elintéztem. Semmi nem vár rád."
            case .loading: return "Egy pillanat, a reggeli postát rendezem."
            case .failed: return "A reggeli levelek megvannak, de két részt nem tudtam betölteni."
            case .disconnected: return "Kösd össze a Boop postafiókját, és reggelente itt találod a rendezett levelekedet."
            default: return "34 levél jött reggel óta. 31-et elintéztem helyetted, kettő megér egy percet."
            }
        }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        LevelHead(verdict: verdict, sentence: sentence, m: m).id("top")
                        LazyVStack(alignment: .leading, spacing: 24) {
                            switch tab {
                            case 1: LevelFigyelt(m: m)
                            case 2: LevelSzabalyok(m: m)
                            case 3: LevelFiokok(m: m, state: state, stalled: stalled)
                            default: LevelMa(m: m, state: state)
                            }
                        }
                        .padding(.horizontal, 16).padding(.top, 22).padding(.bottom, 40)
                        .background(FloatingLights(hue: m.glow).padding(.vertical, -120))
                        MirroredLand(sky: m.sky).padding(.top, -20).padding(.bottom, 110)
                    }
                }
                .scrollIndicators(.hidden)
                .onAppear {
                    guard scroll > 0, tab == 0 || tab == 3 else { return }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                        proxy.scrollTo(tab == 3 ? "form" : anchors[scroll], anchor: .top)
                    }
                }
            }
            .background(gPageBackground(m.top).ignoresSafeArea())
            .ignoresSafeArea(edges: .top)
            .overlay(alignment: .topLeading) { backButton {} }
            bar
        }
        .preferredColorScheme(.dark)
    }

    private var bar: some View {
        GlassEffectContainer(spacing: 12) {
            HStack(spacing: 0) {
                ForEach(0..<4, id: \.self) { i in
                    item(glyph: tabGlyphs[i], label: tabNames[i], badge: i == 0 && state == .normal ? 2 : 0, on: i == tab)
                        .onTapGesture { withAnimation(.easeInOut(duration: 0.22)) { tab = i } }
                }
                item(glyph: "chat-ink", label: "Boop", badge: 0, on: false)
            }
            .padding(.horizontal, 6).padding(.vertical, 7)
            .glassEffect(.regular, in: .capsule)
        }
        .padding(.horizontal, 14).padding(.bottom, 4)
    }

    private func item(glyph: String, label: String, badge: Int, on: Bool) -> some View {
        VStack(spacing: 4) {
            ZStack(alignment: .topTrailing) {
                EGlyph(glyph, on ? m.glow : .white.opacity(0.65), size: 19)
                if badge > 0 {
                    Text("\(badge)").font(.custom("Outfit", size: 10).weight(.semibold)).foregroundStyle(gBase)
                        .frame(minWidth: 14, minHeight: 14).background(Circle().fill(m.glow)).offset(x: 9, y: -6)
                }
            }.frame(height: 20)
            Text(label).font(.system(size: 10.5, weight: on ? .semibold : .regular))
                .foregroundStyle(on ? .white : .white.opacity(0.6)).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity).frame(height: 46)
        .background(Capsule().fill(on ? m.glow.opacity(0.16) : .clear))
        .contentShape(Capsule())
    }
}
