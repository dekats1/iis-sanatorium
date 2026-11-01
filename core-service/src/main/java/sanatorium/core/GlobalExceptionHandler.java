package sanatorium.core;

import jakarta.validation.ConstraintViolationException;
import java.sql.SQLException;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import sanatorium.core.common.ApiException;
import sanatorium.core.medical.ContraindicationsFoundException;

/** Единый формат ошибок (RFC 9457 ProblemDetail), НФТ-05: понятные сообщения без внутренних деталей. */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ProblemDetail api(ApiException ex) {
        return ProblemDetail.forStatusAndDetail(ex.status(), ex.getMessage());
    }

    /** Противопоказания (НФТ-09): 409 со списком предупреждений; врач может повторить запрос с подтверждением. */
    @ExceptionHandler(ContraindicationsFoundException.class)
    ProblemDetail contraindications(ContraindicationsFoundException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        pd.setProperty("warnings", ex.warnings());
        return pd;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail validation(MethodArgumentNotValidException ex) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, detail);
    }

    /** Bean Validation на уровне JPA (срабатывает при сохранении сущности): те же 422, что и для проверки входных DTO. */
    @ExceptionHandler(ConstraintViolationException.class)
    ProblemDetail beanValidation(ConstraintViolationException ex) {
        String detail = ex.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .sorted()
                .collect(Collectors.joining("; "));
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, detail);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class})
    ProblemDetail badRequest(Exception ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Некорректный запрос");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail integrity(DataIntegrityViolationException ex) {
        String state = ex.getMostSpecificCause() instanceof SQLException s ? s.getSQLState() : null;
        log.warn("Нарушение ограничения БД, SQLSTATE={}", state);
        return switch (String.valueOf(state)) {
            case "23503" -> ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, "Ссылка на несуществующий объект");
            case "23514" -> ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, "Значение не удовлетворяет ограничению предметной области");
            case "22001" -> ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, "Значение слишком длинное");
            case "23505" -> ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "Такая запись уже существует");
            case "23P01" -> ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "Места уже заняты");
            default -> ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "Данные нарушают ограничения целостности");
        };
    }
}
