import SwiftUI

// MARK: - The top of a page does not pull down (mezo-r36n9.191)

#if canImport(UIKit)
import UIKit

public extension View {
    /// Apply to the **content inside** a full-screen page's `ScrollView` (not to the scroll view itself): pulling the
    /// page down past its top no longer drags the top bar and the sky with it and opens an empty band above them.
    /// The bottom keeps its bounce, and a scroll view that carries a pull-to-refresh is left alone (the pull is the
    /// gesture there). Not for sheets: a sheet's pull-down is how it closes.
    func nkTopBounceLock() -> some View {
        background(NKTopBounceLock().frame(width: 0, height: 0).accessibilityHidden(true))
    }
}

/// A zero-size probe inside the scroll content: it finds the scroll view hosting it and keeps its offset from going
/// above the top. KVO on the offset (not the delegate, which SwiftUI owns).
struct NKTopBounceLock: UIViewRepresentable {
    func makeUIView(context: Context) -> Probe { Probe() }
    func updateUIView(_ uiView: Probe, context: Context) {}

    final class Probe: UIView {
        private var observation: NSKeyValueObservation?
        private weak var scrollView: UIScrollView?

        override func didMoveToWindow() {
            super.didMoveToWindow()
            guard window != nil else { return }
            var v = superview
            while let s = v, !(s is UIScrollView) { v = s.superview }
            guard let sv = v as? UIScrollView, sv !== scrollView else { return }
            scrollView = sv
            observation = sv.observe(\.contentOffset, options: [.new]) { sv, _ in
                MainActor.assumeIsolated { Self.clamp(sv) }
            }
        }

        static func clamp(_ sv: UIScrollView) {
            guard sv.refreshControl == nil else { return }
            let top = -sv.adjustedContentInset.top
            if sv.contentOffset.y < top { sv.contentOffset.y = top }
        }
    }
}
#else
public extension View {
    func nkTopBounceLock() -> some View { self }
}
#endif
