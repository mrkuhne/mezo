import SwiftUI

// Round 11 (owner, 2026-11-13), on the Pénz area: "egybefolynak az infók, nagyon száraz, nincsenek ikonok,
// a hírek kevesek és nem kattinthatók, a magyarázatok ne a görgetőn legyenek, és hiányoznak a cselekvések."
// Four answers, all reusable by the other areas:
//   1. every section head can carry a glyph  (EBare gains `glyph:`)
//   2. the "hogyan működik" paragraphs move behind an info row that opens a sheet  (EInfoRow / EInfoSheet)
//   3. every page gets real buttons                                                (EAction / EActionRow)
//   4. a news item becomes a card you open, with the holding it touches, the computed effect, how sure
//      Boop is and where it could be wrong                                         (ENews / ENewsCard / ENewsSheet)

// MARK: - Actions

struct EAction: Identifiable {
    let id = UUID()
    let glyph: String, title: String
    var primary = false
}

/// Two or three buttons on one line. The primary one is filled; the rest are quiet.
struct EActionRow: View {
    var actions: [EAction]
    var hue: Color
    var onTap: (String) -> Void
    var body: some View {
        HStack(spacing: 10) {
            ForEach(actions) { a in
                Button { onTap(a.title) } label: {
                    HStack(spacing: 7) {
                        EGlyph(a.glyph, a.primary ? gBase : .white, size: 15)
                        Text(a.title).font(.system(size: 14.5, weight: .semibold))
                            .lineLimit(1).minimumScaleFactor(0.85)
                            .foregroundStyle(a.primary ? gBase : .white)
                    }
                    .frame(maxWidth: .infinity).frame(height: 46)
                    .background(
                        Capsule().fill(a.primary ? AnyShapeStyle(hue) : AnyShapeStyle(Color.white.opacity(0.1)))
                    )
                    .overlay(Capsule().stroke(.white.opacity(a.primary ? 0 : 0.14)))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - The explanation, behind a button

/// One quiet line in place of a paragraph. Tapping it opens the full text.
struct EInfoRow: View {
    var label: String
    var hue: Color
    var onTap: () -> Void
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 9) {
                Image(systemName: "info.circle")
                    .font(.system(size: 14.5, weight: .medium)).foregroundStyle(hue.opacity(0.9))
                Text(label).font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.62))
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(.white.opacity(0.35))
            }
            .padding(.horizontal, 14).frame(height: 42)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.05)))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct EInfoSheet: View {
    var title: String
    var text: String
    var hue: Color
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 9) {
                    Image(systemName: "info.circle").font(.system(size: 15, weight: .medium)).foregroundStyle(hue)
                    Text(title.uppercased()).font(AuraFont.mono(11, .bold)).tracking(1.5)
                        .foregroundStyle(.white.opacity(0.7))
                    Spacer()
                }
                EHueText(text: text, hue: hue, size: 15.5, opacity: 0.85).padding(.top, 16)
                Spacer(minLength: 20)
            }
            .padding(.horizontal, 22).padding(.top, 26).padding(.bottom, 30)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(gBase)
    }
}

// MARK: - A news item worth opening

struct ENews: Identifiable {
    let id = UUID()
    /// What happened, in his words.
    let title: String
    /// Which of HIS holdings it touches, and the sleeve it sits in.
    let holding: String, sleeve: String, holdingGlyph: String
    /// The computed effect — the backend's number, never the model's.
    let effect: String, effectNote: String
    /// 0 alacsony · 1 közepes · 2 magas
    let confidence: Int
    let sources: [String]
    let when: String
    /// One line: what Boop makes of it.
    let verdict: String
    /// The full reading, for the sheet.
    let body: String
    /// Where this could be wrong — always present, never empty.
    let uncertainty: String
    /// Why there is nothing to do about it. Per item: a 10+ year holding and a currency move
    /// are left alone for different reasons, and one sentence for both would be a lie.
    var noAction: String = "Ez a hír nem ok a lépésre, és nem is küldelek sehova."

    var confidenceText: String { ["Alacsony", "Közepes", "Magas"][confidence] }
    var confidenceHue: Color { [Color(hex: 0x9AA3AE), Color(hex: 0xE8C25A), Color(hex: 0x5FD08A)][confidence] }
    var negative: Bool { effect.hasPrefix("−") || effect.hasPrefix("-") }
}

/// Three dots that say how sure Boop is — so a guess never looks like a fact.
struct EConfidenceDots: View {
    var level: Int
    var hue: Color
    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<3, id: \.self) { i in
                Circle().fill(i <= level ? hue : Color.white.opacity(0.18)).frame(width: 5, height: 5)
            }
        }
    }
}

struct ENewsCard: View {
    var item: ENews
    var hue: Color
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 0) {
                // which of his holdings this is about — the first thing, because that is why it is here
                HStack(spacing: 7) {
                    EGlyph(item.holdingGlyph, hue, size: 13)
                    Text(item.holding).font(.system(size: 12, weight: .semibold)).foregroundStyle(hue)
                    Text("·").foregroundStyle(.white.opacity(0.3))
                    Text(item.sleeve).font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
                    Spacer()
                }
                Text(item.title).font(AuraFont.serif(19)).lineSpacing(2).foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true).padding(.top, 9)

                // the computed effect, set apart so it never reads as something the model wrote
                HStack(alignment: .firstTextBaseline, spacing: 7) {
                    Text(item.effect)
                        .font(.custom("Outfit", size: 24).weight(.medium))
                        .foregroundStyle(item.negative ? Color(hex: 0xE89A6A) : hue)
                    Text(item.effectNote).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.55))
                    Spacer()
                }
                .padding(.top, 11)

                Text(item.verdict).font(.system(size: 13.5)).lineSpacing(3)
                    .multilineTextAlignment(.leading)
                    .foregroundStyle(.white.opacity(0.72))
                    .fixedSize(horizontal: false, vertical: true).padding(.top, 9)

                Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5).padding(.top, 13)

                HStack(spacing: 8) {
                    EConfidenceDots(level: item.confidence, hue: item.confidenceHue)
                    Text(item.confidenceText.lowercased() + " biztonság")
                        .font(.system(size: 11.5)).foregroundStyle(.white.opacity(0.5))
                    Text("·").foregroundStyle(.white.opacity(0.25))
                    Text("\(item.sources.count) forrás").font(.system(size: 11.5)).foregroundStyle(.white.opacity(0.5))
                    Spacer()
                    Text("Elemzés").font(.system(size: 12.5, weight: .semibold)).foregroundStyle(hue)
                    Image(systemName: "chevron.right").font(.system(size: 10, weight: .bold)).foregroundStyle(hue)
                }
                .padding(.top, 11)
            }
            .padding(17)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous).fill(.white.opacity(0.055))
                    .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(.white.opacity(0.1)))
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// The analysis behind a news card: what happened, what it does to HIS money, how sure Boop is,
/// where it sits in his plan, the sources — and, always, that there is nothing to do.
struct ENewsSheet: View {
    var item: ENews
    var hue: Color
    var onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 7) {
                    EGlyph(item.holdingGlyph, hue, size: 14)
                    Text(item.holding.uppercased() + " · " + item.sleeve.uppercased())
                        .font(AuraFont.mono(11, .bold)).tracking(1.5).foregroundStyle(hue)
                    Spacer()
                }
                Text(item.title).font(AuraFont.serif(27)).lineSpacing(3).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true).padding(.top, 12)
                Text(item.when).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.45)).padding(.top, 8)

                // 1 — what it does to his money. The number comes from the ledger, not from the model.
                section("MIT JELENT NEKED", glyph: "e-penz") {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(item.effect).font(.custom("Outfit", size: 34).weight(.light))
                            .foregroundStyle(item.negative ? Color(hex: 0xE89A6A) : hue)
                        Text(item.effectNote).font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.6))
                        Spacer()
                    }
                    Text("Ezt a számot a rendszer számolta ki a te tételeidből — nem az AI írta.")
                        .font(.system(size: 12)).foregroundStyle(.white.opacity(0.45)).padding(.top, 8)
                }

                // 2 — the reading
                section("AMIT BOOP GONDOL RÓLA", glyph: "chat-ink") {
                    EHueText(text: item.body, hue: hue, size: 15, opacity: 0.85)
                }

                // 3 — how sure, and where it could be wrong
                section("MENNYIRE BIZTOS", glyph: "scale-ink") {
                    HStack(spacing: 9) {
                        EConfidenceDots(level: item.confidence, hue: item.confidenceHue)
                        Text(item.confidenceText).font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(item.confidenceHue)
                        Spacer()
                    }
                    Text(item.uncertainty).font(.system(size: 14)).lineSpacing(4)
                        .foregroundStyle(.white.opacity(0.72))
                        .fixedSize(horizontal: false, vertical: true).padding(.top, 9)
                }

                // 4 — the sources, named
                section("HONNAN VAN", glyph: "book-sage") {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(item.sources.enumerated()), id: \.offset) { i, s in
                            Button { onToast("Megnyitom: " + s) } label: {
                                HStack(spacing: 10) {
                                    Circle().fill(hue.opacity(0.5)).frame(width: 5, height: 5)
                                    Text(s).font(.system(size: 14)).foregroundStyle(.white.opacity(0.85))
                                    Spacer()
                                    Image(systemName: "arrow.up.right")
                                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
                                }
                                .frame(height: 38).contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            if i < item.sources.count - 1 {
                                Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5)
                            }
                        }
                    }
                }

                // 5 — the point of the whole area: most of the time, nothing
                HStack(spacing: 11) {
                    EGlyph("check-ink", hue, size: 17)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Nincs teendőd").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                        Text(item.noAction)
                            .font(.system(size: 13)).lineSpacing(3).foregroundStyle(.white.opacity(0.65))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(15).frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous).fill(hue.opacity(0.12))
                        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(hue.opacity(0.3)))
                )
                .padding(.top, 24)

                EActionRow(actions: [
                    EAction(glyph: "chat-ink", title: "Kérdezek róla", primary: true),
                    EAction(glyph: "search-ink", title: "A befektetésem"),
                ], hue: hue) { onToast($0 + " · " + item.holding) }
                .padding(.top, 14)

                Spacer(minLength: 10)
            }
            .padding(.horizontal, 22).padding(.top, 26).padding(.bottom, 34)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(gBase)
    }

    @ViewBuilder private func section<C: View>(_ label: String, glyph: String,
                                               @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Capsule().fill(hue).frame(width: 3, height: 13)
                EGlyph(glyph, hue.opacity(0.9), size: 14)
                Text(label).font(AuraFont.mono(11, .bold)).tracking(1.4).foregroundStyle(.white.opacity(0.7))
                Spacer()
            }
            VStack(alignment: .leading, spacing: 0) { c() }
        }
        .padding(.top, 26)
    }
}

/// Identifiable wrapper so `.sheet(item:)` can carry the explanation text.
struct EInfoText: Identifiable {
    let id = UUID()
    let title: String, body: String
}
