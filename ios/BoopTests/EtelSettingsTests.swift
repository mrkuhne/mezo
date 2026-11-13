import Foundation
import Testing
import BoopCore
@testable import Boop

/// The three settings pages of the Étel room (B4 Task 14): what he avoids, the day's rhythm, and the skip + kímélő sheet.
@MainActor
struct EtelSettingsTests {
    let transport = ScriptedTransport()
    private var food: FoodClient { FoodClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)) }

    // MARK: Amit kerülök

    private let empty = #"{"items":[],"novaRule":{"enabled":false,"maxLevel":4}}"#

    @Test func theTwoRulesTheSliceKeysOffAreSavedLowercaseAndWithTheirLevels() async {
        transport.on("getSensitivityProfile", 200, empty)
        transport.on("setSensitivityProfile") { body in (200, body) }
        let e = SensitivityEditor(food: food)
        await e.load()
        e.setLevel(.intolerance, for: "milk")
        e.setNova(enabled: true, maxLevel: 2)
        #expect(e.dirty)
        #expect(await e.save() == "Elmentettem — innentől ezek szerint jelzek.")
        let sent = transport.compactBodies("setSensitivityProfile")[0]
        #expect(sent.contains(#""key":"milk""#) && sent.contains(#""level":"intolerance""#))
        #expect(sent.contains(#""enabled":true"#) && sent.contains(#""maxLevel":2"#))
        #expect(!e.dirty)
    }

    @Test func aLevelCanBeChangedAndTakenBackAndFreeTextIsLowercasedWithoutDuplicates() async {
        transport.on("getSensitivityProfile", 200, #"{"items":[{"key":"milk","level":"intolerance"}],"novaRule":{"enabled":true,"maxLevel":2}}"#)
        let e = SensitivityEditor(food: food)
        await e.load()
        #expect(e.level(for: "milk") == .intolerance && e.level(for: "gluten") == nil)   // not set is not "free of"
        e.setLevel(.allergy, for: "milk")
        #expect(e.level(for: "milk") == .allergy)
        e.setLevel(nil, for: "milk")
        #expect(e.draft?.items.isEmpty == true)
        #expect(e.addFreeText("  FODMAP ") == nil)
        #expect(e.draft?.items.map(\.key) == ["fodmap"])
        #expect(e.addFreeText("fodmap") != nil)        // already there
        #expect(e.addFreeText("Tej") != nil)           // a structured allergen is set on its chip, not typed
        #expect(e.addFreeText("   ") != nil)
        #expect(e.freeText.map(\.key) == ["fodmap"])
        #expect(sensitivityName("fodmap") == "Fodmap" && sensitivityName("milk") == "Tej")   // capitalised for display only
    }

    @Test func rulesThatCouldNotBeReadAreNeverEditedOrOverwrittenWithAnEmptyList() async {
        transport.on("getSensitivityProfile", 500)
        let e = SensitivityEditor(food: food)
        await e.load()
        #expect(e.draft == nil && e.problem != nil)
        e.setLevel(.avoid, for: "milk")
        #expect(e.draft == nil)
        #expect(await e.save().isEmpty == false)
        #expect(transport.count("setSensitivityProfile") == 0)
    }

    // MARK: Napi ritmus

    @Test func theDefaultRhythmReadsThreeMealsAndTwoSnacksAndTheCutoffRoundTrips() async {
        #expect(rhythmSummary(5) == "3 étkezés + 2 nasi")
        #expect(rhythmSummary(3) == "3 étkezés, nasi nélkül")
        #expect(rhythmSummary(6) == "3 étkezés + 3 nasi")
        #expect(cutoffMinutes("14:00") == 14 * 60 && cutoffMinutes("7:5") == nil && cutoffMinutes("25:00") == nil)
        #expect(cutoffText(minutes: 14 * 60 + 5) == "14:05")

        transport.on("getFuelSettings", 200, #"{"mealsPerDay":5,"caffeineCutoff":"14:00"}"#)
        transport.on("setFuelSettings") { body in (200, body) }
        let m = RhythmModel(food: food)
        await m.load()
        #expect(m.meals == 5 && m.cutoff == "14:00" && !m.dirty)
        m.meals = 4; m.cutoff = "13:30"
        #expect(await m.save() == "Elmentettem — a napirendet újraszámolom.")
        let sent = transport.compactBodies("setFuelSettings")[0]
        #expect(sent.contains(#""mealsPerDay":4"#) && sent.contains(#""caffeineCutoff":"13:30""#))
    }

    // MARK: Kihagyás + kímélő mód

    private func plan(_ day: String = "2026-11-13") -> FuelPlan {
        func w(_ slot: String, _ label: String, _ from: String, _ to: String, kcal: Double) -> PlanWindow {
            PlanWindow(slot: slot, kind: slot == "snack" ? .snack : .meal, label: label, from: from, to: to,
                       budget: Macros(kcal: kcal, p: 40, c: 70, f: 20), state: .pending, loggedMealIds: [])
        }
        return FuelPlan(date: day, windows: [w("lunch", "Ebéd", "12:00", "14:00", kcal: 700), w("snack", "Tízórai", "10:00", "11:00", kcal: 200),
                                             w("snack", "Uzsonna", "16:00", "17:00", kcal: 200), w("dinner", "Vacsora", "19:00", "21:00", kcal: 700)],
                        remaining: nil, tip: nil)
    }

    @Test func theReasonChipsMapToTheServersReasonsAndOnlyEgyebCarriesText() {
        #expect(skipChips.map(\.label) == ["Nem vagyok éhes", "Nincs időm", "Gyomorrontás", "Beteg vagyok", "Úton vagyok", "Egyéb"])
        #expect(skipChips.map(\.reason) == [.notHungry, .noTime, .stomach, .illness, .travel, .other])
    }

    @Test func skippingAWindowWritesTheMealSkipWithItsReasonAndSaysWhatLeftTheDay() async {
        transport.on("upsertPlannedSkip") { body in (200, #"{"id":"22249a7e-d8f9-44c4-9a7e-93b03cd0c12e","date":"2026-11-13","kind":"MEAL","reasonCategory":"NOT_HUNGRY","source":"USER","serious":false,"freePass":false,"excused":false}"#) }
        let p = plan()
        let toast = await skipWindow(p.windows[3], in: p, reason: .notHungry, text: "", food: food).text
        #expect(toast == "Vacsora kihagyva · Nem vagyok éhes · 700 kcal kiesett a napból")
        let sent = transport.compactBodies("upsertPlannedSkip")[0]
        #expect(sent.contains(#""sessionKey":"dinner#1""#) && sent.contains(#""kind":"MEAL""#) && sent.contains(#""plannedKcal":700"#))
        #expect(sent.contains(#""reasonCategory":"NOT_HUNGRY""#))
        // the second snack is the second window of its kind
        _ = await skipWindow(p.windows[2], in: p, reason: .other, text: "Orvosi vizsgálat", food: food)
        let other = transport.compactBodies("upsertPlannedSkip")[1]
        #expect(other.contains(#""sessionKey":"snack#2""#) && other.contains(#""reasonText":"Orvosi vizsgálat""#))
    }

    @Test func aSkipWithNoReasonIsAllowedAndARefusedOneIsSaid() async {
        transport.on("upsertPlannedSkip", 200, #"{"id":"22249a7e-d8f9-44c4-9a7e-93b03cd0c12e","date":"2026-11-13","kind":"MEAL","reasonCategory":"NONE","source":"USER","serious":false,"freePass":false,"excused":false}"#)
        let p = plan()
        #expect(await skipWindow(p.windows[0], in: p, reason: nil, text: "", food: food).text.hasPrefix("Ebéd kihagyva"))
        #expect(transport.compactBodies("upsertPlannedSkip")[0].contains(#""reasonCategory":"NONE""#))
        transport.on("upsertPlannedSkip", 500)
        let refused = await skipWindow(p.windows[0], in: p, reason: nil, text: "", food: food)
        #expect(!refused.ok && refused.text.contains("Nem sikerült"))
    }

    private let noRecovery = #"{"protectedDates":[]}"#
    private func recovery(start: String, category: String = "STOMACH") -> String {
        #"{"period":{"id":"22249a7e-d8f9-44c4-9a7e-93b03cd0c12e","category":"\#(category)","estimate":"TODAY","startDate":"\#(start)","dayIndex":1,"estimateExpired":false,"checkedInToday":false,"releasedDates":[],"releasedUnlightened":[]},"protectedDates":["\#(start)"]}"#
    }

    @Test func kimeloModeIsOpenedForTheDayAndTakenBackInOneTap() async throws {
        let f = food
        transport.on("getRecovery", 200, noRecovery)
        transport.on("upsertRecovery", 200, recovery(start: f.ymd(Date())))
        #expect(try await f.recovery() == nil)
        try await f.startKimelo(.stomach)
        let sent = transport.compactBodies("upsertRecovery")[0]
        #expect(sent.contains(#""category":"STOMACH""#) && sent.contains(#""estimate":"TODAY""#))

        // started today: "Tévedés volt" (the check-in answer BETTER is refused on the start day)
        transport.on("getRecovery", 200, recovery(start: f.ymd(Date())))
        transport.on("deleteRecovery", 204)
        let today = try #require(try await f.recovery())
        try await f.endKimelo(today, today: Date())
        #expect(transport.count("deleteRecovery") == 1 && transport.count("recoveryCheckIn") == 0)

        // started days ago: "Jobban vagyok"
        transport.on("recoveryCheckIn", 200, noRecovery)
        let older = KimeloPeriod(category: "ILLNESS", startDate: "2026-11-10", dayIndex: 4)
        try await f.endKimelo(older, today: Date())
        #expect(transport.compactBodies("recoveryCheckIn")[0].contains(#""answer":"BETTER""#))
    }

    @Test func theStoreTurnsKimeloOnAndOffAndSaysWhichKindIsAlreadyOpen() async {
        transport.on("getFuelDay", 200, #"{"date":"2026-11-13","targets":{"kcal":0,"p":0,"c":0,"f":0,"water":2500},"consumed":{"kcal":0,"p":0,"c":0,"f":0,"water":0},"meals":[],"fuelMode":"GUIDANCE","recoveryCategory":"STOMACH","skippedKcal":0}"#)
        transport.on("getFuelPlan", 200, #"{"date":"2026-11-13","windows":[]}"#)
        transport.on("getMealCoachForDay", 200, #"{"verdicts":[]}"#)
        transport.on("getProtocol", 200, #"{"history":[]}"#)
        transport.on("getPantry", 200, #"{"ingredients":[],"imports":[],"suggestions":[],"stash":[]}"#)
        let s = EtelStore()
        await s.load(food: food, now: Date())
        #expect(s.day?.fuelMode == "GUIDANCE")
        transport.on("getRecovery", 200, recovery(start: food.ymd(Date())))
        transport.on("deleteRecovery", 204)
        #expect(await s.endKimelo().text == "A kímélő mód kikapcsolva — újra számolom a keretet.")
        #expect(transport.count("deleteRecovery") == 1)

        transport.on("getRecovery", 200, recovery(start: "2026-11-12", category: "INJURY"))
        transport.on("upsertRecovery", 200, recovery(start: "2026-11-13"))
        // an open injury period is not turned into an illness by a tap
        let again = await s.startKimelo(.illness)
        #expect(!again.ok && again.text.contains("már be van kapcsolva"))
        #expect(transport.count("upsertRecovery") == 0)
    }

    // MARK: travel, and the way back from a skip

    @Test func travelIsOneOfTheKimeloChoicesAndItsSentenceDoesNotClaimThereIsNoTarget() {
        #expect(kimeloChoices.map(\.reason) == [.illness, .stomach, .travel])
        #expect(kimeloSentence("TRAVEL").contains("becsülöm") && !kimeloSentence("TRAVEL").contains("nincs kalóriacél"))
        #expect(kimeloSentence("ILLNESS").contains("nincs kalóriacél"))
        #expect(kimeloSentence("INJURY").contains("szinten"))
        #expect(kimeloWord("TRAVEL") == "úton vagy")
    }

    @Test func aSkippedWindowCanBeTakenBackAndItsBudgetReturns() async throws {
        let f = food
        let p = plan()
        transport.on("listPlannedSkips", 200, #"[{"id":"22249a7e-d8f9-44c4-9a7e-93b03cd0c12e","date":"2026-11-13","kind":"MEAL","sessionKey":"snack#2","reasonCategory":"NONE","source":"USER","serious":false,"freePass":false,"excused":false},{"id":"33349a7e-d8f9-44c4-9a7e-93b03cd0c12e","date":"2026-11-13","kind":"MEAL","sessionKey":"dinner#1","reasonCategory":"NONE","source":"USER","serious":false,"freePass":false,"excused":false}]"#)
        transport.on("undoPlannedSkip", 204)
        try await f.undoSkip(window: p.windows[3], in: p)
        #expect(transport.count("undoPlannedSkip") == 1)
        // the right row: dinner#1 (33349a7e), not the snack
        #expect(transport.pathsOf("undoPlannedSkip")[0].hasSuffix("33349a7e-d8f9-44c4-9a7e-93b03cd0c12e"))
        let out = await undoSkipWindow(p.windows[2], in: p, food: f)
        #expect(out.ok && out.text == "Uzsonna újra a tervedben")
        #expect(transport.pathsOf("undoPlannedSkip")[1].hasSuffix("22249a7e-d8f9-44c4-9a7e-93b03cd0c12e"))
        // a window with no live skip is simply already planned again
        transport.on("listPlannedSkips", 200, "[]")
        #expect(await undoSkipWindow(p.windows[0], in: p, food: f).ok)
        transport.on("listPlannedSkips", 500)
        let failed = await undoSkipWindow(p.windows[0], in: p, food: f)
        #expect(!failed.ok && failed.text.contains("Nem sikerült"))
    }
}
