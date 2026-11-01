package sanatorium.core.common;

import org.springframework.http.HttpStatus;
import sanatorium.core.GlobalExceptionHandler;

/** Бизнес-ошибка с HTTP-статусом; единый формат ответа формирует GlobalExceptionHandler. */
public class ApiException extends RuntimeException {
    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }

    public static ApiException notFound(String m) { return new ApiException(HttpStatus.NOT_FOUND, m); }
    public static ApiException conflict(String m) { return new ApiException(HttpStatus.CONFLICT, m); }
    public static ApiException badRequest(String m) { return new ApiException(HttpStatus.BAD_REQUEST, m); }
    public static ApiException unavailable(String m) { return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, m); }
    public static ApiException badGateway(String m) { return new ApiException(HttpStatus.BAD_GATEWAY, m); }
}
