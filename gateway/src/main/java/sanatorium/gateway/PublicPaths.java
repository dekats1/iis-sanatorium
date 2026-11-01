package sanatorium.gateway;

/**
 * Пути, доступные без токена: вход и регистрация клиента, документация API, проверка состояния.
 * Всё остальное требует корректного JWT. Класс без зависимостей — проверяется модульным тестом.
 */
public final class PublicPaths {

    private PublicPaths() { }

    public static boolean isPublic(String path) {
        return path.equals("/api/auth/login")
                || path.equals("/api/auth/register")
                || path.equals("/actuator/health")
                || path.startsWith("/actuator/health/");
    }

    /** Внутренние пути, которые снаружи не существуют: вебхук платёжного сервиса приходит в core-service напрямую. */
    public static boolean isBlocked(String path) {
        return path.equals("/api/payments") || path.startsWith("/api/payments/");
    }
}
