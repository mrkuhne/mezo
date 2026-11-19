import Foundation
import Testing
@testable import BoopCore

private let templateDay = UUID(uuidString: "b1b2c3d4-0010-4a2b-9c3d-111122223333")!
private let pressId = UUID(uuidString: "b1b2c3d4-0011-4a2b-9c3d-111122223333")!
private let serverWorkout = "b1b2c3d4-0012-4a2b-9c3d-111122223333"

private func day(_ d: Int, _ h: Int = 18) -> Date {
    budapest.date(from: DateComponents(year: 2026, month: 11, day: d, hour: h))!
}

/// The open instance the server answers a start with — the same one however many times it is asked.
private func instanceJSON(status: String = "active") -> String {
    #"""
    {"id":"\#(serverWorkout)","templateSessionId":"\#(templateDay.uuidString.lowercased())",
     "date":"2026-11-16","status":"\#(status)","sets":[]}
    """#
}

struct TrainOutboxTests {
    let dir = temporaryDirectory()
    let time = TestClock(day(16))

    func outbox(_ sender: OutboxSender) -> Outbox {
        let c = time
        return Outbox(directory: dir, sender: sender, clock: { c.now }, calendar: budapest)
    }

    func startItem(id: UUID = UUID(), date: String = "2026-11-16") -> OutboxItem {
        .workoutStart(WorkoutStartPayload(templateSessionId: templateDay), date: date, capturedAt: time.now, id: id)
    }

    func setItem(ref: UUID, index: Int, date: String = "2026-11-16") -> OutboxItem {
        .workoutWrite(.workoutSet,
                      payload: TrainPayloadCodec.encode(WorkoutSetPayload(
                        workoutRef: ref, exerciseId: pressId, setIndex: index, weightKg: 80, reps: 8, rir: 2)),
                      workoutRef: ref, date: date, capturedAt: time.now)
    }

    func finishItem(ref: UUID, date: String = "2026-11-16") -> OutboxItem {
        .workoutWrite(.workoutFinish,
                      payload: TrainPayloadCodec.encode(WorkoutFinishPayload(workoutRef: ref)),
                      workoutRef: ref, date: date, capturedAt: time.now)
    }

    // MARK: - Order

    @Test func setsOfOneWorkoutKeepTheirOrder() async throws {
        let start = startItem()
        let items = [start, setItem(ref: start.id, index: 0), setItem(ref: start.id, index: 1),
                     setItem(ref: start.id, index: 2), finishItem(ref: start.id)]

        // One session is one chain: every write of it shares the group key…
        let keys = Set(items.map { Outbox.group(of: $0).key })
        #expect(keys.count == 1)
        // …the start waits on nothing, and everything after it waits behind what is queued before it.
        #expect(Outbox.group(of: start).waits == false)
        #expect(items.dropFirst().allSatisfy { Outbox.group(of: $0).waits })

        let sender = FakeSender()
        let box = outbox(sender)
        for item in items { try await box.enqueue(item) }
        await box.flush()
        #expect(await sender.sent.map(\.id) == items.map(\.id))
    }

    @Test func twoWorkoutsOnOneDayAreSeparateGroups() async throws {
        // The first non-date group there has ever been: two sessions on one day must not hold each other up.
        let first = startItem(), second = startItem()
        #expect(Outbox.group(of: setItem(ref: first.id, index: 0)).key
                != Outbox.group(of: setItem(ref: second.id, index: 0)).key)
        #expect(Outbox.group(of: first).key != Outbox.group(of: second).key)
    }

    @Test func aStuckWorkoutDoesNotHoldBackTheOther() async throws {
        let stuck = startItem(), other = startItem()
        let sender = FakeSender()
        await sender.stick(stuck.id)
        let box = outbox(sender)
        try await box.enqueue(stuck)
        try await box.enqueue(setItem(ref: stuck.id, index: 0))
        try await box.enqueue(other)
        await box.flush()

        // The stuck session's own set waits behind it; the other session's start went out.
        let sent = await sender.sent.map(\.id)
        #expect(sent.contains(other.id))
        #expect(await box.pending.contains { $0.groupRef == stuck.id && $0.kind == .workoutSet })
    }

    // MARK: - Starting twice

    @Test func startRetryDoesNotCreateASecondWorkout() async throws {
        // The server resumes rather than duplicating: `POST /api/train/workouts` answers 201 with the OPEN
        // instance when one exists, so the natural key (the template day) is all the idempotency a replay needs —
        // there is no clientRef on /api/train/*.
        let stub = StubTransport()
        stub.on("startWorkout", .json(201, instanceJSON()))
        stub.on("startWorkout", .json(201, instanceJSON()))
        let train = TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub), calendar: budapest)

        let item = startItem()
        let first = await train.send(item)
        let second = await train.send(item)

        guard case .sent(let body) = first, let data = body,
              let instance = TrainPayloadCodec.decode(WorkoutInstance.self, from: data)
        else { Issue.record("the start must come back with the instance it opened"); return }
        #expect(instance.id.uuidString.lowercased() == serverWorkout)
        #expect(instance.templateSessionId == templateDay)
        guard case .sent = second else { Issue.record("a replayed start must be sent, not refused"); return }
        #expect(stub.ops.filter { $0 == "startWorkout" }.count == 2)
    }

    @Test func aConflictingStartIsReportedNotRetriedForever() async throws {
        // The other 409 the server has: another workout is open, or this day is already done this week. Neither
        // can be fixed by sending again, so the item fails with the server's own code and the room says what
        // happened — rather than burning the attempt cap in silence.
        let stub = StubTransport()
        stub.on("startWorkout", .json(409, #"[{"code":"TRAIN_WORKOUT_OPEN_ELSEWHERE","type":"REQUEST","level":"ERROR"}]"#))
        let train = TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub), calendar: budapest)

        #expect(await train.send(startItem()) == .failed("TRAIN_WORKOUT_OPEN_ELSEWHERE"))
    }

    @Test func aSetWaitsWhileItsWorkoutHasNoServerIdYet() async throws {
        // Queued in a basement: the start has not landed, and today's workout has nothing open either. The set
        // must wait, never invent a workout id and never be thrown away.
        let stub = StubTransport()
        stub.on("getTodayWorkout", .json(200, #"{"weekDoneDates":[]}"#))
        let train = TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub), calendar: budapest)

        let start = startItem()
        #expect(await train.send(setItem(ref: start.id, index: 0)) == .retryLater)
    }

    // MARK: - Surviving and failing visibly

    @Test func aSetSurvivesAProcessRestart() async throws {
        let start = startItem()
        let sender = FakeSender()
        await sender.setOffline(true)
        let box = outbox(sender)
        try await box.enqueue(start)
        let logged = setItem(ref: start.id, index: 0)
        try await box.enqueue(logged)
        await box.flush()

        // A second outbox over the same folder is what the next launch has: the set is still there, same id.
        let next = outbox(FakeSender())
        let pending = await next.pending
        #expect(pending.map(\.id) == [start.id, logged.id])
        #expect(pending.last?.groupRef == start.id)
    }

    @Test func anItemOlderThanSevenDaysFailsVisibly() async throws {
        let start = startItem(date: "2026-11-01")
        let sender = FakeSender()
        let box = outbox(sender)
        try await box.enqueue(start)
        await box.flush()

        // Kept, not dropped: it gets an „Újra" row with its own values, and the server was never asked.
        // `pending` is only what is still on its way; a refused item moves to `failed`, which is what shows the row.
        #expect(await box.pending.isEmpty)
        let failed = await box.failed
        #expect(failed.count == 1)
        #expect(failed.first?.failure != nil)
        #expect(await sender.sent.isEmpty)
    }

    @Test func feedbackIsSentOneBased() async throws {
        // In the app the answers are 0-based (pump 0-3, joint pain 0-2, workload 0-2); the contract wants
        // pump 1-4, joint pain 1-3, workload 1-3 — so the wire is one more, whatever was queued before the fix.
        let stub = StubTransport()
        stub.on("startWorkout", .json(201, instanceJSON()))
        stub.on("saveWorkoutFeedback", .status(204))
        let train = TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub), calendar: budapest)

        let start = startItem()
        guard case .sent = await train.send(start) else { Issue.record("the start must go out first"); return }
        let feedback = OutboxItem.workoutWrite(
            .workoutFeedback,
            payload: TrainPayloadCodec.encode(WorkoutFeedbackPayload(
                workoutRef: start.id, items: [.init(exerciseId: pressId, pump: 0, jointPain: 2, workload: 1)])),
            workoutRef: start.id, date: "2026-11-16", capturedAt: time.now)
        guard case .sent = await train.send(feedback) else { Issue.record("the feedback must be sent"); return }

        let sentBody = stub.sent.first { $0.op == "saveWorkoutFeedback" }?.body ?? ""
        let items = try JSONSerialization.jsonObject(with: Data(sentBody.utf8)) as? [[String: Any]]
        #expect(items?.count == 1)
        #expect(items?.first?["pump"] as? Int == 1)
        #expect(items?.first?["jointPain"] as? Int == 3)
        #expect(items?.first?["workload"] as? Int == 2)
    }
}
