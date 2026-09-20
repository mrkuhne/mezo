package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "companion_preferences")
@SQLDelete(sql = "update companion_preferences set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CompanionPreferencesEntity extends OwnedEntity {
    @Id @GeneratedValue @Column(columnDefinition = "uuid")
    private UUID id;
    @NotNull @Size(max = 4000) @Column(name = "about_me", nullable = false, length = 4000)
    private String aboutMe = "";
    @NotNull @Size(max = 4000) @Column(name = "custom_instructions", nullable = false, length = 4000)
    private String customInstructions = "";
    @NotNull @Column(name = "use_learned_profile", nullable = false)
    private Boolean useLearnedProfile = true;
}
