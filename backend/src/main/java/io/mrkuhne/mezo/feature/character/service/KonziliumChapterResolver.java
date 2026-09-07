package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads the owner's dossier once and hands back a {@link KonziliumChapters} for a round's flat
 * proposal list (mezo-xlvr final review, I4): the chapter titles, plus the chapter of every claim
 * the proposals target. Every konzílium entry point — weekly, monthly, bootstrap — and the
 * cross-talk round resolve chapters through this single reader, so a proposal can never land in
 * one chapter for the debate and another for the stored thread.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class KonziliumChapterResolver {

    private final CharacterDimensionRepository dimensionRepository;
    private final CharacterClaimRepository claimRepository;

    @Transactional(readOnly = true)
    public KonziliumChapters resolve(UUID owner, List<ClaimProposal> proposals) {
        Map<String, String> keyToTitle = new LinkedHashMap<>();
        Map<UUID, String> dimensionKeyById = new LinkedHashMap<>();
        for (CharacterDimensionEntity dimension : dimensionRepository.findByCreatedBy(owner)) {
            keyToTitle.put(dimension.getKey(), dimension.getTitle());
            dimensionKeyById.put(dimension.getId(), dimension.getKey());
        }

        Map<UUID, String> claimIdToChapterKey = new LinkedHashMap<>();
        for (ClaimProposal proposal : proposals) {
            UUID claimId = proposal.claimId();
            if (claimId == null || claimIdToChapterKey.containsKey(claimId)) {
                continue;
            }
            claimRepository.findByIdAndCreatedBy(claimId, owner)
                    .map(CharacterClaimEntity::getDimensionId)
                    .map(dimensionKeyById::get)
                    .ifPresent(chapterKey -> claimIdToChapterKey.put(claimId, chapterKey));
        }
        return new KonziliumChapters(Map.copyOf(keyToTitle), Map.copyOf(claimIdToChapterKey));
    }
}
