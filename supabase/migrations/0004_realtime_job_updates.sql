-- Enable Realtime for job_updates so INSERTs are broadcast to subscribed clients.
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_updates;
