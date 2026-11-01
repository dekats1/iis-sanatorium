package sanatorium.gateway;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class PublicPathsTest {

    @Test
    void loginRegisterAndHealthArePublic() {
        assertTrue(PublicPaths.isPublic("/api/auth/login"));
        assertTrue(PublicPaths.isPublic("/api/auth/register"));
        assertTrue(PublicPaths.isPublic("/actuator/health"));
        assertTrue(PublicPaths.isPublic("/actuator/health/liveness"));
    }

    @Test
    void everythingElseRequiresToken() {
        assertFalse(PublicPaths.isPublic("/api/vouchers"));
        assertFalse(PublicPaths.isPublic("/api/auth/login/../users"));
        assertFalse(PublicPaths.isPublic("/api/auth/loginx"));
        assertFalse(PublicPaths.isPublic("/pricing/forecast/1"));
        assertFalse(PublicPaths.isPublic("/actuator/env"));
    }

    @Test
    void paymentCallbackIsBlockedFromOutside() {
        assertTrue(PublicPaths.isBlocked("/api/payments/callback"));
        assertTrue(PublicPaths.isBlocked("/api/payments"));
        assertFalse(PublicPaths.isBlocked("/api/vouchers/1/pay"));
        assertFalse(PublicPaths.isBlocked("/api/paymentsx"));
    }
}
