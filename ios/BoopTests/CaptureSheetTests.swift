import Testing
import BoopCore
@testable import Boop

/// The "+" sheet after the owner's quick-log ask (2026-11-24, `mezo-r36n9.154`): the web's nine doors plus the cash
/// expense, every one real, and the meal chips as before.
struct CaptureSheetTests {
    @Test func theNineDoorsPlusTheExpense() {
        #expect(CaptureSheet.doors.map(\.title) == ["Víz", "Kiegészítők", "Edzés indítása", "Sport", "Súly", "Check-in",
                                                    "Napló", "Alvás", "Kiadás"])
        #expect(CaptureSheet.foodChips.map(\.title) == ["Fotó", "Szöveg", "Vonalkód", "Recept", "Kamra"])
    }

    @Test func everyDoorOpensSomethingReal() {
        let byTitle = Dictionary(uniqueKeysWithValues: CaptureSheet.doors.map { ($0.title, $0.pick) })
        #expect(byTitle["Víz"] == .quick(.water))
        #expect(byTitle["Kiegészítők"] == .quick(.supplements))
        #expect(byTitle["Edzés indítása"] == .area(.mozgas))
        #expect(byTitle["Sport"] == .quick(.sport))
        #expect(byTitle["Súly"] == .quick(.weight))
        #expect(byTitle["Check-in"] == .cover(.checkin))
        #expect(byTitle["Napló"] == .quick(.journal))
        #expect(byTitle["Alvás"] == .quick(.sleep))
        #expect(byTitle["Kiadás"] == .penzExpense)
        #expect(Set(QuickLog.allCases).count == 6)
    }

    @Test func quickSheetsSayTheirAmountsInHisUnits() {
        #expect(waterLabel(100) == "1 dl" && waterLabel(750) == "7,5 dl" && WaterSheet.amounts == [100, 200, 300, 500, 750])
        #expect(kgText(81.4) == "81,4 kg")
        #expect(sleepHoursText(7.58) == "7 ó 35 p")
    }
}
