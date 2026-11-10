import Testing
@testable import BoopCore

struct NapEmptyStateTests {
    @Test func offlineWins() {
        #expect(NapEmptyState.from(connected: true, syncProgress: nil, nights: 30, calendarRows: 3, online: false) == .offline)
    }
    @Test func notConnectedFirst() {
        #expect(NapEmptyState.from(connected: false, syncProgress: nil, nights: 0, calendarRows: 0, online: true) == .notConnected)
    }
    @Test func syncingShowsProgress() {
        #expect(NapEmptyState.from(connected: true, syncProgress: 0.4, nights: 3, calendarRows: 0, online: true) == .syncing(progress: 0.4))
    }
    @Test func thinDataIsLearning() {
        #expect(NapEmptyState.from(connected: true, syncProgress: nil, nights: 9, calendarRows: 3, online: true) == .learning(nights: 9))
    }
    @Test func noCalendarAfterEnoughNights() {
        #expect(NapEmptyState.from(connected: true, syncProgress: nil, nights: 35, calendarRows: 0, online: true) == .noCalendar)
    }
    @Test func readyWithNightsAndCalendar() {
        #expect(NapEmptyState.from(connected: true, syncProgress: nil, nights: 14, calendarRows: 2, online: true) == .ready)
    }
}

struct NapEmptyStateSyncFailedTests {
    @Test func failedSyncHasItsOwnState() {
        #expect(NapEmptyState.from(connected: true, syncProgress: nil, nights: 35, calendarRows: 3, online: true, syncFailed: true) == .syncFailed)
    }
    @Test func offlineStillWinsOverFailed() {
        #expect(NapEmptyState.from(connected: true, syncProgress: nil, nights: 35, calendarRows: 3, online: false, syncFailed: true) == .offline)
    }
}
