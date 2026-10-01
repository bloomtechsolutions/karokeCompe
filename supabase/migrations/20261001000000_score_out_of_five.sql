-- Judges now score every criterion from 0 to 5 (sheet total 25). The app
-- converts the judges' average to points out of settings.judge_weight (70).

alter table public.scores
  drop constraint if exists scores_vocal_check,
  drop constraint if exists scores_rhythm_check,
  drop constraint if exists scores_stage_presence_check,
  drop constraint if exists scores_interpretation_check,
  drop constraint if exists scores_overall_check;

alter table public.scores
  add constraint scores_vocal_check check (vocal between 0 and 5),
  add constraint scores_rhythm_check check (rhythm between 0 and 5),
  add constraint scores_stage_presence_check check (stage_presence between 0 and 5),
  add constraint scores_interpretation_check check (interpretation between 0 and 5),
  add constraint scores_overall_check check (overall between 0 and 5);
