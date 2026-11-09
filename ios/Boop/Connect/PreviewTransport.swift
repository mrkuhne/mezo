#if DEBUG
import Foundation
import HTTPTypes
import OpenAPIRuntime

/// Simulator review only (`-preview shell|onboarding`): the Wearable endpoints answer success locally,
/// so the connect flow can be walked without a server (the Mac's firewall blocks the simulator app).
struct PreviewTransport: ClientTransport {
    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        try await Task.sleep(for: .milliseconds(400))
        if request.method == .put { return (HTTPResponse(status: .noContent), nil) }
        var h = HTTPFields(); h[.contentType] = "application/json"
        return (HTTPResponse(status: .ok, headerFields: h), HTTPBody(#"{"inserted":0,"updated":0}"#))
    }
}
#endif
