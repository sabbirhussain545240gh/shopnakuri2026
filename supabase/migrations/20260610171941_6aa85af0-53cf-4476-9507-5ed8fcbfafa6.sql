CREATE TABLE public.samiti_cloud_data (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.samiti_cloud_data TO authenticated;
GRANT ALL ON public.samiti_cloud_data TO service_role;

ALTER TABLE public.samiti_cloud_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own samiti data"
  ON public.samiti_cloud_data
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_samiti_cloud_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_samiti_cloud_data
  BEFORE UPDATE ON public.samiti_cloud_data
  FOR EACH ROW EXECUTE FUNCTION public.touch_samiti_cloud_data();