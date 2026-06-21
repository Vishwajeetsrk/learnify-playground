CREATE TABLE public.ai_debug_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  run_id text NOT NULL,
  language text,
  executor text,
  exit_code integer,
  key_source text,
  success boolean NOT NULL,
  final_model text,
  attempts jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  code_bytes integer,
  stderr_bytes integer,
  reply_bytes integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.ai_debug_events TO authenticated;
GRANT ALL ON public.ai_debug_events TO service_role;

ALTER TABLE public.ai_debug_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own debug events" ON public.ai_debug_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own debug events" ON public.ai_debug_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own debug events" ON public.ai_debug_events
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX ai_debug_events_user_created_idx ON public.ai_debug_events (user_id, created_at DESC);
CREATE INDEX ai_debug_events_run_id_idx ON public.ai_debug_events (run_id);