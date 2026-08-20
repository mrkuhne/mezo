package io.mrkuhne.mezo.feature.journal.controller;

import io.mrkuhne.mezo.api.controller.JournalApi;
import io.mrkuhne.mezo.api.dto.CreateDecisionEntryRequest;
import io.mrkuhne.mezo.api.dto.CreateJournalEntryRequest;
import io.mrkuhne.mezo.api.dto.DecisionEntryResponse;
import io.mrkuhne.mezo.api.dto.JournalEntryResponse;
import io.mrkuhne.mezo.api.dto.ReviewDecisionRequest;
import io.mrkuhne.mezo.api.dto.UpdateJournalEntryRequest;
import io.mrkuhne.mezo.feature.journal.service.JournalService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/journal surface (bd mezo-b3pp.1) — thin delegation, ownership from the principal;
 * gated on {@code JOURNAL_SWITCH} (off ⇒ the whole surface 404s and no journal beans exist). */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.JOURNAL_SWITCH, havingValue = "true")
public class JournalController implements JournalApi {

    private final JournalService journalService;
    private final CurrentUserId currentUserId;

    @Override
    public JournalEntryResponse createJournalEntry(CreateJournalEntryRequest createJournalEntryRequest) {
        return journalService.create(currentUserId.get(), createJournalEntryRequest);
    }

    @Override
    public void deleteJournalEntry(UUID id) {
        journalService.delete(currentUserId.get(), id);
    }

    @Override
    public List<JournalEntryResponse> listJournalEntries(LocalDate from, LocalDate to) {
        return journalService.list(currentUserId.get(), from, to);
    }

    @Override
    public JournalEntryResponse updateJournalEntry(UUID id, UpdateJournalEntryRequest updateJournalEntryRequest) {
        return journalService.update(currentUserId.get(), id, updateJournalEntryRequest);
    }

    // Decision journal (bd mezo-b3pp.4): contract + persistence land in Task 1; the service wiring
    // (DecisionService, ContextSnapshotAssembler) is Task 2+. These stubs exist ONLY so JournalApi
    // (one generated interface per OpenAPI tag, skipDefaultInterface=true) still compiles.
    @Override
    public DecisionEntryResponse createDecisionEntry(CreateDecisionEntryRequest createDecisionEntryRequest) {
        throw new UnsupportedOperationException("Decision journal service lands in Task 2 (mezo-b3pp.4)");
    }

    @Override
    public List<DecisionEntryResponse> listDecisionEntries() {
        throw new UnsupportedOperationException("Decision journal service lands in Task 2 (mezo-b3pp.4)");
    }

    @Override
    public DecisionEntryResponse reviewDecisionEntry(UUID id, ReviewDecisionRequest reviewDecisionRequest) {
        throw new UnsupportedOperationException("Decision journal service lands in Task 2 (mezo-b3pp.4)");
    }
}
