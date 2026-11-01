package sanatorium.gateway;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * Ограничитель «не более N событий за окно» по ключу (скользящее окно, в памяти одного экземпляра шлюза).
 * Применяется к попыткам входа с одного адреса: замедляет подбор пароля. Ограничение: счётчики не общие между
 * экземплярами шлюза и сбрасываются при перезапуске — для прототипа достаточно, для промышленной версии нужен общий
 * счётчик (например, Redis).
 */
public final class SlidingWindowLimiter {

    private static final int MAX_KEYS = 10_000; // верхняя граница памяти: при переполнении убираем устаревшие ключи

    private final int maxEvents;
    private final long windowMillis;
    private final LongSupplier clock;
    private final Map<String, Deque<Long>> events = new ConcurrentHashMap<>();

    public SlidingWindowLimiter(int maxEvents, long windowMillis, LongSupplier clockMillis) {
        if (maxEvents < 1 || windowMillis < 1) {
            throw new IllegalArgumentException("maxEvents и windowMillis должны быть положительными");
        }
        this.maxEvents = maxEvents;
        this.windowMillis = windowMillis;
        this.clock = clockMillis;
    }

    public SlidingWindowLimiter(int maxEvents, long windowMillis) {
        this(maxEvents, windowMillis, System::currentTimeMillis);
    }

    /** Регистрирует событие и возвращает true, если оно укладывается в лимит; false — лимит исчерпан (событие не считается). */
    public boolean tryAcquire(String key) {
        long now = clock.getAsLong();
        if (events.size() > MAX_KEYS) {
            evictStale(now);
        }
        Deque<Long> window = events.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (window) {
            while (!window.isEmpty() && now - window.peekFirst() >= windowMillis) {
                window.pollFirst();
            }
            if (window.size() >= maxEvents) {
                return false;
            }
            window.addLast(now);
            return true;
        }
    }

    /** Через сколько миллисекунд освободится место для ключа (0, если лимит не исчерпан). */
    public long retryAfterMillis(String key) {
        Deque<Long> window = events.get(key);
        if (window == null) {
            return 0;
        }
        long now = clock.getAsLong();
        synchronized (window) {
            if (window.size() < maxEvents || window.isEmpty()) {
                return 0;
            }
            return Math.max(0, windowMillis - (now - window.peekFirst()));
        }
    }

    private void evictStale(long now) {
        events.entrySet().removeIf(e -> {
            Deque<Long> w = e.getValue();
            synchronized (w) {
                return w.isEmpty() || now - w.peekLast() >= windowMillis;
            }
        });
    }
}
