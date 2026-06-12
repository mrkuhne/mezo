package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Read side of the exercise catalog: master data, identical for every authenticated user
 * (no ownership scoping). Sorted muscle-then-name so the picker renders grouped.
 */
@Service
@RequiredArgsConstructor
public class ExerciseCatalogService {

    private final ExerciseCatalogRepository repository;
    private final TrainMapper mapper;

    public List<ExerciseCatalogItem> list() {
        return repository.findAllByOrderByMuscleAscNameAsc().stream().map(mapper::toCatalogItem).toList();
    }
}
