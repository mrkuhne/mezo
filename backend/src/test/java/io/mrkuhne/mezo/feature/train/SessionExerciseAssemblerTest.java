package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.service.SessionExerciseAssembler;
import io.mrkuhne.mezo.feature.train.service.SessionExerciseAssembler.Entry;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SessionExerciseAssemblerTest {

    private static final UUID DAY = UUID.randomUUID();
    private static final UUID INSTANCE = UUID.randomUUID();
    private static final UUID CLOSING_CATALOG = UUID.randomUUID();

    private static ExerciseEntity row(String name, UUID session, int order) {
        ExerciseEntity e = new ExerciseEntity();
        e.setId(UUID.randomUUID());
        e.setName(name);
        e.setWorkoutSessionId(session);
        e.setOrderIndex(order);
        e.setWorkingSets(4);
        return e;
    }

    private static List<String> names(List<Entry> entries) {
        return entries.stream().map(en -> en.row().getName()).toList();
    }

    private static Entry by(List<Entry> entries, String name) {
        return entries.stream().filter(en -> en.row().getName().equals(name)).findFirst().orElseThrow();
    }

    @Test
    void testAssemble_shouldPassTheTemplateThrough_whenNothingChanged() {
        ExerciseEntity a = row("A", DAY, 0);
        ExerciseEntity b = row("B", DAY, 1);

        List<Entry> out = SessionExerciseAssembler.assemble(
            INSTANCE, List.of(b, a), List.of(), List.of(), Map.of(), Set.of());

        assertThat(names(out)).containsExactly("A", "B");
        assertThat(out).allSatisfy(en -> {
            assertThat(en.changeScope()).isNull();
            assertThat(en.planSlot()).isTrue();
            assertThat(en.workingSetsOverride()).isNull();
        });
    }

    @Test
    void testAssemble_shouldPutTheNewRowInPlace_whenTheReplacedRowHasNoLoggedSet() {
        ExerciseEntity a = row("A", DAY, 0);
        ExerciseEntity b = row("B", DAY, 1);
        ExerciseEntity x = row("X", INSTANCE, 0);
        x.setReplacesExerciseId(a.getId());

        List<Entry> out = SessionExerciseAssembler.assemble(
            INSTANCE, List.of(a, b), List.of(x), List.of(), Map.of(), Set.of());

        assertThat(names(out)).containsExactly("X", "B");
        Entry nx = by(out, "X");
        assertThat(nx.changeScope()).isEqualTo("TODAY");
        assertThat(nx.replacesName()).isEqualTo("A");
        assertThat(nx.planSlot()).isFalse();
    }

    @Test
    void testAssemble_shouldKeepTheReplacedRowWithItsLoggedCount_whenItHasLoggedSets() {
        ExerciseEntity a = row("A", DAY, 0);
        ExerciseEntity b = row("B", DAY, 1);
        ExerciseEntity x = row("X", INSTANCE, 0);
        x.setReplacesExerciseId(a.getId());
        x.setSavedToPlan(true);

        List<Entry> out = SessionExerciseAssembler.assemble(
            INSTANCE, List.of(a, b), List.of(x), List.of(), Map.of(a.getId(), 2), Set.of());

        assertThat(names(out)).containsExactly("A", "X", "B");
        Entry na = by(out, "A");
        assertThat(na.workingSetsOverride()).isEqualTo(2);
        assertThat(na.replacedByName()).isEqualTo("X");
        assertThat(na.planSlot()).isFalse();
        assertThat(by(out, "X").changeScope()).isEqualTo("MESO");
    }

    @Test
    void testAssemble_shouldHideTheMesoTemplateRowAndKeepTheDeletedRowWithSets_whenSwappedToThePlan() {
        ExerciseEntity a = row("A", DAY, 0);
        a.setDeleted(true); // soft-deleted by the MESO swap, but carries 3 sets in this instance
        ExerciseEntity aPlan = row("X", DAY, 0); // the new template row, hidden in this instance
        aPlan.setAddedInWorkoutId(INSTANCE);
        ExerciseEntity b = row("B", DAY, 1);
        ExerciseEntity x = row("X", INSTANCE, 0);
        x.setReplacesExerciseId(a.getId());
        x.setSavedToPlan(true);

        List<Entry> out = SessionExerciseAssembler.assemble(
            INSTANCE, List.of(aPlan, b), List.of(x), List.of(a), Map.of(a.getId(), 3), Set.of());

        assertThat(names(out)).containsExactly("A", "X", "B");
        assertThat(out.get(1).row()).isSameAs(x);
    }

    @Test
    void testAssemble_shouldKeepTheSlot_whenAMesoSwapReplacedARowWithoutSets() {
        ExerciseEntity a = row("A", DAY, 0);
        a.setDeleted(true);
        ExerciseEntity aPlan = row("X", DAY, 0);
        aPlan.setAddedInWorkoutId(INSTANCE);
        ExerciseEntity b = row("B", DAY, 1);
        ExerciseEntity x = row("X", INSTANCE, 0);
        x.setReplacesExerciseId(a.getId());
        x.setSavedToPlan(true);

        List<Entry> out = SessionExerciseAssembler.assemble(
            INSTANCE, List.of(aPlan, b), List.of(x), List.of(a), Map.of(), Set.of());

        assertThat(names(out)).containsExactly("X", "B");
        assertThat(out.get(0).row()).isSameAs(x);
    }

    @Test
    void testAssemble_shouldShowTheMesoTemplateRow_whenAnotherInstanceReads() {
        ExerciseEntity aPlan = row("X", DAY, 0);
        aPlan.setAddedInWorkoutId(UUID.randomUUID());
        ExerciseEntity b = row("B", DAY, 1);

        List<Entry> out = SessionExerciseAssembler.assemble(
            INSTANCE, List.of(aPlan, b), List.of(), List.of(), Map.of(), Set.of());

        assertThat(names(out)).containsExactly("X", "B");
        assertThat(by(out, "X").changeScope()).isNull();
    }

    @Test
    void testAssemble_shouldInsertAnAddBeforeTheClosingBlock_whenOnePresent() {
        ExerciseEntity a = row("A", DAY, 0);
        ExerciseEntity hang = row("Dead Hang", DAY, 1);
        hang.setCatalogId(CLOSING_CATALOG);
        ExerciseEntity add1 = row("Y", INSTANCE, 0);
        ExerciseEntity add2 = row("Z", INSTANCE, 1);

        List<Entry> out = SessionExerciseAssembler.assemble(
            INSTANCE, List.of(a, hang), List.of(add2, add1), List.of(), Map.of(), Set.of(CLOSING_CATALOG));

        assertThat(names(out)).containsExactly("A", "Y", "Z", "Dead Hang");
        assertThat(by(out, "Dead Hang").planSlot()).isFalse();
        assertThat(by(out, "Y").replacesName()).isNull();
    }

    @Test
    void testAssemble_shouldAppendAnAdd_whenNoClosingBlock() {
        ExerciseEntity a = row("A", DAY, 0);
        ExerciseEntity add = row("Y", INSTANCE, 0);

        List<Entry> out = SessionExerciseAssembler.assemble(
            INSTANCE, List.of(a), List.of(add), List.of(), Map.of(), Set.of(CLOSING_CATALOG));

        assertThat(names(out)).containsExactly("A", "Y");
    }

    @Test
    void testAssemble_shouldFollowTheChain_whenASwappedInRowIsSwappedAgain() {
        ExerciseEntity a = row("A", DAY, 0);
        ExerciseEntity x = row("X", INSTANCE, 0);
        x.setReplacesExerciseId(a.getId());
        ExerciseEntity y = row("Y", INSTANCE, 1);
        y.setReplacesExerciseId(x.getId());

        List<Entry> out = SessionExerciseAssembler.assemble(
            INSTANCE, List.of(a), List.of(y, x), List.of(), Map.of(x.getId(), 1), Set.of());

        assertThat(names(out)).containsExactly("X", "Y");
        assertThat(by(out, "X").replacedByName()).isEqualTo("Y");
        assertThat(by(out, "Y").replacesName()).isEqualTo("X");
    }

    @Test
    void testAssemble_shouldIgnoreInstanceRows_whenNoInstance() {
        ExerciseEntity a = row("A", DAY, 0);

        List<Entry> out = SessionExerciseAssembler.assemble(
            null, List.of(a), List.of(), List.of(), Map.of(), Set.of());

        assertThat(names(out)).containsExactly("A");
    }
}
