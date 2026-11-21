package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.config.YearPlanProperties;
import io.mrkuhne.mezo.feature.train.service.YearGenerator.Adopted;
import io.mrkuhne.mezo.feature.train.service.YearGenerator.Block;
import io.mrkuhne.mezo.feature.train.service.YearGenerator.Input;
import io.mrkuhne.mezo.feature.train.service.YearGenerator.Note;
import io.mrkuhne.mezo.feature.train.service.YearGenerator.Result;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class YearGeneratorTest {

    private static final List<String> UPPER = List.of("chest", "back", "shoulder", "biceps", "triceps");
    private static final List<String> LOWER = List.of("quad", "ham", "glute", "calf");
    private static final List<String> ALL = List.of("chest", "back", "shoulder", "biceps", "triceps",
        "quad", "ham", "glute", "calf");

    static final YearPlanProperties P = new YearPlanProperties(52, 6, 2, 3, 14,
        Map.of("upper", UPPER, "lower", LOWER),
        List.of(List.of("back", "biceps"), List.of("chest", "triceps"), List.of("chest", "shoulder"),
            List.of("back", "shoulder"), List.of("shoulder", "triceps"), List.of("biceps", "triceps"),
            List.of("quad", "glute"), List.of("ham", "glute"), List.of("quad", "calf"), List.of("ham", "calf"),
            List.of("glute", "calf")));

    /** The baseline mav table from {@code mezo.volume.baselines}. */
    static final Map<String, Integer> MAV = Map.of("chest", 14, "back", 16, "shoulder", 12, "biceps", 10,
        "triceps", 10, "quad", 12, "ham", 10, "glute", 12, "calf", 10);

    private static final LocalDate START = LocalDate.of(2027, 1, 4);

    private static Result gen(List<String> emphasis, int blockWeeks) {
        return YearGenerator.generate(new Input(START, emphasis, blockWeeks, 2, null), P, MAV);
    }

    private static long count(Result r, String group) {
        return r.blocks().stream().filter(b -> b.focus().contains(group)).count();
    }

    private static Set<List<String>> pairSet() {
        Set<List<String>> s = new HashSet<>();
        for (List<String> pr : P.pairs()) {
            s.add(List.of(pr.get(0), pr.get(1)));
            s.add(List.of(pr.get(1), pr.get(0)));
        }
        return s;
    }

    @Test void defaultYear_eightSixWeekBlocksThenConsolidation() {
        Result r = gen(List.of(), 6);
        assertThat(r.start()).isEqualTo(START);
        assertThat(r.blocks()).extracting(Block::kind).containsExactly(
            "upper", "lower", "upper", "lower", "upper", "lower", "upper", "lower", "consolidation");
        assertThat(r.blocks()).extracting(Block::ordinal).containsExactly(1, 2, 3, 4, 5, 6, 7, 8, 9);
        assertThat(r.blocks().stream().filter(b -> !b.kind().equals("consolidation"))
            .mapToInt(Block::weeks).sum()).isEqualTo(48);
        Block last = r.blocks().get(8);
        assertThat(last.focus()).isEmpty();
        assertThat(last.weeks()).isEqualTo(2);
        assertThat(r.blocks()).noneMatch(Block::adopted);
    }

    @Test void everyGroupFocusedAtLeastOnce_forEveryLength() {
        for (int w = 4; w <= 8; w++) {
            Result r = gen(List.of(), w);
            for (String g : ALL) assertThat(count(r, g)).as("%s @%d", g, w).isGreaterThanOrEqualTo(1);
            assertThat(r.relaxed()).as("relaxed @%d", w).isEmpty();
        }
    }

    @Test void emphasisedGroupsTwice() {
        Result r = gen(List.of("shoulder", "calf"), 6);
        assertThat(count(r, "shoulder")).isEqualTo(2);
        assertThat(count(r, "calf")).isEqualTo(2);
    }

    @Test void noGroupInConsecutiveBlocks() {
        for (List<String> emphasis : List.of(List.<String>of(), List.of("shoulder", "calf"), List.of("biceps"))) {
            for (int w = 4; w <= 8; w++) {
                List<Block> bs = gen(emphasis, w).blocks();
                for (int i = 1; i < bs.size(); i++) {
                    Set<String> prev = new HashSet<>(bs.get(i - 1).focus());
                    assertThat(bs.get(i).focus()).as("%s @%d block %d", emphasis, w, i + 1)
                        .noneMatch(prev::contains);
                }
            }
        }
    }

    @Test void atMostTwoFocusPerBlock() {
        for (List<String> emphasis : List.of(List.<String>of(), List.of("shoulder", "calf"), List.of("biceps"))) {
            for (int w = 4; w <= 8; w++) {
                for (Block b : gen(emphasis, w).blocks()) {
                    assertThat(b.focus()).hasSizeLessThanOrEqualTo(2).doesNotHaveDuplicates();
                    if (!b.kind().equals("consolidation")) {
                        assertThat(b.focus()).isNotEmpty();
                        List<String> kindGroups = b.kind().equals("upper") ? UPPER : LOWER;
                        assertThat(kindGroups).containsAll(b.focus());
                    }
                }
            }
        }
    }

    @Test void pairsFromTable_inDefaultYear() {
        Result r = gen(List.of(), 6);
        assertThat(r.relaxed()).extracting(Note::code).doesNotContain("pair_relaxed");
        Set<List<String>> pairs = pairSet();
        for (Block b : r.blocks()) {
            if (b.focus().size() == 2) assertThat(pairs).contains(b.focus());
        }
    }

    @Test void allUpperEmphasised_relaxes() {
        Result r = gen(List.of("back", "chest", "shoulder", "biceps", "triceps"), 8);
        assertThat(r.blocks().stream().filter(b -> b.kind().equals("upper")).count()).isEqualTo(3);
        assertThat(r.relaxed()).filteredOn(n -> n.code().equals("emphasis_once")).extracting(Note::group)
            .containsExactly("triceps", "biceps", "shoulder", "chest");
        assertThat(r.relaxed()).filteredOn(n -> n.code().equals("emphasis_once"))
            .allMatch(n -> n.ordinal() == null);
        for (String g : UPPER) assertThat(count(r, g)).as(g).isGreaterThanOrEqualTo(1);
        assertThat(count(r, "back")).isEqualTo(2);
    }

    @Test void deterministic() {
        assertThat(gen(List.of("shoulder", "calf"), 5)).isEqualTo(gen(List.of("shoulder", "calf"), 5));
        assertThat(YearGenerator.generate(new Input(START, List.of(), 6, 2, null), P))
            .isEqualTo(YearGenerator.generate(new Input(START, List.of(), 6, 2, null), P));
    }

    @Test void adoptedBlockIsBlockOne() {
        UUID meso = UUID.fromString("00000000-0000-0000-0000-000000000001");
        Result r = YearGenerator.generate(new Input(LocalDate.of(2026, 11, 20), List.of(), 6, 2,
            new Adopted(meso, LocalDate.of(2026, 11, 18), 6, List.of("quad"))), P, MAV);
        assertThat(r.start()).isEqualTo(LocalDate.of(2026, 11, 16));
        Block one = r.blocks().get(0);
        assertThat(one.ordinal()).isEqualTo(1);
        assertThat(one.adopted()).isTrue();
        assertThat(one.mesocycleId()).isEqualTo(meso);
        assertThat(one.kind()).isEqualTo("lower");
        assertThat(one.focus()).containsExactly("quad");
        assertThat(one.weeks()).isEqualTo(6);
        assertThat(r.blocks().get(1).kind()).isEqualTo("upper");
        // (52 - 2 - 6) / 6 = 7 generated + the adopted one + consolidation
        assertThat(r.blocks()).hasSize(9);
        assertThat(r.blocks().get(8).kind()).isEqualTo("consolidation");
        // quad's single demand is met by the adopted block: at most one further (second) appearance
        assertThat(r.blocks().subList(1, 9)).filteredOn(b -> b.focus().contains("quad")).hasSizeLessThanOrEqualTo(1);
        assertThat(r.blocks().subList(1, 9)).noneMatch(Block::adopted);
        for (String g : ALL) assertThat(count(r, g)).as(g).isGreaterThanOrEqualTo(1);
    }

    @Test void adoptedWithoutFocus() {
        Result r = YearGenerator.generate(new Input(LocalDate.of(2026, 11, 16), List.of(), 6, 2,
            new Adopted(UUID.randomUUID(), LocalDate.of(2026, 11, 16), 6, List.of())), P, MAV);
        Block one = r.blocks().get(0);
        assertThat(one.adopted()).isTrue();
        assertThat(one.kind()).isEqualTo("upper");
        assertThat(one.focus()).isEmpty();
        assertThat(r.blocks().get(1).kind()).isEqualTo("lower");
        for (String g : ALL) assertThat(count(r, g)).as(g).isGreaterThanOrEqualTo(1);
    }

    @Test void unknownEmphasisGroup_isRejected() {
        assertThatThrownBy(() -> gen(List.of("neck"), 6)).isInstanceOf(SystemRuntimeErrorException.class);
    }
}
