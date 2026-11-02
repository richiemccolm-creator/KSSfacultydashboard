-- Classroom toolkit: stop Realtime watching the live-game tables.
-- The quiz, exit ticket, traffic light, stimulus and whiteboard migrations
-- added their tables to the supabase_realtime publication, but the games
-- ask for the latest state on a timer instead of listening for changes, so
-- nothing subscribes to them. Realtime still had to read every change to
-- them (each whiteboard save rewrites the whole drawing), and its change
-- feed was the biggest single user of database time. Staff chat and the
-- CI assessment tracker do listen for changes and stay in the publication.
-- Safe to run again: tables already out of the publication are skipped.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'quiz_live_sessions', 'quiz_live_players',
    'exit_ticket_sessions', 'exit_ticket_responses',
    'traffic_light_sessions', 'traffic_light_votes',
    'stimulus_sessions', 'stimulus_results',
    'whiteboard_sessions', 'whiteboard_boards'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
