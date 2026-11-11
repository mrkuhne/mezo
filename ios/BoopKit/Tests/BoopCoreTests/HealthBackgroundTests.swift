import Foundation
import Testing
@testable import BoopCore

final class FakeObserverSource: HealthObserverSource, @unchecked Sendable {
    private let lock = NSLock()
    private(set) var startCount = 0
    private var wake: (@Sendable (@escaping @Sendable () -> Void) -> Void)?
    private(set) var kinds: [HealthObservedKind] = []
    func start(kinds: [HealthObservedKind], onWake: @escaping @Sendable (@escaping @Sendable () -> Void) -> Void) {
        lock.withLock { startCount += 1; wake = onWake; self.kinds = kinds }
    }
    func fire(_ complete: @escaping @Sendable () -> Void) { wake?(complete) }
}

final class Counter: @unchecked Sendable {
    private let lock = NSLock(); private var n = 0
    var value: Int { lock.withLock { n } }
    func bump() { lock.withLock { n += 1 } }
}

struct HealthBackgroundTests {
    func waitFor(_ c: Counter, _ n: Int) async {
        for _ in 0..<400 where c.value < n { try? await Task.sleep(for: .milliseconds(10)) }
    }

    @Test func observesAllTypes() async {
        let src = FakeObserverSource()
        let bg = HealthBackground(source: src)
        await bg.registerObservers { true }
        #expect(src.kinds.count == 12)
        #expect(HealthObservedKind.sleep.immediate && !HealthObservedKind.steps.immediate)
    }

    @Test func registrationIsIdempotent() async {
        let src = FakeObserverSource()
        let bg = HealthBackground(source: src)
        await bg.registerObservers { true }
        await bg.registerObservers { true }
        #expect(src.startCount == 1)
    }

    @Test func completionOnSuccessAndFailure() async {
        for result in [true, false] {
            let src = FakeObserverSource(); let done = Counter(); let runs = Counter()
            let bg = HealthBackground(source: src)
            await bg.registerObservers { runs.bump(); return result }
            src.fire { done.bump() }
            await waitFor(done, 1)
            #expect(done.value == 1 && runs.value == 1)
        }
    }

    @Test func signedOutCompletesImmediately() async {
        let src = FakeObserverSource(); let done = Counter()
        let bg = HealthBackground(source: src)
        await bg.registerObservers { false }   // no signed-in user → the closure has nothing to run
        src.fire { done.bump() }
        await waitFor(done, 1)
        #expect(done.value == 1)
    }

    @Test func lockedPhoneSkipsSyncButCompletes() async {
        let src = FakeObserverSource(); let done = Counter(); let runs = Counter()
        let bg = HealthBackground(source: src, protectedDataAvailable: { false })
        await bg.registerObservers { runs.bump(); return true }
        src.fire { done.bump() }
        await waitFor(done, 1)
        #expect(done.value == 1 && runs.value == 0)
    }

    @Test func simultaneousWakesShareOneRun() async {
        let src = FakeObserverSource(); let done = Counter(); let runs = Counter()
        let bg = HealthBackground(source: src)
        await bg.registerObservers { runs.bump(); try? await Task.sleep(for: .milliseconds(150)); return true }
        for _ in 0..<5 { src.fire { done.bump() } }
        await waitFor(done, 5)
        #expect(done.value == 5)
        #expect(runs.value <= 2)   // one run + at most the single follow-up for wakes landing mid-run
        #expect(runs.value >= 1)
    }

    @Test func wakeDuringRunGetsExactlyOneFollowUp() async {
        let src = FakeObserverSource(); let done = Counter(); let runs = Counter()
        let bg = HealthBackground(source: src)
        await bg.registerObservers { runs.bump(); try? await Task.sleep(for: .milliseconds(200)); return true }
        src.fire { done.bump() }
        try? await Task.sleep(for: .milliseconds(60))
        src.fire { done.bump() }
        src.fire { done.bump() }
        await waitFor(done, 3)
        #expect(done.value == 3 && runs.value == 2)
    }

    @Test func budgetStopsWaiting() async {
        let src = FakeObserverSource(); let done = Counter()
        let bg = HealthBackground(source: src, budget: .milliseconds(50))
        await bg.registerObservers { try? await Task.sleep(for: .seconds(5)); return true }
        src.fire { done.bump() }
        await waitFor(done, 1)
        #expect(done.value == 1)
    }
}
