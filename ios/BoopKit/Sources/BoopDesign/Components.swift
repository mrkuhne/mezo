import SwiftUI

// MARK: - Chips and pills

public struct Chip: View {
    public enum Style: Sendable { case plain, soft, warm, ink }
    let text: String
    let style: Style
    let glyph: (String, String)?
    let small: Bool
    public init(text: String, style: Style = .plain, glyph: (String, String)? = nil, small: Bool = false) {
        self.text = text; self.style = style; self.glyph = glyph; self.small = small
    }
    public var body: some View {
        HStack(spacing: 5) {
            if let g = glyph { Glyph(g.0, g.1, size: small ? 14 : 15) }
            Text(text).font(.manrope(12.5, .bold)).lineLimit(1)
        }
        .padding(.leading, glyph == nil ? (small ? 9 : 11) : 7)
        .padding(.trailing, small ? 9 : 11)
        .frame(height: small ? 26 : 28)
        .foregroundStyle(fg)
        .background(Capsule().fill(bg))
        .shadow(color: style == .plain ? .black.opacity(0.12) : .clear, radius: 7, y: 6)
    }
    private var fg: Color { switch style { case .plain: Lagy.ink; case .soft: Lagy.deep; case .warm: Lagy.peachInk; case .ink: .white } }
    private var bg: Color { switch style { case .plain: .white; case .soft: Lagy.sage3; case .warm: Lagy.peach2; case .ink: Lagy.ink } }
}

public struct PressStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

/// Compact pill: ink (primary), soft (sage tint) or white on a photo.
public struct Pill: View {
    let title: String
    let glyph: (String, String)?
    let soft: Bool
    let onPhoto: Bool
    let action: () -> Void
    public init(title: String, glyph: (String, String)? = nil, soft: Bool = false, onPhoto: Bool = false, action: @escaping () -> Void = {}) {
        self.title = title; self.glyph = glyph; self.soft = soft; self.onPhoto = onPhoto; self.action = action
    }
    public var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let g = glyph { Glyph(g.0, g.1, size: 18) }
                Text(title).font(.manrope(14, .bold))
            }
            .padding(.horizontal, 18)
            .frame(height: onPhoto ? 44 : 46)
            .foregroundStyle(soft ? Lagy.deep : (onPhoto ? Lagy.ink : .white))
            .background(Capsule().fill(soft ? Lagy.sage3 : (onPhoto ? .white : Lagy.ink)))
            .shadow(color: soft ? .clear : .black.opacity(onPhoto ? 0.35 : 0.3), radius: 12, y: 10)
        }
        .buttonStyle(PressStyle())
    }
}

/// Full-width primary pill; shows a spinner and ignores taps while `busy`.
public struct WidePill: View {
    let title: String
    let glyph: (String, String)?
    let soft: Bool
    let busy: Bool
    let action: () -> Void
    public init(title: String, glyph: (String, String)? = nil, soft: Bool = false, busy: Bool = false, action: @escaping () -> Void) {
        self.title = title; self.glyph = glyph; self.soft = soft; self.busy = busy; self.action = action
    }
    public var body: some View {
        Button(action: { if !busy { action() } }) {
            HStack(spacing: 8) {
                if busy { ProgressView().tint(soft ? Lagy.deep : .white) }
                else if let g = glyph { Glyph(g.0, g.1, size: 18) }
                Text(title).font(.manrope(15, .bold))
            }
            .frame(maxWidth: .infinity).frame(height: 54)
            .foregroundStyle(soft ? Lagy.deep : .white)
            .background(Capsule().fill(soft ? Lagy.sage3 : Lagy.ink))
            .shadow(color: soft ? .clear : .black.opacity(0.3), radius: 12, y: 10)
            .opacity(busy ? 0.85 : 1)
        }
        .buttonStyle(PressStyle())
    }
}

// MARK: - Cards and sections

public extension View {
    /// White card, one soft shadow, generous radius.
    func lagyCard(_ radius: CGFloat = 26, fill: Color = .white) -> some View {
        background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(fill)
            .shadow(color: Lagy.ink.opacity(0.10), radius: 18, y: 12))
    }
    /// The one deep-green card of a page.
    func deepCard() -> some View {
        background(RoundedRectangle(cornerRadius: 26, style: .continuous)
            .fill(LinearGradient(colors: [Color(hex: 0x2F6E54), Lagy.deepDark], startPoint: .topLeading, endPoint: .bottomTrailing))
            .shadow(color: Lagy.deepDark.opacity(0.45), radius: 18, y: 14))
    }
    /// Soft rise on first appearance; lands instantly with reduced motion.
    func entrance(_ delay: Double) -> some View { modifier(Entrance(delay: delay)) }
}

struct Entrance: ViewModifier {
    let delay: Double
    @State private var on = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func body(content: Content) -> some View {
        content
            .opacity(on || reduceMotion ? 1 : 0)
            .offset(y: on || reduceMotion ? 0 : 26)
            .onAppear { withAnimation(.spring(response: 0.9, dampingFraction: 0.86).delay(delay)) { on = true } }
    }
}

public struct SectionHeader: View {
    let title: String
    let link: String?
    let action: () -> Void
    public init(title: String, link: String? = nil, action: @escaping () -> Void = {}) { self.title = title; self.link = link; self.action = action }
    public var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(.outfit(18)).tracking(-0.36).foregroundStyle(Lagy.ink)
            Spacer()
            if let link {
                Button(action: action) {
                    HStack(spacing: 3) { Text(link); Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)) }
                        .font(.manrope(13, .bold)).foregroundStyle(Lagy.deep)
                        .padding(.vertical, 10).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 4)
    }
}

/// Thin labelled bar ("Alvás  84 %").
public struct LagyBar: View {
    let label: String, glyph: (String, String), value: String, unit: String, frac: Double, onDeep: Bool, warn: Bool
    @State private var shown = false
    public init(label: String, glyph: (String, String), value: String, unit: String = "", frac: Double, onDeep: Bool = false, warn: Bool = false) {
        self.label = label; self.glyph = glyph; self.value = value; self.unit = unit; self.frac = frac; self.onDeep = onDeep; self.warn = warn
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                HStack(spacing: 5) { Glyph(glyph.0, glyph.1, size: 15); Text(label) }
                    .font(.manrope(12.5, .bold)).foregroundStyle(onDeep ? .white.opacity(0.82) : Lagy.ink2)
                Spacer(minLength: 4)
                (Text(value).font(.outfit(14)) + Text(unit.isEmpty ? "" : " \(unit)").font(.manrope(12, .bold)).foregroundColor(onDeep ? .white.opacity(0.6) : Lagy.mute))
                    .foregroundStyle(onDeep ? .white : Lagy.ink).monospacedDigit()
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(onDeep ? .white.opacity(0.14) : Lagy.ink.opacity(0.08))
                    Capsule().fill(warn ? Lagy.peach : Lagy.sage2).frame(width: shown ? g.size.width * min(1, max(0, frac)) : 0)
                }
            }
            .frame(height: 6)
        }
        .onAppear { withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 1.1).delay(0.3)) { shown = true } }
    }
}

public struct GlassCircle<C: View>: View {
    let c: C
    public init(@ViewBuilder _ c: () -> C) { self.c = c() }
    public var body: some View {
        c.foregroundStyle(.white).frame(width: 40, height: 40)
            .background(Circle().fill(.white.opacity(0.18)).overlay(Circle().stroke(.white.opacity(0.28), lineWidth: 1)))
            .background(.ultraThinMaterial.opacity(0.4), in: Circle())
    }
}

/// Photo row (Lágy `.dlist.one .dl`): round photo or glyph, title, chips, chevron.
public struct PhotoRow: View {
    let img: String?, glyph: (String, String)?, title: String, chips: [Chip], chevron: Bool
    public init(img: String?, glyph: (String, String)? = nil, title: String, chips: [Chip], chevron: Bool = true) {
        self.img = img; self.glyph = glyph; self.title = title; self.chips = chips; self.chevron = chevron
    }
    public var body: some View {
        HStack(spacing: 12) {
            Group {
                if let img { photo(img).resizable().scaledToFill() }
                else if let g = glyph { Glyph(g.0, g.1, size: 24).frame(maxWidth: .infinity, maxHeight: .infinity).background(Lagy.sage3) }
            }
            .frame(width: 44, height: 44).clipShape(Circle())
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(.outfit(15)).foregroundStyle(Lagy.ink).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 6) { ForEach(Array(chips.enumerated()), id: \.offset) { $0.element } }
            }
            Spacer(minLength: 4)
            if chevron { Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Lagy.mute) }
        }
        .padding(.vertical, 12).padding(.leading, 12).padding(.trailing, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .lagyCard(22)
    }
}

/// A white input pill (text / e-mail / password) with its problem line under it.
public struct LagyField: View {
    let label: String
    @Binding var text: String
    let secure: Bool
    let keyboard: UIKeyboardType
    let content: UITextContentType?
    let problem: String?
    public init(_ label: String, text: Binding<String>, secure: Bool = false, keyboard: UIKeyboardType = .default, content: UITextContentType? = nil, problem: String? = nil) {
        self.label = label; self._text = text; self.secure = secure; self.keyboard = keyboard; self.content = content; self.problem = problem
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.manrope(12.5, .bold)).foregroundStyle(Lagy.ink2).padding(.leading, 6)
            Group {
                if secure { SecureField("", text: $text) } else { TextField("", text: $text) }
            }
            .font(.manrope(16, .medium)).foregroundStyle(Lagy.ink)
            .keyboardType(keyboard).textContentType(content)
            .textInputAutocapitalization(keyboard == .emailAddress || secure ? .never : .words)
            .autocorrectionDisabled(keyboard == .emailAddress || secure)
            .padding(.horizontal, 18).frame(height: 52)
            .background(Capsule().fill(.white).shadow(color: Lagy.ink.opacity(0.08), radius: 10, y: 6))
            .overlay(Capsule().stroke(problem == nil ? .clear : Lagy.peach, lineWidth: 1.5))
            .accessibilityLabel(label)
            if let problem {
                Text(problem).font(.manrope(13, .semibold)).foregroundStyle(Lagy.peachInk).padding(.leading, 6)
            }
        }
    }
}
