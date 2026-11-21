import Foundation
import Testing
@testable import BoopCore

/// The living wall's engine (L0/b, `mezo-r36n9.45`). Owner decision #34: three fixed roles, not one sort key —
/// so every rule that makes the wall trustworthy is a test here, with the clock injected.
struct WallTests {
    let now = Date(timeIntervalSince1970: 1_763_300_400)   // a fixed afternoon

    func at(_ minutes: Double) -> Date { now.addingTimeInterval(minutes * 60) }

    func candidate(_ id: String, _ role: WallRole, expires: Date? = nil, rank: Double = 0,
                   happened: Date? = nil, photo: String? = nil, area: String = "etel") -> WallCandidate {
        WallCandidate(id: id, role: role, kind: .teendo, area: area, expiresAt: expires, rank: rank,
                      happenedAt: happened, text: id, photo: photo, settled: "\(id) kész", why: "mert \(id)")
    }

    // MARK: - One per role, three at most

    @Test func eachRoleContributesAtMostOneCard() {
        let wall = buildWall([
            candidate("ablak", .expires, expires: at(20)),
            candidate("masik-ablak", .expires, expires: at(40)),
            candidate("feherje", .improves, rank: 0.9),
            candidate("seta", .improves, rank: 0.3),
            candidate("posta", .happened, happened: at(-120)),
            candidate("spar", .happened, happened: at(-30)),
        ], now: now)
        #expect(wall.cards.count == 3)
        #expect(wall.cards.map(\.id) == ["ablak", "feherje", "spar"])
    }

    @Test func theCardsComeInRoleOrderWhateverTheInputOrder() {
        let wall = buildWall([
            candidate("posta", .happened, happened: at(-10)),
            candidate("feherje", .improves, rank: 0.5),
            candidate("ablak", .expires, expires: at(20)),
        ], now: now)
        #expect(wall.hero?.id == "ablak")
        #expect(wall.rows.map(\.id) == ["feherje", "posta"])
    }

    @Test func theSoonestToExpireWinsItsSlot() {
        let wall = buildWall([
            candidate("kesobb", .expires, expires: at(90)),
            candidate("hamarabb", .expires, expires: at(15)),
        ], now: now)
        #expect(wall.hero?.id == "hamarabb")
    }

    @Test func theHighestRankWinsTheImprovesSlotAndTheNewestTheHappenedSlot() {
        let wall = buildWall([
            candidate("kicsi", .improves, rank: 0.2),
            candidate("nagy", .improves, rank: 0.8),
            candidate("regi", .happened, happened: at(-300)),
            candidate("friss", .happened, happened: at(-5)),
        ], now: now)
        #expect(wall.cards.map(\.id) == ["nagy", "friss"])
    }

    // MARK: - An empty slot shrinks the wall

    @Test func anEmptySlotIsNotRefilledFromALowerRole() {
        let wall = buildWall([
            candidate("feherje", .improves, rank: 0.9),
            candidate("seta", .improves, rank: 0.4),
            candidate("posta", .happened, happened: at(-20)),
        ], now: now)
        // nothing expires today: the wall is two cards, not three padded out of the improves pile
        #expect(wall.cards.map(\.id) == ["feherje", "posta"])
        #expect(wall.hero?.id == "feherje")
    }

    @Test func anExpiredCandidateIsNotWorthSaying() {
        let wall = buildWall([candidate("lejart", .expires, expires: at(-1))], now: now)
        #expect(wall.cards.isEmpty)
        #expect(wall.isQuiet)
    }

    // MARK: - Acting on a card

    @Test func anActedCardLeavesTheWallAndDoesNotComeBack() {
        let all = [candidate("ablak", .expires, expires: at(20)), candidate("posta", .happened, happened: at(-20))]
        let after = buildWall(all, now: now, acted: ["ablak"],
                              settled: [WallSettled(id: "ablak", line: "Ebéd rögzítve", at: now)])
        #expect(after.cards.map(\.id) == ["posta"])
        #expect(after.settledToday.map(\.line) == ["Ebéd rögzítve"])
    }

    @Test func whatHeHasDoneIsNewestFirst() {
        let wall = buildWall([], now: now, settled: [
            WallSettled(id: "a", line: "reggel", at: at(-300)),
            WallSettled(id: "b", line: "most", at: at(-5)),
        ])
        #expect(wall.settledToday.map(\.line) == ["most", "reggel"])
    }

    // MARK: - The quiet wall is good news

    @Test func anEmptyWallSaysSoAndWhenBoopWillSpeakNext() {
        let wall = buildWall([], now: now, nextVoice: "17:00")
        #expect(wall.isQuiet)
        #expect(wall.emptyLine == "Most nincs teendőd. Legközelebb 17:00-kor szólok.")
    }

    @Test func withNothingPlannedItStillSaysSomethingWarm() {
        #expect(buildWall([], now: now).emptyLine == "Most nincs teendőd.")
    }

    @Test func aPendingCheckInMeansTheWallIsNotQuietEvenWithNoCards() {
        let wall = buildWall([], now: now, checkIn: .due(prompt: "Hogy vagy most?", sub: "Fél perc"))
        #expect(!wall.isQuiet)
        #expect(wall.emptyLine == nil)       // there IS something on screen: the question
        #expect(wall.cards.isEmpty)          // and it is not one of the three
    }

    // MARK: - The hero

    @Test func aPhotoDoesNotDecideWhichCardComesFirst() {
        let wall = buildWall([
            candidate("ablak", .expires, expires: at(20)),               // no photo
            candidate("ebed", .improves, rank: 0.9, photo: "csirke"),    // a photo
        ], now: now)
        #expect(wall.hero?.id == "ablak", "a picture is not a reason to put something first")
    }

    // MARK: - Reaching his pocket (decision #35)

    @Test func onlyTheFirstSlotMayRing() {
        let out = wallNotifications([
            candidate("ablak", .expires, expires: at(20)),
            candidate("feherje", .improves, rank: 0.9),
            candidate("posta", .happened, happened: at(-20)),
        ], now: now)
        #expect(out.map(\.id) == ["ablak"])
    }

    @Test func theDailyCapHolds() {
        let out = wallNotifications([
            candidate("a", .expires, expires: at(10)),
            candidate("b", .expires, expires: at(20)),
            candidate("c", .expires, expires: at(30)),
        ], now: now)
        #expect(out.map(\.id) == ["a", "b"], "two a day, soonest first")
    }

    @Test func whatHasAlreadyRungEatsIntoTheCap() {
        let out = wallNotifications([
            candidate("a", .expires, expires: at(10)),
            candidate("b", .expires, expires: at(20)),
        ], now: now, alreadyRang: ["a"])
        #expect(out.map(\.id) == ["b"])
    }

    @Test func boopDoesNotRingForSomethingHeHasAlreadySeenOrDone() {
        let cards = [candidate("a", .expires, expires: at(10)), candidate("b", .expires, expires: at(20))]
        #expect(wallNotifications(cards, now: now, seen: ["a"]).map(\.id) == ["b"])
        #expect(wallNotifications(cards, now: now, acted: ["a", "b"]).isEmpty)
    }

    // MARK: - A new area joins by registering a source

    @Test func aNewAreaAppearsOnTheWallWithNoChangeToTheEngine() {
        var registry = WallRegistry([
            WallSource(id: "etel") { _ in
                [WallCandidate(id: "ablak", role: .expires, kind: .teendo, area: "etel",
                               expiresAt: Date(timeIntervalSince1970: 1_763_301_600),
                               text: "Az ebéd ablaka záródik", settled: "Ebéd rögzítve", why: "mert záródik")]
            }
        ])
        // this is what B5 Edzés, and later Pénz and Levél, will do — nothing else changes
        registry.register(WallSource(id: "edzes") { _ in
            [WallCandidate(id: "edzes-keszulj", role: .improves, kind: .keszulj, area: "edzes", rank: 0.7,
                           text: "Másfél óra múlva edzés", settled: "Edzés-emlékeztető", why: "mert ma edzel")]
        })
        let input = WallInput(now: now, day: now)
        let wall = buildWall(registry.candidates(input), now: now)
        #expect(wall.cards.map(\.area) == ["etel", "edzes"])
        #expect(registry.sources.count == 2)
    }

    @Test func registeringTheSameAreaTwiceReplacesItRatherThanDoublingIt() {
        var registry = WallRegistry([WallSource(id: "etel") { _ in [] }])
        registry.register(WallSource(id: "etel") { _ in
            [WallCandidate(id: "uj", role: .happened, kind: .tortent, area: "etel",
                           happenedAt: Date(timeIntervalSince1970: 1_763_300_000),
                           text: "Ebéd rögzítve", settled: "Ebéd", why: "mert rögzítetted")]
        })
        #expect(registry.sources.count == 1)
        #expect(registry.candidates(WallInput(now: now, day: now)).map(\.id) == ["uj"])
    }

    // MARK: - The same day renders the same way twice

    @Test func tiesBreakOnTheIdSoTheWallDoesNotReshuffleUnderHim() {
        let a = candidate("alma", .improves, rank: 0.5)
        let b = candidate("banan", .improves, rank: 0.5)
        #expect(buildWall([a, b], now: now).hero?.id == buildWall([b, a], now: now).hero?.id)
    }
}

/// What each area hands in (L0/b). The sources are pure, so the awkward cases — a window that has already shut,
/// a day with nothing to say, the Hungarian article — are tests rather than things noticed on the phone.
struct WallSourceTests {
    let now = Date(timeIntervalSince1970: 1_763_300_400)
    var cal: Calendar { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c }

    func plan(_ windows: [PlanWindow], tip: PlanTip? = nil) -> FuelPlan {
        FuelPlan(date: "2026-11-16", windows: windows, remaining: nil, tip: tip)
    }

    @Test func theOpenWindowIsWhatExpires() {
        let at = wallTime(now, calendar: cal)
        _ = at
        let close = wallTime(now.addingTimeInterval(40 * 60), calendar: cal)
        let out = etelWallCandidates(plan: plan([
            PlanWindow(slot: "lunch", label: "Ebéd", from: "12:00", to: close, state: .now),
        ]), now: now, calendar: cal)
        let w = out.first { $0.role == .expires }
        #expect(w != nil)
        #expect(w?.text.hasPrefix("Az *Ebéd*") == true, "Hungarian article: Az ebéd, not A ebéd")
        #expect(w?.expiresAt != nil)
    }

    @Test func aWindowThatHasAlreadyShutIsNotOffered() {
        let past = wallTime(now.addingTimeInterval(-30 * 60), calendar: cal)
        let out = etelWallCandidates(plan: plan([
            PlanWindow(slot: "lunch", label: "Ebéd", from: "11:00", to: past, state: .now),
        ]), now: now, calendar: cal)
        #expect(out.filter { $0.role == .expires }.isEmpty)
    }

    @Test func theServersTipIsNoLongerACardOnTheWall() {
        // Owner, 2026-11-21 (mezo-r36n9.135): the "Következik: …" card is gone; the open window's card says it.
        let out = etelWallCandidates(plan: plan([], tip: PlanTip(text: "Következik: Vacsora, 18:00–20:00.",
                                                                 reason: "A napi 165-ből 115-nél jársz.")),
                                     now: now, calendar: cal)
        #expect(out.allSatisfy { $0.id != "etel-tip" && !$0.text.hasPrefix("Következik") })
    }

    @Test func theLastMealIsWhatHappened() {
        let out = etelWallCandidates(plan: nil, now: now, calendar: cal,
                                     lastMeal: ("Csirkés tál", 46, now.addingTimeInterval(-20 * 60), "csirke"))
        let m = out.first { $0.role == .happened }
        #expect(m?.big == "46")
        #expect(m?.photo == "csirke")
        #expect(m?.kind == .reakcio)
    }

    @Test func anEmptyDayHandsInNothingRatherThanPlaceholders() {
        #expect(etelWallCandidates(plan: nil, now: now, calendar: cal).isEmpty)
    }

    @Test func theArticleIsRightForBothKinds() {
        #expect(hungarianArticle("Ebéd") == "Az")
        #expect(hungarianArticle("Vacsora") == "A")
        #expect(hungarianArticle("Uzsonna") == "Az")
        #expect(hungarianArticle("") == "A")
    }
}
