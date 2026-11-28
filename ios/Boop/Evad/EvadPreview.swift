#if DEBUG
import Foundation
import HTTPTypes
import OpenAPIRuntime
import BoopCore

/// Simulator review only (`-preview shell -previewHome evad`, `-evadTab Most|Hét|Terv|Kísérlet`): the season API answered locally with the approved spike's
/// invented, real-looking figures (84,1 kg → 82, 4 edzés + 2 röplabda, 2440 / 2270 kcal …) — never the owner's. The
/// Mac's firewall blocks the simulator app's network, so this is how the Évad page is looked at. The consequences of a
/// change come from the spike's toy model; on the phone they are the server's goal engine.
///
/// `-evadState full|maintain|empty|offline|error` (default `full`): a cut season in week 7 · his real shape, a maintain
/// season inside its band · no season yet (screen 13 → Új évad) · no net (the cache is primed five hours old) · the
/// server failing. `-previewOffline YES` is the same as `offline`. `-evadOpen modositas|szabalyok|uj|kiserlet|ujkiserlet`
/// opens a sub-page (`kiserlet` = the newest finished experiment; S4's experiments: `EvadExperimentPreview.swift`),
/// `-evadLit 0…3` lights a pillar, `-evadSessions 5` / `-evadPace 0.6` pre-set Módosítás, `-evadStale YES` answers the
/// first accept with 409 SEASON_PREVIEW_STALE. The block runs by default (the gym days are locked in Módosítás);
/// `-evadNoBlock YES` frees them. S2: the overview carries „Hogy megy" (adherence) and three insights; `-evadQuiet YES`
/// leaves both out (data still short); `-evadEndSoon YES` puts the season in its last week (the wall's season-end
/// card). `getAdherence` answers the same seven days the Étel preview's week holds (a stomach-bug day 4, today going).
enum EvadPreviewFixtures {
    static let raw = RawJSONClient(transport: EvadPreviewTransport(), baseURL: URL(string: "https://preview.invalid")!,
                                   token: { "preview" })
    static let client = EvadClient(raw: raw)
    static var state: String {
        UserDefaults.standard.bool(forKey: "previewOffline") ? "offline" : (UserDefaults.standard.string(forKey: "evadState") ?? "full")
    }

    /// `offline`: what the cache would hold from a read five hours ago.
    static func primeCache(_ directory: URL) async {
        guard state == "offline" else { return }
        let earlier = Date().addingTimeInterval(-5 * 3600)
        let cache = ServerCache(directory: directory, clock: { earlier })
        let model = EvadPreviewModel(state: "full")
        guard let data = try? JSONSerialization.data(withJSONObject: model.overview()),
              let o = try? JSONDecoder().decode(EvadOverview.self, from: data) else { return }
        try? await cache.put(o, endpoint: "evad/overview", date: "-")
        if let data = try? JSONSerialization.data(withJSONObject: EvadExperimentPreviewModel.shared.list()),
           let x = try? JSONDecoder().decode(EvadExperiments.self, from: data) {
            try? await cache.put(x, endpoint: "evad/experiments", date: "-")
        }
    }
}

/// The preview's season, kept for the run so an accept, a rules switch or a new season shows its effect.
final class EvadPreviewModel: @unchecked Sendable {
    let lock = NSLock()
    let maintain: Bool
    var hasSeason: Bool
    var draft: [String: Any]
    var rules: [String: Any] = ["processedFoodMaxNova": 2, "deloadMaintain": true, "useLearnedExpenditure": true,
                                "proposeExperiments": true, "menuDay": 6, "menuTime": "18:00"]
    var staleOnce = UserDefaults.standard.bool(forKey: "evadStale")
    let weight = 84.1, target = 82.0, tdee = 2_590.0
    /// `-evadNoBlock YES`: the season's block is not running, so Módosítás may move the gym days.
    let noBlock = UserDefaults.standard.bool(forKey: "evadNoBlock")
    /// `-evadQuiet YES`: no adherence and no insights yet (the S1 look).
    let quiet = UserDefaults.standard.bool(forKey: "evadQuiet")
    /// `-evadEndSoon YES`: the season's last week.
    let endSoon = UserDefaults.standard.bool(forKey: "evadEndSoon")

    init(state: String) {
        maintain = state == "maintain"
        hasSeason = state != "empty"
        draft = [
            "title": maintain ? "Őszi súlytartás" : "Őszi fogyás",
            "trajectory": maintain ? "maintain" : "cut",
            "startDate": Self.iso(Calendar.current.date(byAdding: .day,
                                                        value: UserDefaults.standard.bool(forKey: "evadEndSoon") ? -80 : -45, to: Date())!),
            "weeks": 12, "gymDays": [0, 2, 4, 5], "gymTime": "07:00",
            "sport": [["dayOfWeek": 1, "time": "19:00", "durationMin": 90, "sport": "volleyball"],
                      ["dayOfWeek": 3, "time": "19:00", "durationMin": 90, "sport": "volleyball"]],
            "sleepAnchor": ["anchor": "WAKE", "time": "06:30"],
            "allowedRecipeIds": (1...24).map { String(format: "e0000000-0000-4000-8000-%012d", $0) },
            "block": ["source": "adopt", "mesocycleId": "b0000000-0000-4000-8000-000000000001"],
        ]
        if !maintain { draft["targetWeightKg"] = 82.0; draft["kgPerWeek"] = 0.4 }
    }

    static func iso(_ d: Date) -> String {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"; return f.string(from: d)
    }

    // MARK: the spike's toy consequence model

    func numbers(_ d: [String: Any]) -> [String: Any] {
        let sessions = (d["gymDays"] as? [Int])?.count ?? 0
        let sport = (d["sport"] as? [[String: Any]])?.count ?? 0
        let trajectory = d["trajectory"] as? String ?? "maintain"
        let tempo: Double = trajectory == "maintain" ? 0
            : (d["kgPerWeek"] as? Double) ?? ((d["ratePctPerWeek"] as? Double).map { $0 * weight / 100 } ?? 0.4)
        let sign: Double = trajectory == "bulk" ? 1 : -1
        let eatAvg = (Double(sessions) * 290 + Double(sport) * 360) / 7
        let avg = tdee + eatAvg + sign * tempo * 7_700 / 7
        let activeDays = Double(min(7, sessions + sport))
        let train = avg + 170 * (7 - activeDays) / 7
        let rest: Double? = activeDays >= 7 ? nil : (avg * 7 - train * activeDays) / (7 - activeDays)
        let sleep = min(510, 450 + sessions * 6 + sport * 6)
        let bedMin = 6 * 60 + 30 - sleep - 15 + 24 * 60
        var out: [String: Any] = [
            "trainDayKcal": Int((train / 10).rounded() * 10),
            "restDayKcal": rest.map { Int(($0 / 10).rounded() * 10) as Any } ?? NSNull(),
            "proteinG": Int((weight * 2.0 / 5).rounded() * 5),
            "carbsTrainG": Int(((train * 0.45) / 4 / 5).rounded() * 5),
            "sleepNeedMin": sleep,
            "bedtime": String(format: "%02d:%02d", (bedMin / 60) % 24, bedMin % 60),
            "gymPerWeek": sessions, "sportPerWeek": sport,
        ]
        // the week's total: what moves when a sport day is added even when a day's own target barely does
        let trainR = out["trainDayKcal"] as! Int
        let restR = rest.map { Int(($0 / 10).rounded() * 10) }
        out["weekKcal"] = trainR * Int(activeDays) + (restR ?? 0) * (7 - Int(activeDays))
        if trajectory == "maintain" {
            out["band"] = ["lowKg": weight - 1, "highKg": weight + 1]
        } else if tempo > 0 {
            let weeks = Int((abs(weight - target) / tempo).rounded(.up))
            out["weeksToTarget"] = weeks
            out["targetDate"] = Self.iso(Calendar.current.date(byAdding: .weekOfYear, value: weeks, to: Date())!)
            let pct = tempo / weight * 100
            out["paceVerdict"] = pct < 0.55 ? "feasible" : (pct <= 0.9 ? "warnings" : "aggressive")
            out["kgPerWeek"] = sign * tempo
        }
        return out
    }

    func preview(_ new: [String: Any], fingerprint: String) -> [String: Any] {
        let a = numbers(draft), b = numbers(new)
        let tempo = (new["kgPerWeek"] as? Double) ?? 0
        let sessions = (new["gymDays"] as? [Int])?.count ?? 0
        var warnings: [[String: Any]] = []
        let pct = tempo / weight * 100
        if new["trajectory"] as? String == "cut" {
            if pct > 0.6 && sessions >= 5 {
                warnings.append(["key": "strength", "text": "Ennyi edzés mellett ilyen kevés kalóriától gyengülhetsz: a nagy gyakorlatokban valószínűleg megáll a fejlődés."])
            } else if pct > 0.9 {
                warnings.append(["key": "muscle", "text": "Ilyen tempónál izmot is veszítenél, nem csak zsírt."])
            }
        }
        var todo: [[String: Any]] = []
        let ta = a["trainDayKcal"] as! Int, tb = b["trainDayKcal"] as! Int
        if tb > ta + 40 { todo.append(["key": "snack", "title": "Több étel edzésnapon", "body": "Edzésnapokon kapsz egy plusz uzsonnát (kb. +\(tb - ta) kcal), és a bevásárlólista is frissül."]) }
        if tb < ta - 40 { todo.append(["key": "portions", "title": "Kisebb adagok", "body": "Edzésnapon kb. \(ta - tb) kcal-lal kisebbek lesznek az adagok."]) }
        if (b["sleepNeedMin"] as! Int) > (a["sleepNeedMin"] as! Int) {
            todo.append(["key": "bedtime", "title": "Korábbi lefekvés", "body": "\(b["bedtime"] as! String) körül feküdj le. Az esti emlékeztetőt is ehhez igazítom."])
        }
        let oldDays = ((draft["gymDays"] as? [Int]) ?? []).sorted(), newDays = ((new["gymDays"] as? [Int]) ?? []).sorted()
        var block: Any = NSNull()
        if Set(oldDays) != Set(newDays), !newDays.isEmpty {
            // the running block follows (mezo-r36n9.122): its days in order onto the new weekdays, extras repeat
            let titles = ["Felső A", "Alsó A", "Felső B", "Alsó B", "Felső C", "Alsó C"]
            let days: [[String: Any]] = newDays.enumerated().map { i, wd in
                if i < oldDays.count {
                    let from = oldDays[i]
                    return ["weekday": wd, "title": titles[i], "change": from == wd ? "keep" : "move",
                            "fromWeekday": from == wd ? NSNull() : from]
                }
                let src = (i - oldDays.count) % max(oldDays.count, 1)
                return ["weekday": wd, "title": titles[src], "change": "add", "fromWeekday": oldDays.isEmpty ? NSNull() : oldDays[src]]
            }
            let dropped: [[String: Any]] = oldDays.count > newDays.count
                ? (newDays.count..<oldDays.count).map { ["weekday": oldDays[$0], "title": titles[$0], "change": "drop"] } : []
            block = ["mesocycleId": "m1", "title": "Felső-alsó mezociklus", "days": days, "dropped": dropped]
            todo.append(["key": "block", "title": "A mezociklus", "body": "A futó mezociklusod napjai az új edzésnapokra kerülnek, lent látod, melyik hova. Ezt is az Elfogadom teszi meg."])
        }
        if let wa = a["weeksToTarget"] as? Int, let wb = b["weeksToTarget"] as? Int, wa != wb, let date = b["targetDate"] as? String {
            todo.append(["key": "length", "title": "Az évad hossza", "body": "Az évad \(wb > wa ? "hosszabb" : "rövidebb") lesz, a célt \(evadShortDate(date)) körül éred el."])
        }
        let oldSport = Set(((draft["sport"] as? [[String: Any]]) ?? []).compactMap { $0["dayOfWeek"] as? Int })
        let newSport = Set(((new["sport"] as? [[String: Any]]) ?? []).compactMap { $0["dayOfWeek"] as? Int })
        if oldSport != newSport {
            todo.append(["key": "sport", "title": "Sportnapok", "body": "Sportnap reggelén több szénhidrát lesz a menüben, és a pihenőnapok is máshova kerülnek."])
        }
        return ["before": a, "after": b, "todo": todo, "warnings": warnings, "fingerprint": fingerprint, "block": block]
    }

    var fingerprint: String { "fp-\(abs(String(describing: draft["gymDays"] ?? "").hashValue % 10_000))" }

    func season(status: String = "active") -> [String: Any] {
        let start = draft["startDate"] as! String
        let weeks = draft["weeks"] as! Int
        let startDate = DateFormatter.evadISO.date(from: start) ?? Date()
        return ["id": "5e000000-0000-4000-8000-000000000001", "title": draft["title"]!, "status": status,
                "startDate": start, "endDate": Self.iso(Calendar.current.date(byAdding: .day, value: weeks * 7 - 1, to: startDate)!),
                "weeks": weeks, "goalId": "90000000-0000-4000-8000-000000000001",
                "sleepNeedMin": numbers(draft)["sleepNeedMin"]!, "mesocycleId": "b0000000-0000-4000-8000-000000000001",
                "rules": rules, "draft": draft]
    }

    func overview() -> [String: Any] {
        let n = numbers(draft)
        let isMaintain = draft["trajectory"] as? String == "maintain"
        let sessions = (draft["gymDays"] as? [Int])?.count ?? 0
        let sportCount = (draft["sport"] as? [[String: Any]])?.count ?? 0
        let series: [Double] = isMaintain ? [84.3, 84.0, 84.4, 84.1, 83.8, 84.2, 84.0, 84.1]
            : [86.9, 86.4, 86.2, 85.6, 85.3, 84.8, 84.4, 84.1]
        let projection: [Double] = isMaintain ? [84.1, 84.1, 84.1, 84.1, 84.1] : [83.7, 83.3, 82.9, 82.5, 82.1]
        func points(_ v: [Double], from week: Int) -> [[String: Any]] {
            v.enumerated().map { i, kg in
                ["date": Self.iso(Calendar.current.date(byAdding: .weekOfYear, value: week + i - 7, to: Date())!), "kg": kg]
            }
        }
        let band: Any = isMaintain ? ["lowKg": 83.1, "highKg": 85.1] : NSNull()
        let kgPerWeek: Any = n["kgPerWeek"] ?? NSNull()
        let targetDate: Any = n["targetDate"] ?? NSNull()
        return [
            "season": season(),
            "head": ["title": draft["title"]!, "week": endSoon ? 12 : 7, "weeks": draft["weeks"]!,
                     "status": isMaintain ? "in_band" : "on_course", "trajectory": draft["trajectory"]!],
            "map": [
                "pillars": [["key": "edzes", "value": sportCount > 0 ? "\(sessions) edzés + \(sportCount) röpi" : "\(sessions) edzés"],
                            ["key": "etel", "value": "\(n["trainDayKcal"]!) kcal"],
                            ["key": "alvas", "value": evadHM(n["sleepNeedMin"] as! Int)],
                            ["key": "suly", "value": isMaintain ? "84,1 · sávban" : "84,1 → 82"]],
                "links": [["from": "edzes", "to": "etel", "key": "train_food", "value": 290],
                          ["from": "edzes", "to": "alvas", "key": "train_sleep", "value": 12],
                          ["from": "etel", "to": "suly", "key": "food_weight", "value": kgPerWeek],
                          ["from": "alvas", "to": "etel", "key": "sleep_food", "value": quiet ? NSNull() : 283 as Any],
                          ["from": "etel", "to": "edzes", "key": "food_train", "value": NSNull()],
                          ["from": "alvas", "to": "edzes", "key": "sleep_train", "value": NSNull()]],
            ],
            "weight": ["series": points(series, from: 0), "projection": points(projection, from: 8),
                       "trendKg": 84.1, "targetKg": isMaintain ? NSNull() : 82.0 as Any, "band": band,
                       "kgPerWeek": kgPerWeek, "paceVerdict": n["paceVerdict"] ?? NSNull()],
            "pillars": [
                "block": ["title": "V-forma és kar",
                          "mesocycleId": noBlock ? NSNull() : "b0000000-0000-4000-8000-000000000001" as Any, "blockWeeks": 6,
                          "fromWeek": 4, "toWeek": 9, "gymDays": draft["gymDays"]!, "sport": draft["sport"]!],
                "food": ["trainDayKcal": n["trainDayKcal"]!, "restDayKcal": n["restDayKcal"]!, "proteinG": n["proteinG"]!,
                         "allowedCount": 24, "recipeCount": 53, "novaMax": rules["processedFoodMaxNova"]!],
                "sleep": ["needMin": n["sleepNeedMin"]!, "baseMin": 450, "bedtime": n["bedtime"]!, "anchor": "WAKE",
                          "anchorTime": "06:30", "avgMin": 440],
                "weight": ["targetKg": isMaintain ? NSNull() : 82.0 as Any, "targetDate": targetDate,
                           "deltaKg": isMaintain ? -0.2 : -2.8, "kgPerWeek": kgPerWeek, "band": band],
            ],
            "adherence": quiet ? NSNull() : ["foodInBand": 4, "foodJudged": 5, "sessionsDone": 4, "sessionsPlanned": 6,
                                              "nightsOk": 4, "nightsJudged": 7, "excusedDays": 1, "trainingDone": 3,
                                              "trainingPlanned": 4, "sportDone": 1, "sportPlanned": 2] as Any,
            "insights": quiet ? [] as [Any] : insights,
            "upcoming": [["week": 10, "kind": "deload", "text": isMaintain ? "a könnyebb héten is tartjuk a súlyt" : "erre a hétre nem fogyunk: napi +350 kcal"],
                         ["week": draft["weeks"]!, "kind": "end", "text": "összefoglalom, mi vált be, és javaslok egy következőt"]],
        ]
    }
}

extension EvadPreviewModel {
    /// The spike's three insights (invented figures, "például").
    var insights: [[String: Any]] {
        [["key": "learned_expenditure", "title": "Kevesebbet égetsz, mint gondoltuk",
          "body": "A terv napi 2650 kcal-lal számolt, de a mérleged és az étkezéseid alapján inkább 2580 körül égetsz. Hétfőn ehhez igazítanám a keretet; előtte megmutatom, mi változna."],
         ["key": "short_night_intake", "title": "Rossz alvás után többet eszel",
          "body": "Ha 7 óránál kevesebbet alszol, másnap átlagosan 280 kcal-lal többet eszel. Vagyis a jobb alvás is segít fogyni."],
         ["key": "guard", "title": "Erre figyelek",
          "body": "A mellizmodra jutó heti munka a minimum közelében van. Ha tovább csökkentjük a kalóriát, itt állhat meg először a fejlődés."]]
    }

    /// `getAdherence ?from&to`: the Étel preview's week judged the server's way — the fourth day is a kímélő day
    /// (stomach bug), today is still going, the rest are logged and judged.
    func adherence(query: String) -> [String: Any] {
        let q = Dictionary(uniqueKeysWithValues: query.split(separator: "&").compactMap { pair -> (String, String)? in
            let kv = pair.split(separator: "=", maxSplits: 1).map(String.init)
            return kv.count == 2 ? (kv[0], kv[1]) : nil
        })
        let today = Self.iso(Date())
        guard let from = q["from"].flatMap(DateFormatter.evadISO.date(from:)),
              let to = q["to"].flatMap(DateFormatter.evadISO.date(from:)) else { return ["days": [], "summary": [:]] }
        var days: [[String: Any]] = []
        var day = from, i = 0
        while day <= to, i < 62 {
            let date = Self.iso(day)
            let kimelo = i == 3, isToday = date == today
            let judged = !kimelo && !isToday
            days.append(["date": date, "judged": judged, "excused": kimelo, "excuse": kimelo ? "kimelo" : NSNull() as Any,
                         "foodInBand": judged ? (i != 1) as Any : NSNull(), "sessionPlanned": [0, 2, 4, 5].contains(i % 7),
                         "sleepOk": isToday ? NSNull() as Any : (i % 3 != 0) as Any])
            day = Calendar.current.date(byAdding: .day, value: 1, to: day)!; i += 1
        }
        let judged = days.filter { $0["judged"] as? Bool == true }
        // The counts are named first: one literal with every filter inline took Xcode 26.3 past its type-check
        // budget („unable to type-check this expression in reasonable time"). Same values, same shape.
        let foodInBand = judged.filter { $0["foodInBand"] as? Bool == true }.count
        let nightsOk = days.filter { $0["sleepOk"] as? Bool == true }.count
        let nightsJudged = days.filter { $0["sleepOk"] is Bool }.count
        let excusedDays = days.filter { $0["excused"] as? Bool == true }.count
        let summary: [String: Any] = ["foodInBand": foodInBand, "foodJudged": judged.count,
                                      "sessionsDone": 3, "sessionsPlanned": 4,
                                      "nightsOk": nightsOk, "nightsJudged": nightsJudged, "excusedDays": excusedDays]
        return ["days": days, "summary": summary]
    }
}

extension DateFormatter {
    static let evadISO: DateFormatter = {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"; return f
    }()
}

struct EvadPreviewTransport: ClientTransport {
    nonisolated(unsafe) static let model = EvadPreviewModel(state: EvadPreviewFixtures.state)

    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        try await Task.sleep(for: .milliseconds(350))
        let state = EvadPreviewFixtures.state
        if state == "offline" { throw URLError(.notConnectedToInternet) }
        if state == "error", operationID == "getSeasonOverview" { return (HTTPResponse(status: .internalServerError), nil) }
        var sent: [String: Any] = [:]
        if let body, let data = try? await Data(collecting: body, upTo: 1 << 16),
           let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] { sent = object }
        let m = Self.model
        func json(_ object: Any, _ status: Int = 200) -> (HTTPResponse, HTTPBody?) {
            var h = HTTPFields(); h[.contentType] = "application/json"
            let data = (try? JSONSerialization.data(withJSONObject: object)) ?? Data("{}".utf8)
            return (HTTPResponse(status: .init(code: status), headerFields: h), HTTPBody(data))
        }
        func refuse(_ status: Int, _ code: String) -> (HTTPResponse, HTTPBody?) {
            json(["messages": [["code": code, "text": code]]], status)
        }
        return m.lock.withLock {
            if let (status, object) = EvadMenuPreviewModel.shared.answer(operationID, path: request.path ?? "", sent: sent) {
                return json(object, status)
            }
            if let (status, object) = EvadExperimentPreviewModel.shared.answer(operationID, path: request.path ?? "", sent: sent) {
                return json(object, status)
            }
            switch operationID {
            case "putSeasonRecipes":
                var d = m.draft; d["allowedRecipeIds"] = sent["recipeIds"]; m.draft = d
                return json(m.season())
            case "getSeasonOverview":
                guard m.hasSeason else { return refuse(404, "NOT_FOUND") }
                var o = m.overview(); o["menu"] = EvadMenuPreviewModel.shared.menuStatus()
                return json(o)
            case "getFirstSeasonDraft":
                return json(m.draft)
            case "previewSeasonDraft":
                return json(m.preview(sent, fingerprint: ""))
            case "previewSeason":
                return json(m.preview(sent, fingerprint: m.fingerprint))
            case "createSeason":
                m.draft = sent
                return json(m.season(status: "planned"), 201)
            case "activateSeason":
                m.hasSeason = true
                return json(m.season())
            case "applySeason":
                if m.staleOnce { m.staleOnce = false; return refuse(409, "SEASON_PREVIEW_STALE") }
                if let d = sent["draft"] as? [String: Any] { m.draft = d }
                return json(m.season())
            case "putSeasonRules":
                m.rules = sent
                return json(m.season())
            case "getAdherence":
                return json(m.adherence(query: String((request.path ?? "").split(separator: "?").dropFirst().first ?? "")))
            case "listSeasons":
                return json(m.hasSeason ? [m.season()] : [])
            default:
                return (HTTPResponse(status: .notFound), nil)
            }
        }
    }
}
#endif
