import Foundation
import BoopAPI

public enum AuthError: Error, Equatable {
    case badCredentials, inviteInvalid, emailTaken, field(name: String, text: String), offline, server
}

/// Maps an error status + the backend's SystemMessage list to an AuthError.
func authError(status: Int, messages: [Components.Schemas.SystemMessage]) -> AuthError {
    let first = messages.first
    switch (status, first?.code) {
    case (401, _): return .badCredentials
    case (409, "AUTH_INVITE_INVALID"?): return .inviteInvalid
    case (409, "AUTH_EMAIL_TAKEN"?): return .emailTaken
    case (400, _):
        if let f = messages.first(where: { $0._type == .FIELD && $0.fieldName != nil }) {
            return .field(name: f.fieldName!, text: f.message ?? "Ellenőrizd ezt a mezőt.")
        }
        return .server
    default: return .server
    }
}

public func hungarianText(_ e: AuthError) -> String {
    switch e {
    case .badCredentials: "Hibás e-mail cím vagy jelszó."
    case .inviteInvalid: "Ez a meghívókód nem érvényes, vagy már felhasználták."
    case .emailTaken: "Ezzel az e-mail címmel már van fiók. Lépj be inkább."
    case .offline: "Nem érem el a szervert. Nézd meg a netet, és próbáld újra."
    case .server: "Valami félrement a szerveren. Próbáld újra pár perc múlva."
    case .field(_, let text): text
    }
}
