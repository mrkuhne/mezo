package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.CharacterMutationLock;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

class CharacterMutationLockIT extends ApiIntegrationTest {
    @Autowired private CharacterMutationLock lock;
    @Autowired private PlatformTransactionManager transactions;

    @Test
    void testLock_shouldSerializeOwnerMutationsUntilCommit_whenTwoWorkersOverlap() throws Exception {
        var owner = databasePopulator.populateUser("mutation-lock@test.local");
        var acquired = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var secondEntered = new CountDownLatch(1);
        var secondStarted = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var first = pool.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(status -> {
                lock.lock(owner);
                acquired.countDown();
                try {
                    if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Test latch timeout");
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(interrupted);
                }
            }));
            assertThat(acquired.await(5, TimeUnit.SECONDS)).isTrue();
            var second = pool.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(status -> {
                secondStarted.countDown();
                lock.lock(owner);
                secondEntered.countDown();
            }));
            assertThat(secondStarted.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(secondEntered.await(150, TimeUnit.MILLISECONDS)).isFalse();
            release.countDown();
            first.get(5, TimeUnit.SECONDS);
            second.get(5, TimeUnit.SECONDS);
            assertThat(secondEntered.getCount()).isZero();
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
    }
}
