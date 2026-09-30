insert into public.blogger_evidence_placement_links
  (report_id, placement_key, project, format)
select
  report.id,
  'placement-v2|blogger-1786699089539|2026-09-01|Stories|Бартер|1788094347817',
  'Оба',
  'Stories'
from public.blogger_evidence_reports report
where lower(regexp_replace(report.blogger, '^@', '', 'g')) = 'fitby_zlata'
  and report.exit_date >= date '2026-09-01'
  and report.exit_date < date '2026-10-01'
on conflict (report_id, placement_key) do update
set project = excluded.project,
    format = excluded.format,
    linked_at = now();
