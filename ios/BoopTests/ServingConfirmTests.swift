import CoreGraphics
import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers
import BoopCore
@testable import Boop

/// B4 Task 11: a scanned product becomes a line only through the serving confirmation, and a code nobody knows is kept
/// for the label photo instead of being dropped.
private func yogurt(servingQuantity: Double? = nil, servingSize: String? = nil) -> LookupItem {
    LookupItem(name: "Görög joghurt 2%", brand: "Milli", barcode: "5998200312458", per: 100, unit: "g",
               kcal: 73, proteinG: 9, carbsG: 4, fatG: 2, fiberG: nil, sugarG: nil, saltG: nil, saturatedFatG: nil,
               nova: nil, allergens: ["milk": .contains], servingSize: servingSize, servingQuantity: servingQuantity)
}

private actor Seen {
    var barcodes: [String?] = []
    func note(_ b: String?) { barcodes.append(b) }
}

private struct SeenDrafter: MealDrafting {
    let seen: Seen
    func draft(date: Date, text: String?, photo: Data?, barcode: String?) async throws -> MealDraft {
        await seen.note(barcode)
        return MealDraft(date: "2026-11-13", slot: "snack", title: nil, items: [], barcode: barcode, photo: photo,
                         lookupSource: barcode == nil ? nil : LookupSource.none)
    }
}

struct ServingConfirmTests {
    @Test func convertsPer100gToGrams() {
        var c = ServingConfirmation(facts: yogurt(servingQuantity: 170, servingSize: "170 g"))
        #expect(c.mode == .serving)
        #expect(c.amount == FoodAmount(amount: 170, unit: "g"))
        #expect(abs(c.kcal - 124.1) < 0.01 && abs(c.proteinG - 15.3) < 0.01)

        c.mode = .grams; c.grams = 250
        #expect(abs(c.kcal - 182.5) < 0.01 && abs(c.proteinG - 22.5) < 0.01)

        c.mode = .basis
        #expect(c.amount == FoodAmount(amount: 100, unit: "g"))
        #expect(abs(c.kcal - 73) < 0.01)

        let line = c.line()
        #expect(line.amount == 100 && line.unit == "g" && line.per == 100 && line.basisUnit == "g")
        #expect(line.allergens == ["milk": .contains] && line.source == .estimate && !line.needsReview)
    }

    @Test func defaultsToGramsWhenTheServingSizeIsMissing() {
        // A CATALOG hit carries no serving fields at all; OpenFoodFacts sometimes gives a text size but no quantity.
        for facts in [yogurt(), yogurt(servingQuantity: nil, servingSize: "1 doboz"), yogurt(servingQuantity: 0)] {
            let c = ServingConfirmation(facts: facts)
            #expect(c.mode == .grams)
            #expect(c.grams == 100)
            #expect(!c.modes.contains(.serving))
            #expect(c.modes == [.basis, .grams])
        }
        #expect(ServingConfirmation(facts: yogurt(servingQuantity: 40)).modes == [.basis, .serving, .grams])
    }

    @Test func aMissingNutrientIsNotAZero() {
        var facts = yogurt(); facts.kcal = nil
        let c = ServingConfirmation(facts: facts)
        #expect(c.line().needsReview)
    }

    @Test func rejectsNonsenseGrams() {
        var c = ServingConfirmation(facts: yogurt())
        c.mode = .grams; c.grams = 0
        #expect(!c.canConfirm)
        c.grams = 1200
        #expect(c.canConfirm)
        c.grams = 100_000
        #expect(!c.canConfirm)
    }

    @Test func typedCodesAreCleanedAndChecked() {
        #expect(BarcodeCode.clean(" 5998 2003-12458 ") == "5998200312458")
        #expect(BarcodeCode.clean("12345") == nil)
        #expect(BarcodeCode.clean("59982003124581234567") == nil)
        #expect(BarcodeCode.clean("abc") == nil)
        #expect(BarcodeCode.clean("96385074") == "96385074")
    }

    @Test @MainActor func lookupSortsIntoFoundMissAndFailed() async {
        let hit = LookupResult(source: .off, results: [yogurt()])
        let none = LookupResult(source: .none, results: [])
        let model = BarcodeScanModel(lookup: { code in
            switch code {
            case "5998200312458": return hit
            case "0000000000000": return none
            default: throw FoodFetchError.offline
            }
        })
        await model.submit("5998200312458")
        #expect(model.state == .found(yogurt(), .off, code: "5998200312458"))
        await model.submit("0000000000000")
        #expect(model.state == .miss(code: "0000000000000"))
        await model.submit("1111111111116")
        #expect(model.state == .failed(code: "1111111111116", offline: true))
    }

    @Test @MainActor func unknownBarcodeOffersTheLabelPhotoCarryingTheCode() async {
        let model = BarcodeScanModel(lookup: { _ in LookupResult(source: .none, results: []) })
        await model.submit("5998200312458")
        guard case .miss(let code) = model.state else { Issue.record("a nobody-knows-it code must be a miss"); return }
        #expect(code == "5998200312458")
        #expect(model.state.labelPhotoCode == "5998200312458")

        // The composer takes the code along: the label photo's draft is asked for with that very barcode.
        let seen = Seen()
        let composer = MealComposerModel(
            drafter: SeenDrafter(seen: seen),
            saver: { _, _, _ in throw FoodFetchError.server }, outbox: nil, online: { true })
        composer.carryCode(code)
        #expect(composer.barcode == code)
        await composer.setPhoto(Self.jpeg())
        #expect(composer.canSubmit)
        await composer.submit()
        #expect(await seen.barcodes == [code])
        #expect(composer.draft?.barcode == code)
    }

    @Test func theSensitivityLineNamesWhatTouchesTheListAndNeverCallsSilenceSafe() {
        let profile = SensitivityProfile(items: [SensitivityItem(key: "milk", level: .intolerance, note: nil)],
                                         novaRule: NovaRule(enabled: false, maxLevel: 4))
        let line = scanSensitivityLine(yogurt(), profile: profile)
        #expect(line?.contains("Tej") == true && line?.contains("Rögzíteni tudod, csak szólok") == true)

        var silent = yogurt(); silent.allergens = [:]
        #expect(scanSensitivityLine(silent, profile: profile)?.contains("nincs allergén-adat") == true)

        var clear = yogurt(); clear.allergens = ["gluten": .unknown, "milk": .unknown]
        #expect(scanSensitivityLine(clear, profile: profile) == nil)
        #expect(scanSensitivityLine(yogurt(), profile: nil) == nil)
    }

    private static func jpeg() -> Data {
        let ctx = CGContext(data: nil, width: 64, height: 64, bitsPerComponent: 8, bytesPerRow: 0,
                            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.setFillColor(CGColor(red: 0.8, green: 0.5, blue: 0.2, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
        let out = NSMutableData()
        let dest = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil)!
        CGImageDestinationAddImage(dest, ctx.makeImage()!, nil); CGImageDestinationFinalize(dest)
        return out as Data
    }
}
