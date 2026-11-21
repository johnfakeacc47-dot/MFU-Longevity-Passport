-- ============================================================================
-- QA-002: the AI Statistics report showed Thai headers (client-side chrome,
-- already localized) but English content, even in the Thai UI.
--
-- Root cause: health-insights already generated reports in the requested
-- language (its `lang` param was passed correctly by both call sites), but
-- the cache lookup only ever keyed on (user_id, period_type, period_end) --
-- not language. So the first report generated for a period "won" for both
-- languages: if it was ever generated in English (e.g. before the user
-- switched to Thai, or simply because the client defaulted to 'en'), every
-- later Thai request within the cache window got that same English payload
-- back, cache hit, language ignored entirely.
-- ============================================================================

alter table public.ai_reports
  add column if not exists language text not null default 'en'
    check (language in ('en', 'th'));

alter table public.ai_reports
  drop constraint if exists ai_reports_user_id_period_type_period_end_key;

alter table public.ai_reports
  add constraint ai_reports_user_period_end_lang_key
    unique (user_id, period_type, period_end, language);
