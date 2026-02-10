-- Change date_flexible default from true to null
-- null = unknown (not yet determined)
-- true = flexible (org indicated they can adjust date)
-- false = fixed (org has a pre-planned event, cannot change date)

ALTER TABLE event_requests
ALTER COLUMN date_flexible DROP DEFAULT;

-- Note: Existing records with date_flexible=true will remain true
-- Only new records will get null by default
