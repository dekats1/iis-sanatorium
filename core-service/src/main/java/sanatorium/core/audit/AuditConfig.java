package sanatorium.core.audit;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class AuditConfig implements WebMvcConfigurer {

    private final AuditInterceptor interceptor;

    public AuditConfig(AuditInterceptor interceptor) {
        this.interceptor = interceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // вход и вебхук платёжного сервиса не пишем: у них нет пользователя, а подпись проверяется отдельно
        registry.addInterceptor(interceptor).addPathPatterns("/api/**")
                .excludePathPatterns("/api/auth/**", "/api/payments/callback");
    }
}
