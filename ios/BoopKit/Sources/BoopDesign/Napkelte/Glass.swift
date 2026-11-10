import SwiftUI

public extension View {
    /// The Napkelte card: white 7 % glass, continuous corners, a 1 pt top-light stroke. No coloured glow (spec §4.3).
    func nkGlass(_ radius: CGFloat = 26) -> some View {
        background(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(.white.opacity(0.07))
                .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(LinearGradient(colors: [.white.opacity(0.16), .white.opacity(0.03)], startPoint: .top, endPoint: .bottom), lineWidth: 1))
        )
    }
}

/// White primary pill (dark text) or a 10 % white secondary pill.
public struct NKPill: View {
    let title: String, glyph: String?, primary: Bool, wide: Bool, action: () -> Void
    public init(_ title: String, glyph: String? = nil, primary: Bool = true, wide: Bool = true, action: @escaping () -> Void) {
        self.title = title; self.glyph = glyph; self.primary = primary; self.wide = wide; self.action = action
    }
    public var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let glyph { NKGlyph(glyph, primary ? NK.ground : .white, size: 16) }
                Text(title).font(.system(size: 16, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.7)
            }
            .foregroundStyle(primary ? NK.ground : .white)
            .padding(.horizontal, 22)
            .frame(maxWidth: wide ? .infinity : nil, minHeight: 52)
            .background(Capsule().fill(primary ? .white : .white.opacity(0.1)))
            .contentShape(Capsule())
        }
        .buttonStyle(PressStyle())
    }
}

/// Monospaced caps label ("BOOP MONDJA").
public struct NKMono: View {
    let text: String
    public init(_ text: String) { self.text = text }
    public var body: some View {
        Text(text).font(.nkMono(12)).tracking(1.4).foregroundStyle(.white.opacity(0.6)).lineLimit(1).minimumScaleFactor(0.8)
    }
}

/// Up = better than yesterday (green), down = worse (rose). The only status colours outside orbs and skies.
public struct Trend: View {
    let up: Bool, size: CGFloat
    public init(up: Bool, size: CGFloat = 9) { self.up = up; self.size = size }
    public var body: some View {
        Path { p in
            if up { p.move(to: CGPoint(x: size / 2, y: 0)); p.addLine(to: CGPoint(x: size, y: size)); p.addLine(to: CGPoint(x: 0, y: size)) }
            else { p.move(to: .zero); p.addLine(to: CGPoint(x: size, y: 0)); p.addLine(to: CGPoint(x: size / 2, y: size)) }
            p.closeSubpath()
        }
        .fill(LinearGradient(colors: up ? [Color(hex: 0x43C59E), Color(hex: 0x167A5F)] : [Color(hex: 0xF0508C), Color(hex: 0xA8195A)],
                             startPoint: .top, endPoint: .bottom))
        .frame(width: size, height: size)
        .accessibilityLabel(up ? "jobb" : "rosszabb")
    }
}

/// A Lágy glyph tinted as one colour for the dark look. The four whose artwork relies on white inner detail would
/// flatten into a blob, so they are drawn as thin outlines on the same 64-unit grid.
public struct NKGlyph: View {
    static let outlined: Set<String> = ["check-ink", "clock-ink", "camera-ink", "book-sage"]
    let name: String, color: Color, size: CGFloat
    public init(_ name: String, _ color: Color, size: CGFloat = 18) { self.name = name; self.color = color; self.size = size }

    public var body: some View {
        Group {
            if Self.outlined.contains(name) {
                Canvas { ctx, s in
                    let k = s.width / 64
                    func P(_ f: (inout Path) -> Void) -> Path { var p = Path(); f(&p); return p.applying(CGAffineTransform(scaleX: k, y: k)) }
                    let st = StrokeStyle(lineWidth: 5 * k, lineCap: .round, lineJoin: .round)
                    switch name {
                    case "check-ink":
                        ctx.stroke(P { $0.addEllipse(in: CGRect(x: 9, y: 9, width: 46, height: 46)) }, with: .color(color), style: st)
                        ctx.stroke(P { $0.move(to: CGPoint(x: 21, y: 33)); $0.addLine(to: CGPoint(x: 28, y: 40)); $0.addLine(to: CGPoint(x: 43, y: 24)) }, with: .color(color), style: st)
                    case "clock-ink":
                        ctx.stroke(P { $0.addEllipse(in: CGRect(x: 9, y: 9, width: 46, height: 46)) }, with: .color(color), style: st)
                        ctx.stroke(P { $0.move(to: CGPoint(x: 32, y: 20)); $0.addLine(to: CGPoint(x: 32, y: 32)); $0.addLine(to: CGPoint(x: 40, y: 37)) }, with: .color(color), style: st)
                    case "camera-ink":
                        ctx.stroke(P { $0.addRoundedRect(in: CGRect(x: 8, y: 18, width: 48, height: 34), cornerSize: CGSize(width: 10, height: 10)) }, with: .color(color), style: st)
                        ctx.stroke(P { $0.addEllipse(in: CGRect(x: 23, y: 26, width: 18, height: 18)) }, with: .color(color), style: st)
                        ctx.fill(P { $0.addRoundedRect(in: CGRect(x: 23, y: 11, width: 18, height: 8), cornerSize: CGSize(width: 4, height: 4)) }, with: .color(color))
                    default:
                        ctx.stroke(P { $0.addRoundedRect(in: CGRect(x: 14, y: 10, width: 36, height: 44), cornerSize: CGSize(width: 8, height: 8)) }, with: .color(color), style: st)
                        ctx.stroke(P {
                            $0.move(to: CGPoint(x: 24, y: 24)); $0.addLine(to: CGPoint(x: 40, y: 24))
                            $0.move(to: CGPoint(x: 24, y: 32)); $0.addLine(to: CGPoint(x: 40, y: 32))
                            $0.move(to: CGPoint(x: 24, y: 40)); $0.addLine(to: CGPoint(x: 32, y: 40))
                        }, with: .color(color), style: st)
                    }
                }
            } else {
                Image("g-\(name)", bundle: .module).renderingMode(.template).resizable().scaledToFit().foregroundStyle(color)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// A glass capsule that slides in from the top for 2.2 s ("Kávé · hozzáadva"), with a success haptic.
public struct NKToast: ViewModifier {
    @Binding var text: String?
    public func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if let t = text {
                    HStack(spacing: 8) {
                        NKGlyph("check-ink", .white, size: 15)
                        Text(t).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                    }
                    .padding(.horizontal, 16).frame(height: 42)
                    .glassEffect(.regular, in: .capsule)
                    .padding(.top, 6)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .task(id: t) {
                        try? await Task.sleep(for: .seconds(2.2))
                        withAnimation(.easeInOut) { if text == t { text = nil } }
                    }
                }
            }
            .animation(.spring(response: 0.4, dampingFraction: 0.8), value: text)
            .sensoryFeedback(.success, trigger: text) { _, new in new != nil }
    }
}

public extension View {
    func nkToast(_ text: Binding<String?>) -> some View { modifier(NKToast(text: text)) }
}
