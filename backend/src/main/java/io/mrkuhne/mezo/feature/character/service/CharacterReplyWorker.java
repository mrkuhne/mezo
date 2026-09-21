package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.companion.embedding.MemoryEmbeddingWriter;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterReplyWorker {
    private final CharacterReplyProcessing processing;
    private final ObjectProvider<CharacterReplyEvaluation> evaluator;
    private final ObjectProvider<MemoryEmbeddingWriter> memory;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void requested(CharacterReplyService.Requested event) {
        process(event);
    }

    public void process(CharacterReplyService.Requested event) {
        var reply = processing.claim(event.owner(), event.replyId());
        if (reply == null) return;
        LlmActorContext.runAs(
                event.owner(),
                () -> {
                    try {
                        memory.getObject()
                                .syncNote(
                                        MemoryEmbeddingEntity.KIND_CHARACTER_REPLY,
                                        CharacterReplyMemorySource.note(reply));
                        var verdict = evaluator.getObject().evaluate(reply);
                        processing.complete(reply, verdict);
                    } catch (Exception e) {
                        log.warn(
                                "Character reply processing failed for reply {}", reply.getId(), e);
                        processing.failed(event.owner(), reply.getId(), reply.getProcessingToken());
                    }
                });
    }
}
