-- Add simulated time for testing pick'em lock functionality
-- When set, the app will use this time instead of the real current time
ALTER TABLE tournaments
  ADD COLUMN dev_simulated_time TIMESTAMPTZ DEFAULT NULL;
