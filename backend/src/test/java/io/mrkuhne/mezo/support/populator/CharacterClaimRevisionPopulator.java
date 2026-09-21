package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimRevisionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimRevisionSnapshot;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRevisionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class CharacterClaimRevisionPopulator {
    private final CharacterClaimRevisionRepository revisions;

    public CharacterClaimRevisionEntity createdClaim(CharacterClaimEntity claim) {
        var revision = new CharacterClaimRevisionEntity();
        revision.setCreatedBy(claim.getCreatedBy());
        revision.setClaimId(claim.getId());
        revision.setOperation("NEW");
        revision.setAfterSnapshot(ClaimRevisionSnapshot.of(claim));
        revision.setReason("A megfigyelések alapján.");
        return revisions.saveAndFlush(revision);
    }
}
