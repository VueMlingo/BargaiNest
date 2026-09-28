-- Widen the loyalty account uniqueness constraint from
-- (userId, loyaltyProgramId) to (userId, loyaltyProgramId, accountNumber).
--
-- Previously a user could never have two accounts on the same loyalty
-- programme at all -- contradicting FR-WAL-005, which explicitly
-- allows multiple cards from the same retailer (e.g. a spouse's
-- separate membership). This still prevents adding the exact same
-- membership number twice; MySQL treats each NULL as distinct for
-- uniqueness purposes, so existing accounts with no accountNumber set
-- are unaffected and will not collide with each other after this
-- migration runs.
ALTER TABLE `loyalty_accounts` DROP INDEX `loyalty_accounts_userId_loyaltyProgramId_key`;

ALTER TABLE `loyalty_accounts`
  ADD UNIQUE INDEX `loyalty_accounts_userId_loyaltyProgramId_accountNumber_key`
  (`userId`, `loyaltyProgramId`, `accountNumber`);
