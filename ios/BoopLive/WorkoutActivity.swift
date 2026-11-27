import ActivityKit
import AppIntents
import Foundation

// Compiled into BOTH the app and the widget extension (the `BoopLive` folder is a synchronized group of both targets):
// ActivityKit matches the attributes by type, and a button on the Lock Screen names its intent by type. The extension
// only draws; every intent runs in the app's process (`LiveActivityIntent`), so `perform` reaches the app's code only
// when compiled into the app (`BOOP_WIDGETS` is set for the extension).

/// The running workout on the Lock Screen and in the Dynamic Island (`mezo-r36n9.172`, step 2).
struct WorkoutActivityAttributes: ActivityAttributes, Sendable {
    struct ContentState: Codable, Hashable, Sendable {
        enum Phase: String, Codable, Hashable, Sendable {
            /// A set to lift: the target, and „Kész" when it can be logged from here.
            case set
            /// Resting before the next set: the countdown, „+15 mp" and „Tovább".
            case rest
            /// Inside a technique set (drop, myo, half reps): only the app's player can log its steps.
            case technique
            /// The exercise's three questions: answered in the app.
            case debrief
        }
        var phase: Phase
        var exercise: String
        /// 1-based set of the exercise on the card, and how many it has.
        var setIndex: Int
        var setCount: Int
        /// Sets done and planned across the whole workout (the header's „7 / 16").
        var done: Int
        var total: Int
        var targetKg: Double?
        var targetReps: Int?
        var restEndsAt: Date?
        var restTotal: TimeInterval?
        /// „Kész" is offered only for a plain set (a technique set's steps need the player).
        var canLogHere: Bool
    }

    /// The workout's own id (`WorkoutSession.ref`): one card per workout.
    var ref: String
    /// „Push nap" — the plan day's name, when the plan has one.
    var dayName: String
}

/// What a Lock Screen button asks of the running workout.
enum WorkoutLiveAction: String, Sendable {
    case logSet, addRest, skipRest
}

/// „Kész · 80 kg × 8": the set on the card, as prefilled, logged without opening the app.
struct LogPlannedSetIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Kész"
    static let isDiscoverable = false
    init() {}
    func perform() async throws -> some IntentResult {
        #if !BOOP_WIDGETS
        await WorkoutLiveActions.run(.logSet)
        #endif
        return .result()
    }
}

/// „+15 mp" on the running rest.
struct AddRestIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "+15 mp"
    static let isDiscoverable = false
    init() {}
    func perform() async throws -> some IntentResult {
        #if !BOOP_WIDGETS
        await WorkoutLiveActions.run(.addRest)
        #endif
        return .result()
    }
}

/// „Tovább": the rest is over, on with the next set.
struct SkipRestIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Tovább"
    static let isDiscoverable = false
    init() {}
    func perform() async throws -> some IntentResult {
        #if !BOOP_WIDGETS
        await WorkoutLiveActions.run(.skipRest)
        #endif
        return .result()
    }
}
