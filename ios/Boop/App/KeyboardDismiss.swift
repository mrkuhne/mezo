import SwiftUI
import UIKit

/// **A tap outside the text closes the keyboard — everywhere** (mezo-r36n9.191). One tap recognizer on every window
/// of the app: it never swallows the tap (buttons, rows and chips still get it), it ignores taps that land in a text
/// field or text box (moving between fields keeps the keyboard), and it only listens while the keyboard is up.
@MainActor
enum KeyboardDismiss {
    private static var keyboardUp = false
    private static let delegate = Delegate()
    private static var installed: Set<ObjectIdentifier> = []
    private static var tokens: [NSObjectProtocol] = []

    static func install() {
        guard tokens.isEmpty else { return }
        let nc = NotificationCenter.default
        tokens = [
            nc.addObserver(forName: UIWindow.didBecomeKeyNotification, object: nil, queue: .main) { n in
                let window = n.object as? UIWindow
                MainActor.assumeIsolated { if let window { attach(to: window) } }
            },
            nc.addObserver(forName: UIResponder.keyboardWillShowNotification, object: nil, queue: .main) { _ in
                MainActor.assumeIsolated {
                    keyboardUp = true
                    // a window that became key before this was installed still gets its recognizer
                    for case let scene as UIWindowScene in UIApplication.shared.connectedScenes {
                        scene.windows.forEach(attach(to:))
                    }
                }
            },
            nc.addObserver(forName: UIResponder.keyboardWillHideNotification, object: nil, queue: .main) { _ in
                MainActor.assumeIsolated { keyboardUp = false }
            },
        ]
    }

    private static func attach(to window: UIWindow) {
        // the keyboard's own windows are not ours
        guard window.windowScene != nil, !String(describing: type(of: window)).contains("Keyboard"),
              installed.insert(ObjectIdentifier(window)).inserted else { return }
        let tap = UITapGestureRecognizer(target: delegate, action: #selector(Delegate.tapped(_:)))
        tap.cancelsTouchesInView = false
        tap.delaysTouchesBegan = false
        tap.delaysTouchesEnded = false
        tap.delegate = delegate
        window.addGestureRecognizer(tap)
    }

    /// Views marked with `keepsKeyboard()` (the chat's composer: send, microphone) do not close it.
    fileprivate static var keepers = NSHashTable<UIView>.weakObjects()

    fileprivate final class Delegate: NSObject, UIGestureRecognizerDelegate {
        @objc func tapped(_ g: UITapGestureRecognizer) {
            g.view?.endEditing(true)
        }

        func gestureRecognizer(_ g: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            MainActor.assumeIsolated {
                guard KeyboardDismiss.keyboardUp, let window = g.view as? UIWindow else { return false }
                var v = touch.view
                while let s = v {
                    if s is UITextField || s is UITextView || s is UISearchBar { return false }
                    v = s.superview
                }
                let p = touch.location(in: window)
                for keeper in KeyboardDismiss.keepers.allObjects where keeper.window === window {
                    if keeper.convert(keeper.bounds, to: window).contains(p) { return false }
                }
                return true
            }
        }

        func gestureRecognizer(_ g: UIGestureRecognizer,
                               shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
    }
}

extension View {
    /// A tap inside this view does not close the keyboard (e.g. a chat composer's send button).
    func keepsKeyboard() -> some View {
        background(KeyboardKeeper().accessibilityHidden(true))
    }
}

private struct KeyboardKeeper: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
        let v = UIView()
        v.isUserInteractionEnabled = false
        v.backgroundColor = .clear
        KeyboardDismiss.keepers.add(v)
        return v
    }
    func updateUIView(_ uiView: UIView, context: Context) {}
}
