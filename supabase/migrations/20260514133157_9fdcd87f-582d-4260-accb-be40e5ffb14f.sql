
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','reel')),
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS posts_media_type_idx ON public.posts(media_type);
CREATE INDEX IF NOT EXISTS posts_active_idx ON public.posts(created_at DESC) WHERE deleted_at IS NULL AND is_archived = false;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS posts_touch_updated_at ON public.posts;
CREATE TRIGGER posts_touch_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP POLICY IF EXISTS posts_select_all ON public.posts;
DROP POLICY IF EXISTS posts_select_visible ON public.posts;
CREATE POLICY posts_select_visible ON public.posts FOR SELECT USING (
  (deleted_at IS NULL AND is_archived = false) OR auth.uid() = user_id
);

CREATE TABLE IF NOT EXISTS public.post_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  viewer_id uuid,
  session_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS post_views_unique_idx
  ON public.post_views (post_id, COALESCE(viewer_id::text, session_key));
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS post_views_insert_any ON public.post_views;
CREATE POLICY post_views_insert_any ON public.post_views FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS post_views_select_owner ON public.post_views;
CREATE POLICY post_views_select_owner ON public.post_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.increment_post_view(_post_id uuid, _session_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  inserted boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.post_views (post_id, viewer_id, session_key)
    VALUES (_post_id, v_uid, COALESCE(v_uid::text, _session_key));
    inserted := true;
  EXCEPTION WHEN unique_violation THEN
    inserted := false;
  END;
  IF inserted THEN
    UPDATE public.posts SET view_count = view_count + 1 WHERE id = _post_id;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  post_id uuid,
  reported_user_id uuid,
  reason text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reports_insert_self ON public.reports;
CREATE POLICY reports_insert_self ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS reports_select_self ON public.reports;
CREATE POLICY reports_select_self ON public.reports FOR SELECT USING (auth.uid() = reporter_id);

CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS blocks_select_self ON public.blocks;
CREATE POLICY blocks_select_self ON public.blocks FOR SELECT USING (auth.uid() = blocker_id);
DROP POLICY IF EXISTS blocks_insert_self ON public.blocks;
CREATE POLICY blocks_insert_self ON public.blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS blocks_delete_self ON public.blocks;
CREATE POLICY blocks_delete_self ON public.blocks FOR DELETE USING (auth.uid() = blocker_id);

CREATE TABLE IF NOT EXISTS public.mutes (
  muter_id uuid NOT NULL,
  muted_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (muter_id, muted_id)
);
ALTER TABLE public.mutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mutes_select_self ON public.mutes;
CREATE POLICY mutes_select_self ON public.mutes FOR SELECT USING (auth.uid() = muter_id);
DROP POLICY IF EXISTS mutes_insert_self ON public.mutes;
CREATE POLICY mutes_insert_self ON public.mutes FOR INSERT WITH CHECK (auth.uid() = muter_id);
DROP POLICY IF EXISTS mutes_delete_self ON public.mutes;
CREATE POLICY mutes_delete_self ON public.mutes FOR DELETE USING (auth.uid() = muter_id);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
