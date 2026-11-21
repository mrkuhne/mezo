import Foundation
import Testing
@testable import BoopCore

@Suite("Levél — wire, head, deadlines, highlight")
struct LevelLogicTests {
    static let sampleJSON = #"""
    {"lastRunAt":"2026-11-21T06:02:11.512Z","mailboxState":"connected","rulesOnly":true,"rulesOnlyReason":"cap",
     "arrived":34,"worthAMinute":2,"handled":31,"heatSlots":[0,1,2,3,4,5,6,7,8,9,10,11],
     "people":[{"id":"p1","group":"person","category":"person","title":"Teszt Elek","summary":"Kérdez valamit.","why":"Személy írt.",
       "score":null,"screen":"none","flagged":false,"notifiable":false,"fromName":"Teszt Elek","fromAddress":"elek@pelda.hu",
       "via":"gmail","receivedAt":"2026-11-21T05:30:00Z","gmailMessageId":"1850000000000001"}],
     "sensitive":[{"id":"s1","group":"sensitive","category":"bank","title":"Pelda Bank","summary":"","why":"","screen":"none","flagged":false,"notifiable":false}],
     "deadlines":[{"id":"d1","group":"deadline","category":"deadline","title":"Számla","summary":"Fizetési határidő.","why":"Határidő.",
       "dueAt":"2026-11-22T10:00:00+01:00","screen":"none","flagged":false,"notifiable":true}],
     "parcels":[{"id":"c1","group":"parcel","category":"parcel","title":"Csomag","summary":"","why":"","carrier":"GLS","parcelState":"pickup",
       "stateChangedAt":"2026-11-21T07:00:00Z","screen":"none","flagged":false,"notifiable":false}],
     "deals":[{"id":"x1","group":"deal","category":"deal","title":"Akció","summary":"Kedvezmény a boltban.","why":"Ismert bolt.",
       "score":8,"validUntil":"2026-11-22T20:00:00Z","amountMinor":1250000,"currency":"HUF","screen":"clean","flagged":false,"notifiable":true,"via":"icloud"}],
     "rest":[{"category":"newsletter","count":20}]}
    """#

    static func decode(_ json: String) throws -> LevelDigest { try JSONDecoder().decode(LevelDigest.self, from: Data(json.utf8)) }

    static func at(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 12, _ min: Int = 0) -> Date {
        levelCalendar.date(from: DateComponents(year: y, month: m, day: d, hour: h, minute: min))!
    }

    // MARK: wire

    @Test func decodesTheFullSampleAndRoundTrips() throws {
        let d = try Self.decode(Self.sampleJSON)
        #expect(d.arrived == 34 && d.worthAMinute == 2 && d.handled == 31 && d.heatSlots.count == 12)
        #expect(d.rulesOnly && d.rulesOnlyReason == .cap && d.mailboxState == .connected)
        #expect(d.people[0].via == .gmail && d.people[0].gmailMessageId == "1850000000000001" && d.people[0].score == nil)
        #expect(d.parcels[0].parcelState == .pickup && d.parcels[0].carrier == "GLS")
        #expect(d.deals[0].amountMinor == 1_250_000 && d.deals[0].validUntil != nil && d.deals[0].notifiable)
        #expect(d.deadlines[0].dueAt != nil && d.rest == [LevelRestGroup(category: "newsletter", count: 20)])
        let again = try JSONDecoder().decode(LevelDigest.self, from: JSONEncoder().encode(d))
        #expect(again == d)
    }

    @Test func unknownStringsLandOnUnknownAndMissingFieldsOnNil() throws {
        let d = try Self.decode(#"""
        {"mailboxState":"a_new_state","rulesOnlyReason":"mars","arrived":1,
         "deals":[{"id":"x","group":"coupon","title":"T","screen":"quantum","parcelState":"teleported","via":"yahoo"}]}
        """#)
        let i = d.deals[0]
        #expect(d.mailboxState == .unknown && d.rulesOnlyReason == .unknown)
        #expect(i.group == .unknown && i.screen == .unknown && i.parcelState == .unknown && i.via == .unknown)
        #expect(i.score == nil && i.dueAt == nil && i.gmailMessageId == nil && !i.notifiable)
        #expect(d.people.isEmpty && d.rest.isEmpty)
    }

    @Test func rulesDecodeAndSendOnlyOwnerPatterns() throws {
        let r = try JSONDecoder().decode(LevelRules.self, from: Data(#"""
        {"sensitive":[{"pattern":"@bank.hu","origin":"seed"},{"pattern":"x@y.hu","origin":"owner"}],
         "silent":[],"always":[{"pattern":"a@b.hu","origin":"zzz"}],"proposals":[{"fromAddress":"s@t.hu","nopes":3}]}
        """#.utf8))
        #expect(r.sensitive[0].origin == .seed && r.always[0].origin == .unknown && r.proposals[0].nopes == 3)
        #expect(r.ownerRequest == LevelRulesRequest(sensitive: ["x@y.hu"], silent: [], always: ["a@b.hu"]))
    }

    // MARK: head

    @Test func headForTwoWorthAMinute() throws {
        let h = levelHead(try Self.decode(Self.sampleJSON))
        #expect(h.verdict == "Két dolgot nézz meg")
        #expect(h.sentence == "34 levél jött reggel óta. 31-et elintéztem helyetted, kettő megér egy percet.")
    }

    @Test func headForOneZeroAndEmpty() {
        #expect(levelHead(LevelDigest(arrived: 10, worthAMinute: 1, handled: 9)).verdict == "Egy dolgot nézz meg")
        #expect(levelHead(LevelDigest(arrived: 10, worthAMinute: 1, handled: 9)).sentence
                == "10 levél jött reggel óta. 9-et elintéztem helyetted, egy megér egy percet.")
        let none = levelHead(LevelDigest(arrived: 12, worthAMinute: 0, handled: 12))
        #expect(none.verdict == "Nincs teendőd" && none.sentence == "12 levél jött reggel óta. 12-t elintéztem helyetted, egyik sem kér semmit.")
        let empty = levelHead(LevelDigest())
        #expect(empty.verdict == "Csendes nap" && levelHead(nil) == empty)
    }

    @Test func accusativeSuffixes() {
        #expect([1, 2, 3, 5, 6, 30, 40, 100].map(levelAccusativeSuffix) == ["-et", "-t", "-at", "-öt", "-ot", "-at", "-et", "-at"])
    }

    @Test func rulesOnlyNoteOnlyWhenRulesOnly() {
        #expect(levelRulesOnlyNote(LevelDigest()) == nil && levelRulesOnlyNote(nil) == nil)
        #expect(levelRulesOnlyNote(LevelDigest(rulesOnly: true, rulesOnlyReason: .cap))?.contains("Holnap") == true)
    }

    // MARK: deadlines

    @Test func deadlinesSortByDueWithBudapestMarks() {
        let now = Self.at(2026, 11, 21, 9)   // Saturday
        let items = [
            LevelItem(id: "far", group: .deadline, title: "Később", dueAt: Self.at(2026, 12, 3, 10)),
            LevelItem(id: "none", group: .deadline, title: "Nincs idő"),
            LevelItem(id: "tom", group: .deadline, title: "Holnap", dueAt: Self.at(2026, 11, 22, 10)),
            LevelItem(id: "today", group: .deadline, title: "Ma", dueAt: Self.at(2026, 11, 21, 18)),
            LevelItem(id: "wed", group: .deadline, title: "Szerda", dueAt: Self.at(2026, 11, 25, 10)),
            LevelItem(id: "old", group: .deadline, title: "Régi", dueAt: Self.at(2026, 11, 19, 10)),
        ]
        let rows = levelDeadlineRows(items, now: now)
        #expect(rows.map(\.item.id) == ["old", "today", "tom", "wed", "far", "none"])
        #expect(rows.map(\.mark) == ["lejárt", "ma", "holnap", "szerda", "12. 3.", ""])
    }

    @Test func lateEveningUtcIsStillTodayInBudapest() {
        // 23:30 Budapest on the 21st is 22:30 UTC the same day; 00:30 on the 22nd is 23:30 UTC the 21st.
        let now = Self.at(2026, 11, 21, 23, 30)
        #expect(levelDueMark(Self.at(2026, 11, 22, 0, 30), now: now) == "holnap")
    }

    // MARK: highlight

    static func deal(_ id: String, score: Int, notifiable: Bool = false, screen: LevelScreen = .clean, flagged: Bool = false) -> LevelItem {
        LevelItem(id: id, group: .deal, title: "Akció \(id)", summary: "S \(id)", score: score,
                  validUntil: at(2026, 11, 22, 18), screen: screen, flagged: flagged, notifiable: notifiable)
    }

    @Test func highlightPrefersNotifiableDealThenTomorrowDeadlineThenGoodDeal() {
        let now = Self.at(2026, 11, 21, 9)
        let tomorrow = LevelItem(id: "t", group: .deadline, title: "T", dueAt: Self.at(2026, 11, 22, 10))
        let d1 = LevelDigest(deadlines: [tomorrow], deals: [Self.deal("a", score: 9), Self.deal("b", score: 8, notifiable: true),
                                                           Self.deal("c", score: 8, notifiable: true)])
        #expect(levelHighlight(d1, now: now)?.item.id == "b" || levelHighlight(d1, now: now)?.item.id == "c")
        #expect(levelHighlight(d1, now: now)?.kind == .deal)
        let d2 = LevelDigest(deadlines: [tomorrow], deals: [Self.deal("a", score: 9)])
        #expect(levelHighlight(d2, now: now)?.item.id == "t" && levelHighlight(d2, now: now)?.kind == .deadline)
        let d3 = LevelDigest(deals: [Self.deal("a", score: 7), Self.deal("b", score: 6)])
        #expect(levelHighlight(d3, now: now)?.item.id == "a")
        #expect(levelHighlight(LevelDigest(deals: [Self.deal("a", score: 6)]), now: now) == nil)
        #expect(levelHighlight(nil, now: now) == nil)
    }

    @Test func highlightSkipsFlaggedAndUnknownAndUsesServerWords() {
        let now = Self.at(2026, 11, 21, 9)
        let d = LevelDigest(deals: [Self.deal("f", score: 10, notifiable: true, screen: .flagged, flagged: true),
                                    Self.deal("u", score: 10, notifiable: true, screen: .unknown)])
        #expect(levelHighlight(d, now: now) == nil)
        let ok = levelHighlight(LevelDigest(deals: [Self.deal("k", score: 8, notifiable: true)]), now: now)
        #expect(ok?.title == "Akció k" && ok?.sub == "S k" && ok?.eyebrow.contains(where: \.isNumber) == false)
    }

    @Test func errorTextNamesTheCooldownAndAuthFailure() {
        #expect(levelErrorText(.conflict("MAIL_RUN_COOLDOWN")).contains("várj"))
        #expect(levelErrorText(.rejected("MAIL_AUTH_FAILED")).contains("jelszót"))
        #expect(!levelErrorText(.server).contains("Mezo"))
    }
}
