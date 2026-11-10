#if DEBUG
import Foundation
import HTTPTypes
import OpenAPIRuntime

/// Simulator review only (`-preview shell|onboarding`): the Wearable endpoints and the morning brief answer locally,
/// so the connect flow can be walked without a server (the Mac's firewall blocks the simulator app).
struct PreviewTransport: ClientTransport {
    /// What the review has changed so far (DEBUG preview only): a moved session and the judged observations.
    nonisolated(unsafe) private static var movedTime: String?
    nonisolated(unsafe) private static var decided: Set<String> = []

    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        try await Task.sleep(for: .milliseconds(400))
        var sent = ""
        if operationID == "setSessionTime", let body { sent = String(decoding: try await Data(collecting: body, upTo: 1 << 16), as: UTF8.self) }
        if let reply = Self.morningReply(operationID, request, sent: sent) { return reply }
        if request.method == .put { return (HTTPResponse(status: .noContent), nil) }
        var h = HTTPFields(); h[.contentType] = "application/json"
        return (HTTPResponse(status: .ok, headerFields: h), HTTPBody(#"{"inserted":0,"updated":0}"#))
    }

    private static func json(_ text: String) -> (HTTPResponse, HTTPBody?) {
        var h = HTTPFields(); h[.contentType] = "application/json"
        return (HTTPResponse(status: .ok, headerFields: h), HTTPBody(text))
    }

    /// Canned morning brief (invented numbers) and its session/pattern operations.
    private static func morningReply(_ op: String, _ request: HTTPRequest, sent: String) -> (HTTPResponse, HTTPBody?)? {
        switch op {
        case "getBoopBrief", "regenerateBoopBrief": return json(morningBrief(date: queryDate(request)))
        case "setSessionTime":
            // Echo the requested date and time (the request body is the JSON the client sent).
            let obj = (try? JSONSerialization.jsonObject(with: Data(sent.utf8))) as? [String: String]
            movedTime = obj?["time"]
            return json(#"{"date":"\#(obj?["date"] ?? queryDate(request))","time":"\#(obj?["time"] ?? "19:00")","plannedTime":"17:30"}"#)
        case "clearSessionTime":
            movedTime = nil
            return (HTTPResponse(status: .noContent), nil)
        case "decidePattern":
            let parts = (request.path ?? "").split(separator: "/")
            if let i = parts.firstIndex(of: "pattern"), i + 1 < parts.count { decided.insert(String(parts[i + 1])) }
            return json(#"{"id":"6f1d7a52-2b7e-4c0e-8a52-7d9d4c1a0001","kind":"statistical","pairKey":"minta","category":"trigger","categoryLabel":"Kiváltó","title":"Minta","evidence":[],"status":"confirmed","lastDetectedAt":"2026-11-10T05:00:00Z","evidenceHits":4,"evidenceMisses":1}"#)
        default: return nil
        }
    }

    private static func queryDate(_ request: HTTPRequest) -> String {
        let q = request.path?.split(separator: "?").last.map(String.init) ?? ""
        let hit = q.split(separator: "&").first { $0.hasPrefix("date=") }.map { String($0.dropFirst(5)) }
        if let hit { return hit }
        var greg = Calendar(identifier: .gregorian); greg.timeZone = .current
        let c = greg.dateComponents([.year, .month, .day], from: Date())
        return String(format: "%04d-%02d-%02d", c.year ?? 2026, c.month ?? 1, c.day ?? 1)
    }

    private static func morningBrief(date: String) -> String {
        let hourly = [0.35, 0.5, 0.68, 0.82, 0.9, 0.86, 0.74, 0.6, 0.52, 0.44, 0.5, 0.62, 0.7, 0.66, 0.55, 0.45, 0.36, 0.28, 0.2]
            .map { String($0) }.joined(separator: ",")
        // 06:00–24:00 in quarter hours: a 10:00–11:00 meeting and a 16:00–17:00 meeting just before the 17:30 session.
        let time = movedTime ?? "17:30"
        let conflict = movedTime == nil
            ? #"{"text":"A 16:00-s megbeszélés 17:00-ig tart, alig fél órával az edzés előtt.","suggestedTime":"18:30"}"#
            : "null"
        let observations = [
            #"{"id":"6f1d7a52-2b7e-4c0e-8a52-7d9d4c1a0001","lead":"Úgy látszik, ha későn eszel,","bold":"kevesebb mély alvásod","tail":"van másnap.","strength":3}"#,
            #"{"id":"6f1d7a52-2b7e-4c0e-8a52-7d9d4c1a0002","lead":"Az edzésnapokon","bold":"délután 3-kor mélyebb a hullámvölgyed","tail":", ha ebédre kevés a fehérje.","strength":3}"#,
            #"{"id":"6f1d7a52-2b7e-4c0e-8a52-7d9d4c1a0003","lead":"Hétfőnként","bold":"a feszültséged átlagosan 2-vel magasabb","tail":"a hét többi napjánál.","strength":4}"#,
        ].filter { o in !decided.contains { o.contains($0) } }.joined(separator: ",")
        let slots = (0..<72).map { i in (16..<20).contains(i) || (40..<44).contains(i) ? "true" : "false" }.joined(separator: ",")
        return #"""
        {"date":"\#(date)","generatedAt":"\#(date)T05:40:00Z","state":"okay","nightsKnown":12,
         "metrics":[
          {"key":"forma","score":74,"display":"74","caption":"jó formában","headline":"Elég jó reggel","sentence":"Az alvásod és a pulzusod rendben, az edzésnapot bírni fogod."},
          {"key":"alvas","score":78,"display":"7ó 12p","caption":"mély 1ó 28p","headline":"Nyugodt éjszaka","sentence":"A mély alvásod a heti átlag fölött volt."},
          {"key":"mozgas","score":52,"display":"3 240","caption":"lépés eddig","headline":"Lassan indul a nap","sentence":"Délutánra a séta behozza a célt."},
          {"key":"fuel","score":null,"display":"–","caption":null,"headline":"Még nincs étkezés","sentence":"Az első étkezés után látszik majd."},
          {"key":"pulzus","score":66,"display":"57","caption":"nyugalmi","headline":"Nyugodt szív","sentence":"Két ütéssel a heti átlag alatt."}],
         "brief":[{"text":"Jó reggelt! Hét órát meghaladó alvás után nyugodt napnak nézel elébe.","link":"sleep"},
                  {"text":"A nyugalmi pulzusod a megszokott alatt van.","link":"heart"},
                  {"text":"Ma vállak és hát edzés van, 17:30-kor.","link":"day"}],
         "energy":{"hourly":[\#(hourly)],"dipHour":15},
         "tonightTip":"Ma 22:30 körül érdemes lefeküdni, hogy a holnapi edzés előtt kipihent legyél.",
         "nextMealTip":"Ebédre tegyél be egy jó adag fehérjét.",
         "conflict":\#(conflict),
         "day":{"sleep":{"bedtime":"23:05","wakeup":"06:17","totalMin":432,"deepMin":88,"remMin":96,"lightMin":238,"awakeMin":30,
                  "hypnogram":[{"stage":2,"minutes":40},{"stage":3,"minutes":50},{"stage":2,"minutes":60},{"stage":1,"minutes":45},{"stage":0,"minutes":10},{"stage":2,"minutes":90},{"stage":3,"minutes":38},{"stage":1,"minutes":51},{"stage":2,"minutes":48}]},
          "bedtimeTarget":"22:30","deepSleepWeek":[72,64,null,80,70,76,88],"restingHrWeek":[59,58,60,null,58,59,57],
          "hrToday":{"min":54,"avg":66,"max":92},"steps":3240,"stepsGoal":10000,"activeKcal":210,
          "session":{"title":"Vállak és hát","time":"\#(time)","plannedTime":"17:30","minutes":60,
                     "exercises":[{"name":"Húzódzkodás","sets":4},{"name":"Evezés rúddal","sets":4},{"name":"Vállnyomás","sets":3},{"name":"Oldalemelés","sets":3}]},
          "meals":[{"time":"08:00","title":"Zabkása gyümölccsel","kcal":420,"proteinG":22,"logged":false},{"time":"12:30","title":"Csirkés rizs","kcal":650,"proteinG":48,"logged":false}],
          "kcalSoFar":0,"kcalTarget":2400,"proteinG":0,"proteinTarget":150,"carbsG":0,"fatG":0,
          "checkins":[{"slot":"morning","time":"08:00","done":false},{"slot":"midday","time":"13:00","done":false}],
          "intention":{"creed":"Egyenletesen, nem erőből.","foci":["Nyugodt tempó","Vizet inni"]},
          "observations":[\#(observations)],
          "calendar":{"count":2,"busySlots":[\#(slots)]},
          "weight":{"kg":78.4,"trendKg":78.1},"recovery":null}}
        """#
    }
}
#endif
