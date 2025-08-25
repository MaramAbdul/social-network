-- Drop event-related tables
DROP INDEX IF EXISTS idx_event_responses_user_id;
DROP INDEX IF EXISTS idx_event_responses_event_id;
DROP INDEX IF EXISTS idx_events_event_date;
DROP INDEX IF EXISTS idx_events_group_id;

DROP TABLE IF EXISTS event_responses;
DROP TABLE IF EXISTS events;