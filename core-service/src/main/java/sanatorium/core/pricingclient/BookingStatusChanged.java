package sanatorium.core.pricingclient;



/** Внутреннее событие: бронь подтверждена или отменена. Публикуется в брокер только после коммита транзакции. */
public record BookingStatusChanged(long bookingId, Type type) {

    public enum Type {
        CONFIRMED("booking.confirmed"),
        CANCELLED("booking.cancelled");

        private final String routingKey;

        Type(String routingKey) {
            this.routingKey = routingKey;
        }

        public String routingKey() {
            return routingKey;
        }
    }
}
