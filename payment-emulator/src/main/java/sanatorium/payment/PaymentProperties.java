package sanatorium.payment;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "payment")
public record PaymentProperties(String apiKey, String webhookSecret, String publicBaseUrl,
                                String allowedCallbackPrefix, String returnUrl) { }
