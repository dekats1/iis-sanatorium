package sanatorium.core.identity;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Аутентификация по JWT и авторизация по ролям (раздел 2.4 главы 2).
 * Сервис сам проверяет подпись токена и не доверяет заголовкам шлюза.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, JwtDecoder decoder) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable) // stateless API с Bearer-токеном, cookie-сессий нет
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/auth/**").permitAll()
                // вебхук платёжного сервиса: аутентификация — HMAC-подпись в самом обработчике
                .requestMatchers("/api/payments/callback").permitAll()
                .requestMatchers("/actuator/health/**", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                // порядок важен: более частные правила — раньше общих
                .requestMatchers("/api/users/**", "/api/audit/**").hasRole("SYSADMIN")
                // справочник заказчиков содержит данные организаций: читают только сотрудники, не клиенты
                .requestMatchers(HttpMethod.GET, "/api/directory/customers/**")
                    .hasAnyRole("BOOKING_ADMIN", "DOCTOR", "MANAGER", "SYSADMIN")
                .requestMatchers(HttpMethod.GET, "/api/directory/**").authenticated()
                .requestMatchers("/api/directory/**").hasRole("SYSADMIN")
                .requestMatchers("/api/reports/**").hasRole("MANAGER")
                .requestMatchers("/api/vouchers/*/check-in", "/api/vouchers/*/check-out").hasRole("BOOKING_ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/vouchers").hasRole("BOOKING_ADMIN") // список всех — только админ
                .requestMatchers("/api/vouchers/**").hasAnyRole("CLIENT", "BOOKING_ADMIN")
                .requestMatchers("/api/waitlist/**").hasAnyRole("CLIENT", "BOOKING_ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/clients").hasAnyRole("BOOKING_ADMIN", "SYSADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/clients/*").hasAnyRole("BOOKING_ADMIN", "SYSADMIN")
                .requestMatchers("/api/clients/*/conditions/**").hasAnyRole("DOCTOR", "BOOKING_ADMIN")
                .requestMatchers("/api/clients/**").hasAnyRole("BOOKING_ADMIN", "DOCTOR", "SYSADMIN")
                .requestMatchers(HttpMethod.GET, "/api/assignments/by-voucher/*").hasAnyRole("DOCTOR", "BOOKING_ADMIN")
                .requestMatchers("/api/assignments/**", "/api/schedule/**").hasRole("DOCTOR")
                .requestMatchers("/api/availability/**").hasAnyRole("CLIENT", "BOOKING_ADMIN", "MANAGER")
                .requestMatchers(HttpMethod.POST, "/api/reviews/*/reply").hasAnyRole("MANAGER", "SYSADMIN")
                .requestMatchers("/api/reviews/**").authenticated()
                .requestMatchers("/api/loyalty/**").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/ehr/notes").hasAnyRole("DOCTOR", "SYSADMIN")
                .requestMatchers("/api/ehr/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/interactive-rooms/**").permitAll()
                .requestMatchers(HttpMethod.PUT, "/api/interactive-rooms/*/status").hasAnyRole("BOOKING_ADMIN", "MANAGER", "SYSADMIN")
                .requestMatchers("/api/notifications/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/inventory/**", "/api/staff/**", "/api/packages/**").authenticated()
                .requestMatchers("/api/inventory/**", "/api/staff/**", "/api/packages/**").hasAnyRole("MANAGER", "SYSADMIN", "BOOKING_ADMIN")
                .requestMatchers("/api/**").authenticated()
                .anyRequest().denyAll())
            .oauth2ResourceServer(o -> o.jwt(j -> j
                .decoder(decoder)
                .jwtAuthenticationConverter(jwtAuthenticationConverter())));
        return http.build();
    }

    @Bean
    JwtDecoder jwtDecoder(JwtTokenProvider jwtService) {
        return NimbusJwtDecoder.withSecretKey(jwtService.key()).macAlgorithm(MacAlgorithm.HS256).build();
    }

    private JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName("roles");
        authorities.setAuthorityPrefix("ROLE_");
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authorities);
        return converter;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(); // хранение паролей: BCrypt (НФТ-04)
    }
}
