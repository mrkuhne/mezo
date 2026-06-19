package io.mrkuhne.mezo.feature.biometrics.profile.mapper;

import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Entity -> {@link BiometricProfileResponse}. The entity stores {@code sex} and
 * {@code activityLevel} as plain {@code String} (M|F and SEDENTARY|..|EXTRA); the generated DTO uses
 * inner enums, so each is converted explicitly via the enum's {@code fromValue(String)}.
 * {@code heightCm}, {@code birthDate} and {@code bodyFatPct} map 1:1 (matching
 * {@code BigDecimal}/{@code LocalDate}). {@code activityLevel} is nullable until captured.
 */
@Mapper(componentModel = "spring")
public interface BiometricProfileMapper {

    @Mapping(target = "sex",
        expression = "java(BiometricProfileResponse.SexEnum.fromValue(entity.getSex()))")
    @Mapping(target = "activityLevel",
        expression = "java(toActivityLevelEnum(entity.getActivityLevel()))")
    BiometricProfileResponse toResponse(BiometricProfileEntity entity);

    default BiometricProfileResponse.ActivityLevelEnum toActivityLevelEnum(String activityLevel) {
        return activityLevel == null ? null
            : BiometricProfileResponse.ActivityLevelEnum.fromValue(activityLevel);
    }
}
