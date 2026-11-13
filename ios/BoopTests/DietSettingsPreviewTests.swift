import Foundation
import Testing
import BoopCore
@testable import Boop

/// The Étrend-beállítások page (B4 Task 14): the owner sees the day targets a draft WOULD give before he saves it.
@MainActor
struct DietSettingsPreviewTests {
    let transport = ScriptedTransport()

    private let saved = #"{"splitPreset":"balanced","proteinTier":"moderate","waterMl":2500,"fiberG":30,"dayTypeShiftKcal":0,"learningEnabled":true}"#

    private func model() -> DietSettingsModel {
        transport.on("getDietSettings", 200, saved)
        transport.on("previewDietSettings") { body in
            // the projection follows the draft that was posted: a higher protein tier projects more protein
            let high = compactJSON(body).contains(#""proteinTier":"high""#)
            return (200, #"{"kcal":2650,"proteinG":\#(high ? 205 : 170),"carbsG":280,"fatG":75,"source":"goal"}"#)
        }
        transport.on("setDietSettings") { body in (200, body) }
        return DietSettingsModel(food: FoodClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)))
    }

    @Test func previewShowsProjectedTargetsBeforeSaving() async {
        let m = model()
        await m.load()
        #expect(m.draft?.proteinTier == "moderate")
        await m.refreshPreview()
        #expect(m.preview?.proteinG == 170)

        m.draft?.proteinTier = "high"
        await m.refreshPreview()
        #expect(m.preview?.proteinG == 205 && m.preview?.kcal == 2650)
        #expect(transport.compactBodies("previewDietSettings").last?.contains(#""proteinTier":"high""#) == true)
        // nothing is saved by looking: the save is the owner's own tap
        #expect(transport.count("setDietSettings") == 0)
        #expect(m.dirty)

        #expect(await m.save() == "Elmentettem — a célokat újraszámolom.")
        #expect(transport.count("setDietSettings") == 1)
        #expect(transport.compactBodies("setDietSettings").last?.contains(#""proteinTier":"high""#) == true)
        #expect(!m.dirty)
    }

    @Test func aCustomSplitThatDoesNotAddUpTo100IsNeitherPreviewedNorSaved() async {
        let m = model()
        await m.load()
        m.draft?.splitPreset = "custom"
        m.draft?.proteinPctX10 = 300; m.draft?.carbsPctX10 = 400; m.draft?.fatPctX10 = 250
        #expect(m.splitProblem != nil)
        #expect(!m.canSave)
        await m.refreshPreview()
        #expect(transport.count("previewDietSettings") == 0)
        _ = await m.save()
        #expect(transport.count("setDietSettings") == 0)
        m.draft?.fatPctX10 = 300
        #expect(m.splitProblem == nil && m.canSave)
        await m.refreshPreview()
        #expect(transport.count("previewDietSettings") == 1)
    }

    @Test func settingsThatCouldNotBeReadAreNeverEditedOrOverwritten() async {
        transport.on("getDietSettings", 500)
        let m = DietSettingsModel(food: FoodClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport)))
        await m.load()
        #expect(m.draft == nil && m.problem != nil)
        #expect(await m.save().isEmpty == false)
        #expect(transport.count("setDietSettings") == 0)
    }

    @Test func aPreviewThatFailsSaysSoAndKeepsTheLastNumbersOff() async {
        let m = model()
        await m.load()
        await m.refreshPreview()
        transport.on("previewDietSettings", 500)
        m.draft?.proteinTier = "low"
        await m.refreshPreview()
        #expect(m.preview == nil && m.previewProblem != nil)   // never the old numbers under a new draft
        #expect(m.canSave)                                     // the save does not depend on the look
    }
}
