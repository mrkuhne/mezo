import Testing
@testable import BoopCore

@Suite("SubMuscles — the fine muscle names and the add sheet's summary (mezo-r36n9.127)")
struct SubMusclesTests {
    @Test(.timeLimit(.minutes(1))) func namesEveryCatalogueToken() {
        #expect(SubMuscles.order.count == 21, "the catalogue's 21 tokens")
        #expect(SubMuscles.name("back-wide") == "Hát · felső")
        #expect(SubMuscles.name("traps") == "Hát · csuklyás")
        #expect(SubMuscles.name("chest-lower") == "Mell · alsó")
        #expect(SubMuscles.name("shoulder-rear") == "Váll · hátsó")
        #expect(SubMuscles.name("biceps-brachialis") == "Bicepsz · brachialis")
        #expect(SubMuscles.name("triceps-medial") == "Tricepsz · belső fej")
        #expect(SubMuscles.name("quad") == "Comb")
        #expect(SubMuscles.name("ham") == "Combhajlító")
        #expect(SubMuscles.name("glute") == "Far")
        #expect(SubMuscles.name("calf") == "Vádli")
        #expect(SubMuscles.name("core") == "Törzs")
        #expect(SubMuscles.order.allSatisfy { SubMuscles.name($0) != "Egyéb" })
    }

    @Test(.timeLimit(.minutes(1))) func legacyKeysNameTheirGroup() {
        #expect(SubMuscles.name("back") == "Hát")
        #expect(SubMuscles.name("lats") == "Hát")
        #expect(SubMuscles.name("quads") == "Comb")
        #expect(SubMuscles.name("BACK-MID") == "Hát · középső")
        #expect(SubMuscles.name("forearm") == "Egyéb")
    }

    @Test(.timeLimit(.minutes(1))) func summaryNamesWholeGroupsAndParts() {
        #expect(SubMuscles.summary([]).isEmpty)
        #expect(SubMuscles.summary(["chest-upper", "back-mid"]) == ["Hát · középső", "Mell · felső"], "body order")
        #expect(SubMuscles.summary(["chest-upper", "chest-mid", "chest-lower"]) == ["Mell"], "a whole group by its name")
        #expect(SubMuscles.summary(["back-wide", "back-mid"]) == ["Hát · felső, középső"])
        #expect(SubMuscles.summary(["quad", "glute"]) == ["Comb", "Far"], "leg parts are names of their own")
        #expect(SubMuscles.summary(["quad", "ham", "glute", "calf"]) == ["Láb"])
        #expect(SubMuscles.summary(["core"]) == ["Törzs"])
        #expect(SubMuscles.shortSummary(["chest-upper", "back-mid", "quad"]) == "Hát · középső +2")
        #expect(SubMuscles.shortSummary(["calf"]) == "Vádli")
        #expect(SubMuscles.shortSummary([]) == nil)
    }

    @Test(.timeLimit(.minutes(1))) func lowMarkSitsOnTheGroupOrTheStandAlonePart() {
        let back = SubMuscles.groups[0], legs = SubMuscles.groups[5]
        #expect(SubMuscles.groupLow(back, under: ["back"]))
        #expect(!SubMuscles.groupLow(back, under: ["biceps"]))
        #expect(!SubMuscles.groupLow(legs, under: ["quad"]), "the legs group has no band of its own")
        #expect(SubMuscles.partLow(legs, legs.parts[0], under: ["quad"]))
        #expect(!SubMuscles.partLow(back, back.parts[0], under: ["back"]), "never on a back part")
    }

    @Test(.timeLimit(.minutes(1))) func groupNamesSpellTheCoarseGroupsLikeTheSubMuscles() {
        let names = ["back", "chest", "shoulder", "biceps", "triceps", "quad", "ham", "glute", "calf", "core"]
            .map(SubMuscles.groupName)
        #expect(names == ["Hát", "Mell", "Váll", "Bicepsz", "Tricepsz", "Comb", "Combhajlító", "Far", "Vádli", "Törzs"])
        #expect(SubMuscles.groupName("traps") == "Hát", "the traps count with the back")
        #expect(SubMuscles.groupName("chest-upper") == "Mell", "a fine token names its group")
    }
}
