CREATE TABLE IF NOT EXISTS event_volunteer_declines (
  id serial PRIMARY KEY,
  event_request_id integer NOT NULL,
  volunteer_user_id varchar NOT NULL,
  volunteer_name varchar,
  volunteer_email varchar,
  volunteer_phone varchar,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_volunteer_declines_event_id
  ON event_volunteer_declines(event_request_id);

CREATE INDEX IF NOT EXISTS idx_event_volunteer_declines_volunteer
  ON event_volunteer_declines(volunteer_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_volunteer_declines_event_user_unique
  ON event_volunteer_declines(event_request_id, volunteer_user_id);
