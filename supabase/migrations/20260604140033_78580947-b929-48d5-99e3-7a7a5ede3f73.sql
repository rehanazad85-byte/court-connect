ALTER TABLE public.opening_hours DROP CONSTRAINT IF EXISTS opening_hours_check;
ALTER TABLE public.opening_hours DROP CONSTRAINT IF EXISTS opening_hours_close_min_check;
ALTER TABLE public.opening_hours ADD CONSTRAINT opening_hours_close_min_check CHECK (close_min >= 0 AND close_min <= 2880);
ALTER TABLE public.opening_hours ADD CONSTRAINT opening_hours_check CHECK (close_min > open_min);