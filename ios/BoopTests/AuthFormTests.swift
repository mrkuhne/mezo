import Testing
@testable import Boop

struct AuthFormTests {
    let valid = AuthForm(invite: "MEZO-7Q2K", email: "teszt@pelda.hu", password: "titkos123", name: "Teszt Elek")

    @Test func validRegisterFormHasNoProblems() {
        #expect(valid.problems(register: true).isEmpty)
    }

    @Test func eachRuleHasItsText() {
        var f = valid; f.invite = ""
        #expect(f.problems(register: true)[.invite] == "Írd be a meghívókódot.")
        f = valid; f.invite = String(repeating: "A", count: 33)
        #expect(f.problems(register: true)[.invite] == "Írd be a meghívókódot.")
        f = valid; f.email = "teszt@pelda"
        #expect(f.problems(register: true)[.email] == "Ez nem tűnik e-mail címnek.")
        f = valid; f.email = "tesztpelda.hu"
        #expect(f.problems(register: true)[.email] == "Ez nem tűnik e-mail címnek.")
        f = valid; f.password = "1234567"
        #expect(f.problems(register: true)[.password] == "Legalább 8 karakter legyen.")
        f = valid; f.password = String(repeating: "x", count: 73)
        #expect(f.problems(register: true)[.password] == "Legfeljebb 72 karakter lehet.")
        f = valid; f.name = "   "
        #expect(f.problems(register: true)[.name] == "Írd be a neved.")
    }

    @Test func nameIsTrimmed() {
        var f = valid; f.name = "  Teszt Elek  "
        #expect(f.trimmedName == "Teszt Elek")
        #expect(f.problems(register: true).isEmpty)
    }

    @Test func signInChecksOnlyEmailAndPassword() {
        let f = AuthForm(invite: "", email: "teszt@pelda.hu", password: "x", name: "")
        #expect(f.problems(register: false).isEmpty)
        #expect(AuthForm(invite: "", email: "rossz", password: "", name: "").problems(register: false).keys.sorted() == [.email, .password])
    }
}

struct AuthCopyTests {
    @Test func authCopyIsBoop() {
        #expect(!AuthCopy.all.isEmpty)
        for s in AuthCopy.all { #expect(!s.contains("Mezo"), "\(s)") }
        #expect(AuthCopy.signInTitle == "Jó újra látni")
        #expect(AuthCopy.registerTitle == "Kezdjük el")
    }
}
