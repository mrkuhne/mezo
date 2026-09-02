package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.entity.HabitChainEntity;
import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitChainRepository;
import io.mrkuhne.mezo.feature.habit.repository.HabitDefRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class HabitChainDefEntityIT extends AbstractIntegrationTest {

    @Autowired private HabitChainRepository chainRepository;
    @Autowired private HabitDefRepository defRepository;
    @Autowired private UserPopulator userPopulator;

    private UUID owner() {
        return userPopulator.createUser("habit-chain@test.hu").getId();
    }

    @Test
    void testSave_shouldRoundTripChainAndDef_whenLinked() {
        UUID owner = owner();
        HabitChainEntity chain = new HabitChainEntity();
        chain.setCreatedBy(owner);
        chain.setChainKey("MORNING");
        chain.setTitle("Reggeli rutin");
        chain.setDaypart(HabitChainEntity.DAYPART_MORNING);
        chain.setPosition(1);
        chain = chainRepository.saveAndFlush(chain);

        HabitDefEntity def = new HabitDefEntity();
        def.setCreatedBy(owner);
        def.setHabitKey("morning_sunlight");
        def.setChainId(chain.getId());
        def.setPosition(2);
        def.setTitle("Reggeli napfény");
        def.setMode(HabitDefEntity.MODE_MANUAL);
        def.setMetric(HabitDefEntity.METRIC_MANUAL);
        def.setSkillKey("recovery");
        def.setXp(10);
        def = defRepository.saveAndFlush(def);

        assertThat(defRepository.findByCreatedByAndHabitKeyAndDeletedFalse(owner, "morning_sunlight"))
            .isPresent();
        assertThat(defRepository.findByChainIdAndDeletedFalse(chain.getId())).hasSize(1);
        assertThat(def.getSkillKind()).isEqualTo(HabitDefEntity.SKILL_KIND_LIFE);
        assertThat(def.getActive()).isTrue();
    }

    @Test
    void testDelete_shouldSoftDelete_whenRepositoryDelete() {
        UUID owner = owner();
        HabitChainEntity chain = new HabitChainEntity();
        chain.setCreatedBy(owner);
        chain.setChainKey("chain_ab12cd34");
        chain.setTitle("Munka előtti");
        chain.setDaypart(HabitChainEntity.DAYPART_DAY);
        chain.setPosition(3);
        chain = chainRepository.saveAndFlush(chain);

        chainRepository.delete(chain);
        chainRepository.flush();

        assertThat(chainRepository.findByCreatedByAndChainKeyAndDeletedFalse(owner, "chain_ab12cd34"))
            .isEmpty();
    }

    @Test
    void testHabitDef_shouldRoundTripFrameworkFields() {
        UUID owner = owner();
        HabitChainEntity chain = new HabitChainEntity();
        chain.setCreatedBy(owner);
        chain.setChainKey("MORNING_FW");
        chain.setTitle("Reggeli rutin");
        chain.setDaypart(HabitChainEntity.DAYPART_MORNING);
        chain.setPosition(1);
        chain = chainRepository.saveAndFlush(chain);

        HabitDefEntity def = new HabitDefEntity();
        def.setCreatedBy(owner);
        def.setHabitKey("custom_fw01");
        def.setChainId(chain.getId());
        def.setPosition(99);
        def.setTitle("Napi szándék");
        def.setMode(HabitDefEntity.MODE_MANUAL);
        def.setMetric(HabitDefEntity.METRIC_MANUAL);
        def.setSkillKey("mindset");
        def.setXp(10);
        def.setFramework(HabitDefEntity.FRAMEWORK_CLEAR);
        def.setCue("7:10-kor a konyhaasztalnál");
        def.setCraving("tisztább fejjel indul a nap");
        def.setReward("a pipa maga");
        def.setIdentity("figyel a saját gondolataira");

        UUID id = defRepository.saveAndFlush(def).getId();

        HabitDefEntity read = defRepository.findById(id).orElseThrow();
        assertThat(read.getFramework()).isEqualTo("CLEAR");
        assertThat(read.getCue()).isEqualTo("7:10-kor a konyhaasztalnál");
        assertThat(read.getCraving()).isEqualTo("tisztább fejjel indul a nap");
        assertThat(read.getReward()).isEqualTo("a pipa maga");
        assertThat(read.getIdentity()).isEqualTo("figyel a saját gondolataira");
        assertThat(read.getAnchorHabitKey()).isNull();
        assertThat(read.getCelebration()).isNull();
    }
}
