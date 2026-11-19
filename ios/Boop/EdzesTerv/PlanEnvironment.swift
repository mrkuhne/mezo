import SwiftUI
import BoopCore

// The block builder's and the weekly review's client, handed down the view tree (mezo-r36n9.83). Nil before sign-in.

private struct PlanClientKey: EnvironmentKey { static let defaultValue: PlanClient? = nil }

extension EnvironmentValues {
    var planClient: PlanClient? {
        get { self[PlanClientKey.self] }
        set { self[PlanClientKey.self] = newValue }
    }
}

extension Session {
    /// The signed-in user's plan client; in a DEBUG review launch (`-preview …`) it answers from fixtures.
    @MainActor var planClient: PlanClient? {
        guard case .ready = state else { return nil }
        #if DEBUG
        if UserDefaults.standard.string(forKey: "preview") != nil { return PlanPreview.client }
        #endif
        return PlanClient(raw: raw)
    }
}
