package io.mrkuhne.mezo.feature.habit.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** One routine chain (Reggeli/Esti + user-created). Its daypart anchors the Today face. */
@Getter
@Setter
@Entity
@Table(name = "habit_chain")
@SQLDelete(sql = "update habit_chain set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class HabitChainEntity extends OwnedEntity {

    public static final String DAYPART_MORNING = "MORNING";
    public static final String DAYPART_DAY = "DAY";
    public static final String DAYPART_EVENING = "EVENING";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "chain_key", nullable = false, length = 40)
    private String chainKey;

    @Column(nullable = false, length = 80)
    private String title;

    @Column(nullable = false, length = 8)
    private String daypart;

    @Column(nullable = false)
    private Integer position;

    @Column(name = "is_active", nullable = false)
    private Boolean active = true;
}
