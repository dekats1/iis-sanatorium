package sanatorium.core.loyalty;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.common.ApiException;
import sanatorium.core.loyalty.LoyaltyDtos.ApplyBonusesResult;
import sanatorium.core.loyalty.LoyaltyDtos.BonusTransactionView;
import sanatorium.core.loyalty.LoyaltyDtos.LoyaltyAccountView;

@Service
public class LoyaltyService {

    private final LoyaltyAccountRepository accountRepository;
    private final BonusTransactionRepository transactionRepository;

    public LoyaltyService(LoyaltyAccountRepository accountRepository,
                          BonusTransactionRepository transactionRepository) {
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
    }

    @Transactional
    public LoyaltyAccount getOrCreateAccount(long clientId) {
        return accountRepository.findByClientId(clientId).orElseGet(() -> {
            LoyaltyAccount created = new LoyaltyAccount(clientId, 100, BigDecimal.ZERO);
            accountRepository.save(created);
            BonusTransaction welcome = new BonusTransaction(
                    clientId,
                    100,
                    BonusTransactionType.WELCOME,
                    "Приветственный бонус нового гостя",
                    null
            );
            transactionRepository.save(welcome);
            return created;
        });
    }

    @Transactional(readOnly = true)
    public LoyaltyAccountView getAccountView(long clientId) {
        LoyaltyAccount acc = accountRepository.findByClientId(clientId).orElse(null);
        if (acc == null) {
            acc = new LoyaltyAccount(clientId, 100, BigDecimal.ZERO);
        }

        List<BonusTransaction> txs = transactionRepository.findByClientIdOrderByCreatedAtDesc(clientId);
        int totalEarned = txs.stream().filter(t -> t.getAmount() > 0).mapToInt(BonusTransaction::getAmount).sum();
        if (totalEarned == 0) totalEarned = acc.getBalance();
        int totalSpent = txs.stream().filter(t -> t.getAmount() < 0).mapToInt(t -> Math.abs(t.getAmount())).sum();

        BigDecimal spent = acc.getSpentMoney();
        String tier = "BRONZE";
        int cashback = 3;
        BigDecimal nextThreshold = BigDecimal.valueOf(1000);
        List<String> privileges = List.of(
                "Базовый кэшбэк 3% бонусами",
                "Приветственные 100 баллов",
                "Консультация врача-координатора"
        );

        if (spent.compareTo(BigDecimal.valueOf(5000)) >= 0) {
            tier = "PLATINUM";
            cashback = 10;
            nextThreshold = null;
            privileges = List.of(
                    "Максимальный кэшбэк 10% бонусами",
                    "Персональный консьерж-сервис",
                    "Бесплатный трансфер от вокзала",
                    "Приоритетный ранний заезд и поздний выезд",
                    "Ежедневная корзина свежих фруктов"
            );
        } else if (spent.compareTo(BigDecimal.valueOf(2500)) >= 0) {
            tier = "GOLD";
            cashback = 7;
            nextThreshold = BigDecimal.valueOf(5000);
            privileges = List.of(
                    "Повышенный кэшбэк 7% бонусами",
                    "Выбор любимого номера без доплаты",
                    "Скидка 15% на SPA-процедуры",
                    "Чайная церемония в фитобаре"
            );
        } else if (spent.compareTo(BigDecimal.valueOf(1000)) >= 0) {
            tier = "SILVER";
            cashback = 5;
            nextThreshold = BigDecimal.valueOf(2500);
            privileges = List.of(
                    "Кэшбэк 5% бонусами",
                    "1 процедура спелеотерапии в подарок",
                    "Скидка 10% на дополнительные процедуры"
            );
        }

        return new LoyaltyAccountView(
                clientId,
                acc.getBalance(),
                acc.getSpentMoney(),
                tier,
                cashback,
                nextThreshold,
                privileges,
                totalEarned,
                totalSpent
        );
    }

    @Transactional(readOnly = true)
    public List<BonusTransactionView> getTransactions(long clientId) {
        return transactionRepository.findByClientIdOrderByCreatedAtDesc(clientId).stream()
                .map(t -> new BonusTransactionView(
                        t.getId(),
                        t.getClientId(),
                        t.getAmount(),
                        t.getType().name(),
                        t.getDescription(),
                        t.getVoucherId(),
                        t.getCreatedAt()
                ))
                .collect(Collectors.toList());
    }

    @Transactional
    public LoyaltyAccountView addBonus(long clientId, int amount, String description, Long voucherId, BonusTransactionType type) {
        LoyaltyAccount acc = getOrCreateAccount(clientId);
        acc.setBalance(Math.max(0, acc.getBalance() + amount));
        accountRepository.save(acc);

        BonusTransaction tx = new BonusTransaction(
                clientId,
                amount,
                type != null ? type : (amount >= 0 ? BonusTransactionType.ADJUSTMENT : BonusTransactionType.REDEMPTION),
                description,
                voucherId
        );
        transactionRepository.save(tx);

        return getAccountView(clientId);
    }

    @Transactional
    public ApplyBonusesResult applyBonuses(long clientId, long voucherId, int bonusPoints) {
        LoyaltyAccount acc = getOrCreateAccount(clientId);
        int canApply = Math.min(acc.getBalance(), bonusPoints);
        if (canApply <= 0) {
            throw ApiException.badRequest("Недостаточно бонусных баллов");
        }

        acc.setBalance(acc.getBalance() - canApply);
        accountRepository.save(acc);

        BonusTransaction tx = new BonusTransaction(
                clientId,
                -canApply,
                BonusTransactionType.REDEMPTION,
                "Списание бонусов в счёт оплаты путёвки #" + voucherId,
                voucherId
        );
        transactionRepository.save(tx);

        return new ApplyBonusesResult(true, canApply);
    }
}
