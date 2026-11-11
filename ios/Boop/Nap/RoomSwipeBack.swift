import SwiftUI
import UIKit

/// The edge swipe back from a room to Ma. A room hides the navigation bar, which switches off the system swipe-back;
/// this helper turns it back on for the room only: while the room is on screen it stands in as the pop gesture's
/// delegate (a pop only when there is a page under it and no transition is running), and it hands the gesture back
/// to its original delegate when the room leaves. Nothing outside the room is touched.
struct RoomSwipeBack: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> Helper { Helper() }
    func updateUIViewController(_ helper: Helper, context: Context) {}

    final class Helper: UIViewController, UIGestureRecognizerDelegate {
        private weak var nav: UINavigationController?
        private weak var original: UIGestureRecognizerDelegate?
        private var installed = false

        override func loadView() {
            view = UIView()
            view.isUserInteractionEnabled = false
            view.backgroundColor = .clear
        }

        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            install()
        }

        /// Not on `viewWillDisappear`: a cancelled swipe calls it and then appears again; only a real exit restores.
        override func viewDidDisappear(_ animated: Bool) {
            super.viewDidDisappear(animated)
            restore()
        }

        private func install() {
            guard !installed, let nav = navigationController ?? findNav(),
                  let pop = nav.interactivePopGestureRecognizer else { return }
            self.nav = nav
            original = pop.delegate
            pop.delegate = self
            pop.isEnabled = true
            installed = true
        }

        private func restore() {
            guard installed else { return }
            if let pop = nav?.interactivePopGestureRecognizer, pop.delegate === self { pop.delegate = original }
            installed = false
        }

        /// The nearest navigation controller up the parent chain (a representable may sit below the hosting controller).
        private func findNav() -> UINavigationController? {
            var vc: UIViewController? = parent
            while let v = vc {
                if let n = v as? UINavigationController { return n }
                if let n = v.navigationController { return n }
                vc = v.parent
            }
            return nil
        }

        func gestureRecognizerShouldBegin(_ g: UIGestureRecognizer) -> Bool {
            guard let nav else { return false }
            return nav.viewControllers.count > 1 && nav.transitionCoordinator == nil
        }
    }
}
