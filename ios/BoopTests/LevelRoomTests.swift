import Foundation
import Testing
@testable import Boop
import BoopCore
import BoopDesign

@Suite("Levél room — what the page shows")
@MainActor
struct LevelRoomTests {
    private let now = ISO8601DateFormatter().date(from: "2026-11-21T09:30:00Z")!   // 10:30 Budapest

    @Test func headVerdictForZeroOneAndManyWorthAMinute() {
        let none = levelHead(LevelDigest(arrived: 12, worthAMinute: 0, handled: 12))
        #expect(none.verdict == "Nincs teendőd")
        let one = levelHead(LevelDigest(arrived: 5, worthAMinute: 1, handled: 4))
        #expect(one.verdict == "Egy dolgot nézz meg")
        let many = levelHead(LevelDigest(arrived: 34, worthAMinute: 2, handled: 31))
        #expect(many.verdict == "Két dolgot nézz meg")
        #expect(many.sentence.contains("34 levél") && many.sentence.contains("31-et elintéztem"))
    }

    @Test func statTilesAreExactlyTheDigestsCounts() {
        let d = LevelDigest(lastRunAt: now, arrived: 34, worthAMinute: 2, handled: 31)
        let s = levelStats(d)
        #expect(s.map(\.value) == ["34", "31", "2"])
        #expect(s.map(\.label) == ["érkezett reggel óta", "elintéztem helyetted", "megér egy percet"])
        #expect(s[2].hot && !s[0].hot)
    }

    @Test func afternoonRunSaysToday() {
        let afternoon = ISO8601DateFormatter().date(from: "2026-11-21T14:05:00Z")!   // 15:05 Budapest
        #expect(levelStats(LevelDigest(lastRunAt: afternoon, arrived: 3))[0].label == "érkezett ma")
    }

    @Test func disconnectedMailboxIsTheGuideNotAnError() {
        #expect(levelMailboxMode(LevelMailbox(state: .none)) == .needsConnect)
        #expect(levelMailboxMode(LevelMailbox(state: .disconnected)) == .needsConnect)
        #expect(levelMailboxMode(LevelMailbox(state: .authFailed)) == .authFailed)
        #expect(levelMailboxMode(LevelMailbox(state: .silent)) == .connected(silent: true))
        #expect(levelMailboxMode(nil) == .unknown)
        let w = levelHeadWords(tab: .ma, mailbox: LevelMailbox(state: .none), digest: nil, digestState: .idle)
        #expect(w.verdict == "Még nincs postafiókod")
        let revoked = levelHeadWords(tab: .ma, mailbox: LevelMailbox(state: .authFailed), digest: nil, digestState: .idle)
        #expect(revoked.verdict == "A Google nem enged be")
        let failed = levelHeadWords(tab: .ma, mailbox: LevelMailbox(state: .connected), digest: nil, digestState: .failed(.offline))
        #expect(failed.verdict == "Most nem érem el a postát" && failed.sentence.contains("Nincs net"))
        let loading = levelHeadWords(tab: .ma, mailbox: LevelMailbox(state: .connected), digest: nil, digestState: .loading)
        #expect(loading.verdict == "Átnézem a postát")
        let day = levelHeadWords(tab: .ma, mailbox: LevelMailbox(state: .connected), digest: LevelDigest(arrived: 34, worthAMinute: 2, handled: 31), digestState: .loaded)
        #expect(day.verdict == "Két dolgot nézz meg")
        #expect(levelHeadWords(tab: .figyelt, mailbox: nil, digest: nil, digestState: .idle).verdict == "Még nem figyelek semmit")
    }

    @Test func sensitiveRowsRenderTheSenderOnly() {
        let bank = LevelItem(id: "s1", group: .sensitive, title: "Terhelés 48 200 Ft", summary: "Kártyás vásárlás", why: "x",
                             fromName: "A bankod", fromAddress: "bank@example.com", receivedAt: now)
        let person = LevelItem(id: "p1", group: .person, title: "Szombati terv", fromName: "Kiss Réka", receivedAt: now)
        let rows = levelPeopleRows(LevelDigest(people: [person], sensitive: [bank]))
        #expect(rows.map(\.id) == ["p1", "s1"], "people first, then the sensitive ones")
        let s = rows[1]
        #expect(s.title == "A bankod írt")
        for shown in [s.title, s.sub, s.right] {
            #expect(!shown.contains("48") && !shown.contains("Terhelés") && !shown.contains("Kártyás"))
        }
        #expect(s.sub == "Nem olvastam el · megnyitás a Gmailben")
    }

    @Test func aSenderWithNoNameShowsItsAddressThenAPlainWord() {
        #expect(levelSender(LevelItem(id: "a", group: .sensitive, title: "", fromAddress: "x@example.com")) == "x@example.com")
        #expect(levelSender(LevelItem(id: "b", group: .sensitive, title: "")) == "Ismeretlen feladó")
    }

    @Test func serverTextCannotLightTheHueWithAsterisks() {
        #expect(levelPlain("Most *ingyen*") == "Most ingyen")
        let face = levelDealFace(LevelItem(id: "d", group: .deal, title: "*Akció*", why: "a *b*", score: 8, screen: .clean), now: now)
        #expect(face.title == "Akció" && face.why == "a b")
    }

    @Test func dealFaceUsesServerWordsAndNeverPricesAScorelessOrFlaggedCard() {
        let clean = LevelItem(id: "d1", group: .deal, title: "T", why: "W", score: 9, screen: .clean)
        #expect(levelDealFace(clean, now: now).score == 9, "a score already given is shown even on a rules-only day")
        var unscored = clean; unscored.score = nil
        #expect(levelDealFace(unscored, now: now).score == nil)
        let bad = LevelItem(id: "d2", group: .deal, title: "T", why: "W", score: 9, screen: .flagged, flagged: true)
        #expect(levelDealFace(bad, now: now).warning)
        #expect(!levelDealFace(clean, now: now).warning)
    }

    @Test func validLeftReadsTheServersDeadline() {
        let midnight = ISO8601DateFormatter().date(from: "2026-11-21T22:59:00Z")!     // 23:59 Budapest
        #expect(levelValidLeft(midnight, now: now) == "Ma éjfélig")
        let evening = ISO8601DateFormatter().date(from: "2026-11-21T17:00:00Z")!      // 18:00
        #expect(levelValidLeft(evening, now: now) == "Ma 18:00-ig")
        let tomorrow = ISO8601DateFormatter().date(from: "2026-11-22T11:00:00Z")!
        #expect(levelValidLeft(tomorrow, now: now) == "Holnap 12:00-ig")
        #expect(levelValidLeft(nil, now: now) == "")
    }

    @Test func deadlineRowsCarryTheMarkAndTheAmount() {
        let due = ISO8601DateFormatter().date(from: "2026-11-22T11:00:00Z")!
        let bill = LevelItem(id: "k", group: .deadline, title: "Áramszámla", summary: "Esedékes", dueAt: due, amountMinor: 1_482_000, currency: "HUF", screen: .none)
        let rows = levelDueMarkRows([bill], now: now)
        #expect(rows.count == 1)
        #expect(rows[0].mark == "holnap" && rows[0].soon)
        #expect(rows[0].markSub == "14\u{00A0}820 Ft")
    }

    @Test func parcelStatesGetTheirOwnWords() {
        let items = [LevelItem(id: "1", group: .parcel, title: "A", parcelState: .today),
                     LevelItem(id: "2", group: .parcel, title: "B", parcelState: .pickup),
                     LevelItem(id: "3", group: .parcel, title: "C", parcelState: .inTransit)]
        #expect(levelParcelRows(items).map(\.mark) == ["ma érkezik", "átvehető", "úton"])
        #expect(levelParcelRows(items).map(\.soon) == [true, false, false])
    }

    @Test func rulesOnlyNoteTellsCapFromFailure() {
        #expect(levelRulesNote(LevelDigest(rulesOnly: true, rulesOnlyReason: .cap)) == "Ma már nem pontoztam tovább — a többit szabályok szerint rendeztem.")
        #expect(levelRulesNote(LevelDigest(rulesOnly: true, rulesOnlyReason: .failure)) == "Ma nem tudtam pontozni — a többit szabályok szerint rendeztem.")
        #expect(levelRulesNote(LevelDigest(rulesOnly: false, rulesOnlyReason: .cap)) == nil)
        #expect(levelRulesNote(nil) == nil)
    }

    @Test func heatStripIsTheServersSlotsAndNeverInvented() {
        #expect(levelHeat(LevelDigest(heatSlots: [])) == nil)
        #expect(levelHeat(LevelDigest(heatSlots: Array(repeating: 0, count: 12))) == nil)
        let slots = [0, 0, 0, 1, 12, 6, 0, 0, 0, 0, 0, 0]
        let h = levelHeat(LevelDigest(heatSlots: slots))!
        #expect(h.cells.count == 12 && h.cells[4].0 == "8" && h.cells[4].1 == 1 && h.cells[5].1 == 0.5)
        #expect(h.note == "A legtöbb levél *8 és 10* között jön.")
    }

    @Test func gmailLinkIsTheMessageThenTheAppThenTheWeb() {
        let urls = levelGmailURLs(messageId: "1845026571234567890")
        #expect(urls.count == 3)
        #expect(urls[0].absoluteString == "googlegmail:///cv=" + String(UInt64("1845026571234567890")!, radix: 16))
        #expect(urls[1].absoluteString == "googlegmail://")
        #expect(urls[2].absoluteString == "https://mail.google.com/")
        #expect(levelGmailURLs(messageId: nil).map(\.absoluteString) == ["https://mail.google.com/"])
        #expect(levelGmailURLs(messageId: "  ").map(\.absoluteString) == ["https://mail.google.com/"])
        #expect(levelGmailURLs(messageId: "1a2b3c").first?.absoluteString == "googlegmail:///cv=1a2b3c")
    }

    @Test func rulesEditsKeepSeedRulesAndOnlyTouchTheOwnersList() {
        let rules = LevelRules(sensitive: [LevelRule(pattern: "Bank", origin: .seed), LevelRule(pattern: "Fogász", origin: .owner)],
                               silent: [LevelRule(pattern: "Divat", origin: .owner)],
                               always: [LevelRule(pattern: "Réka", origin: .owner)])
        let added = levelRulesAdding(rules, .sensitive, pattern: "  Uj Bolt ")!
        #expect(added.sensitive == ["Fogász", "Uj Bolt"], "the seed row is the server's, not sent back")
        #expect(added.silent == ["Divat"] && added.always == ["Réka"])
        #expect(levelRulesAdding(rules, .sensitive, pattern: "fogász") == nil, "already there")
        #expect(levelRulesAdding(rules, .sensitive, pattern: "   ") == nil)
        let removed = levelRulesRemoving(rules, .silent, pattern: "Divat")!
        #expect(removed.silent.isEmpty && removed.sensitive == ["Fogász"])
        #expect(levelRulesAdding(nil, .silent, pattern: "x") == nil)
        #expect(levelRulesRemoving(rules, .silent, pattern: "divat")?.silent.isEmpty == true, "removal matches like add: case-insensitive")
    }

    @Test func fiokokStatesFollowTheMailboxAndTheClientId() {
        let id = "1-a.apps.googleusercontent.com"
        #expect(levelFiokokView(nil) == .unknown)
        #expect(levelFiokokView(LevelMailbox(state: .none, googleClientId: id)) == .signIn(canSignIn: true))
        #expect(levelFiokokView(LevelMailbox(state: .none, googleClientId: nil)) == .signIn(canSignIn: false))
        #expect(levelFiokokView(LevelMailbox(state: .disconnected, googleClientId: "")) == .signIn(canSignIn: false))
        #expect(levelFiokokView(LevelMailbox(state: .authFailed, kind: .google, googleClientId: id)) == .revoked(canSignIn: true))
        #expect(levelFiokokView(LevelMailbox(address: "a@b.hu", state: .connected, kind: .google)) == .connected(silent: false))
        #expect(levelFiokokView(LevelMailbox(address: "a@b.hu", state: .silent, kind: .google)) == .connected(silent: true))
    }

    @Test func googleOutcomesHaveFixedWords() {
        #expect(levelGoogleOutcomeLine(.connected) == nil)
        #expect(levelGoogleOutcomeLine(.refused) == "A Google nem engedte a belépést")
        #expect(levelGoogleOutcomeLine(.notConfigured) == "A Google-belépés még nincs beállítva a szerveren.")
        #expect(levelGoogleOutcomeLine(.offline) == levelErrorText(.offline))
        #expect(levelDetachMessage.contains("visszavonom"))
    }

    @Test func lastRunLineIsCountedFromTheServersFigures() {
        let m = LevelMailbox(address: "b@example.com", state: .connected,
                             lastRunAt: ISO8601DateFormatter().date(from: "2026-11-21T07:00:00Z"), lastFetched: 34)
        #expect(levelLastRunLine(m, now: now) == "Utolsó átnézés: ma 08:00 · 34 levél")
        #expect(levelLastRunLine(LevelMailbox(state: .connected), now: now) == "Még nem néztem át a postát.")
        #expect(levelFiokokSentence(m, now: now) == "Utolsó átnézés ma 08:00-kor volt.")
    }

    @Test func timesWordsForTheSilentProposal() {
        #expect(levelTimesWord(3) == "háromszor")
        #expect(levelTimesWord(12) == "12-szer")
    }

    @Test func staleMarkSaysHowOldAndOnlyWhenOld() {
        #expect(levelStale(isStale: false, age: 99_999) == nil)
        #expect(levelStale(isStale: true, age: nil)?.age == "Nincs net — az utolsó ismert állapot")
        #expect(levelStale(isStale: true, age: 3 * 3600)?.age == "Nincs net — 3 órája mentett adat")
        #expect(levelStale(isStale: true, age: 3 * 3600)?.loud == false)
        #expect(levelStale(isStale: true, age: 30 * 3600)?.age == "Nincs net — 1 napja mentett adat")
        #expect(levelStale(isStale: true, age: 30 * 3600)?.loud == true)
    }

    @Test func restFoldsAreCollapsedByDefaultAndToggle() {
        var open = Set<String>()
        #expect(open.isEmpty)
        open = levelToggleFold(open, "Hírlevelek")
        #expect(open == ["Hírlevelek"])
        open = levelToggleFold(open, "Értesítők")
        #expect(open == ["Hírlevelek", "Értesítők"])
        open = levelToggleFold(open, "Hírlevelek")
        #expect(open == ["Értesítők"])
    }

    @Test func highlightShowsTheScoreOnlyForAScoredDeal() {
        let deal = LevelItem(id: "d", group: .deal, title: "T", why: "W", score: 9, screen: .clean, notifiable: true)
        let h = levelHighlight(LevelDigest(deals: [deal]), now: now)!
        #expect(levelHighlightScore(h) == 9)
        let due = LevelItem(id: "k", group: .deadline, title: "K", dueAt: ISO8601DateFormatter().date(from: "2026-11-22T09:00:00Z"))
        let hd = levelHighlight(LevelDigest(deadlines: [due]), now: now)!
        #expect(hd.kind == .deadline && levelHighlightScore(hd) == nil)
    }

    @Test func theOrbIsHowMuchOfThePostIsHandled() {
        #expect(levelOrbLevel(nil) == nil)
        #expect(levelOrbLevel(LevelDigest(arrived: 0)) == 1)
        #expect(levelOrbLevel(LevelDigest(arrived: 4, handled: 1)) == 0.25)
    }

    @Test func noEmojiAndNoMezoInAnyFixedLine() {
        let lines = [levelCooldownLine, levelGoogleRefusedLine, levelGoogleUnconfiguredLine, levelGoogleRevokedLine, levelReadOnlyLine,
                     levelNeverLine, levelICloudLine, levelDetachMessage]
        for l in lines {
            #expect(!l.lowercased().contains("mezo"))
            #expect(l.unicodeScalars.allSatisfy { !$0.properties.isEmojiPresentation })
        }
    }
}
