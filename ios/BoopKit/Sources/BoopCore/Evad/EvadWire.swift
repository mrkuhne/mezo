import Foundation

// The wire shapes of Boop B6 Évad (mezo-r36n9.16, contract `api/feature/season/season.yml`). Hand-written on purpose,
// like Pénz and the block builder (see PlanTransport.swift): every enum is a plain String, so a value the server adds
// later never fails a response, unknown fields are ignored and a missing nullable is nil. A value the server could
// not compute arrives as null, and the page leaves its block out — it never invents one.

// MARK: - The draft (what Módosítás and Új évad edit)

/// One sport slot of the week (`SeasonSportSlot`). `dayOfWeek` 0 = hétfő … 6 = vasárnap.
public struct EvadSportSlot: Codable, Equatable, Hashable, Sendable {
    public var dayOfWeek: Int
    public var time: String
    public var durationMin: Int
    public var sport: String
    public init(dayOfWeek: Int, time: String, durationMin: Int, sport: String) {
        self.dayOfWeek = dayOfWeek; self.time = time; self.durationMin = durationMin; self.sport = sport
    }
}

/// What the sleep need is anchored to: his wake time (`WAKE`) or his bedtime (`BED`).
public struct EvadSleepAnchor: Codable, Equatable, Hashable, Sendable {
    public var anchor: String
    public var time: String
    public init(anchor: String, time: String) { self.anchor = anchor; self.time = time }
}

/// Where the season's training block comes from: `adopt` / `rerun` a mesocycle, or a `template`.
public struct EvadBlockChoice: Codable, Equatable, Hashable, Sendable {
    public var source: String
    public var mesocycleId: String?
    public var templateId: String?
    public init(source: String, mesocycleId: String? = nil, templateId: String? = nil) {
        self.source = source; self.mesocycleId = mesocycleId; self.templateId = templateId
    }
}

/// A season as he would set it (`SeasonDraft`). Nothing in here is saved until he accepts.
public struct EvadDraft: Codable, Equatable, Hashable, Sendable {
    public var title: String
    /// `cut` · `bulk` · `maintain`.
    public var trajectory: String
    public var targetWeightKg: Double?
    public var ratePctPerWeek: Double?
    public var kgPerWeek: Double?
    /// `YYYY-MM-DD`.
    public var startDate: String
    public var weeks: Int
    public var gymDays: [Int]
    public var gymTime: String?
    public var sport: [EvadSportSlot]
    public var sleepAnchor: EvadSleepAnchor?
    public var allowedRecipeIds: [String]
    public var block: EvadBlockChoice?

    public init(title: String, trajectory: String, targetWeightKg: Double? = nil, ratePctPerWeek: Double? = nil,
                kgPerWeek: Double? = nil, startDate: String, weeks: Int, gymDays: [Int], gymTime: String? = nil,
                sport: [EvadSportSlot] = [], sleepAnchor: EvadSleepAnchor? = nil, allowedRecipeIds: [String] = [],
                block: EvadBlockChoice? = nil) {
        self.title = title; self.trajectory = trajectory; self.targetWeightKg = targetWeightKg
        self.ratePctPerWeek = ratePctPerWeek; self.kgPerWeek = kgPerWeek; self.startDate = startDate; self.weeks = weeks
        self.gymDays = gymDays; self.gymTime = gymTime; self.sport = sport; self.sleepAnchor = sleepAnchor
        self.allowedRecipeIds = allowedRecipeIds; self.block = block
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        trajectory = try c.decodeIfPresent(String.self, forKey: .trajectory) ?? "maintain"
        targetWeightKg = try c.decodeIfPresent(Double.self, forKey: .targetWeightKg)
        ratePctPerWeek = try c.decodeIfPresent(Double.self, forKey: .ratePctPerWeek)
        kgPerWeek = try c.decodeIfPresent(Double.self, forKey: .kgPerWeek)
        startDate = try c.decode(String.self, forKey: .startDate)
        weeks = try c.decode(Int.self, forKey: .weeks)
        gymDays = try c.decodeIfPresent([Int].self, forKey: .gymDays) ?? []
        gymTime = try c.decodeIfPresent(String.self, forKey: .gymTime)
        sport = try c.decodeIfPresent([EvadSportSlot].self, forKey: .sport) ?? []
        sleepAnchor = try c.decodeIfPresent(EvadSleepAnchor.self, forKey: .sleepAnchor)
        allowedRecipeIds = try c.decodeIfPresent([String].self, forKey: .allowedRecipeIds) ?? []
        block = try c.decodeIfPresent(EvadBlockChoice.self, forKey: .block)
    }
}

/// The season's switches (`SeasonRules`) — no kcal effect, so they are saved without a preview.
public struct EvadRules: Codable, Equatable, Hashable, Sendable {
    /// 1–4; 4 = anything goes.
    public var processedFoodMaxNova: Int
    public var deloadMaintain: Bool
    public var useLearnedExpenditure: Bool
    public var proposeExperiments: Bool
    /// nil = no weekly menu.
    public var menuDay: Int?
    public var menuTime: String
    public init(processedFoodMaxNova: Int, deloadMaintain: Bool, useLearnedExpenditure: Bool, proposeExperiments: Bool,
                menuDay: Int?, menuTime: String) {
        self.processedFoodMaxNova = processedFoodMaxNova; self.deloadMaintain = deloadMaintain
        self.useLearnedExpenditure = useLearnedExpenditure; self.proposeExperiments = proposeExperiments
        self.menuDay = menuDay; self.menuTime = menuTime
    }

    /// `menuDay` is written even when nil: null is its own answer ("no weekly menu"), not "keep".
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(processedFoodMaxNova, forKey: .processedFoodMaxNova)
        try c.encode(deloadMaintain, forKey: .deloadMaintain)
        try c.encode(useLearnedExpenditure, forKey: .useLearnedExpenditure)
        try c.encode(proposeExperiments, forKey: .proposeExperiments)
        try c.encode(menuDay, forKey: .menuDay)
        try c.encode(menuTime, forKey: .menuTime)
    }
}

/// The body of `applySeason`.
public struct EvadApply: Codable, Equatable, Sendable {
    public var draft: EvadDraft
    public var fingerprint: String
    public init(draft: EvadDraft, fingerprint: String) { self.draft = draft; self.fingerprint = fingerprint }
}

// MARK: - The season

public struct EvadSeason: Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    /// `planned` · `active` · `closed`.
    public let status: String
    public let startDate: String
    public let endDate: String
    public let weeks: Int
    public let goalId: String?
    public let sleepNeedMin: Int?
    public let mesocycleId: String?
    public let rules: EvadRules
    public let draft: EvadDraft
}

// MARK: - The live preview

public struct EvadBand: Codable, Equatable, Hashable, Sendable {
    public let lowKg: Double
    public let highKg: Double
    public init(lowKg: Double, highKg: Double) { self.lowKg = lowKg; self.highKg = highKg }
}

/// The figures one side of a preview shows (`SeasonNumbers`).
public struct EvadNumbers: Codable, Equatable, Hashable, Sendable {
    public let trainDayKcal: Int
    /// nil when gym + sport days cover all seven weekdays: there is no rest day.
    public let restDayKcal: Int?
    public let proteinG: Int
    public let carbsTrainG: Int
    public let sleepNeedMin: Int
    public let bedtime: String
    public let targetDate: String?
    public let weeksToTarget: Int?
    /// `feasible` · `warnings` · `aggressive`.
    public let paceVerdict: String?
    public let kgPerWeek: Double?
    public let band: EvadBand?
    /// The week's total planned intake: the seven weekdays' targets, each with its own sessions; nil when not computed.
    public let weekKcal: Int?
    public let gymPerWeek: Int?
    public let sportPerWeek: Int?
    /// A gym + sport day's target (both sessions); nil when no weekday carries both, or an older server.
    public let trainSportDayKcal: Int?
}

public struct EvadTodo: Codable, Equatable, Hashable, Sendable {
    public let key: String
    public let title: String
    public let body: String
}

public struct EvadWarning: Codable, Equatable, Hashable, Sendable {
    public let key: String
    public let text: String
}

/// What a change would do (`SeasonPreview`). Persists nothing; `fingerprint` goes back with the accept.
public struct EvadPreview: Codable, Equatable, Sendable {
    public let before: EvadNumbers
    public let after: EvadNumbers
    public let todo: [EvadTodo]
    public let warnings: [EvadWarning]
    public let fingerprint: String
    /// The running block's re-arranged week when the draft moves the gym days (mezo-r36n9.122) — the same
    /// Elfogadom applies it; nil when the block does not change.
    public let block: EvadBlockWeek?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        before = try c.decode(EvadNumbers.self, forKey: .before)
        after = try c.decode(EvadNumbers.self, forKey: .after)
        todo = try c.decodeIfPresent([EvadTodo].self, forKey: .todo) ?? []
        warnings = try c.decodeIfPresent([EvadWarning].self, forKey: .warnings) ?? []
        fingerprint = try c.decodeIfPresent(String.self, forKey: .fingerprint) ?? ""
        block = try c.decodeIfPresent(EvadBlockWeek.self, forKey: .block)
    }
}

/// One day of the block's new week: `change` keep | move | add | drop; `weekday` 0 = hétfő (−1 = not a weekday);
/// `fromWeekday` = where a moved day came from, or which day an added one repeats.
public struct EvadBlockDay: Codable, Equatable, Sendable {
    public let weekday: Int
    public let title: String
    public let change: String
    public let fromWeekday: Int?
    public init(weekday: Int, title: String, change: String, fromWeekday: Int?) {
        self.weekday = weekday; self.title = title; self.change = change; self.fromWeekday = fromWeekday
    }
}

public struct EvadBlockWeek: Codable, Equatable, Sendable {
    public let mesocycleId: String
    public let title: String
    public let days: [EvadBlockDay]
    public let dropped: [EvadBlockDay]
    public init(mesocycleId: String, title: String, days: [EvadBlockDay], dropped: [EvadBlockDay]) {
        self.mesocycleId = mesocycleId; self.title = title; self.days = days; self.dropped = dropped
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        mesocycleId = try c.decode(String.self, forKey: .mesocycleId)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        days = try c.decodeIfPresent([EvadBlockDay].self, forKey: .days) ?? []
        dropped = try c.decodeIfPresent([EvadBlockDay].self, forKey: .dropped) ?? []
    }
}

// MARK: - The overview (the Évad tab)

public struct EvadHead: Codable, Equatable, Sendable {
    public let title: String
    public let week: Int
    public let weeks: Int
    /// `on_course` · `slower` · `faster` · `no_data` · `in_band` · `out_of_band`.
    public let status: String
    public let trajectory: String
}

public struct EvadMapPillar: Codable, Equatable, Sendable {
    /// `edzes` · `etel` · `alvas` · `suly`.
    public let key: String
    /// The headline the server already formatted ("4 edzés"); nil when unknown.
    public let value: String?
}

public struct EvadMapLink: Codable, Equatable, Sendable {
    public let from: String
    public let to: String
    /// `train_food` · `train_sleep` · `food_weight` · `sleep_food` · `food_train` · `sleep_train`.
    public let key: String
    public let value: Double?
}

public struct EvadMap: Codable, Equatable, Sendable {
    public let pillars: [EvadMapPillar]
    public let links: [EvadMapLink]

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        pillars = try c.decodeIfPresent([EvadMapPillar].self, forKey: .pillars) ?? []
        links = try c.decodeIfPresent([EvadMapLink].self, forKey: .links) ?? []
    }
}

public struct EvadWeightPoint: Codable, Equatable, Sendable {
    public let date: String
    public let kg: Double
}

public struct EvadWeight: Codable, Equatable, Sendable {
    public let series: [EvadWeightPoint]
    public let projection: [EvadWeightPoint]
    public let trendKg: Double?
    public let targetKg: Double?
    public let band: EvadBand?
    public let kgPerWeek: Double?
    public let paceVerdict: String?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        series = try c.decodeIfPresent([EvadWeightPoint].self, forKey: .series) ?? []
        projection = try c.decodeIfPresent([EvadWeightPoint].self, forKey: .projection) ?? []
        trendKg = try c.decodeIfPresent(Double.self, forKey: .trendKg)
        targetKg = try c.decodeIfPresent(Double.self, forKey: .targetKg)
        band = try c.decodeIfPresent(EvadBand.self, forKey: .band)
        kgPerWeek = try c.decodeIfPresent(Double.self, forKey: .kgPerWeek)
        paceVerdict = try c.decodeIfPresent(String.self, forKey: .paceVerdict)
    }
}

public struct EvadBlockPillar: Codable, Equatable, Sendable {
    public let title: String?
    public let mesocycleId: String?
    public let blockWeeks: Int?
    public let fromWeek: Int?
    public let toWeek: Int?
    public let gymDays: [Int]
    public let sport: [EvadSportSlot]

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        mesocycleId = try c.decodeIfPresent(String.self, forKey: .mesocycleId)
        blockWeeks = try c.decodeIfPresent(Int.self, forKey: .blockWeeks)
        fromWeek = try c.decodeIfPresent(Int.self, forKey: .fromWeek)
        toWeek = try c.decodeIfPresent(Int.self, forKey: .toWeek)
        gymDays = try c.decodeIfPresent([Int].self, forKey: .gymDays) ?? []
        sport = try c.decodeIfPresent([EvadSportSlot].self, forKey: .sport) ?? []
    }
}

public struct EvadFoodPillar: Codable, Equatable, Sendable {
    public let trainDayKcal: Int?
    /// A gym + sport day (both sessions); nil when no weekday carries both.
    public let trainSportDayKcal: Int?
    public let restDayKcal: Int?
    public let proteinG: Int?
    public let allowedCount: Int?
    public let recipeCount: Int?
    public let novaMax: Int?
}

public struct EvadSleepPillar: Codable, Equatable, Sendable {
    public let needMin: Int?
    public let baseMin: Int?
    public let bedtime: String?
    public let anchor: String?
    public let anchorTime: String?
    public let avgMin: Int?
}

public struct EvadWeightPillar: Codable, Equatable, Sendable {
    public let targetKg: Double?
    public let targetDate: String?
    public let deltaKg: Double?
    public let kgPerWeek: Double?
    public let band: EvadBand?
}

public struct EvadPillars: Codable, Equatable, Sendable {
    public let block: EvadBlockPillar
    public let food: EvadFoodPillar
    public let sleep: EvadSleepPillar
    public let weight: EvadWeightPillar
}

public struct EvadAdherence: Codable, Equatable, Sendable {
    public let foodInBand: Int
    public let foodJudged: Int
    /// training + sport — a gym + sport day counts two.
    public let sessionsDone: Int
    public let sessionsPlanned: Int
    public let nightsOk: Int
    public let nightsJudged: Int
    public let excusedDays: Int
    /// Gym and block-run sessions; nil from an older server (then only the total is known).
    public let trainingDone: Int?
    public let trainingPlanned: Int?
    public let sportDone: Int?
    public let sportPlanned: Int?

    public init(foodInBand: Int, foodJudged: Int, sessionsDone: Int, sessionsPlanned: Int, nightsOk: Int,
                nightsJudged: Int, excusedDays: Int, trainingDone: Int? = nil, trainingPlanned: Int? = nil,
                sportDone: Int? = nil, sportPlanned: Int? = nil) {
        self.foodInBand = foodInBand; self.foodJudged = foodJudged; self.sessionsDone = sessionsDone
        self.sessionsPlanned = sessionsPlanned; self.nightsOk = nightsOk; self.nightsJudged = nightsJudged
        self.excusedDays = excusedDays; self.trainingDone = trainingDone; self.trainingPlanned = trainingPlanned
        self.sportDone = sportDone; self.sportPlanned = sportPlanned
    }
}

/// One planned session of a day (`SeasonAdherenceSession`): `kind` gym · sport · run; `done` nil when excused or
/// today or later.
public struct EvadDaySession: Codable, Equatable, Sendable {
    public let kind: String
    public let excused: Bool
    public let done: Bool?
    public init(kind: String, excused: Bool, done: Bool?) { self.kind = kind; self.excused = excused; self.done = done }
}

/// One day as the server judges it (`SeasonAdherenceDay`, `GET /api/seasons/adherence`) — the single source of day
/// judgement, with or without a season. Every field the phone does not need to decide the day is optional.
public struct EvadAdherenceDay: Codable, Equatable, Sendable {
    public let date: String
    /// The food side counts: not today, not a kímélő day, something logged.
    public let judged: Bool
    /// A kímélő day — left out of every count (a reasoned skip excuses only its own session).
    public let excused: Bool
    /// `kimelo` · `skip`; nil when nothing is excused.
    public let excuse: String?
    public let kcal: Int?
    public let targetKcal: Int?
    public let foodInBand: Bool?
    public let sessionPlanned: Bool
    public let sessionDone: Bool?
    public let sleepMin: Int?
    public let needMin: Int?
    public let sleepOk: Bool?
    /// `edzesnap` · `sport` · `edzes_sport` (two sessions) · `pihenonap`; nil from an older server.
    public let dayKind: String?
    /// One per planned session kind; a gym + sport day has two. Empty from an older server.
    public let sessions: [EvadDaySession]

    public init(date: String, judged: Bool, excused: Bool, excuse: String?, kcal: Int? = nil, targetKcal: Int? = nil,
                foodInBand: Bool? = nil, sessionPlanned: Bool = false, sessionDone: Bool? = nil, sleepMin: Int? = nil,
                needMin: Int? = nil, sleepOk: Bool? = nil, dayKind: String? = nil, sessions: [EvadDaySession] = []) {
        self.date = date; self.judged = judged; self.excused = excused; self.excuse = excuse; self.kcal = kcal
        self.targetKcal = targetKcal; self.foodInBand = foodInBand; self.sessionPlanned = sessionPlanned
        self.sessionDone = sessionDone; self.sleepMin = sleepMin; self.needMin = needMin; self.sleepOk = sleepOk
        self.dayKind = dayKind; self.sessions = sessions
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = try c.decode(String.self, forKey: .date)
        judged = try c.decodeIfPresent(Bool.self, forKey: .judged) ?? false
        excused = try c.decodeIfPresent(Bool.self, forKey: .excused) ?? false
        excuse = try c.decodeIfPresent(String.self, forKey: .excuse)
        kcal = try c.decodeIfPresent(Int.self, forKey: .kcal)
        targetKcal = try c.decodeIfPresent(Int.self, forKey: .targetKcal)
        foodInBand = try c.decodeIfPresent(Bool.self, forKey: .foodInBand)
        sessionPlanned = try c.decodeIfPresent(Bool.self, forKey: .sessionPlanned) ?? false
        sessionDone = try c.decodeIfPresent(Bool.self, forKey: .sessionDone)
        sleepMin = try c.decodeIfPresent(Int.self, forKey: .sleepMin)
        needMin = try c.decodeIfPresent(Int.self, forKey: .needMin)
        sleepOk = try c.decodeIfPresent(Bool.self, forKey: .sleepOk)
        dayKind = try c.decodeIfPresent(String.self, forKey: .dayKind)
        sessions = try c.decodeIfPresent([EvadDaySession].self, forKey: .sessions) ?? []
    }
}

/// `SeasonAdherenceResponse`: the days and their counts.
public struct EvadAdherenceResponse: Codable, Equatable, Sendable {
    public let days: [EvadAdherenceDay]
    public let summary: EvadAdherence
}

public struct EvadInsight: Codable, Equatable, Sendable {
    public let key: String
    public let title: String
    public let body: String
}

public struct EvadUpcoming: Codable, Equatable, Sendable {
    public let week: Int
    /// `deload` · `end`.
    public let kind: String
    public let text: String
}

/// The one read model the Évad tab renders (`SeasonOverview`).
public struct EvadOverview: Codable, Equatable, Sendable {
    public let season: EvadSeason
    public let head: EvadHead
    public let map: EvadMap
    public let weight: EvadWeight
    public let pillars: EvadPillars
    /// S2; nil in S1 — the "Hogy megy" block is left out.
    public let adherence: EvadAdherence?
    /// S2; empty in S1 — the "Amit Boop észrevett" block is left out.
    public let insights: [EvadInsight]
    public let upcoming: [EvadUpcoming]
    /// S3 — next week's menu state; nil without a weekly menu (or from an older server).
    public let menu: EvadMenuStatus?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        season = try c.decode(EvadSeason.self, forKey: .season)
        head = try c.decode(EvadHead.self, forKey: .head)
        map = try c.decode(EvadMap.self, forKey: .map)
        weight = try c.decode(EvadWeight.self, forKey: .weight)
        pillars = try c.decode(EvadPillars.self, forKey: .pillars)
        adherence = try c.decodeIfPresent(EvadAdherence.self, forKey: .adherence)
        insights = try c.decodeIfPresent([EvadInsight].self, forKey: .insights) ?? []
        upcoming = try c.decodeIfPresent([EvadUpcoming].self, forKey: .upcoming) ?? []
        menu = try c.decodeIfPresent(EvadMenuStatus.self, forKey: .menu)
    }
}
