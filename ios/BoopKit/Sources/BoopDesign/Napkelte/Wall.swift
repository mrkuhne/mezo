import SwiftUI

// The living wall's three weights (L0/b, owner round 7): five equal cards read as a list, so the wall has a
// hierarchy instead — the check-in keeps its own tinted question shape, one hero carries a photo band and 25 pt
// serif, and the rest are compact rows inside a single card. "Ma történt" folds under them, and a quiet wall says
// so warmly: an empty wall is good news, not an empty state.
//
// The engine (`BoopCore/Morning/Wall.swift`) decides what goes where; this only draws it.

// MARK: - The question

/// The check-in while it is due: pinned above the three, and a question rather than a notice — its own tinted
/// shape, so it never reads as one more card.
public struct NKWallQuestion: View {
    let hue: Hue, prompt: String, sub: String, answer: String, later: String
    let onAnswer: @MainActor @Sendable () -> Void
    let onLater: @MainActor @Sendable () -> Void
    public init(hue: Hue, prompt: String, sub: String, answer: String = "Kitöltöm", later: String = "Később",
                onAnswer: @escaping @MainActor @Sendable () -> Void,
                onLater: @escaping @MainActor @Sendable () -> Void) {
        self.hue = hue; self.prompt = prompt; self.sub = sub; self.answer = answer; self.later = later
        self.onAnswer = onAnswer; self.onLater = onLater
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 9) {
                StillOrb(palette: hue.orb, size: 22, level: 0.85)
                NKMono("KÉRDEZEK")
                Spacer()
            }
            Text(prompt).nkFont(25, design: .serif).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true).padding(.top, 10)
            Text(sub).nkFont(13.5).lineSpacing(3).foregroundStyle(.white.opacity(0.72))
                .fixedSize(horizontal: false, vertical: true).padding(.top, 6)
            HStack(spacing: 10) {
                Button(action: onAnswer) {
                    Text(answer).nkFont(15, .semibold).foregroundStyle(NK.ground)
                        .padding(.horizontal, 20).frame(height: 44)
                        .background(Capsule().fill(.white.opacity(0.95))).contentShape(Capsule())
                }
                .buttonStyle(.plain)
                Button(action: onLater) {
                    Text(later).nkFont(15, .medium).foregroundStyle(.white.opacity(0.8))
                        .padding(.horizontal, 18).frame(height: 44)
                        .background(Capsule().stroke(.white.opacity(0.35))).contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 16)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(LinearGradient(colors: [hue.glow.opacity(0.26), hue.glow.opacity(0.08)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(hue.glow.opacity(0.4)))
        )
    }
}

// MARK: - What a card says

/// One thing on the wall, as the view needs it. The engine's `WallCandidate` maps onto this; the kit stays free
/// of BoopCore so it can be previewed on its own.
public struct NKWallItem: Identifiable, Equatable {
    public let id: String
    public let hue: Hue
    public let eyebrow: String
    public let when: String
    /// May carry `*marked*` spans: they take the area's hue.
    public let text: String
    public let sub: String
    public let big: String?, bigUnit: String
    public let photo: Image?
    public let primary: String?, secondary: String?
    public init(id: String, hue: Hue, eyebrow: String, when: String = "", text: String, sub: String = "",
                big: String? = nil, bigUnit: String = "", photo: Image? = nil,
                primary: String? = nil, secondary: String? = nil) {
        self.id = id; self.hue = hue; self.eyebrow = eyebrow; self.when = when; self.text = text; self.sub = sub
        self.big = big; self.bigUnit = bigUnit; self.photo = photo; self.primary = primary; self.secondary = secondary
    }
    public static func == (a: NKWallItem, b: NKWallItem) -> Bool {
        a.id == b.id && a.text == b.text && a.sub == b.sub && a.big == b.big
    }
}

// MARK: - The hero

/// The one card that reads big: a photo band of the thing where there is one, 25 pt serif, and its actions. The
/// photo never decides which card is the hero — the engine does that; this only draws what it is given.
public struct NKWallHero: View {
    let item: NKWallItem
    let onAct: @MainActor @Sendable (String) -> Void
    let onWhy: @MainActor @Sendable () -> Void
    public init(item: NKWallItem, onAct: @escaping @MainActor @Sendable (String) -> Void,
                onWhy: @escaping @MainActor @Sendable () -> Void) {
        self.item = item; self.onAct = onAct; self.onWhy = onWhy
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let photo = item.photo { NKCardPhoto(photo, hue: item.hue, height: 132) }
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 9) {
                    StillOrb(palette: item.hue.orb, size: 20, level: 0.85)
                    NKMono(item.eyebrow)
                    Spacer(minLength: 8)
                    if !item.when.isEmpty {
                        Text(item.when).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                    }
                }
                if let big = item.big {
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(big).font(.custom(Lagy.outfitFamily, size: 34).weight(.light))
                            .foregroundStyle(item.hue.glow).monospacedDigit()
                            .lineLimit(1).minimumScaleFactor(0.6)
                        if !item.bigUnit.isEmpty {
                            Text(item.bigUnit).nkFont(13).foregroundStyle(.white.opacity(0.6))
                        }
                    }
                    .padding(.top, 10)
                }
                NKHueText(item.text, hue: item.hue, size: 25, serif: true, opacity: 1)
                    .padding(.top, item.big == nil ? 10 : 4)
                if !item.sub.isEmpty {
                    NKHueText(item.sub, hue: item.hue, size: 13.5, opacity: 0.74).padding(.top, 6)
                }
                NKWallActions(item: item, onAct: onAct, onWhy: onWhy).padding(.top, 14)
            }
            .padding(18)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(.white.opacity(0.07))
            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(.white.opacity(0.12))))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

/// A card's actions, and the "miért?" that is always there — Boop can always say why it is saying this one.
struct NKWallActions: View {
    let item: NKWallItem
    let onAct: @MainActor @Sendable (String) -> Void
    let onWhy: @MainActor @Sendable () -> Void
    var body: some View {
        NKFlowRow(spacing: 10, rowSpacing: 8) {
            if let p = item.primary {
                Button { onAct(p) } label: {
                    Text(p).nkFont(14.5, .semibold).foregroundStyle(NK.ground)
                        .padding(.horizontal, 18).frame(height: 40)
                        .background(Capsule().fill(.white.opacity(0.95))).contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            if let s = item.secondary {
                Button { onAct(s) } label: {
                    Text(s).nkFont(14.5, .medium).foregroundStyle(.white.opacity(0.85))
                        .padding(.horizontal, 16).frame(height: 40)
                        .background(Capsule().stroke(.white.opacity(0.35))).contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            Button(action: onWhy) {
                Text("miért?").nkFont(14, .medium).foregroundStyle(.white.opacity(0.6))
                    .underline(true, pattern: .dot).frame(height: 40)
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - The quiet ones

/// The cards that are not the hero: compact rows inside **one** card — a thumbnail, two lines, the number in
/// weight on the right, the action as an inline link. Two at most.
public struct NKWallRows: View {
    let items: [NKWallItem]
    let onAct: @MainActor @Sendable (String, String) -> Void
    let onWhy: @MainActor @Sendable (String) -> Void
    public init(items: [NKWallItem], onAct: @escaping @MainActor @Sendable (String, String) -> Void,
                onWhy: @escaping @MainActor @Sendable (String) -> Void) {
        self.items = items; self.onAct = onAct; self.onWhy = onWhy
    }
    public var body: some View {
        if !items.isEmpty {
            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { i, item in
                    if i > 0 { Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5).padding(.leading, 68) }
                    row(item)
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 4)
            .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(.white.opacity(0.06))
                .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(.white.opacity(0.1))))
        }
    }

    private func row(_ item: NKWallItem) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                if let photo = item.photo {
                    RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.08))
                        .overlay { photo.resizable().scaledToFill().nkPhotoTone() }
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                } else {
                    RoundedRectangle(cornerRadius: 14, style: .continuous).fill(item.hue.glow.opacity(0.18))
                    StillOrb(palette: item.hue.orb, size: 26, level: 0.8)
                }
            }
            .frame(width: 52, height: 52)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    NKMono(item.eyebrow)
                    Spacer(minLength: 6)
                    if !item.when.isEmpty {
                        Text(item.when).nkFont(10.5, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                    }
                }
                NKHueText(item.text, hue: item.hue, size: 15, opacity: 0.95)
                if !item.sub.isEmpty {
                    Text(item.sub).nkFont(12.5).foregroundStyle(.white.opacity(0.58))
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                }
                HStack(spacing: 14) {
                    if let p = item.primary {
                        Button { onAct(item.id, p) } label: {
                            Text(p).nkFont(13.5, .semibold).foregroundStyle(item.hue.glow)
                        }
                        .buttonStyle(.plain)
                    }
                    Button { onWhy(item.id) } label: {
                        Text("miért?").nkFont(13).foregroundStyle(.white.opacity(0.5))
                            .underline(true, pattern: .dot)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 2)
            }
            if let big = item.big {
                VStack(alignment: .trailing, spacing: 1) {
                    Text(big).font(.custom(Lagy.outfitFamily, size: 19).weight(.medium))
                        .foregroundStyle(.white).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
                    if !item.bigUnit.isEmpty {
                        Text(item.bigUnit).nkFont(10.5).foregroundStyle(.white.opacity(0.5))
                    }
                }
            }
        }
        .padding(.vertical, 14)
    }
}

// MARK: - Nothing to say

/// A quiet wall. Not an empty state: good news, in Boop's voice, with the orb still there.
public struct NKWallQuiet: View {
    let hue: Hue, line: String
    public init(hue: Hue, line: String) { self.hue = hue; self.line = line }
    public var body: some View {
        HStack(alignment: .top, spacing: 14) {
            StillOrb(palette: hue.orb, size: 34, level: 0.8)
            Text(line).nkFont(17, design: .serif).foregroundStyle(.white.opacity(0.9))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 18).padding(.vertical, 20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(.white.opacity(0.05))
            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(.white.opacity(0.09))))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - A folded section

/// What the morning briefing and the day's timeline became: one row each, open in the morning and closed later,
/// with everything still behind them. Also carries "Ma történt".
public struct NKFoldRow<Content: View>: View {
    let title: String, sub: String, hue: Hue
    @Binding var open: Bool
    let content: Content
    public init(_ title: String, sub: String = "", hue: Hue, open: Binding<Bool>,
                @ViewBuilder content: () -> Content) {
        self.title = title; self.sub = sub; self.hue = hue; self._open = open; self.content = content()
    }
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(reduceMotion ? nil : .smooth(duration: 0.3)) { open.toggle() }
            } label: {
                HStack(spacing: 10) {
                    Capsule().fill(hue.glow).frame(width: 3, height: 15)
                    Text(title).nkFont(16, .medium).foregroundStyle(.white)
                    if !sub.isEmpty {
                        Text(sub).nkFont(13).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
                    }
                    Spacer(minLength: 6)
                    Image(systemName: "chevron.down").nkFont(13, .semibold)
                        .foregroundStyle(.white.opacity(0.5))
                        .rotationEffect(.degrees(open ? 0 : -90))
                }
                .padding(.horizontal, 16).frame(minHeight: 52)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(title)
            .accessibilityValue(open ? "nyitva" : "csukva")
            .accessibilityAddTraits(.isButton)
            if open {
                content
                    .padding(.horizontal, 16).padding(.bottom, 16)
                    .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(.white.opacity(0.05))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(.white.opacity(0.09))))
    }
}

/// One line of "Ma történt": a card he already acted on, settled rather than vanished.
public struct NKSettledRow: View {
    let line: String, at: String, hue: Hue
    public init(line: String, at: String, hue: Hue) { self.line = line; self.at = at; self.hue = hue }
    public var body: some View {
        HStack(spacing: 10) {
            NKDoneTick(hue: hue)
            Text(line).nkFont(14).foregroundStyle(.white.opacity(0.8))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 6)
            Text(at).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
        }
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
    }
}
