-- Call the weekly-announcements Edge Function every Sunday evening.
--
-- Run this after deploying the function and storing two Vault secrets (see
-- "Sunday announcements agent" in DEPLOYMENT.md):
--   project_url                 https://<project-ref>.supabase.co
--   announcements_agent_secret  the same random value as the function's
--                               AGENT_CRON_SECRET secret
--
-- pg_cron runs in UTC, so the job fires at 18:00 and 19:00 UTC: 6pm and 7pm
-- in winter, 7pm and 8pm in summer. The first call writes the week; the
-- second finds that week already done and does nothing, unless the first
-- one failed, in which case it tries again.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('weekly-announcements');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'weekly-announcements',
  '0 18,19 * * 0',
  $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
      || '/functions/v1/weekly-announcements',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-agent-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'announcements_agent_secret')
    ),
    body := '{"trigger": "schedule"}'::jsonb,
    timeout_milliseconds := 150000
  ) AS request_id;
  $job$
);
