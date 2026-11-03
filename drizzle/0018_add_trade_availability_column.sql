ALTER TABLE collector_profile ADD COLUMN trade_availability TEXT;
--> statement-breakpoint
UPDATE collector_profile SET trade_availability = CASE trade_mode WHEN 'all' THEN 'all' WHEN 'none' THEN 'none' WHEN 'keep_one' THEN 'master' ELSE NULL END;
