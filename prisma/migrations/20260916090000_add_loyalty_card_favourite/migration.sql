-- AlterTable: move "favourite" from a device-local frontend flag to a
-- real, synced server-side column. Additive and safe -- defaults to
-- false, so every existing card starts unfavourited (matching the
-- fact that the old localStorage flag was never actually persisted
-- there anyway, per the dead persist() stub found and fixed alongside
-- this change).
ALTER TABLE `loyalty_cards`
  ADD COLUMN `favourite` BOOLEAN NOT NULL DEFAULT false;
