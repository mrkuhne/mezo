import Foundation
import Testing
@testable import BoopCore

@MainActor
struct OnboardingModelTests {
    let stub = StubTransport()
    var finished = Box()
    final class Box { var count = 0 }

    func model() -> OnboardingModel {
        let f = finished
        return OnboardingModel(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub)) { f.count += 1 }
    }
    var budapest: Calendar { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c }
    let emptyProfile = #"{"sex":null,"heightCm":null,"birthDate":null,"bodyFatPct":null,"activityLevel":null,"tdeeBootstrap":null}"#
    let fullProfile = #"{"sex":"M","heightCm":182,"birthDate":"1990-05-12","bodyFatPct":null,"activityLevel":null,"tdeeBootstrap":null}"#

    @Test func startWithoutProfileGoesToProfile() async {
        stub.on("getBiometricProfile", .json(200, emptyProfile))
        let m = model(); await m.start()
        #expect(m.step == .profile)
    }

    @Test func startWith401ReportsUnauthorized() async {
        stub.on("getBiometricProfile", .json(401, #"[{"code":"AUTH_UNAUTHORIZED","type":"REQUEST"}]"#))
        let m = model(); await m.start()
        #expect(m.problem == .unauthorized)
    }

    @Test func startWithProfileResumesAtWeight() async {
        stub.on("getBiometricProfile", .json(200, fullProfile)); stub.on("listWeightLogs", .json(200, "[]"))
        let m = model(); await m.start()
        #expect(m.step == .weight)
    }

    @Test func startWithProfileAndWeightFinishes() async {
        stub.on("getBiometricProfile", .json(200, fullProfile))
        stub.on("listWeightLogs", .json(200, #"[{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444","date":"2026-11-09","value":82.4}]"#))
        stub.on("completeOnboarding", .status(204))
        let m = model(); await m.start()
        #expect(stub.ops == ["getBiometricProfile", "listWeightLogs", "completeOnboarding"])
        #expect(finished.count == 1)
    }

    @Test func saveProfileSendsContractFields() async throws {
        stub.on("upsertBiometricProfile", .json(200, fullProfile))
        let m = model()
        let birth = budapest.date(from: DateComponents(year: 1990, month: 5, day: 12, hour: 0, minute: 30))!
        try await m.saveProfile(sex: "M", heightCm: 182, birthDate: birth, calendar: budapest)
        let body = try #require(stub.sent.last?.body)
        let json = try JSONSerialization.jsonObject(with: Data(body.utf8)) as! [String: Any]
        #expect(json["sex"] as? String == "M")
        #expect(json["heightCm"] as? Double == 182)
        #expect(json["birthDate"] as? String == "1990-05-12")
        #expect(m.step == .weight)
    }

    @Test func saveWeightPostsLocalDayAndNumber() async throws {
        stub.on("logWeight", .json(201, #"{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444","date":"2026-11-09","value":82.4}"#))
        stub.on("completeOnboarding", .status(204))
        let m = model()
        let late = budapest.date(from: DateComponents(year: 2026, month: 11, day: 9, hour: 23, minute: 30))!
        try await m.saveWeight(82.4, now: late, calendar: budapest)
        let body = try #require(stub.sent.first?.body)
        let json = try JSONSerialization.jsonObject(with: Data(body.utf8)) as! [String: Any]
        #expect(json["date"] as? String == "2026-11-09")
        #expect(json["weightKg"] as? Double == 82.4)
    }

    @Test func saveWeightCompletesOnboardingInOrder() async throws {
        stub.on("logWeight", .json(201, #"{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444","date":"2026-11-09","value":82.4}"#))
        stub.on("completeOnboarding", .status(204))
        let m = model()
        try await m.saveWeight(82.4, now: Date(), calendar: budapest)
        #expect(stub.ops == ["logWeight", "completeOnboarding"])
        #expect(finished.count == 1)
        #expect(m.step == .finishing)
    }
}
