import Foundation
import Testing
import BoopAPI

@Test func decodesMeResponse() throws {
    let json = #"{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444","email":"teszt@pelda.hu","name":"Teszt","role":"USER","onboarded":false,"mustChangePassword":false,"timezone":"Europe/Budapest","language":"hu"}"#
    let me = try JSONDecoder().decode(Components.Schemas.MeResponse.self, from: Data(json.utf8))
    #expect(me.onboarded == false)
    #expect(me.language == .hu)
    #expect(me.timezone == "Europe/Budapest")
}
