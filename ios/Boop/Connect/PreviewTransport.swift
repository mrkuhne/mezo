#if DEBUG
import Foundation
import HTTPTypes
import OpenAPIRuntime
import UIKit

/// Simulator review only (`-preview shell|onboarding`): the Wearable endpoints and the morning brief answer locally,
/// so the connect flow can be walked without a server (the Mac's firewall blocks the simulator app).
struct PreviewTransport: ClientTransport {
    /// What the review has changed so far (DEBUG preview only): a moved session and the judged observations.
    nonisolated(unsafe) private static var movedTime: String?
    nonisolated(unsafe) private static var decided: Set<String> = []
    /// Today's Boop conversation in the review (role, text); `-previewOpen chatAnswer` starts with one answered question.
    nonisolated(unsafe) private static var chatTurns: [(String, String)] =
        UserDefaults.standard.string(forKey: "previewOpen") == "chatAnswer" ? [("user", tiredQuestion), ("assistant", answers[tiredQuestion]!)] : []
    private static let chatId = "7a3c1e52-4b6d-4f0e-9a52-1d9d4c1a0b00"

    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        // `-previewOpen chatAsk`: Boop takes his time, so the waiting look can be seen.
        let slowAnswer = operationID == "sendMessage" && UserDefaults.standard.string(forKey: "previewOpen") == "chatAsk"
        try await Task.sleep(for: .milliseconds(slowAnswer ? 8_000 : 400))
        // `-previewOffline YES`: the daily loop's writes and Boop's lines find no net (they stay on the phone).
        if UserDefaults.standard.bool(forKey: "previewOffline"), Self.ritmusOps.contains(operationID) {
            throw URLError(.notConnectedToInternet)
        }
        // `previewFoodOffline` (set it at runtime with `defaults write` to cut the net while the app runs): drafting and
        // saving a meal find no net, so the capture stays on the phone.
        if UserDefaults.standard.bool(forKey: "previewFoodOffline"), ["draftMealFromAi", "createMeal", "lookupPantryItem"].contains(operationID) {
            throw URLError(.notConnectedToInternet)
        }
        // `-previewRefuse YES`: the server refuses the daily loop's writes (the "nem sikerült elküldeni · Újra" rows).
        if UserDefaults.standard.bool(forKey: "previewRefuse"), ["saveCheckIn", "addFocus", "putDayClose", "createJournalEntry"].contains(operationID) {
            return (HTTPResponse(status: .badRequest), nil)
        }
        var sent = ""
        if (["setSessionTime", "addFocus", "sendMessage"] + Self.foodWriteOps).contains(operationID), let body {
            sent = String(decoding: try await Data(collecting: body, upTo: 1 << 16), as: UTF8.self)
        }
        if let reply = Self.morningReply(operationID, request, sent: sent) { return reply }
        if let reply = Self.chatReply(operationID, sent: sent) { return reply }
        if let reply = Self.foodReply(operationID, request, sent: sent) { return reply }
        assert(!Self.foodOps.contains(operationID), "PreviewTransport: unanswered op \(operationID)")
        if request.method == .put { return (HTTPResponse(status: .noContent), nil) }
        var h = HTTPFields(); h[.contentType] = "application/json"
        return (HTTPResponse(status: .ok, headerFields: h), HTTPBody(#"{"inserted":0,"updated":0}"#))
    }

    /// The B3 daily-loop operations (`-previewOffline` cuts them off).
    private static let ritmusOps: Set<String> = [
        "saveCheckIn", "generateCheckInLine", "getCheckInPlan", "listCheckInsForDay", "addFocus", "removeFocus",
        "createJournalEntry", "transcribeVoiceNote", "putDayClose", "getDayClose", "generateDayCloseLine",
        "getDayContext", "listDayCloses", "listConversations", "createConversation", "listMessages", "sendMessage",
    ]

    // MARK: - Boop's chat (invented day: a short night, low HRV, volleyball at 19:00)

    private static let tiredQuestion = "Miért vagyok fáradtabb, mint tegnap?"
    private static let answers: [String: String] = [
        tiredQuestion: "Három dolog együtt: az éjjel 6ó 10 percet aludtál, tegnap 7ó 40-et, és ebből 38 perccel kevesebb volt a mély. A HRV-d 41, a szokásos 50 alatt. Délben már 6-os energiát mondtál a workshop után. Nem vagy beteg — kevesebb a tartalék, ma este korábban feküdj le.",
        "Mennyit egyek a röpi előtt?": "A röpi 19:00-kor kezdődik, eddig 1 240 kcal-t ettél a mai 2 450-ből. 17:30 körül egyél 40–60 g szénhidrátot kis fehérjével: egy banán és egy pohár joghurt elég. A vacsora a játék után jöjjön, 21:00 előtt.",
        "Mire figyeljek ma az edzésen?": "A HRV-d lejjebb van, a délutáni energiád 5. Az első 20 percben ne ugorj maximális erővel, a bemelegítés legyen hosszabb. Ha a második szettnél a pulzusod 165 fölött ragad, vegyél vissza.",
    ]

    private static func chatReply(_ op: String, sent: String) -> (HTTPResponse, HTTPBody?)? {
        func quoted(_ t: String) -> String {
            String(decoding: (try? JSONEncoder().encode(t)) ?? Data(#""""#.utf8), as: UTF8.self)
        }
        func message(_ role: String, _ text: String) -> String {
            #"{"id":"\#(UUID().uuidString.lowercased())","role":"\#(role)","content":\#(quoted(text)),"createdAt":"\#(ISO8601DateFormatter().string(from: Date()))","tools":[],"refs":[],"recalled":[],"degraded":false}"#
        }
        let conversation = #"{"id":"\#(chatId)","title":"\#(todayTitle())","startedAt":"\#(ISO8601DateFormatter().string(from: Date()))"}"#
        switch op {
        case "getDayContext":
            return json(#"""
            {"chips":[{"key":"sleep","label":"Alvás","value":"6ó 10p","sub":"előző éjjel 7ó 40p"},
             {"key":"hrv","label":"HRV","value":"41","sub":"szokott 50"},
             {"key":"session","label":"Röpi","value":"19:00","sub":"90 perc"},
             {"key":"checkins","label":"Kitöltés","value":"2 kitöltés","sub":"energia 6"},
             {"key":"fuel","label":"Étkezés","value":"1 240 kcal","sub":"cél 2 450"},
             {"key":"goal","label":"A nap célja","value":"Ügyfélprezentáció","sub":null},
             {"key":"calendar","label":"Naptár","value":"még 2 esemény","sub":"következő 14:00"}],
             "questions":["Mennyit egyek a röpi előtt?","Mire figyeljek ma az edzésen?","Miért vagyok fáradtabb, mint tegnap?"],
             "generatedAt":"2026-11-12T15:00:00Z"}
            """#)
        case "listConversations": return json(chatTurns.isEmpty ? "[]" : "[\(conversation)]")
        case "createConversation":
            var h = HTTPFields(); h[.contentType] = "application/json"
            return (HTTPResponse(status: .created, headerFields: h), HTTPBody(conversation))
        case "listMessages": return json("[" + chatTurns.map { message($0.0, $0.1) }.joined(separator: ",") + "]")
        case "sendMessage":
            let question = ((try? JSONSerialization.jsonObject(with: Data(sent.utf8))) as? [String: Any])?["content"] as? String ?? ""
            let answer = answers[question] ?? "Ezt a mai adataid alapján nézem: az éjjel 6ó 10 percet aludtál, a HRV-d 41, a szokásos 50 alatt. Ma inkább a pihenés felé billenj."
            chatTurns += [("user", question), ("assistant", answer)]
            return json(message("assistant", answer))
        default: return nil
        }
    }

    /// "2026. november 12." — how the server titles today's Boop conversation.
    private static func todayTitle() -> String {
        let f = DateFormatter(); f.locale = Locale(identifier: "hu"); f.dateFormat = "y. MMMM d."
        return f.string(from: Date())
    }

    private static func json(_ text: String) -> (HTTPResponse, HTTPBody?) {
        var h = HTTPFields(); h[.contentType] = "application/json"
        return (HTTPResponse(status: .ok, headerFields: h), HTTPBody(text))
    }

    // MARK: - Étel (B4): an invented food day, so the room can be walked without a server

    private static let foodWriteOps = ["createMeal", "logWater", "upsertPlannedSkip", "setSensitivityProfile", "logIntake",
                                       "importRecipeFromUrl", "importRecipeFromText", "createRecipe", "workshopTurn"]
    /// Every Étel operation the app can call; one of these falling through unanswered is a bug in this file.
    private static let foodOps: Set<String> = [
        "getFuelDay", "getFuelPlan", "draftMealFromAi", "createMeal", "logWater", "upsertPlannedSkip", "listRecipes", "getRecipe",
        "importRecipeFromUrl", "importRecipeFromText", "importRecipeFromPhoto", "getPantry", "searchPantryCatalog",
        "lookupPantryItem", "getSensitivityProfile", "setSensitivityProfile", "getDietSettings", "getProtocol", "logIntake",
        "getMealPhoto", "putMealPhoto", "deleteMealPhoto", "deleteAllMealPhotos", "getMealCoachForDay", "deleteIntake",
        "createRecipe", "recipeLogs", "getRecipeBreakdown", "workshopTurn", "getRecipeImage", "putRecipeImage", "deleteRecipeImage",
    ]
    private static let seedMealId = "5b0e8a52-1c3d-4e0e-9a52-7d9d4c1a0b01"
    private static let recipeId = "7d2a0c74-3e5f-4a2a-9c74-9f1f6e3c2d03"
    private static let oatsId = "6c1f9b63-2d4e-4f1f-8b63-8e0e5d2b1c02"
    /// What the review has logged so far: meals added through `createMeal` (JSON), water in ml, skipped slots (`slot#n`),
    /// and the sensitivity profile as last saved.
    nonisolated(unsafe) private static var foodMeals: [String] = []
    nonisolated(unsafe) private static var foodWater = 500
    nonisolated(unsafe) private static var foodSkips: Set<String> = []
    nonisolated(unsafe) private static var foodSensitivity =
        #"{"items":[{"key":"milk","level":"intolerance","note":"laktózmentes"},{"key":"gluten","level":"avoid"}],"novaRule":{"enabled":true,"maxLevel":2}}"#
    /// The "photo" of every meal that claims one: a small warm gradient with a plate-like disc, drawn once.
    private static let pixel: Data = UIGraphicsImageRenderer(size: CGSize(width: 480, height: 240)).jpegData(withCompressionQuality: 0.8) { ctx in
        let cg = ctx.cgContext
        let colors = [UIColor(red: 0.78, green: 0.62, blue: 0.42, alpha: 1).cgColor, UIColor(red: 0.45, green: 0.30, blue: 0.20, alpha: 1).cgColor]
        if let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors as CFArray, locations: [0, 1]) {
            cg.drawLinearGradient(g, start: .zero, end: CGPoint(x: 480, y: 240), options: [])
        }
        UIColor(white: 0.96, alpha: 0.9).setFill(); cg.fillEllipse(in: CGRect(x: 110, y: 20, width: 260, height: 200))
        UIColor(red: 0.85, green: 0.72, blue: 0.5, alpha: 1).setFill(); cg.fillEllipse(in: CGRect(x: 150, y: 50, width: 180, height: 140))
    }
    /// The eight dimensions of a scored plate. `degraded` lists the ids that could not see it (weight 0 = "nincs adat").
    private static func dimensions(_ scores: [String: Double], degraded: Set<String> = []) -> String {
        let spec: [(String, String, String)] = [
            ("macro", "Kcal & makró arány", "A fehérje a helyén, a zsír kicsit kevesebb a keretnél."),
            ("micro", "Rost & mikro", "A rost a napi cél harmadát hozza."),
            ("who", "Ajánlások · WHO", "A cukor és a só is az ajánlott sávban marad."),
            ("fat_quality", "Zsírminőség", "A zsír nagyobb része telítetlen."),
            ("nova", "Feldolgozottság · NOVA", "A tányér kalóriáinak nagy része nyers vagy minimálisan feldolgozott alapanyagból jön."),
            ("plant_diversity", "Növényi diverzitás", "Három féle növényi alapanyag van a tányéron."),
            ("energy_density", "Energia-sűrűség", "Közepes energiasűrűségű étkezés."),
            ("context", "Időzítés & kontextus", "Ehhez még nincs elég adatom a mai napról."),
        ]
        return spec.map { id, label, detail in
            let off = degraded.contains(id)
            return #"{"id":"\#(id)","label":"\#(label)","weight":\#(off ? 0 : 0.12),"score":\#(off ? 0 : scores[id] ?? 0.7),"detail":"\#(detail)","coverage":\#(off ? 0 : 0.85)}"#
        }.joined(separator: ",")
    }
    private static func breakdown(_ value: Double, _ scores: [String: Double], degraded: Set<String> = []) -> String {
        #"{"value":\#(value),"confidence":0.85,"improve":[],"tools":[],"dimensions":[\#(dimensions(scores, degraded: degraded))]}"#
    }

    private static func pathDate(_ request: HTTPRequest) -> String {
        let last = (request.path ?? "").split(separator: "?").first?.split(separator: "/").last.map(String.init) ?? ""
        return last.count == 10 ? last : dayString(offset: 0)
    }

    private static func macros(_ k: Double, _ p: Double, _ c: Double, _ f: Double) -> String { #"{"kcal":\#(k),"p":\#(p),"c":\#(c),"f":\#(f)}"# }

    private static func seedMeal(date: String) -> String {
        #"{"id":"\#(seedMealId)","slot":"breakfast","loggedAt":"\#(date)T08:10:00+01:00","mealDate":"\#(date)","title":"Zabkása gyümölccsel","macros":\#(macros(420, 22, 62, 9)),"score":{"value":0.74,"breakdown":\#(breakdown(0.74, ["macro": 0.86, "micro": 0.64, "who": 0.78, "fat_quality": 0.81, "nova": 0.92, "plant_diversity": 0.55, "energy_density": 0.88, "context": 0.9]))},"items":[{"source":"pantry","pantryItemId":"\#(oatsId)","amount":60,"unit":"g","lineOrder":0,"name":"Zabpehely","nova":1,"contribution":\#(macros(228, 8, 40, 4))},{"source":"pantry","amount":120,"unit":"g","lineOrder":1,"name":"Banán","nova":1,"contribution":\#(macros(106, 1, 27, 0))}],"hasPhoto":true}"#
    }

    /// A meal as `createMeal` would answer it: the sent title and slot, the sent lines' macros summed.
    private static func createdMeal(from sent: String, date: String) -> String {
        let obj = (try? JSONSerialization.jsonObject(with: Data(sent.utf8))) as? [String: Any]
        let items = obj?["items"] as? [[String: Any]] ?? []
        func num(_ i: [String: Any], _ k: String) -> Double { (i[k] as? Double) ?? 0 }
        let lines = items.enumerated().map { n, i -> (String, Double, Double, Double, Double) in
            let share = num(i, "per") > 0 ? num(i, "amount") / num(i, "per") : 1
            return ((i["name"] as? String ?? "Étel"), num(i, "kcal") * share, num(i, "proteinG") * share, num(i, "carbsG") * share, num(i, "fatG") * share)
        }
        let sum = lines.reduce((0.0, 0.0, 0.0, 0.0)) { ($0.0 + $1.1, $0.1 + $1.2, $0.2 + $1.3, $0.3 + $1.4) }
        let title = (obj?["title"] as? String).map { String(decoding: (try? JSONEncoder().encode($0)) ?? Data(), as: UTF8.self) } ?? "null"
        let jsonItems = lines.enumerated().map { n, l in
            let name = String(decoding: (try? JSONEncoder().encode(l.0)) ?? Data(), as: UTF8.self)
            return #"{"source":"estimate","amount":1,"unit":"adag","lineOrder":\#(n),"name":\#(name),"contribution":\#(macros(l.1.rounded(), l.2.rounded(), l.3.rounded(), l.4.rounded()))}"#
        }.joined(separator: ",")
        let at = ISO8601DateFormatter().string(from: Date())
        return #"{"id":"\#(UUID().uuidString.lowercased())","slot":"\#(obj?["slot"] as? String ?? "snack")","loggedAt":"\#(at)","mealDate":"\#(date)","title":\#(title),"macros":\#(macros(sum.0.rounded(), sum.1.rounded(), sum.2.rounded(), sum.3.rounded())),"score":{"value":0.68,"breakdown":\#(breakdown(0.68, ["macro": 0.71, "micro": 0.42, "who": 0.6, "fat_quality": 0.55, "nova": 0.38, "plant_diversity": 0.3, "energy_density": 0.74], degraded: ["context"]))},"items":[\#(jsonItems)],"hasPhoto":false}"#
    }

    private static func foodPlan(date: String) -> String {
        func window(_ slot: String, _ kind: String, _ label: String, _ from: String, _ to: String, _ key: String, _ budget: String,
                    state: String, logged: String = "", suggestion: String = "") -> String {
            let st = foodSkips.contains(key) ? "skipped" : state
            let sug = (st == "now" || st == "pending") && !suggestion.isEmpty ? #","suggestion":\#(suggestion)"# : ""
            return #"{"slot":"\#(slot)","kind":"\#(kind)","label":"\#(label)","from":"\#(from)","to":"\#(to)","budget":\#(budget),"state":"\#(st)","loggedMealIds":[\#(logged)]\#(sug)}"#
        }
        let recipe = #"{"kind":"recipe","recipeId":"\#(recipeId)","text":"Csirkés rizs zöldségekkel","reason":"belefér a fehérjébe, és laktózmentes"}"#
        let fish = #"{"kind":"ingredients","text":"Lazac, burgonya és saláta","reason":"a nap fehérjéjéből még 38 g hiányzik"}"#
        let windows = [
            window("breakfast", "meal", "Reggeli", "07:00", "09:00", "breakfast#1", macros(600, 40, 70, 18), state: "done", logged: #""\#(seedMealId)""#),
            window("snack", "snack", "Tízórai", "10:00", "11:00", "snack#1", macros(200, 15, 20, 6), state: "missed"),
            window("lunch", "meal", "Ebéd", "12:00", "14:00", "lunch#1", macros(700, 50, 80, 20), state: "now", suggestion: recipe),
            window("snack", "snack", "Uzsonna", "16:00", "17:00", "snack#2", macros(200, 15, 20, 6), state: "pending"),
            window("dinner", "meal", "Vacsora", "19:00", "21:00", "dinner#1", macros(700, 50, 80, 20), state: "pending", suggestion: fish),
        ].joined(separator: ",")
        let skipped = foodSkips.count * 200
        return #"{"date":"\#(date)","windows":[\#(windows)],"remaining":\#(macros(Double(1980 - skipped), 128, 218, 56)),"tip":{"text":"Ebédre tegyél fehérjét: a reggeli után még sok hiányzik.","reason":"a fehérje a nap célja alatt jár"}}"#
    }

    private static func foodReply(_ op: String, _ request: HTTPRequest, sent: String) -> (HTTPResponse, HTTPBody?)? {
        func created(_ text: String) -> (HTTPResponse, HTTPBody?) {
            var h = HTTPFields(); h[.contentType] = "application/json"
            return (HTTPResponse(status: .created, headerFields: h), HTTPBody(text))
        }
        let date = pathDate(request)
        switch op {
        case "getFuelDay":
            let meals = ([seedMeal(date: date)] + foodMeals).joined(separator: ",")
            return json(#"{"date":"\#(date)","targets":{"kcal":2400,"p":150,"c":260,"f":70,"water":2500},"consumed":{"kcal":420,"p":22,"c":62,"f":9,"water":\#(foodWater)},"meals":[\#(meals)],"skippedKcal":\#(foodSkips.count * 200)}"#)
        case "getFuelPlan": return json(foodPlan(date: date))
        case "getMealCoachForDay":
            return json(#"{"verdicts":[{"mealId":"\#(seedMealId)","tagline":"Jó kezdés","summary":"Jó kezdés: a fehérje a helyén, a rost viszont elmarad a napi harmadától.","improve":[],"dimensionNotes":{"micro":"Egy evőkanál chiamag vagy egy adag hüvelyes +6 g rostot ad.","nova":"Ez a tányér szinte csupa alapanyag — itt nincs mit javítani."},"glucoseTips":[{"title":"Legközelebb laposabb","body":"Tegyél bele egy evőkanál chiamagot: lassítja a felszívódást."}]}]}"#)
        case "draftMealFromAi":
            return json(#"{"draftId":"\#(UUID().uuidString.lowercased())","slot":"lunch","title":"Csirkés rizs","note":null,"items":[{"source":"pantry","pantryItemId":"\#(oatsId)","name":"Csirkemell","amount":150,"unit":"g","per":100,"basisUnit":"g","kcal":165,"proteinG":31,"carbsG":0,"fatG":3.6,"nova":1,"confidence":0.9,"needsReview":false},{"source":"estimate","name":"Barna rizs","amount":180,"unit":"g","per":100,"basisUnit":"g","kcal":123,"proteinG":2.7,"carbsG":26,"fatG":1,"confidence":0.5,"needsReview":true}]}"#)
        case "createMeal":
            let meal = createdMeal(from: sent, date: dayString(offset: 0))
            foodMeals.append(meal)
            return created(meal)
        case "putMealPhoto": return json(#"{"bytes":\#(pixel.count),"width":1,"height":1}"#)
        case "getMealPhoto":
            var h = HTTPFields(); h[.contentType] = "image/png"
            return (HTTPResponse(status: .ok, headerFields: h), HTTPBody(pixel))
        case "deleteMealPhoto", "deleteAllMealPhotos", "deleteIntake": return (HTTPResponse(status: .noContent), nil)
        case "logWater":
            let obj = (try? JSONSerialization.jsonObject(with: Data(sent.utf8))) as? [String: Any]
            let ml = obj?["amountMl"] as? Int ?? 250
            foodWater += ml
            return created(#"{"id":"\#(UUID().uuidString.lowercased())","date":"\#(obj?["date"] as? String ?? dayString(offset: 0))","amountMl":\#(ml)}"#)
        case "upsertPlannedSkip":
            let obj = (try? JSONSerialization.jsonObject(with: Data(sent.utf8))) as? [String: Any]
            let key = obj?["sessionKey"] as? String ?? ""
            foodSkips.insert(key)
            return json(#"{"id":"\#(UUID().uuidString.lowercased())","date":"\#(obj?["date"] as? String ?? dayString(offset: 0))","kind":"MEAL","sessionKey":"\#(key)","reasonCategory":"\#(obj?["reasonCategory"] as? String ?? "NONE")","source":"USER","serious":false,"freePass":false,"excused":false,"plannedKcal":\#(obj?["plannedKcal"] as? Int ?? 0)}"#)
        case "lookupPantryItem":
            let q = request.path?.split(separator: "?").last.flatMap { $0.split(separator: "=").last }.map(String.init) ?? ""
            if q.hasSuffix("0000") { return json(#"{"source":"NONE","results":[]}"#) }
            if q.hasSuffix("1111") {
                return json(#"{"source":"CATALOG","results":[{"name":"Zabpehely","per":100,"unit":"g","kcal":370,"proteinG":13,"carbsG":60,"fatG":7,"nova":1,"allergens":{"gluten":"contains"}}]}"#)
            }
            return json(#"{"source":"OFF","results":[{"name":"Protein szelet","brand":"Pelda","barcode":"5997001234567","per":100,"unit":"g","kcal":380,"proteinG":30,"carbsG":35,"fatG":12,"nova":4,"allergens":{"milk":"contains","nuts":"traces","soybeans":"unknown"},"servingSize":"40 g","servingQuantity":40}]}"#)
        case "listRecipes":
            if UserDefaults.standard.string(forKey: "previewRecipes") == "empty" { return json(#"{"recipes":[]}"#) }
            return json(#"{"recipes":[\#((previewLibrary + foodRecipes).joined(separator: ","))]}"#)
        case "getRecipe":
            let id = request.path?.split(separator: "/").last.map(String.init) ?? recipeId
            let all = previewLibrary + foodRecipes
            return json(all.first { $0.contains(id) } ?? all[0])
        case "createRecipe":
            let obj = (try? JSONSerialization.jsonObject(with: Data(sent.utf8))) as? [String: Any]
            let lines = (obj?["ingredients"] as? [[String: Any]] ?? [])
            let name = (obj?["name"] as? String ?? "Recept").replacingOccurrences(of: "\"", with: "\\\"")
            let grams = lines.reduce(0.0) { $0 + ($1["amount"] as? Double ?? 0) }
            let json = recipeJSON(id: UUID().uuidString.lowercased(), name: name, category: obj?["category"] as? String ?? "lunch",
                                  servings: obj?["servings"] as? Int ?? 1, kcal: grams * 1.4, p: grams * 0.09, c: grams * 0.15, f: grams * 0.04)
            foodRecipes.append(json)
            return created(json)
        case "recipeLogs":
            return json(#"{"recentLogs":[{"mealId":"\#(seedMealId)","slot":"lunch","loggedAt":"\#(ISO8601DateFormatter().string(from: Date().addingTimeInterval(-3 * 86400)))","kcal":660,"p":50,"c":75,"f":15,"score":0.78},{"mealId":"\#(UUID().uuidString.lowercased())","slot":"dinner","loggedAt":"\#(ISO8601DateFormatter().string(from: Date().addingTimeInterval(-9 * 86400)))","kcal":640,"p":48,"c":70,"f":16,"score":0.71}]}"#)
        case "getRecipeBreakdown":
            return json(#"{"fitsFor":["post_workout"],"breakdown":{"value":0.78,"confidence":0.9,"tagline":"Jó fehérjeforrás, kiegyensúlyozott tányér","summary":"A recept fehérjében erős, a zsír mértékletes, és nincs benne feldolgozott összetevő.","dimensions":[{"id":"macro","label":"Makrók","weight":0.5,"score":0.82,"detail":"A fehérje a recept energiájának 28%-a, a szénhidrát 45%, a zsír 27%.","coverage":1},{"id":"micro","label":"Rost","weight":0.25,"score":0.7,"detail":"Adagonként 7 g rost.","coverage":0.8},{"id":"nova","label":"Feldolgozottság","weight":0.25,"score":0.95,"detail":"Minden összetevő nyers vagy minimálisan feldolgozott.","coverage":1}],"improve":[],"tools":[]}}"#)
        case "workshopTurn":
            let obj = (try? JSONSerialization.jsonObject(with: Data(sent.utf8))) as? [String: Any]
            let asked = (obj?["message"] as? String ?? "").replacingOccurrences(of: "\"", with: "")
            return json(#"{"reply":"Ezt találtam ki: \#(asked.isEmpty ? "egy gyors vacsorát" : "„" + asked.prefix(40) + "”") alapján egy túrós-zabos tálat, 32 g fehérjével adagonként. Mondd, ha cserélnél valamit.","draft":{"name":"Túrós-zabos tál","category":"breakfast","servings":1,"steps":["Keverd össze a túrót a zabbal.","Add hozzá a gyümölcsöt."],"lines":[{"source":"pantry","pantryItemId":"\#(oatsId)","name":"Zabpehely","amount":60,"unit":"g"},{"source":"estimate","name":"Tehéntúró","amount":200,"unit":"g"}]}}"#)
        case "getRecipeImage":
            var h = HTTPFields(); h[.contentType] = "image/png"
            return (HTTPResponse(status: .ok, headerFields: h), HTTPBody(pixel))
        case "putRecipeImage": return json(#"{"bytes":\#(pixel.count),"width":1,"height":1}"#)
        case "deleteRecipeImage": return (HTTPResponse(status: .noContent), nil)
        case "importRecipeFromUrl", "importRecipeFromText", "importRecipeFromPhoto":
            return json(#"{"result":{"name":"Tejszínes gombás tészta","category":"dinner","servings":2,"steps":["Főzd meg a tésztát.","Pirítsd meg a gombát.","Keverd össze a kettőt."],"sourceUrl":null,"structured":true,"needsReview":true,"lines":[{"source":"estimate","name":"tészta","amount":200,"unit":"g","match":{"catalogId":"33359b8f-e90a-45d5-8b8f-a4c13d1d0f2f","confidence":0.9,"needsReview":false},"sourceText":"20 dkg tészta"},{"source":"estimate","name":"Tejszín","amount":2,"unit":"dl","match":{"catalogId":"33359b8f-e90a-45d5-8b8f-a4c13d1d0f2f","confidence":0.5,"needsReview":true},"sourceText":"2 dl főzőtejszín","allergens":{"milk":"contains"}},{"source":"estimate","name":"gomba","amount":250,"unit":"g","match":{"confidence":0.2,"needsReview":true},"sourceText":"25 dkg gomba"}]}}"#)
        case "getPantry":
            return json(#"{"ingredients":[{"id":"\#(oatsId)","kind":"food","name":"Zabpehely","brand":null,"source":"manual","category":null,"per":100,"unit":"g","macros":{"kcal":370,"p":13,"c":60,"f":7},"price":null,"priceUnit":null,"pkg":null,"micros":[],"nova":1,"lastUsed":"-","usedInRecipes":2,"catalogId":"33359b8f-e90a-45d5-8b8f-a4c13d1d0f2f","catalogEditable":true}],"stash":[\#(stashRow("22b49e70-d8f9-44c4-9a7e-93b1c0cdc12d", "D3-vitamin", "4000 NE")),\#(stashRow("ff027e5c-b6d7-42a2-be5c-719e1abeaf0b", "Magnézium-glicinát", "400 mg")),\#(stashRow("11a38d6f-c7e8-43b3-8f6d-82a0bfbcb01c", "Omega-3", "2 g"))],"imports":[],"suggestions":[]}"#)
        case "searchPantryCatalog":
            return json(#"[{"id":"33359b8f-e90a-45d5-8b8f-a4c13d1d0f2f","kind":"food","name":"Zabpehely","source":"manual","per":100,"unit":"g","kcal":370,"proteinG":13,"carbsG":60,"fatG":7,"nova":1,"allergens":{"gluten":"contains"}}]"#)
        case "getSensitivityProfile": return json(foodSensitivity)
        case "setSensitivityProfile": foodSensitivity = sent; return json(sent)
        case "getDietSettings":
            return json(#"{"splitPreset":"balanced","proteinTier":"moderate","waterMl":2500,"fiberG":30,"dayTypeShiftKcal":0,"learningEnabled":true}"#)
        case "getProtocol":
            return json(#"{"active":{"id":"cc7f5b29-83a4-4f7f-8b29-4e6ebd8b7c08","version":3,"builtAt":"2026-11-01T06:00:00Z","status":"active","items":[{"id":"dd805c3a-94b5-4080-9c3a-5f7fce9c8d09","pantryItemId":"22b49e70-d8f9-44c4-9a7e-93b1c0cdc12d","slotKey":"morning","pinned":false,"placementSource":"rule"},{"id":"ab036d4c-0aa1-4aa1-8c4b-6a8aaed0a00b","pantryItemId":"11a38d6f-c7e8-43b3-8f6d-82a0bfbcb01c","slotKey":"morning","pinned":false,"placementSource":"rule"},{"id":"ee916d4b-a5c6-4191-ad4b-608d0fad9e0a","pantryItemId":"ff027e5c-b6d7-42a2-be5c-719e1abeaf0b","slotKey":"evening","dose":"2 db","pinned":true,"placementSource":"user"}]},"history":[]}"#)
        case "logIntake":
            let obj = (try? JSONSerialization.jsonObject(with: Data(sent.utf8))) as? [String: Any]
            return created(#"{"id":"\#(UUID().uuidString.lowercased())","pantryItemId":"\#(obj?["pantryItemId"] as? String ?? oatsId)","takenAt":"\#(ISO8601DateFormatter().string(from: Date()))","takenDate":"\#(dayString(offset: 0))"}"#)
        default: return nil
        }
    }

    private static func stashRow(_ id: String, _ name: String, _ dose: String) -> String {
        #"{"id":"\#(id)","name":"\#(name)","brand":null,"type":"supplement","category":null,"dose":"\#(dose)","form":null,"protocol":"","timing":"","taken":false,"macros":\#(macros(0, 0, 0, 0)),"catalogId":"\#(id)","catalogEditable":false}"#
    }

    /// What the review has saved as recipes so far (JSON).
    nonisolated(unsafe) private static var foodRecipes: [String] = []

    private static func recipeJSON(id: String, name: String, category: String, servings: Int, kcal: Double, p: Double, c: Double, f: Double,
                                   allergens: String = "{}", hasImage: Bool = false, steps: String = #"["Süsd meg a csirkét.","Főzd meg a rizst.","Keverd össze."]"#) -> String {
        #"{"id":"\#(id)","name":"\#(name)","slot":"\#(category)","category":"\#(category)","servings":\#(servings),"prepMins":15,"cookMins":25,"tags":[],"starred":false,"role":"standard","createdDate":"2026-10-01","novaDominant":1,"macros":\#(macros(kcal, p, c, f)),"mezoFit":{"score":0.78,"fitsFor":[]},"timesLogged":0,"avgScore":0,"lastLogged":"—","hasImage":\#(hasImage),"allergens":\#(allergens),"ingredients":[{"pantryItemId":"\#(oatsId)","amount":300,"unit":"g","note":null,"lineOrder":0,"name":"Csirkemell","contribution":\#(macros(kcal * 0.6, p * 0.8, c * 0.1, f * 0.4))},{"pantryItemId":"\#(oatsId)","amount":150,"unit":"g","note":null,"lineOrder":1,"name":"Rizs","contribution":\#(macros(kcal * 0.4, p * 0.2, c * 0.9, f * 0.6))}],"steps":\#(steps)}"#
    }

    private static var previewLibrary: [String] {
        [recipeJSON(id: recipeId, name: "Görög csirkesaláta", category: "lunch", servings: 2, kcal: 960, p: 92, c: 40, f: 44, hasImage: true),
         recipeJSON(id: "1e4b7a85-5a10-4c4b-8a85-b1a28a5e4f05", name: "Sült lazac barna rizzsel", category: "dinner", servings: 2, kcal: 1280, p: 84, c: 120, f: 52, hasImage: true),
         recipeJSON(id: "2f5c8b96-6b21-4d5c-9b96-c2b39b6f5a06", name: "Túrós zabkása áfonyával", category: "breakfast", servings: 1, kcal: 523, p: 25, c: 60, f: 18,
                    allergens: #"{"milk":"contains","gluten":"contains"}"#),
         recipeJSON(id: "3a6d9ca7-7c32-4e6d-8ca7-d3c4ac7a6b07", name: "Rántotta avokádóval, egy nagyon hosszú névvel, hogy lássuk, hova törik", category: "breakfast", servings: 1, kcal: 480, p: 28, c: 12, f: 36,
                    allergens: #"{"egg":"contains"}"#)]
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
        case "generateCheckInLine":
            return json(#"{"line":"Délben még 6 voltál, most 5, és a HRV-d is a szokott alatt. Egyél 17:00 körül egy banánt joghurttal, hogy az edzésre maradjon erőd."}"#)
        case "addFocus":
            // The focus as the server would keep it: the sent text, a fresh id.
            let obj = (try? JSONSerialization.jsonObject(with: Data(sent.utf8))) as? [String: Any]
            let text = (obj?["text"] as? String ?? "").replacingOccurrences(of: "\"", with: "\\\"")
            return json(#"{"id":"\#(UUID().uuidString.lowercased())","focusDate":"\#(obj?["date"] as? String ?? queryDate(request))","text":"\#(text)"}"#)
        case "removeFocus":
            return (HTTPResponse(status: .noContent), nil)
        case "putDayClose":
            return json(#"{"date":"\#(queryDate(request))","closedAt":"\#(ISO8601DateFormatter().string(from: Date()))","planGoals":[],"source":"boop"}"#)
        case "createJournalEntry":
            var h = HTTPFields(); h[.contentType] = "application/json"
            return (HTTPResponse(status: .created, headerFields: h),
                    HTTPBody(#"{"id":"\#(UUID().uuidString.lowercased())","occurredOn":"\#(queryDate(request))","text":"x","source":"boop","createdAt":"2026-11-12T20:31:00Z"}"#))
        case "transcribeVoiceNote":
            return json(#"{"text":"Jól ment a prezentáció, a röpi után kellemesen elfáradtam."}"#)
        case "getDayClose":
            return (HTTPResponse(status: .notFound), nil)
        case "listDayCloses": return json(pastCloses())
        case "listCheckInsForDay": return json(pastCheckIns(on: queryDate(request)))
        case "generateDayCloseLine":
            return json(#"{"line":"Jó nap volt: a prezentáció sikerült, a fehérje és az edzés is megvolt. Délután leeresztettél, de estére összeszedted magad."}"#)
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

    // MARK: - Past days for Napló (invented; offsets from today)

    private static func dayString(offset: Int) -> String {
        var greg = Calendar(identifier: .gregorian); greg.timeZone = .current
        let d = greg.date(byAdding: .day, value: offset, to: Date()) ?? Date()
        let c = greg.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 2026, c.month ?? 1, c.day ?? 1)
    }

    /// Closes of the days before today: a phone close with a journal line, a web close without a rating, and a few more.
    private static func pastCloses() -> String {
        func close(_ offset: Int, rating: Int?, energy: Int?, goal: String?, outcome: String?, journal: String?, web: Bool = false) -> String {
            let at = ISO8601DateFormatter().string(from: Calendar.current.date(byAdding: .day, value: offset, to: Date()) ?? Date())
            func q(_ s: String?) -> String { s.map { String(decoding: (try? JSONEncoder().encode($0)) ?? Data(), as: UTF8.self) } ?? "null" }
            return #"{"date":"\#(dayString(offset: offset))","closedAt":"\#(at)","eveningEnergy":\#(energy.map(String.init) ?? "null"),"dayRating":\#(rating.map(String.init) ?? "null"),"goalText":\#(q(goal)),"goalOutcome":\#(q(outcome)),"planGoals":[{"id":"protein","title":"150 g fehérje","result":"152 g","met":true}],"journalText":\#(q(journal)),"source":"\#(web ? "web" : "boop")"}"#
        }
        return "[" + [
            close(-1, rating: 4, energy: 4, goal: "Ügyfélprezentáció 14:00", outcome: "done",
                  journal: "Jól ment a prezentáció, a röpi után kellemesen elfáradtam."),
            close(-2, rating: nil, energy: nil, goal: "Meal prep a hétre", outcome: "partial",
                  journal: "Fáradt voltam, a főzés fele kimaradt.\nHolnap folytatom.", web: true),
            close(-4, rating: 2, energy: 3, goal: "Vállak és hát edzés", outcome: "no", journal: nil),
            close(-5, rating: 5, energy: 8, goal: nil, outcome: nil, journal: "Hosszú séta, jó nap."),
            close(-9, rating: 3, energy: 5, goal: "Beadandó vázlata", outcome: "done", journal: nil),
        ].joined(separator: ",") + "]"
    }

    private static let pastCheckInDays: [Int: [(slot: String, hour: Int, energy: Int)]] = [
        -1: [("06:30", 7, 7), ("10:00", 12, 6), ("14:00", 16, 5)],
        -2: [("06:30", 8, 5), ("14:00", 15, 4)],
        -3: [("06:30", 7, 6), ("10:00", 11, 7)],
        -4: [("06:30", 7, 4), ("10:00", 12, 3), ("14:00", 16, 4)],
        -5: [("06:30", 7, 8), ("10:00", 12, 8)],
        -9: [("10:00", 12, 5)],
    ]

    private static func pastCheckIns(on date: String) -> String {
        guard let offset = pastCheckInDays.keys.first(where: { dayString(offset: $0) == date }), let list = pastCheckInDays[offset] else { return "[]" }
        let items = list.map { c -> String in
            let at = Calendar.current.date(bySettingHour: c.hour, minute: 10, second: 0, of: Calendar.current.date(byAdding: .day, value: offset, to: Date()) ?? Date()) ?? Date()
            return #"{"id":"\#(UUID().uuidString.lowercased())","date":"\#(date)","slotTime":"\#(c.slot)","state":"done","energy":\#(c.energy),"savedAt":"\#(ISO8601DateFormatter().string(from: at))"}"#
        }
        return "[" + items.joined(separator: ",") + "]"
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
        // `-previewEvening YES`: the day is behind (check-ins, meals, the session done); `-previewRecovery YES`: kímélő
        // mód, day 2 of a cold, no session.
        let evening = UserDefaults.standard.bool(forKey: "previewEvening")
        let recovering = UserDefaults.standard.bool(forKey: "previewRecovery")
        let forma = recovering
            ? #"{"key":"forma","score":42,"display":"42","caption":"kímélő","headline":"Ma csak pihenj","sentence":"A pulzusod még öt ütéssel magasabb. Edzés helyett ma víz, alvás és egy rövid séta, ha jólesik."}"#
            : evening
            ? #"{"key":"forma","score":78,"display":"78","caption":"jó formában","headline":"Szép nap volt","sentence":"Megvolt az edzés és 9 200 lépés. Egy esti check-in és 22:30-kor ágy, hogy holnap is így ébredj."}"#
            : #"{"key":"forma","score":74,"display":"74","caption":"jó formában","headline":"Elég jó reggel","sentence":"Az alvásod és a pulzusod rendben, az edzésnapot bírni fogod."}"#
        let alvas = evening && !recovering
            ? #"{"key":"alvas","score":78,"display":"7ó 12p","caption":"mély 1ó 28p","headline":"Hamarosan lassíts","sentence":"22:30-kor ágy: tíz órakor tedd le a telefont, és jöhet a levezetés."}"#
            : #"{"key":"alvas","score":78,"display":"7ó 12p","caption":"mély 1ó 28p","headline":"Nyugodt éjszaka","sentence":"A mély alvásod a heti átlag fölött volt."}"#
        let steps = evening ? 9200 : 3240
        let sessionTime = evening ? "18:30" : time
        let session = recovering
            ? "null"
            : #"{"title":"Vállak és hát","time":"\#(sessionTime)","plannedTime":"17:30","minutes":60,\#(evening ? #""done":true,"doneMinutes":62,"avgHr":128,"# : "")"exercises":[{"name":"Húzódzkodás","sets":4},{"name":"Evezés rúddal","sets":4},{"name":"Vállnyomás","sets":3},{"name":"Oldalemelés","sets":3}]}"#
        let logged = evening ? "true" : "false"
        let meals = #"[{"time":"08:00","title":"Zabkása gyümölccsel","kcal":420,"proteinG":22,"logged":\#(logged)},{"time":"12:30","title":"Csirkés rizs","kcal":650,"proteinG":48,"logged":\#(logged)},{"time":"19:30","title":"Lazac salátával","kcal":450,"proteinG":38,"logged":\#(logged)}]"#
        let checkins = evening
            ? #"[{"slot":"morning","time":"08:00","done":true,"summary":"energia 8 · hangulat 8"},{"slot":"midday","time":"13:00","done":true,"summary":"fókusz 7"},{"slot":"evening","time":"21:30","done":false}]"#
            : #"[{"slot":"morning","time":"08:00","done":false},{"slot":"midday","time":"13:00","done":false},{"slot":"evening","time":"21:30","done":false}]"#
        let recovery = recovering ? #"{"reason":"megfázás","day":2}"# : "null"
        let briefLines = recovering
            ? #"[{"text":"Jó reggelt! Még dolgozik benned a megfázás, ezért ma kímélő napot tartunk.","link":"heart"},{"text":"Az edzés ma szünetel, holnap újra megnézzük.","link":"day"}]"#
            : #"[{"text":"Jó reggelt! Hét órát meghaladó alvás után nyugodt napnak nézel elébe.","link":"sleep"},{"text":"A nyugalmi pulzusod a megszokott alatt van.","link":"heart"},{"text":"Ma vállak és hát edzés van, 17:30-kor.","link":"day"}]"#
        let tonightTip = recovering ? "Ma 22:00-kor feküdj le: a regeneráció alvás közben történik."
            : "Ma 22:30 körül érdemes lefeküdni, hogy a holnapi edzés előtt kipihent legyél."
        return #"""
        {"date":"\#(date)","generatedAt":"\#(date)T05:40:00Z","state":"okay","nightsKnown":12,
         "metrics":[
          \#(forma),
          \#(alvas),
          {"key":"mozgas","score":52,"display":"3 240","caption":"lépés eddig","headline":"Lassan indul a nap","sentence":"Délutánra a séta behozza a célt."},
          {"key":"fuel","score":null,"display":"–","caption":null,"headline":"Még nincs étkezés","sentence":"Az első étkezés után látszik majd."},
          {"key":"pulzus","score":66,"display":"57","caption":"nyugalmi","headline":"Nyugodt szív","sentence":"Két ütéssel a heti átlag alatt."}],
         "brief":\#(briefLines),
         "energy":{"hourly":[\#(hourly)],"dipHour":15},
         "tonightTip":"\#(tonightTip)",
         "nextMealTip":"Ebédre tegyél be egy jó adag fehérjét.",
         "conflict":\#(evening || recovering ? "null" : conflict),
         "day":{"sleep":{"bedtime":"23:05","wakeup":"06:17","totalMin":432,"deepMin":88,"remMin":96,"lightMin":238,"awakeMin":30,
                  "hypnogram":[{"stage":2,"minutes":40},{"stage":3,"minutes":50},{"stage":2,"minutes":60},{"stage":1,"minutes":45},{"stage":0,"minutes":10},{"stage":2,"minutes":90},{"stage":3,"minutes":38},{"stage":1,"minutes":51},{"stage":2,"minutes":48}]},
          "bedtimeTarget":"\#(recovering ? "22:00" : "22:30")","deepSleepWeek":[72,64,null,80,70,76,88],"restingHrWeek":[59,58,60,null,58,59,57],
          "hrToday":{"min":54,"avg":66,"max":92},"steps":\#(steps),"stepsGoal":10000,"activeKcal":210,
          "session":\#(session),
          "meals":\#(meals),
          "kcalSoFar":0,"kcalTarget":2400,"proteinG":\#(evening ? 152 : 0),"proteinTarget":150,"carbsG":0,"fatG":0,
          "checkins":\#(checkins),
          "intention":{"creed":"Egyenletesen, nem erőből.","foci":["Nyugodt tempó","Vizet inni"]},
          "observations":[\#(observations)],
          "calendar":{"count":2,"busySlots":[\#(slots)]},
          "weight":{"kg":78.4,"trendKg":78.1},"recovery":\#(recovery)}}
        """#
    }
}
#endif
