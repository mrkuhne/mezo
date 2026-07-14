package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.SportScheduleSlotInput;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotResponse;
import io.mrkuhne.mezo.api.dto.SportSessionCreateRequest;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.feature.progression.ProgressionGate;
import io.mrkuhne.mezo.feature.progression.mapper.LevelUpResultMapper;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.progression.sport.SportSignal;
import io.mrkuhne.mezo.feature.train.signal.SportSignalCalculator;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * T3 sport slice service: SportLogSheet writes ({@code logSportSession} — date/time default to
 * "now" server-side, the sheet has no date picker) and the recurring weekly schedule
 * ({@code getSchedule} / {@code replaceSchedule} full-replace). Reads of the session log stay in
 * {@link TrainService#listSportSessions}. Ownership is stamped from the principal on every row;
 * per house rule only the write methods carry method-level {@code @Transactional}.
 */
@Service
@RequiredArgsConstructor
public class SportService {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final SportSessionRepository sportSessionRepository;
    private final SportScheduleSlotRepository slotRepository;
    private final TrainMapper mapper;
    private final SportSignalCalculator sportSignalCalculator;
    private final ProgressionService progressionService;
    private final LevelUpResultMapper levelUpResultMapper;
    private final ObjectProvider<ProgressionGate> progressionGate;

    @Transactional
    public SportSessionResponse logSportSession(UUID createdBy, SportSessionCreateRequest req) {
        SportSessionEntity s = new SportSessionEntity();
        s.setCreatedBy(createdBy); // server-side ownership — never from the client
        s.setSport(req.getSport() != null ? req.getSport() : "volleyball"); // volleyball|cross|trx
        s.setDate(req.getDate() != null ? req.getDate() : LocalDate.now());
        s.setTime(req.getTime() != null ? req.getTime() : LocalTime.now().format(HH_MM));
        s.setDurationMin(req.getDuration());
        s.setSetsPlayed(req.getSetsPlayed());
        s.setRounds(req.getRounds());
        s.setRpe(req.getRpe());
        s.setShoulderStrain(req.getShoulderStrain());
        s.setNotes(req.getNotes());

        // Award progression XP + attach the level-up when the engine is switched on (mirrors
        // RunningService.logSession): same @Transactional, idempotent on the saved session id.
        SportSessionResponse base = mapper.toResponse(sportSessionRepository.save(s));
        if (progressionGate.getIfAvailable() != null) {
            SportSignal signal = sportSignalCalculator.compute(createdBy, s.getId());
            base.setLevelUp(levelUpResultMapper.toDto(progressionService.applySport(createdBy, signal)));
        }
        return base;
    }

    public List<SportScheduleSlotResponse> getSchedule(UUID createdBy) {
        return slotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(createdBy)
            .stream().map(mapper::toSlotResponse).toList();
    }

    @Transactional
    public List<SportScheduleSlotResponse> replaceSchedule(UUID createdBy, List<SportScheduleSlotInput> inputs) {
        // Full-list replace (replaceDayExercises pattern): soft-delete the current week
        // (@SQLDelete flips is_deleted), then insert the new slots.
        slotRepository.deleteAll(
            slotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(createdBy));
        List<SportScheduleSlotEntity> fresh = new ArrayList<>(inputs.size());
        for (SportScheduleSlotInput in : inputs) {
            SportScheduleSlotEntity s = new SportScheduleSlotEntity();
            s.setCreatedBy(createdBy);
            s.setDayOfWeek(in.getDayOfWeek());
            s.setTime(in.getTime());
            s.setDurationMin(in.getDurationMin());
            s.setKind(in.getKind());
            if (in.getSport() != null) s.setSport(in.getSport()); // volleyball|cross|trx; entity defaults volleyball
            s.setLocation(in.getLocation());
            s.setIntensityLabel(in.getIntensityLabel());
            fresh.add(slotRepository.save(s));
        }
        fresh.sort(Comparator.comparing(SportScheduleSlotEntity::getDayOfWeek)
            .thenComparing(SportScheduleSlotEntity::getTime));
        return fresh.stream().map(mapper::toSlotResponse).toList();
    }
}
