import Testing
import BoopCore
@testable import Boop

struct NapScreenTests {
    private func screen(_ s: NapEmptyState = .ready, store: Bool = true, brief: Bool = false, loading: Bool = false,
                        problem: MorningProblem? = nil, forceBrief: Bool = false) -> NapScreen {
        napScreen(state: s, hasStore: store, hasBrief: brief, loading: loading, problem: problem, forceBrief: forceBrief)
    }

    @Test func loadingWithoutABriefWaitsCalmlyNeverPromisesTomorrow() {
        #expect(screen(loading: true) == .loading)
        #expect(screen(.learning(nights: 20), loading: true) == .loading)
        // before the first load has even started
        #expect(screen(loading: false) == .loading)
    }

    @Test func aBriefShowsMai() {
        #expect(screen(brief: true) == .mai)
        #expect(screen(brief: true, loading: true) == .mai)
        #expect(screen(.syncing(progress: 0.4), brief: true) == .mai)
        #expect(screen(.offline, brief: true) == .mai)
    }

    @Test func aProblemWithoutABriefOffersARetry() {
        #expect(screen(problem: .server) == .problem(.server))
        #expect(screen(loading: true, problem: .server) == .loading)
    }

    @Test func notConnectedKeepsItsState() {
        #expect(screen(.notConnected, brief: true) == .empty(.notConnected))
        #expect(screen(.notConnected) == .empty(.notConnected))
        #expect(screen(.notConnected, brief: true, forceBrief: true) == .mai)
    }

    @Test func syncAndNetworkStatesWithoutABriefStay() {
        #expect(screen(.syncing(progress: 0.3), loading: true) == .empty(.syncing(progress: 0.3)))
        #expect(screen(.syncFailed) == .empty(.syncFailed))
        #expect(screen(.offline, problem: .offline) == .empty(.offline))
        #expect(screen(store: false) == .empty(.ready))
    }

    @Test func aFinishedSyncWithDataReloadsTheBrief() {
        let some = HealthSync.Summary(nights: 1, days: 1, workouts: 0, events: 3)
        let none = HealthSync.Summary(nights: 0, days: 0, workouts: 0, events: 3)
        #expect(reloadsBriefAfterSync(from: .running(progress: 0.9), to: .done(some)))
        #expect(!reloadsBriefAfterSync(from: .running(progress: 0.9), to: .done(none)))
        #expect(!reloadsBriefAfterSync(from: .running(progress: 0.5), to: .failed(.offline)))
        #expect(!reloadsBriefAfterSync(from: .idle, to: .running(progress: 0)))
        #expect(!reloadsBriefAfterSync(from: .done(some), to: .done(some)))
    }

    @Test func loadingCopyIsBoopsVoice() {
        let c = loadingCopy
        #expect(c.title == "Boop összerakja a reggeledet…")
        #expect(c.action == nil)
        for s in [c.caps, c.title, c.sentence] { #expect(!s.localizedCaseInsensitiveContains("mezo")) }
        #expect(c.title != napCopy(.ready).title)
    }
}
