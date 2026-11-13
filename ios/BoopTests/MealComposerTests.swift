import CoreGraphics
import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers
import BoopCore
@testable import Boop

/// Drafts a canned meal (or fails on cue) and counts; a separate counter says how often the owner's tap reached a save.
actor MealCalls {
    var drafted = 0, saved: [(UUID, Date)] = []
    var failDraft: FoodFetchError?, failSave: FoodFetchError?
    var photoLands = true
    func setPhotoLands(_ on: Bool) { photoLands = on }
    func setFailDraft(_ e: FoodFetchError?) { failDraft = e }
    func setFailSave(_ e: FoodFetchError?) { failSave = e }
    func draft() throws { drafted += 1; if let failDraft { throw failDraft } }
    func save(_ ref: UUID, _ at: Date) throws { saved.append((ref, at)); if let failSave { throw failSave } }
}

struct MealDrafter: MealDrafting {
    let calls: MealCalls
    func draft(date: Date, text: String?, photo: Data?, barcode: String?) async throws -> MealDraft {
        try await calls.draft()
        let rice = DraftItem(source: .estimate, name: "Barna rizs", amount: 180, unit: "g", per: 100, basisUnit: "g",
                             kcal: 123, proteinG: 2.7, carbsG: 26, fatG: 1, confidence: 0.5, needsReview: true)
        return MealDraft(date: "2026-11-13", slot: "dinner", title: text, items: [rice], photo: photo)
    }
}

@MainActor
struct MealComposerTests {
    let calls = MealCalls()
    let dir: URL = {
        let d = FileManager.default.temporaryDirectory.appendingPathComponent("boop-composer-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()
    let moment = Date(timeIntervalSince1970: 1_794_000_000)

    private func box() -> FoodOutbox {
        let drafter = MealDrafter(calls: calls)
        let outbox = Outbox(directory: dir, sender: MealDraftSender(drafter: drafter, directory: dir))
        return FoodOutbox(outbox: outbox, directory: dir)
    }

    private func model(online: Bool = true, outbox: FoodOutbox? = nil, clock: Date? = nil) -> MealComposerModel {
        let c = calls
        let now = clock ?? moment
        return MealComposerModel(
            drafter: MealDrafter(calls: calls),
            saver: { d, ref, at in
                try await c.save(ref, at)
                let lands = await c.photoLands
                return BoopCore.Meal(id: UUID(), slot: d.slot, loggedAt: at, mealDate: d.date, title: d.title,
                                     macros: d.total, score: nil, hasPhoto: d.photo != nil && lands)
            },
            outbox: outbox ?? box(), online: { online }, clock: { now })
    }

    private func png() throws -> Data {
        let ctx = try #require(CGContext(data: nil, width: 2400, height: 1800, bitsPerComponent: 8, bytesPerRow: 0,
                                         space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        let data = NSMutableData()
        let dest = try #require(CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(dest, try #require(ctx.makeImage()), nil); CGImageDestinationFinalize(dest)
        return data as Data
    }

    @Test func onlineDraftIsNotSavedUntilTheOwnersTap() async {
        let m = model()
        m.text = "csirke rizzsel"
        await m.submit()
        #expect(m.stage == .draft)
        #expect(await calls.saved.isEmpty, "a draft alone saves nothing")
        guard case .saved(let toast) = await m.save() else { Issue.record("save failed"); return }
        #expect(toast.contains("rögzítve"))
        #expect(await calls.saved.count == 1)
        #expect(await calls.saved.first?.1 == moment, "the meal carries the instant it was captured")
    }

    @Test func noNetKeepsTheCaptureOnThePhoneWithItsPhoto() async throws {
        let outbox = box()
        let m = model(online: false, outbox: outbox)
        await m.setPhoto(try png())
        #expect(m.hasPhoto)
        await m.submit()
        #expect(m.stage == .queued)
        #expect(m.chip?.hasPrefix("Nincs net") == true)
        #expect(await calls.drafted == 0, "the phone knows it has no net, so it does not even try")
        let card = try #require(await outbox.pendingDrafts().first)
        #expect(card.state == .waiting && card.hasPhoto && card.capturedAt == moment)
        #expect(await calls.saved.isEmpty)
    }

    @Test func aNetThatDiesDuringTheCallQueuesIt() async {
        await calls.setFailDraft(.offline)
        let outbox = box()
        let m = model(outbox: outbox)
        m.text = "vacsora"
        await m.submit()
        #expect(m.stage == .queued)
        #expect(await outbox.pendingDrafts().first?.text == "vacsora")
    }

    @Test func aModelThatIsDownQueuesItToo() async {
        await calls.setFailDraft(.unavailable)
        let m = model()
        m.text = "vacsora"
        await m.submit()
        #expect(m.stage == .queued)
        #expect(m.chip?.contains("számolni") == true)
    }

    @Test func aRefusedDraftIsSaidAndNothingIsQueued() async {
        await calls.setFailDraft(.rejected)
        let outbox = box()
        let m = model(outbox: outbox)
        m.text = "vacsora"
        await m.submit()
        #expect(m.stage == .pick && m.problem != nil)
        #expect(await outbox.pendingDrafts().isEmpty)
    }

    @Test func aFailedSaveKeepsTheDraftAndRetriesWithTheSameKey() async {
        let m = model()
        m.text = "vacsora"
        await m.submit()
        await calls.setFailSave(.offline)
        guard case .failed = await m.save() else { Issue.record("expected a failure"); return }
        #expect(m.draft != nil)
        await calls.setFailSave(nil)
        _ = await m.save()
        let refs = await calls.saved.map(\.0)
        #expect(refs.count == 2 && refs[0] == refs[1], "a retry after a lost answer must be the same meal")
    }

    @Test func savingAConfirmationCardRemovesIt() async throws {
        let outbox = box()
        let id = try await outbox.enqueueMeal(draft: MealCapture(text: "vacsora"), photoRef: nil, capturedAt: moment)
        await outbox.flush()
        let card = try #require(await outbox.pendingDrafts().first)
        let m = model(outbox: outbox)
        m.adopt(card, photo: nil)
        #expect(m.stage == .draft && m.cardId == id)
        _ = await m.save()
        #expect(await calls.saved.first?.0 == id, "the card's id is the save's key")
        #expect(await outbox.pendingDrafts().isEmpty)
    }

    private func gradedPhotoModel(_ outbox: FoodOutbox) async throws -> MealComposerModel {
        let m = model(outbox: outbox)
        await m.setPhoto(try png())
        m.text = "vacsora"
        await m.submit()
        return m
    }

    @Test func anOnlineDraftIsOnDiskBeforeAnySaveIsTried() async throws {
        let outbox = box()
        _ = try await gradedPhotoModel(outbox)   // the model is dropped: a swipe-dismiss, a kill
        let card = try #require(await box().pendingDrafts().first)
        guard case .ready = card.state else { Issue.record("expected a parked card"); return }
        #expect(card.hasPhoto)
        #expect(await calls.saved.isEmpty)
    }

    @Test func aFailedSaveLeavesTheCardWithItsPhoto() async throws {
        let outbox = box()
        let m = try await gradedPhotoModel(outbox)
        await calls.setFailSave(.offline)
        guard case .failed = await m.save() else { Issue.record("expected failure"); return }
        let card = try #require(await outbox.pendingDrafts().first)
        #expect(card.hasPhoto)
        guard case .ready = card.state else { Issue.record("expected ready"); return }
    }

    @Test func aSaveWhosePhotoDidNotGoUpKeepsThePhotoAndSaysSo() async throws {
        await calls.setPhotoLands(false)
        let outbox = box()
        let m = try await gradedPhotoModel(outbox)
        guard case .saved(let toast) = await m.save() else { Issue.record("save failed"); return }
        #expect(toast.contains("fotó"))
        let card = try #require(await outbox.pendingDrafts().first)
        guard case .photoWaiting = card.state else { Issue.record("expected photoWaiting"); return }
        #expect(outbox.photoData(try #require(card.photoRef)) != nil)
    }

    @Test func aSaveWithItsPhotoOnTheServerLeavesNothingBehind() async throws {
        let outbox = box()
        let m = try await gradedPhotoModel(outbox)
        _ = await m.save()
        #expect(await outbox.pendingDrafts().isEmpty)
    }

    @Test func cancellingAParkedDraftRemovesIt() async throws {
        let outbox = box()
        let m = try await gradedPhotoModel(outbox)
        await m.discardCard()
        #expect(await outbox.pendingDrafts().isEmpty)
    }

    @Test func aFailedCaptureOpensWithItsTextAndPhotoAndReplacesItself() async throws {
        let outbox = box()
        await calls.setFailDraft(.rejected)
        let ref = try outbox.storePhoto(try png())
        let id = try await outbox.enqueueMeal(draft: MealCapture(text: "régi vacsora"), photoRef: ref, capturedAt: moment)
        await outbox.flush()
        let card = try #require(await outbox.pendingDrafts().first)
        await calls.setFailDraft(nil)
        let m = model(outbox: outbox)
        m.adoptFailed(card, photo: outbox.photoData(ref))
        #expect(m.text == "régi vacsora" && m.hasPhoto && m.capturedAt == moment)
        await m.submit()
        #expect(m.stage == .draft)
        #expect(await outbox.pendingDrafts().contains { $0.id == id } == false, "the old failed card is replaced")
    }

    @Test func aCaptureTooOldForTheServerIsDatedToday() async throws {
        let outbox = box()
        let eightDays = moment.addingTimeInterval(8 * 86_400)
        let id = try await outbox.enqueueMeal(draft: MealCapture(text: "régi"), photoRef: nil, capturedAt: moment)
        let m = model(outbox: outbox, clock: eightDays)
        let c = Calendar.current.dateComponents([.year, .month, .day], from: moment)
        let day = String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
        let card = PendingDraft(id: id, capturedAt: moment, date: day, text: "régi", barcode: nil, photoRef: nil, state: .failed("x"))
        m.adoptFailed(card, photo: nil)
        #expect(m.redated)
        await m.submit()
        #expect(m.capturedAt == eightDays)
    }

    @Test func linesAreEditableAndTheTotalFollows() async {
        let m = model()
        m.text = "rizs"
        await m.submit()
        #expect(Int(m.draft?.total.kcal ?? 0) == 221)
        m.setAmount(0, 90)
        #expect(Int(m.draft?.total.kcal ?? 0) == 110)
        m.remove(0)
        #expect(m.draft?.items.isEmpty == true && !m.canSave)
    }

    @Test func aPickedPhotoIsShrunkToTheServersLimit() async throws {
        let m = model()
        await m.setPhoto(try png())
        let photo = try #require(m.photo)
        let src = try #require(CGImageSourceCreateWithData(photo as CFData, nil))
        let img = try #require(CGImageSourceCreateImageAtIndex(src, 0, nil))
        #expect(max(img.width, img.height) == 1600)
    }

    @Test func anUnreadablePictureIsSaid() async {
        let m = model()
        await m.setPhoto(Data("nope".utf8))
        #expect(m.problem != nil && !m.hasPhoto)
    }
}

struct DraftNoticeTests {
    private func draft(lookupSource: LookupSource? = nil, lookupFailed: Bool = false, barcode: String? = "5998200312458",
                       items: [DraftItem] = [DraftItem(source: .estimate, name: "x", amount: 1, unit: "g", per: 1, basisUnit: "g",
                                                       kcal: 1, proteinG: 0, carbsG: 0, fatG: 0)]) -> MealDraft {
        MealDraft(date: "2026-11-13", slot: "lunch", title: nil, items: items, barcode: barcode,
                  lookupSource: lookupSource, lookupFailed: lookupFailed)
    }

    @Test func aFailedLookupAndAnUnknownProductAreDifferentSentences() throws {
        let failed = try #require(draftNotice(draft(lookupFailed: true)))
        let unknown = try #require(draftNotice(draft(lookupSource: LookupSource.none)))
        #expect(failed != unknown)
        #expect(failed.contains("nem értem el") || failed.contains("nem azt jelenti"))
        #expect(unknown.contains("nem ismerem"))
    }

    @Test func aBarcodeNeverLookedUpIsNotCalledUnknown() {
        #expect(draftNotice(draft(lookupSource: nil)) == nil)
    }

    @Test func aFoundProductAndALookupNeverMadeSayNothing() {
        #expect(draftNotice(draft(lookupSource: .off)) == nil)
        #expect(draftNotice(draft(lookupSource: .catalog)) == nil)
        #expect(draftNotice(draft(lookupSource: nil, barcode: nil)) == nil)
    }

    @Test func aDraftWithNoFoodSaysSo() {
        #expect(draftNotice(draft(barcode: nil, items: [])) != nil)
    }

    @Test func badgesNeverReadSilenceAsSafe() {
        let profile = SensitivityProfile(items: [SensitivityItem(key: "milk", level: .intolerance, note: nil)],
                                         novaRule: NovaRule(enabled: true, maxLevel: 2))
        let estimate = DraftItem(source: .estimate, name: "joghurt", amount: 100, unit: "g", per: 100, basisUnit: "g",
                                 kcal: 60, proteinG: 4, carbsG: 5, fatG: 3)
        #expect(draftBadges(for: estimate, profile: profile).isEmpty)
        #expect(draftHasUnknownAllergens(draft(items: [estimate]), profile: profile))
        var scanned = estimate; scanned.allergens = ["milk": .contains]; scanned.nova = 4
        let texts = draftBadges(for: scanned, profile: profile).map(\.text)
        #expect(texts.contains { $0.contains("Tej") && $0.contains("tartalmazza") })
        #expect(texts.contains("Ultra-feldolgozott"))
    }
}

