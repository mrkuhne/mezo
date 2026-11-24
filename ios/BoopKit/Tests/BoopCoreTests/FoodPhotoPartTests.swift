import Foundation
import Testing
@testable import BoopCore

/// The meal photo on the wire (`mezo-r36n9.151`): the server takes a photo part only when it says it is an image
/// (`image/jpeg`); a part without a type is refused with 400, so the draft never arrives and a saved meal never gets
/// its picture. Both multipart writes must name the type.
struct FoodPhotoPartTests {
    let stub = StubTransport()
    let tokens = MemoryTokenStore()

    func food() throws -> FoodClient {
        try tokens.write("t0")
        let tz = TimeZone(identifier: "Europe/Budapest")!
        var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
        return FoodClient(client: makeClient(tokens: tokens, transport: stub, timeZone: tz), calendar: cal)
    }

    @Test func draftSendsThePhotoPartAsJpeg() async throws {
        stub.on("draftMealFromAi", .json(200, #"{"draftId":"11111111-1111-1111-1111-111111111111","slot":"lunch","title":"x","items":[]}"#))
        _ = try await food().draft(date: Date(), text: "ebéd", photo: Data("JPEGBYTES".utf8), barcode: nil)
        let body = try #require(stub.sent.last?.body).lowercased()
        #expect(body.contains(#"name="photo""#))
        #expect(body.contains(#"name="text""#))
        #expect(body.components(separatedBy: "content-type: image/jpeg").count - 1 == 1)
        #expect(!body.contains("application/octet-stream"))
    }

    @Test func attachPhotoSendsTheJpegType() async throws {
        stub.on("putMealPhoto", .json(200, #"{"bytes":9,"width":4,"height":3}"#))
        try await food().attachPhoto(Data("JPEGBYTES".utf8), mealId: UUID())
        let body = try #require(stub.sent.last?.body).lowercased()
        #expect(body.contains(#"name="photo""#))
        #expect(body.contains("content-type: image/jpeg"))
        #expect(!body.contains("application/octet-stream"))
    }
}
