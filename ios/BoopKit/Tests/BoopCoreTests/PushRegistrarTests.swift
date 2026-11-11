import Foundation
import Testing
import OpenAPIRuntime
@testable import BoopCore

struct PushRegistrarTests {
    func registrar(_ stub: StubTransport, ids: any DeviceIdStore = MemoryDeviceIdStore()) -> PushRegistrar {
        let client = makeClient(tokens: MemoryTokenStore("t0"), transport: stub)
        return PushRegistrar(client: client, ids: ids, environment: .sandbox, bundleId: "io.mrkuhne.boop", appVersion: "1.2")
    }

    @Test func hexIsLowercaseTwoDigits() {
        #expect(PushRegistrar.hex(Data([0x00, 0x0a, 0xff, 0x10])) == "000aff10")
    }

    @Test func registerPutsTokenAndMetadata() async throws {
        let stub = StubTransport(); stub.on("registerApnsDevice", .status(204))
        let ids = MemoryDeviceIdStore()
        let ok = await registrar(stub, ids: ids).register(token: Data(repeating: 0xab, count: 32))
        #expect(ok)
        let body = try #require(stub.sent.first?.body)
        #expect(body.contains(String(repeating: "ab", count: 32)))
        #expect(body.contains("sandbox") && body.contains("io.mrkuhne.boop") && body.contains("1.2"))
        #expect(body.lowercased().contains(ids.deviceId().uuidString.lowercased()))
        #expect(stub.sent.first?.auth == "Bearer t0")
    }

    @Test func unregisterDeletesTheDeviceId() async {
        let stub = StubTransport(); stub.on("unregisterApnsDevice", .status(204))
        let ids = MemoryDeviceIdStore()
        let ok = await registrar(stub, ids: ids).unregister()
        #expect(ok)
        #expect(stub.sent.first?.path.lowercased().hasSuffix(ids.deviceId().uuidString.lowercased()) == true)
    }

    @Test func deviceIdIsStableAcrossRegistrars() async {
        let ids = MemoryDeviceIdStore()
        let a = StubTransport(); a.on("registerApnsDevice", .status(204))
        let b = StubTransport(); b.on("registerApnsDevice", .status(204))
        _ = await registrar(a, ids: ids).register(token: Data(repeating: 1, count: 32))
        _ = await registrar(b, ids: ids).register(token: Data(repeating: 2, count: 32))
        let first = a.sent.first?.body ?? "", second = b.sent.first?.body ?? ""
        let id = ids.deviceId().uuidString.lowercased()
        #expect(first.lowercased().contains(id) && second.lowercased().contains(id))
    }

    @Test func failuresAreSwallowed() async {
        let stub = StubTransport()
        stub.on("registerApnsDevice", .fail(URLError(.notConnectedToInternet)))
        stub.on("unregisterApnsDevice", .status(500))
        let r = registrar(stub)
        #expect(await r.register(token: Data(repeating: 1, count: 32)) == false)
        #expect(await r.unregister() == false)
    }
}
