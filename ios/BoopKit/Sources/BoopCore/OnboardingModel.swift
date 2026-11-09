import Foundation
import Observation
import BoopAPI

public enum OnboardingError: Error, Equatable { case offline, server, unauthorized, field(String) }

/// First-run steps against the backend: profile → first weight → onboarding-complete.
/// Resumes where it stopped (the profile endpoint answers 200 with all-null fields when none exists).
@MainActor @Observable
public final class OnboardingModel {
    public enum Step: Equatable { case loading, failed, profile, weight, finishing }
    public private(set) var step: Step = .loading
    public private(set) var problem: OnboardingError?

    @ObservationIgnored private var weightSaved = false
    @ObservationIgnored private let client: Client
    @ObservationIgnored private let onFinished: () async -> Void

    public init(client: Client, onFinished: @escaping () async -> Void) {
        self.client = client
        self.onFinished = onFinished
    }

    public func start() async {
        problem = nil
        step = .loading
        do {
            let profile = try await client.getBiometricProfile()
            if case .unauthorized = profile { throw OnboardingError.unauthorized }
            guard case .ok(let ok) = profile else { throw OnboardingError.server }
            guard try ok.body.json.sex != nil else { step = .profile; return }
            let list = try await client.listWeightLogs()
            if case .unauthorized = list { throw OnboardingError.unauthorized }
            guard case .ok(let logs) = list else { throw OnboardingError.server }
            if try logs.body.json.isEmpty { step = .weight } else { try await finish() }
        } catch {
            problem = map(error)
            step = .failed          // never fall back to the profile form: its defaults would overwrite saved data
        }
    }

    public func saveProfile(sex: String, heightCm: Double, birthDate: Date, calendar: Calendar = .current) async throws {
        problem = nil
        do {
            let body = Components.Schemas.BiometricProfileUpsertRequest(sex: sex, heightCm: heightCm, birthDate: localDay(birthDate, calendar: calendar))
            switch try await client.upsertBiometricProfile(body: .json(body)) {
            case .ok: step = .weight
            case .unauthorized: throw OnboardingError.unauthorized
            case .badRequest(let r): throw OnboardingError.field((try? r.body.json.first?.message) ?? "Ellenőrizd az adatokat.")
            default: throw OnboardingError.server
            }
        } catch { problem = map(error); throw problem! }
    }

    public func saveWeight(_ kg: Double, now: Date = Date(), calendar: Calendar = .current) async throws {
        problem = nil
        do {
            if weightSaved { try await finish(); return }    // retry after a failed onboarding-complete: don't log twice
            let rounded = (kg * 10).rounded() / 10
            switch try await client.logWeight(body: .json(.init(date: localDay(now, calendar: calendar), weightKg: rounded))) {
            case .created:
                weightSaved = true
                try await finish()
            case .unauthorized: throw OnboardingError.unauthorized
            case .badRequest(let r): throw OnboardingError.field((try? r.body.json.first?.message) ?? "Ellenőrizd a súlyt.")
            default: throw OnboardingError.server
            }
        } catch { problem = map(error); throw problem! }
    }

    private func finish() async throws {
        let done = try await client.completeOnboarding()
        if case .unauthorized = done { throw OnboardingError.unauthorized }
        guard case .noContent = done else { throw OnboardingError.server }
        step = .finishing
        await onFinished()
    }

    private func map(_ error: Error) -> OnboardingError {
        if let e = error as? OnboardingError { return e }
        return isNetworkFailure(error) ? .offline : .server
    }
}

public func onboardingText(_ e: OnboardingError) -> String {
    switch e {
    case .offline: hungarianText(AuthError.offline)
    case .server: hungarianText(AuthError.server)
    case .unauthorized: "Lejárt a belépésed. Lépj be újra."
    case .field(let t): t
    }
}
