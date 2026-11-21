import Foundation

/// When the day page reloads the brief after event labels (B7 K2 final fix, `mezo-r36n9.17`): every label re-scores
/// an event and a reload regenerates the brief, so a run of labels must cost one reload, not one per tap. The reload
/// runs once the label sheet has stayed closed for `delay` (opening another sheet meanwhile cancels the wait), or at
/// once when the page goes away with a label not yet reloaded.
@MainActor
public final class KapacitasReloadGate {
    private let delay: Duration
    private var pending = false
    private var wait: Task<Void, Never>?

    public init(delay: Duration = .seconds(2)) {
        self.delay = delay
    }

    /// A label was stored on the server.
    public func labelStored() {
        pending = true
    }

    /// Another label sheet opened: the next label is coming, hold the reload.
    public func sheetOpened() {
        wait?.cancel()
        wait = nil
    }

    /// The label sheet closed: reload after the quiet spell, if a label is waiting.
    public func sheetClosed(reload: @escaping @MainActor () -> Void) {
        guard pending else { return }
        wait?.cancel()
        let delay = delay
        wait = Task { @MainActor [weak self] in
            try? await Task.sleep(for: delay)
            guard let self, !Task.isCancelled, self.pending else { return }
            self.pending = false
            self.wait = nil
            reload()
        }
    }

    /// The page goes away: reload now if a label is waiting.
    public func flush(reload: @MainActor () -> Void) {
        wait?.cancel()
        wait = nil
        guard pending else { return }
        pending = false
        reload()
    }
}
