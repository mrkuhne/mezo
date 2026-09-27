package io.mrkuhne.mezo.feature.character.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** S7 (mezo-d6ivw.7): one day an exception's rule would otherwise have fired again — at most
 *  one row per (exception, day), the count that turns the next occurrence into a one-time
 *  review question. Spec 2026-09-24-mezo-emlekezete-design.md §S7. */
@Getter
@Setter
@Entity
@Table(name = "team_chat_exception_hit")
@SQLDelete(sql = "update team_chat_exception_hit set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class TeamChatExceptionHitEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "exception_id", nullable = false, columnDefinition = "uuid")
    private UUID exceptionId;

    @NotNull
    @Column(name = "hit_on", nullable = false)
    private LocalDate hitOn;

    @NotNull @Size(max = 8)
    @Pattern(regexp = "NOTES|TAP|REPLY")
    @Column(nullable = false, length = 8)
    private String source;

    @Column(name = "thread_id", columnDefinition = "uuid")
    private UUID threadId;
}
