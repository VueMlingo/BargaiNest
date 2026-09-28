-- AlterTable: persist the full provider snapshot (activities, rewards,
-- vouchers, offers), not just the balance. Previously
-- LoyaltySnapshotSyncService fetched all of this from the provider's
-- getSnapshot() but only ever wrote `balance` to the database — the
-- rest was silently discarded. This is a purely additive change
-- (nullable columns), safe to apply without touching existing rows.
ALTER TABLE `loyalty_snapshots`
  ADD COLUMN `activitiesJson` JSON NULL,
  ADD COLUMN `rewardsJson` JSON NULL,
  ADD COLUMN `vouchersJson` JSON NULL,
  ADD COLUMN `offersJson` JSON NULL;
