package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.api.dto.CatalogExerciseCreateRequest;
import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * Pure Mockito unit test — no Spring context. Covers the {@code create} retry branch that
 * {@code ExerciseCatalogSlugRaceIT} cannot reliably exercise over real HTTP + Testcontainers
 * (the two-thread race window is too narrow to land on this machine): the pre-probe says a slug
 * is free, then {@code saveAndFlush} throws {@link DataIntegrityViolationException} anyway
 * (exactly what a concurrent second insert on the same slug looks like from
 * {@code ExerciseCatalogService}'s point of view). Mirrors {@code AuthServiceTest}'s shape for
 * the identical race pattern on {@code AuthService.register}.
 */
class ExerciseCatalogServiceTest {

    private final ExerciseCatalogRepository repository = mock(ExerciseCatalogRepository.class);
    private final AppUserRepository appUserRepository = mock(AppUserRepository.class);
    private final TrainMapper mapper = mock(TrainMapper.class);

    private final ExerciseCatalogService service =
        new ExerciseCatalogService(repository, appUserRepository, mapper);

    private static final AppUserEntity AUTHOR = author();

    private static AppUserEntity author() {
        AppUserEntity a = new AppUserEntity();
        a.setId(UUID.randomUUID());
        a.setName("Race Author");
        a.setRole(AppUserEntity.UserRole.USER);
        return a;
    }

    private static CatalogExerciseCreateRequest request() {
        return CatalogExerciseCreateRequest.builder()
            .name("Race Move").muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.COMPOUND)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4)).build();
    }

    /** {@code mapper.toCatalogItem} stubbed to carry the entity's slug through, like the real MapStruct impl. */
    private void stubMapper() {
        when(mapper.toCatalogItem(any(ExerciseCatalogEntity.class))).thenAnswer(inv -> {
            ExerciseCatalogEntity e = inv.getArgument(0);
            return ExerciseCatalogItem.builder().id(e.getId()).slug(e.getSlug()).name(e.getName()).build();
        });
    }

    @Test
    void testCreate_shouldRetryWithNextSlug_whenFirstInsertRacesPastPreCheck() {
        stubMapper();
        // First probe: base is free. After the collision, second probe finds base taken, "-2" free.
        when(repository.countAllBySlugIncludingDeleted("race-move"))
            .thenReturn(0L, 1L);
        when(repository.countAllBySlugIncludingDeleted("race-move-2")).thenReturn(0L);
        when(repository.saveAndFlush(any(ExerciseCatalogEntity.class)))
            .thenThrow(new DataIntegrityViolationException("uq_exercise_catalog_slug"))
            .thenAnswer(inv -> inv.getArgument(0));

        ExerciseCatalogItem result = service.create(AUTHOR, request());

        assertThat(result.getSlug()).isEqualTo("race-move-2");
        assertThat(result.getAuthorName()).isEqualTo("Race Author");
        verify(repository, times(2)).saveAndFlush(any());
    }

    @Test
    void testCreate_shouldGiveUpAfterMaxAttempts_whenEveryInsertCollides() {
        stubMapper();
        when(repository.countAllBySlugIncludingDeleted(anyString())).thenReturn(0L);
        when(repository.saveAndFlush(any(ExerciseCatalogEntity.class)))
            .thenThrow(new DataIntegrityViolationException("uq_exercise_catalog_slug"));

        assertThatThrownBy(() -> service.create(AUTHOR, request()))
            .isInstanceOf(DataIntegrityViolationException.class);

        // Behavioural bound, asserted literally — never against the production MAX_SLUG_ATTEMPTS constant.
        verify(repository, times(3)).saveAndFlush(any());
    }

    @Test
    void testCreate_shouldPropagateImmediately_whenViolationIsNotTheSlugIndex() {
        stubMapper();
        when(repository.countAllBySlugIncludingDeleted(anyString())).thenReturn(0L);
        when(repository.saveAndFlush(any(ExerciseCatalogEntity.class)))
            .thenThrow(new DataIntegrityViolationException("ck_exercise_catalog_stim_range"));

        assertThatThrownBy(() -> service.create(AUTHOR, request()))
            .isInstanceOf(DataIntegrityViolationException.class);

        // Not our failure to retry — one attempt, not three.
        verify(repository, times(1)).saveAndFlush(any());
    }
}
