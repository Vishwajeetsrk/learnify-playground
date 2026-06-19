CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by owner" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TYPE public.playground_kind AS ENUM ('code', 'web');

CREATE TABLE public.playground_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.playground_kind NOT NULL DEFAULT 'code',
  language TEXT,
  code TEXT,
  html TEXT,
  css TEXT,
  js TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playground_projects TO authenticated;
GRANT ALL ON public.playground_projects TO service_role;
ALTER TABLE public.playground_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own projects" ON public.playground_projects FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX playground_projects_user_idx ON public.playground_projects(user_id, updated_at DESC);
CREATE TRIGGER set_playground_projects_updated_at BEFORE UPDATE ON public.playground_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.playground_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.playground_projects(id) ON DELETE SET NULL,
  language TEXT NOT NULL,
  source TEXT NOT NULL,
  stdout TEXT,
  stderr TEXT,
  exit_code INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.playground_runs TO authenticated;
GRANT ALL ON public.playground_runs TO service_role;
ALTER TABLE public.playground_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own runs" ON public.playground_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own runs" ON public.playground_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own runs" ON public.playground_runs FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX playground_runs_user_idx ON public.playground_runs(user_id, created_at DESC);