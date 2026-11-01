package sanatorium.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class JsonErrorsTest {

    @Test
    void escapesQuotesBackslashesAndControlChars() {
        assertEquals("a\\\"b\\\\c\\nd\\u0001", JsonErrors.escape("a\"b\\c\nd\u0001"));
    }

    @Test
    void keepsCyrillicAsIs() {
        assertEquals("Требуется вход", JsonErrors.escape("Требуется вход"));
    }
}
