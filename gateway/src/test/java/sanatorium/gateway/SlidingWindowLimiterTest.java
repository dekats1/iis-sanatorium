package sanatorium.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class SlidingWindowLimiterTest {

    @Test
    void allowsUpToLimitThenRejects() {
        var clock = new AtomicLong(1_000);
        var limiter = new SlidingWindowLimiter(3, 60_000, clock::get);
        assertTrue(limiter.tryAcquire("a"));
        assertTrue(limiter.tryAcquire("a"));
        assertTrue(limiter.tryAcquire("a"));
        assertFalse(limiter.tryAcquire("a"));
    }

    @Test
    void keysAreIndependent() {
        var limiter = new SlidingWindowLimiter(1, 60_000, () -> 0L);
        assertTrue(limiter.tryAcquire("a"));
        assertTrue(limiter.tryAcquire("b"));
        assertFalse(limiter.tryAcquire("a"));
    }

    @Test
    void windowSlides() {
        var clock = new AtomicLong(0);
        var limiter = new SlidingWindowLimiter(2, 1_000, clock::get);
        assertTrue(limiter.tryAcquire("a"));
        clock.set(500);
        assertTrue(limiter.tryAcquire("a"));
        assertFalse(limiter.tryAcquire("a"));
        clock.set(1_000); // первое событие вышло из окна
        assertTrue(limiter.tryAcquire("a"));
        assertFalse(limiter.tryAcquire("a"));
    }

    @Test
    void retryAfterShowsTimeToFirstExpiry() {
        var clock = new AtomicLong(0);
        var limiter = new SlidingWindowLimiter(1, 1_000, clock::get);
        assertEquals(0, limiter.retryAfterMillis("a"));
        limiter.tryAcquire("a");
        clock.set(300);
        assertEquals(700, limiter.retryAfterMillis("a"));
    }

    @Test
    void rejectedAttemptIsNotCounted() {
        var clock = new AtomicLong(0);
        var limiter = new SlidingWindowLimiter(1, 1_000, clock::get);
        limiter.tryAcquire("a");
        clock.set(900);
        assertFalse(limiter.tryAcquire("a")); // отказ не продлевает блокировку
        clock.set(1_000);
        assertTrue(limiter.tryAcquire("a"));
    }

    @Test
    void invalidParametersRejected() {
        assertThrows(IllegalArgumentException.class, () -> new SlidingWindowLimiter(0, 1000));
        assertThrows(IllegalArgumentException.class, () -> new SlidingWindowLimiter(1, 0));
    }
}
