-- Allow overnight opening hours where close_min < open_min.
-- e.g. open_min=720 (12:00), close_min=180 (03:00) means "closes at 03:00 next day".
-- Only reject truly invalid rows where open_min = close_min (venue would never close).
--
-- Also fixes pricing_rules which had the same strict constraint, so overnight
-- pricing rules can be created and saved alongside overnight opening hours.

-- ── opening_hours ────────────────────────────────────────────────────────────
-- Drop the unnamed check constraint that enforced close_min > open_min.
-- PostgreSQL auto-names it "opening_hours_check" (first unnamed check on the table).
alter table public.opening_hours
  drop constraint opening_hours_check;

-- Replace with a looser constraint: open and close must differ, but close < open
-- is explicitly valid (overnight venue — closes on the next calendar day).
alter table public.opening_hours
  add constraint opening_hours_open_ne_close
  check (open_min <> close_min);

-- ── pricing_rules ─────────────────────────────────────────────────────────────
-- Drop the equivalent constraint on pricing_rules (auto-named "pricing_rules_check").
alter table public.pricing_rules
  drop constraint pricing_rules_check;

-- Same replacement: start and end must differ; start > end is valid for overnight
-- pricing windows that wrap past midnight.
alter table public.pricing_rules
  add constraint pricing_rules_start_ne_end
  check (start_min <> end_min);
