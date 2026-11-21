import Testing
@testable import BoopCore

/// K2 final fix (mezo-r36n9.17): labelling several events reloads the day page's brief once, not once per tap.
@MainActor
struct KapacitasReloadGateTests {
    final class Counter { var n = 0 }

    @Test func severalLabelsInARowReloadOnce() async throws {
        let gate = KapacitasReloadGate(delay: .milliseconds(80))
        let c = Counter()
        for _ in 0..<3 {          // tap, sheet closes, next sheet opens before the quiet spell ends
            gate.labelStored()
            gate.sheetClosed { c.n += 1 }
            try await Task.sleep(for: .milliseconds(20))
            gate.sheetOpened()
        }
        gate.sheetClosed { c.n += 1 }
        try await Task.sleep(for: .milliseconds(250))
        #expect(c.n == 1)
    }

    @Test func closingWithoutALabelDoesNotReload() async throws {
        let gate = KapacitasReloadGate(delay: .milliseconds(30))
        let c = Counter()
        gate.sheetClosed { c.n += 1 }
        try await Task.sleep(for: .milliseconds(120))
        #expect(c.n == 0)
    }

    @Test func leavingThePageReloadsAtOnceAndOnlyOnce() async throws {
        let gate = KapacitasReloadGate(delay: .seconds(5))
        let c = Counter()
        gate.labelStored()
        gate.sheetClosed { c.n += 1 }
        gate.flush { c.n += 1 }
        #expect(c.n == 1)
        gate.flush { c.n += 1 }   // nothing pending any more
        #expect(c.n == 1)
    }
}
