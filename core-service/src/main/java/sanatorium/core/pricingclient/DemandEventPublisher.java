package sanatorium.core.pricingclient;

import java.time.LocalDate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import sanatorium.core.booking.BookingRepository;
import sanatorium.core.booking.BookingStay;
import sanatorium.core.directory.RoomRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import sanatorium.core.common.CoreProperties;

/**
 * Публикация booking.confirmed / booking.cancelled (поток 9, раздел 2.5 главы 2).
 *
 * <p>На каждые сутки брони отправляется отдельное сообщение: JSON в формате BookingEvent сервиса
 * pricing-forecast (поля message_id, event_type, category_id, stay_date, places, available).
 * message_id детерминирован (бронь + тип + дата), поэтому повторная отправка безопасна: consumer
 * идемпотентен по message_id (таблица processed_events).
 *
 * <p>Ограничение прототипа: отправка выполняется после коммита без transactional outbox — при падении
 * брокера в этот момент событие теряется (спрос в pricing-forecast занижается до ближайшей сверки).
 * Для промышленной версии нужен outbox (раздел 4 главы 4, «ограничения»).
 */
@Component
public class DemandEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(DemandEventPublisher.class);

    private final RabbitTemplate rabbit;
    private final BookingRepository bookings;
    private final RoomRepository rooms;
    private final CoreProperties props;
    private final TransactionTemplate readTx;

    public DemandEventPublisher(RabbitTemplate rabbit, BookingRepository bookings, RoomRepository rooms,
                                CoreProperties props, PlatformTransactionManager txManager) {
        this.rabbit = rabbit;
        this.bookings = bookings;
        this.rooms = rooms;
        this.props = props;
        // Слушатель вызывается после коммита исходной транзакции: чтение выполняем в новой, короткой, только для чтения.
        this.readTx = new TransactionTemplate(txManager);
        this.readTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.readTx.setReadOnly(true);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onBookingStatusChanged(BookingStatusChanged event) {
        try {
            publish(event);
        } catch (RuntimeException ex) {
            // Не пробрасываем: транзакция уже зафиксирована, бизнес-операция выполнена.
            log.error("Не удалось опубликовать {} для брони {}", event.type().routingKey(), event.bookingId(), ex);
        }
    }

    void publish(BookingStatusChanged event) {
        record Data(BookingStay stay, int available) { }

        Data data = readTx.execute(st -> {
            BookingStay stay = bookings.findStay(event.bookingId()).orElseThrow();
            Long places = rooms.activePlaces(stay.categoryId());
            return new Data(stay, places == null ? 0 : places.intValue());
        });
        BookingStay b = data.stay();
        int available = data.available();

        List<LocalDate> nights = b.checkIn().datesUntil(b.checkOut()).toList();
        for (LocalDate night : nights) {
            String messageId = "booking-" + event.bookingId() + "-" + event.type().routingKey() + "-" + night;
            String json = "{\"message_id\":\"" + messageId + "\","
                    + "\"event_type\":\"" + event.type().routingKey() + "\","
                    + "\"category_id\":" + b.categoryId() + ","
                    + "\"stay_date\":\"" + night + "\","
                    + "\"places\":" + b.places() + ","
                    + "\"available\":" + available + "}";
            Message msg = MessageBuilder.withBody(json.getBytes(java.nio.charset.StandardCharsets.UTF_8))
                    .setContentType(MessageProperties.CONTENT_TYPE_JSON)
                    .setContentEncoding("UTF-8")
                    .setMessageId(messageId)
                    .setDeliveryMode(MessageDeliveryMode.PERSISTENT)
                    .build();
            rabbit.send(props.events().exchange(), event.type().routingKey(), msg);
        }
        log.info("Опубликовано {} сообщений {} по брони {}", nights.size(), event.type().routingKey(), event.bookingId());
    }
}
