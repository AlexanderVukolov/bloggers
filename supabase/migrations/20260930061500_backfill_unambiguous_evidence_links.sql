with updates as (
  select record_key, value_json as item
  from public.blogger_shared_state
  where namespace = 'placement'
), base as (
  select elem as item
  from public.blogger_shared_state source
  cross join lateral jsonb_array_elements(source.value_json) elem
  where source.namespace = 'bootstrap_placements'
    and source.record_key = 'source'
), placement_rows as (
  select item from updates
  union all
  select base.item
  from base
  where not exists (
    select 1 from updates
    where coalesce(updates.item->>'id', updates.record_key) = base.item->>'id'
  )
), candidates as (
  select
    report.id as report_id,
    concat_ws('|',
      'placement-v2',
      coalesce(placement.item->>'sourceKey', placement.item->>'tag', ''),
      coalesce(placement.item->>'sortDate', placement.item->>'start', ''),
      coalesce(placement.item->>'type', ''),
      coalesce(placement.item->>'dealType', ''),
      coalesce(placement.item->>'id', '')
    ) as placement_key,
    coalesce(placement.item->>'direction', placement.item->>'brand', '') as project,
    coalesce(placement.item->>'type', '') as format,
    count(*) over (partition by report.id) as candidate_count
  from public.blogger_evidence_reports report
  join placement_rows placement
    on lower(regexp_replace(coalesce(nullif(placement.item->>'tag',''), nullif(placement.item->>'fullName','')), '^@', '', 'g'))
      = lower(regexp_replace(report.blogger, '^@', '', 'g'))
   and placement.item->>'sortDate' = report.exit_date::text
)
insert into public.blogger_evidence_placement_links
  (report_id, placement_key, project, format)
select report_id, placement_key, project, format
from candidates
where candidate_count = 1
on conflict (report_id, placement_key) do nothing;
