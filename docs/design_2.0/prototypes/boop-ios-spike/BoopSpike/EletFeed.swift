import SwiftUI

// Round 6 (owner, 2026-11-13): "inkább az érdekel, hogy kontextuálisan, amikor megnyitom az appot, mutassa
// nekem, mintha üzenne nekem … egy élő, living breathing AI üzenőfal ez igazából. jó ez a terv hogy mi lesz
// aznap, de ezt nem akarom egész nap nézegetni, hanem reggel átnézem hogy mi várható."
//
// So Ma stops being a timeline you scroll and becomes what Boop wants to say RIGHT NOW — bounded:
//   • at most three cards in "Most", plus the check-in pinned above them while it is due,
//   • a card you act on settles into "Ma történt" instead of vanishing,
//   • the morning briefing and the day's timeline stay, collapsed into one row each (open in the morning),
//   • and when there is nothing, it says so warmly — an empty feed is good news, not an empty state.

enum EFeedKind {
    case checkin, teendo, tortent, keszulj, reakcio

    var label: String {
        switch self {
        case .checkin: return "KÉRDEZEK"
        case .teendo:  return "TEENDŐ"
        case .tortent: return "TÖRTÉNT"
        case .keszulj: return "KÉSZÜLJ"
        case .reakcio: return "BOOP MONDJA"
        }
    }
    var glyph: String {
        switch self {
        case .checkin: return "pen-sun"
        case .teendo:  return "check-ink"
        case .tortent: return "bell-cream"
        case .keszulj: return "clock-ink"
        case .reakcio: return "chat-ink"
        }
    }
}

struct EFeedCard: Identifiable {
    let id: String
    let kind: EFeedKind
    let when: String
    let text: String          // may carry *…* spans for the area hue
    let sub: String
    let areas: [Int]          // which worlds contributed — their orbs sit on the card
    let primary: String?      // the one action
    let secondary: String?
    let settled: String       // the line it leaves behind in "Ma történt"
    var hue: Color { areas.first.map { EMetric.all[$0].glow } ?? EMetric.all[0].glow }

    /// What Boop has to say at 13:40 on this invented day.
    static let now: [EFeedCard] = [
        EFeedCard(id: "checkin", kind: .checkin, when: "esedékes",
                  text: "Hogy vagy most?",
                  sub: "Három kérdés, fél perc. A délelőtti óta eltelt hat óra.",
                  areas: [4], primary: "Kitöltöm", secondary: "Később",
                  settled: "Délutáni check-in kitöltve"),
        EFeedCard(id: "cipo", kind: .tortent, when: "08:04",
                  text: "A futócipő, amit figyelsz, ma *32%-kal olcsóbb*",
                  sub: "30 590 Ft. Négy boltban néztem meg — ez az eddigi legjobb ár. A havi keretedbe belefér.",
                  areas: [6, 5, 2], primary: "Megnézem", secondary: "Nem érdekel",
                  settled: "Futócipő · megnézted"),
        EFeedCard(id: "ebed", kind: .reakcio, when: "12:48",
                  text: "Jó ebéd volt: *46 g fehérje*",
                  sub: "Ezzel 38-nál tartasz a napi 165-ből. Vacsorára 50 g kell — egy csirkés tál pont ennyit hoz.",
                  areas: [3], primary: "Recept", secondary: nil,
                  settled: "Ebéd · 46 g fehérje"),
        EFeedCard(id: "edzes", kind: .keszulj, when: "18:30-kor",
                  text: "Másfél óra múlva edzés",
                  sub: "Felsőtest, 75 perc. Egyél valamit 17:00 körül, különben éhesen kezdesz.",
                  areas: [2, 3], primary: "Emlékeztess", secondary: nil,
                  settled: "Edzés-emlékeztető 17:00-ra"),
        EFeedCard(id: "spar", kind: .tortent, when: "12:06",
                  text: "Spar · *8 240 Ft*",
                  sub: "A banki üzenetedből, magától. Élelmiszer — a havi kereted 64%-ánál jársz.",
                  areas: [5], primary: nil, secondary: nil,
                  settled: "Spar · 8 240 Ft"),
    ]
}

/// One card on the wall. The check-in looks different: it is a question, not a notice.
struct EFeedCardView: View {
    let c: EFeedCard
    var onAct: (String) -> Void
    @State private var why = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                if c.kind == .reakcio {
                    StillOrb(colors: EMetric.all[0].orb, size: 20, level: 0.85)
                } else {
                    EGlyph(c.kind.glyph, c.hue, size: 15)
                }
                Text(c.kind.label).font(AuraFont.mono(10.5, .bold)).tracking(1.5)
                    .foregroundStyle(c.kind == .checkin ? c.hue : .white.opacity(0.6))
                Spacer()
                Text(c.when).font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.45))
            }

            EHueText(text: c.text, hue: c.hue, size: 21, opacity: 1, serif: true)
                .padding(.top, 10)

            Text(c.sub).font(.system(size: 14)).lineSpacing(4).foregroundStyle(.white.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true).padding(.top, 6)

            if c.areas.count > 1 {
                HStack(spacing: 7) {
                    ForEach(c.areas, id: \.self) { a in
                        StillOrb(colors: EMetric.all[a].orb, size: 16, level: 0.8)
                    }
                    Text(c.areas.map { EMetric.all[$0].name }.joined(separator: " · "))
                        .font(.system(size: 11.5)).foregroundStyle(.white.opacity(0.45))
                    Spacer()
                }
                .padding(.top, 11)
            }

            if c.primary != nil || c.secondary != nil {
                HStack(spacing: 8) {
                    if let p = c.primary { EPill(title: p) { onAct(c.settled) } }
                    if let s = c.secondary { EPill(title: s, primary: false) { onAct("Rendben, most nem") } }
                    Spacer(minLength: 4)
                    if c.areas.count > 1 {
                        Button { why = true } label: {
                            Text("miért?").font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.8)).underline()
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, 14)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(c.kind == .checkin
                      ? AnyShapeStyle(LinearGradient(colors: [c.hue.opacity(0.24), c.hue.opacity(0.05)],
                                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                      : AnyShapeStyle(Color.white.opacity(0.07)))
                .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(c.kind == .checkin ? c.hue.opacity(0.45) : .white.opacity(0.12)))
        )
        .sheet(isPresented: $why) {
            EWhySheet(p: .shoe)
                .presentationDetents([.large])
                .presentationBackground(gBase)
                .presentationCornerRadius(34)
                .presentationDragIndicator(.visible)
        }
    }
}

/// A row that opens something long: the morning briefing, the day's timeline, what already happened.
struct EFoldRow<C: View>: View {
    var title: String
    var sub: String
    var glyph: String
    var hue: Color
    @Binding var open: Bool
    @ViewBuilder var content: () -> C

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button { withAnimation(.spring(response: 0.42, dampingFraction: 0.86)) { open.toggle() } } label: {
                HStack(spacing: 13) {
                    EGlyph(glyph, .white.opacity(0.9), size: 17).frame(width: 36, height: 36)
                        .background(Circle().fill(.white.opacity(0.08)))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title).font(.system(size: 15.5, weight: .medium)).foregroundStyle(.white)
                        Text(sub).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.55))
                    }
                    Spacer()
                    Image(systemName: open ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.45))
                }
                .padding(.horizontal, 16).padding(.vertical, 13)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if open {
                content()
                    .padding(.horizontal, 16).padding(.bottom, 16)
                    .transition(.opacity.combined(with: .offset(y: -8)))
            }
        }
        .gCard(22)
    }
}
