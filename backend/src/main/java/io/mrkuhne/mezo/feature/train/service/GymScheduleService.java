package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.GymScheduleSlotInput;
import io.mrkuhne.mezo.api.dto.GymScheduleSlotResponse;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Recurring weekly gym time slots (weekday->time), maintained via full-replace
 * ({@code getSchedule} / {@code replaceSchedule}). Mirrors {@link SportService}'s schedule
 * methods: the whole week is soft-deleted and re-inserted on every save. Ownership is stamped
 * from the principal on every row; per house rule only the write method carries method-level
 * {@code @Transactional}.
 */
@Service
@RequiredArgsConstructor
public class GymScheduleService {

    private final GymScheduleSlotRepository slotRepository;
    private final TrainMapper mapper;

    public List<GymScheduleSlotResponse> getSchedule(UUID createdBy) {
        return slotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(createdBy)
            .stream().map(mapper::toGymSlotResponse).toList();
    }

    @Transactional
    public List<GymScheduleSlotResponse> replaceSchedule(UUID createdBy, List<GymScheduleSlotInput> inputs) {
        // Full-list replace: soft-delete the current week (@SQLDelete flips is_deleted),
        // then insert the new slots.
        slotRepository.deleteAll(
            slotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(createdBy));
        List<GymScheduleSlotEntity> fresh = new ArrayList<>(inputs.size());
        for (GymScheduleSlotInput in : inputs) {
            GymScheduleSlotEntity s = new GymScheduleSlotEntity();
            s.setCreatedBy(createdBy);
            s.setDayOfWeek(in.getDayOfWeek());
            s.setTime(in.getTime());
            fresh.add(slotRepository.save(s));
        }
        fresh.sort(Comparator.comparing(GymScheduleSlotEntity::getDayOfWeek)
            .thenComparing(GymScheduleSlotEntity::getTime));
        return fresh.stream().map(mapper::toGymSlotResponse).toList();
    }
}
