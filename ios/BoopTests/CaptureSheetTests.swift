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

    /// The home screen's five doors (owner 2026-11-24, `mezo-r36n9.157`): the frequent five, in his order, each one tap.
    @Test func homeDoorsAreTheFiveFrequentOnes() {
        #expect(KezdolapView.doors.map(\.label) == ["ÉTKEZÉS", "VÍZ", "SÚLY", "CHECK-IN", "NAPLÓ"])
        #expect(KezdolapView.doors.map(\.pick) == [.meal(.pick, text: ""), .quick(.water), .quick(.weight), .cover(.checkin), .quick(.journal)])
        #expect(KezdolapView.doors.map(\.glyph) == ["bowl-cream", "drop-sky", "scale-ink", "spark-cream", "book-sage"])
    }

    @Test func everyHomeDoorIsAlsoOnTheSheet() {
        let onSheet = Set(CaptureSheet.doors.map { "\($0.pick)" })
        for d in KezdolapView.doors {
            if case .meal = d.pick { continue }   // the meal card itself is on the sheet
            #expect(onSheet.contains("\(d.pick)"), "\(d.label) is not a sheet door")
        }
    }

    @Test func quickSheetsSayTheirAmountsInHisUnits() {
        #expect(waterLabel(100) == "1 dl" && waterLabel(750) == "7,5 dl" && WaterSheet.amounts == [100, 200, 300, 500, 750])
        #expect(kgText(81.4) == "81,4 kg")
        #expect(sleepHoursText(7.58) == "7 ó 35 p")
    }
}
