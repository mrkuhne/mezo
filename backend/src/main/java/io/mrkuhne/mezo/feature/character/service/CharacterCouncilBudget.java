package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.config.CharacterCouncilBudgetProperties;
import io.mrkuhne.mezo.feature.character.config.CharacterCouncilProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallQuota;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CharacterCouncilBudget {
    private final CharacterCouncilBudgetProperties properties;
    private final CharacterCouncilProperties council;
    private final CharacterCouncilQuotaLedger ledger;

    public <T> T run(UUID owner, boolean userReply, Supplier<T> body) {
        if (LlmCallQuota.capture() != null) return body.get();
        LocalDate day = LocalDate.now(ZoneId.of(council.zone()));
        ledger.expire(day);
        return LlmCallQuota.run(new Cycle(owner, day, userReply), body);
    }

    private final class Cycle implements LlmCallQuota.Scope {
        private final UUID owner;
        private final LocalDate day;
        private final boolean reply;
        private int calls;
        private int smartCalls;
        private boolean refused;
        private Cycle(UUID owner, LocalDate day, boolean reply) {
            this.owner = owner; this.day = day; this.reply = reply;
        }
        @Override public synchronized void charge(boolean smart) {
            if (!canRun(smart, 0) || !ledger.reserve(owner, day, reply)) {
                refused = true;
                throw exhausted();
            }
            calls++;
            if (smart) smartCalls++;
        }
        @Override public synchronized boolean canRun(boolean smart, int reserve) {
            return !refused && calls + reserve < properties.cycleCalls()
                    && (!smart || smartCalls < properties.cycleSmartCalls());
        }
        @Override public synchronized void verify() { if (refused) throw exhausted(); }
        @Override public synchronized void refuse() { refused = true; }
    }

    private static SystemRuntimeErrorException exhausted() {
        return new SystemRuntimeErrorException(SystemMessage.error("CHARACTER_COUNCIL_QUOTA_EXHAUSTED").build());
    }
}
