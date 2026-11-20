import SwiftUI

// A news item worth opening (Pénz L6, `mezo-r36n9.104`) — the approved Élet spike round 11 (`EletPenzKit.swift`
// `ENewsCard` / `EConfidenceDots` / `ENewsSheet`'s section head), owner: "a hírek kevesek és nem tudok rákattintani".
// The card carries, in order: which of HIS holdings it touches and its sleeve · the headline · the computed effect,
// set apart in Outfit so it never reads as model prose · Boop's one line · how sure (three dots + the word) and the
// source count · an *Elemzés ›* affordance. A negative effect is drawn in the warm tone, never in the area's hue.
// The kit knows nothing of money: every string arrives formatted.

public enum NKNews {
    /// The warm tone of a loss — the area hue would turn it green.
    public static let warm = Color(hex: 0xE89A6A)
    /// 0 alacsony (grey) · 1 közepes (amber) · 2 magas (green).
    public static func confidenceColor(_ level: Int) -> Color {
        [Color(hex: 0x9AA3AE), Color(hex: 0xE8C25A), Color(hex: 0x5FD08A)][min(2, max(0, level))]
    }
}

/// Three dots that say how sure Boop is — so a guess never looks like a fact.
public struct NKConfidenceDots: View {
    let level: Int
    let color: Color
    public init(level: Int, color: Color? = nil) {
        self.level = min(2, max(0, level)); self.color = color ?? NKNews.confidenceColor(level)
    }
    public var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<3, id: \.self) { i in
                Circle().fill(i <= level ? color : Color.white.opacity(0.18)).frame(width: 5, height: 5)
            }
        }
        .accessibilityHidden(true)
    }
}

/// The news card.
public struct NKNewsCard: View {
    let hue: Hue
    let holding: String, sleeve: String, holdingGlyph: String
    let title: String
    let effect: String, effectNote: String, negative: Bool
    let verdict: String
    let confidence: Int, confidenceText: String
    let sourceCount: Int
    let action: @MainActor @Sendable () -> Void

    public init(hue: Hue, holding: String, sleeve: String, holdingGlyph: String, title: String, effect: String,
                effectNote: String, negative: Bool, verdict: String, confidence: Int, confidenceText: String,
                sourceCount: Int, action: @escaping @MainActor @Sendable () -> Void) {
        self.hue = hue; self.holding = holding; self.sleeve = sleeve; self.holdingGlyph = holdingGlyph; self.title = title
        self.effect = effect; self.effectNote = effectNote; self.negative = negative; self.verdict = verdict
        self.confidence = confidence; self.confidenceText = confidenceText; self.sourceCount = sourceCount
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                // which of his holdings this is about — the first thing, because that is why it is here
                HStack(spacing: 7) {
                    NKGlyph(holdingGlyph, hue.glow, size: 13)
                    Text(holding).nkFont(12, .semibold).foregroundStyle(hue.glow).lineLimit(1)
                    if !sleeve.isEmpty {
                        Text("·").nkFont(12).foregroundStyle(.white.opacity(0.3))
                        Text(sleeve).nkFont(12).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
                Text(title).nkFont(19, design: .serif).lineSpacing(2).foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true).padding(.top, 9)

                // the computed effect, set apart so it never reads as something the model wrote
                NKNewsEffect(effect: effect, note: effectNote, negative: negative, hue: hue, size: 24, weight: .medium)
                    .padding(.top, 11)

                if !verdict.isEmpty {
                    Text(verdict).nkFont(13.5).lineSpacing(3)
                        .multilineTextAlignment(.leading)
                        .foregroundStyle(.white.opacity(0.72))
                        .fixedSize(horizontal: false, vertical: true).padding(.top, 9)
                }

                Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5).padding(.top, 13)

                HStack(spacing: 8) {
                    NKConfidenceDots(level: confidence)
                    Text(confidenceText.lowercased() + " biztonság").nkFont(11.5).foregroundStyle(.white.opacity(0.5))
                        .lineLimit(1).minimumScaleFactor(0.8)
                    if sourceCount > 0 {
                        Text("·").nkFont(11.5).foregroundStyle(.white.opacity(0.25))
                        Text("\(sourceCount) forrás").nkFont(11.5).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
                    }
                    Spacer(minLength: 4)
                    Text("Elemzés").nkFont(12.5, .semibold).foregroundStyle(hue.glow)
                    Image(systemName: "chevron.right").font(.system(size: 10, weight: .bold)).foregroundStyle(hue.glow)
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
        .accessibilityElement(children: .combine)
        .accessibilityHint("Megnyitja az elemzést")
    }
}

/// The computed effect: the figure in Outfit (warm when negative) with what it is measured on beside it.
public struct NKNewsEffect: View {
    let effect: String, note: String, negative: Bool, hue: Hue
    let size: CGFloat, weight: Font.Weight
    public init(effect: String, note: String, negative: Bool, hue: Hue, size: CGFloat = 34, weight: Font.Weight = .light) {
        self.effect = effect; self.note = note; self.negative = negative; self.hue = hue; self.size = size; self.weight = weight
    }
    public var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: size > 28 ? 8 : 7) { figure; caption; Spacer(minLength: 0) }
            VStack(alignment: .leading, spacing: 2) { figure; caption }
        }
    }
    private var figure: some View {
        Text(effect).font(.custom(Lagy.outfitFamily, size: size).weight(weight))
            .foregroundStyle(negative ? NKNews.warm : hue.glow).monospacedDigit().lineLimit(1).fixedSize()
    }
    private var caption: some View {
        Text(note).nkFont(size > 28 ? 13.5 : 12.5).foregroundStyle(.white.opacity(size > 28 ? 0.6 : 0.55))
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The analysis page's section head: a hue tick, the glyph, a mono label (the spike's `ENewsSheet.section`).
public struct NKNewsSection<Content: View>: View {
    let label: String, glyph: String, hue: Hue
    let content: Content
    public init(_ label: String, glyph: String, hue: Hue, @ViewBuilder content: () -> Content) {
        self.label = label; self.glyph = glyph; self.hue = hue; self.content = content()
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Capsule().fill(hue.glow).frame(width: 3, height: 13)
                NKGlyph(glyph, hue.glow.opacity(0.9), size: 14)
                NKMono(label.uppercased())
                Spacer(minLength: 0)
            }
            .accessibilityAddTraits(.isHeader)
            VStack(alignment: .leading, spacing: 0) { content }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// "Nincs teendőd" with its per-item reason — the point of the whole area.
public struct NKNothingToDo: View {
    let reason: String, hue: Hue
    public init(_ reason: String, hue: Hue) { self.reason = reason; self.hue = hue }
    public var body: some View {
        HStack(alignment: .top, spacing: 11) {
            NKGlyph("check-ink", hue.glow, size: 17).padding(.top, 1)
            VStack(alignment: .leading, spacing: 3) {
                Text("Nincs teendőd").nkFont(15, .semibold).foregroundStyle(.white)
                Text(reason).nkFont(13).lineSpacing(3).foregroundStyle(.white.opacity(0.65))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(15).frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous).fill(hue.glow.opacity(0.12))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(hue.glow.opacity(0.3)))
        )
        .accessibilityElement(children: .combine)
    }
}
