import SwiftUI

/// Pressed buttons sink a little (used by the Napkelte pills).
public struct PressStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

/// A white input pill (text / e-mail / password) with its problem line under it.
public struct LagyField: View {
    /// What the field holds; decides capitalization and autocorrect (codes and e-mails are never rewritten).
    public enum Kind: Sendable {
        case name, email, password, code
        public var capitalizesWords: Bool { self == .name }
        var capitalization: TextInputAutocapitalization { capitalizesWords ? .words : .never }
        public var autocorrectionDisabled: Bool { self != .name }
        var keyboard: UIKeyboardType { switch self { case .email: .emailAddress; case .code: .asciiCapable; default: .default } }
    }
    let label: String
    @Binding var text: String
    let kind: Kind
    let content: UITextContentType?
    let problem: String?
    public init(_ label: String, text: Binding<String>, kind: Kind = .name, content: UITextContentType? = nil, problem: String? = nil) {
        self.label = label; self._text = text; self.kind = kind; self.content = content; self.problem = problem
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.manrope(12.5, .bold)).foregroundStyle(Lagy.ink2).padding(.leading, 6)
            Group {
                if kind == .password { SecureField("", text: $text) } else { TextField("", text: $text) }
            }
            .font(.manrope(16, .medium)).foregroundStyle(Lagy.ink)
            .keyboardType(kind.keyboard).textContentType(content)
            .textInputAutocapitalization(kind.capitalization)
            .autocorrectionDisabled(kind.autocorrectionDisabled)
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
