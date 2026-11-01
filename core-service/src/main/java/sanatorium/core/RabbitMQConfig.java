package sanatorium.core;

import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import sanatorium.core.common.CoreProperties;

@Configuration
public class RabbitMQConfig {

    /** Тема событий; очередь pricing.booking_events объявляет и привязывает сам consumer (pricing-forecast). */
    @Bean
    TopicExchange eventsExchange(CoreProperties props) {
        return new TopicExchange(props.events().exchange(), true, false);
    }
}
