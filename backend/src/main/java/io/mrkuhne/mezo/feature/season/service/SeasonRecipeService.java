package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.api.dto.SeasonRecipeOption;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityProfile;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityService;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.RecipeCandidate;
import io.mrkuhne.mezo.feature.season.entity.SeasonAllowedRecipeEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonMenuSourcePort;
import io.mrkuhne.mezo.feature.season.repository.SeasonAllowedRecipeRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * „Kiválasztott receptek" (Boop B6 Évad S3): every recipe of his with whether the active season allows it and
 * whether his rules (sensitivity profile + the season's NOVA rule) let it into a menu at all.
 */
@Service
@RequiredArgsConstructor
public class SeasonRecipeService {

    private final SeasonRepository seasons;
    private final SeasonAllowedRecipeRepository allowedRepository;
    private final SeasonMenuSourcePort source;

    @Transactional(readOnly = true)
    public List<SeasonRecipeOption> options(UUID owner) {
        SeasonEntity s = seasons.findActive(owner).orElseThrow(() -> new SystemRuntimeErrorException(
            SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        Set<UUID> allowed = allowedRepository.findBySeasonId(s.getId()).stream()
            .map(SeasonAllowedRecipeEntity::getRecipeId).collect(Collectors.toSet());
        SensitivityProfile profile = source.profile(owner);
        int novaMax = s.getProcessedFoodMaxNova();
        return source.recipes(owner).stream()
            .sorted(Comparator.comparing((RecipeCandidate r) -> r.category().ordinal())
                .thenComparing(r -> r.name().toLowerCase(Locale.forLanguageTag("hu"))))
            .map(r -> {
                String reason = reason(r, profile, novaMax);
                return SeasonRecipeOption.builder()
                    .id(r.id()).name(r.name()).category(r.category().wire())
                    .kcal(r.perServing() == null ? null : r.perServing().kcal())
                    .allowed(allowed.contains(r.id()))
                    .usable(reason == null)
                    .reason(reason)
                    .build();
            })
            .toList();
    }

    public Set<UUID> hisRecipeIds(UUID owner) {
        return source.recipes(owner).stream().map(RecipeCandidate::id).collect(Collectors.toSet());
    }

    /** Why a recipe can never land in a menu, in his words; null when it can. */
    static String reason(RecipeCandidate r, SensitivityProfile profile, int novaMax) {
        if (r.perServing() == null || r.perServing().kcal() <= 0) {
            return "nincs kalóriaadata";
        }
        if (r.nova() != null && r.nova() > novaMax) {
            return "feldolgozottabb, mint az évad szabálya engedi";
        }
        if (SensitivityService.verdict(profile, r.allergens(), r.nova(), r.lactoseFree()).blocksSuggestion()) {
            return "ütközik az érzékenységeiddel";
        }
        return null;
    }
}
