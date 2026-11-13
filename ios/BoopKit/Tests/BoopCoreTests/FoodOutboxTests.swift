import CoreGraphics
import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers
@testable import BoopCore

/// Computes a canned draft and remembers what it was asked; it has no way to save anything.
actor FakeDrafter: MealDrafting {
    private(set) var asked: [(date: Date, text: String?, photoBytes: Int?, barcode: String?)] = []
    var fail: FoodFetchError?
    func setFail(_ e: FoodFetchError?) { fail = e }
    func draft(date: Date, text: String?, photo: Data?, barcode: String?) async throws -> MealDraft {
        asked.append((date, text, photo?.count, barcode))
        if let fail { throw fail }
        let item = DraftItem(source: .estimate, name: "Csirkemell", amount: 180, unit: "g", per: 100, basisUnit: "g",
                             kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6)
        let f = DateFormatter(); f.calendar = budapest; f.timeZone = budapest.timeZone; f.dateFormat = "yyyy-MM-dd"
        return MealDraft(date: f.string(from: date), slot: "dinner", title: text, items: [item], barcode: barcode, photo: photo)
    }
}

final class FoodOutboxTests {
    let dir = temporaryDirectory()
    let drafter = FakeDrafter()
    /// 13 Nov 00:30 in Budapest = 12 Nov 23:30 UTC: the capture's own day is the 13th, UTC's is the 12th.
    let afterMidnight = budapest.date(from: DateComponents(year: 2026, month: 11, day: 13, hour: 0, minute: 30))!
    let time: TestClock
    init() { time = TestClock(budapest.date(from: DateComponents(year: 2026, month: 11, day: 13, hour: 0, minute: 30))!) }
    deinit { try? FileManager.default.removeItem(at: dir) }

    func make() -> (FoodOutbox, Outbox) {
        let c = time
        let box = Outbox(directory: dir, sender: MealDraftSender(drafter: drafter, directory: dir), clock: { c.now }, calendar: budapest)
        return (FoodOutbox(outbox: box, directory: dir, calendar: budapest), box)
    }

    /// A real 3000 x 2000 image, as PNG bytes.
    func bigImage() throws -> Data {
        let ctx = try #require(CGContext(data: nil, width: 3000, height: 2000, bitsPerComponent: 8, bytesPerRow: 0,
                                         space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        ctx.setFillColor(CGColor(red: 0.8, green: 0.3, blue: 0.2, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: 3000, height: 2000))
        let data = NSMutableData()
        let dest = try #require(CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(dest, try #require(ctx.makeImage()), nil)
        #expect(CGImageDestinationFinalize(dest))
        return data as Data
    }

    @Test func capturedOfflineKeepsItsOwnDateAfterMidnight() async throws {
        let (food, box) = make()
        let id = try await food.enqueueMeal(draft: MealCapture(text: "csirke rizzsel"), photoRef: nil, capturedAt: afterMidnight)
        // The queue item carries the capture's own local day, not UTC's.
        let queued = try #require(await box.queued(id))
        #expect(queued.date == "2026-11-13")
        #expect(queued.capturedAt == afterMidnight)
        // The net returns two days later: the draft is still for the capture's day and instant.
        time.advance(2 * 86_400)
        await food.flush()
        let card = try #require(await food.pendingDrafts().first)
        #expect(card.date == "2026-11-13")
        #expect(card.capturedAt == afterMidnight)
        #expect(await drafter.asked.first?.date == afterMidnight)
        guard case .ready(let draft) = card.state else { Issue.record("expected a confirmation card"); return }
        #expect(draft.date == "2026-11-13")
        // ... and it survives a relaunch with the same instant, to the second.
        let (again, _) = make()
        #expect(await again.pendingDrafts().first?.capturedAt == afterMidnight)
    }

    @Test func photoIsStoredBesideTheQueueNotInThePayload() async throws {
        let (food, box) = make()
        let ref = try food.storePhoto(try bigImage())
        let file = dir.appendingPathComponent("meal-\(ref.uuidString).jpg")
        let stored = try Data(contentsOf: file)
        #expect(stored.starts(with: [0xFF, 0xD8])) // JPEG, whatever came in
        #expect(food.photoData(ref) == stored)
        // Long edge 1600, the other side in proportion.
        let src = try #require(CGImageSourceCreateWithData(stored as CFData, nil))
        let img = try #require(CGImageSourceCreateImageAtIndex(src, 0, nil))
        #expect(max(img.width, img.height) == 1600)
        #expect(img.height == 1067 || img.height == 1066)

        let id = try await food.enqueueMeal(draft: MealCapture(text: nil), photoRef: ref, capturedAt: afterMidnight)
        let payload = try #require(await box.queued(id)).payload
        #expect(payload.count < 400, "the payload names the photo, it does not carry it")
        #expect(try JSONDecoder().decode(MealCapture.self, from: payload).photoRef == ref)
        // The sender reads the stored bytes when it drafts.
        await food.flush()
        #expect(await drafter.asked.first?.photoBytes == stored.count)
    }

    @Test func aSmallPhotoIsNotEnlarged() throws {
        let (food, _) = make()
        let ctx = try #require(CGContext(data: nil, width: 400, height: 300, bitsPerComponent: 8, bytesPerRow: 0,
                                         space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        let data = NSMutableData()
        let dest = try #require(CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(dest, try #require(ctx.makeImage()), nil); CGImageDestinationFinalize(dest)
        let ref = try food.storePhoto(data as Data)
        let stored = try #require(food.photoData(ref))
        let src = try #require(CGImageSourceCreateWithData(stored as CFData, nil))
        let img = try #require(CGImageSourceCreateImageAtIndex(src, 0, nil))
        #expect(img.width == 400)
    }

    @Test func anUnreadablePhotoIsRefusedAtOnce() {
        let (food, _) = make()
        #expect(throws: FoodOutboxError.unreadablePhoto) { try food.storePhoto(Data("not an image".utf8)) }
    }

    @Test func flushProducesAConfirmationCardNotASavedMeal() async throws {
        let (food, box) = make()
        let ref = try food.storePhoto(try bigImage())
        let id = try await food.enqueueMeal(draft: MealCapture(text: "vacsora"), photoRef: ref, capturedAt: afterMidnight)
        // While the net is away it is just waiting, with its values.
        await drafter.setFail(.offline)
        await food.flush()
        var card = try #require(await food.pendingDrafts().first)
        #expect(card.id == id && card.text == "vacsora" && card.hasPhoto)
        #expect(card.state == .waiting)
        // The net returns: the draft is computed and handed over as a card; the queue is empty, nothing was saved.
        await drafter.setFail(nil)
        await food.flush()
        card = try #require(await food.pendingDrafts().first)
        guard case .ready(let draft) = card.state else { Issue.record("expected a confirmation card"); return }
        #expect(draft.items.count == 1 && draft.photo == nil)
        #expect(await box.queue.isEmpty)
        #expect(await drafter.asked.count == 2)
        // Only the owner's decision removes it — and its photo with it.
        await food.discard(id)
        #expect(await food.pendingDrafts().isEmpty)
        #expect(food.photoData(ref) == nil)
    }

    @Test func aBarcodeCaptureCarriesItsCode() async throws {
        let (food, _) = make()
        _ = try await food.enqueueMeal(draft: MealCapture(text: nil, barcode: "5998200312458"), photoRef: nil, capturedAt: afterMidnight)
        await food.flush()
        guard case .ready(let draft)? = await food.pendingDrafts().first?.state else { Issue.record("no card"); return }
        #expect(draft.barcode == "5998200312458")
    }

    @Test func itemOlderThanSevenDaysIsShownAsFailedWithItsValues() async throws {
        let (food, _) = make()
        let id = try await food.enqueueMeal(draft: MealCapture(text: "régi vacsora"), photoRef: nil, capturedAt: afterMidnight)
        time.advance(8 * 86_400)
        await food.flush()
        let card = try #require(await food.pendingDrafts().first)
        #expect(card.id == id)
        #expect(card.text == "régi vacsora")
        #expect(card.capturedAt == afterMidnight)
        guard case .failed(let why) = card.state else { Issue.record("expected failed"); return }
        #expect(!why.isEmpty)
        #expect(await drafter.asked.isEmpty, "the server would refuse it, so it was never sent")
    }

    @Test func aRefusedDraftWaitsForRetryWithItsValues() async throws {
        let (food, _) = make()
        await drafter.setFail(.rejected)
        let id = try await food.enqueueMeal(draft: MealCapture(text: "x"), photoRef: nil, capturedAt: afterMidnight)
        await food.flush()
        guard case .failed? = await food.pendingDrafts().first?.state else { Issue.record("expected failed"); return }
        await drafter.setFail(nil)
        await food.retry(id)
        guard case .ready? = await food.pendingDrafts().first?.state else { Issue.record("expected a card after Újra"); return }
    }
}
