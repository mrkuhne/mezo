package io.mrkuhne.mezo.feature.biometrics.profile.mapper;

import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Entity -> {@link BiometricProfileResponse}. The entity stores {@code sex} as a plain
 * {@code String} (M|F); the generated DTO uses the inner {@link BiometricProfileResponse.SexEnum},
 * so it is converted explicitly via {@code SexEnum.fromValue(String)}. {@code heightCm},
 * {@code birthDate} and {@code bodyFatPct} map 1:1 (matching {@code BigDecimal}/{@code LocalDate}).
 */
@Mapper(componentModel = "spring")
public interface BiometricProfileMapper {

    // Task 3 (mezo-g1u): the entity has no activityLevel yet — ignore until the field + DDL land.
    @Mapping(target = "activityLevel", ignore = true)
    @Mapping(target = "sex",
        expression = "java(BiometricProfileResponse.SexEnum.fromValue(entity.getSex()))")
    BiometricProfileResponse toResponse(BiometricProfileEntity entity);
}
