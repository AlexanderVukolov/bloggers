create table if not exists public.blogger_evidence_placement_links (
  report_id uuid not null references public.blogger_evidence_reports(id) on delete cascade,
  placement_key text not null,
  project text not null default '',
  format text not null default '',
  linked_at timestamptz not null default now(),
  linked_by uuid null,
  primary key (report_id, placement_key)
);

create index if not exists blogger_evidence_links_placement_key_idx
  on public.blogger_evidence_placement_links (placement_key);

create index if not exists blogger_evidence_links_report_id_idx
  on public.blogger_evidence_placement_links (report_id);

alter table public.blogger_evidence_placement_links enable row level security;

comment on table public.blogger_evidence_placement_links is
  'Явная связь фотоотчёта по охвату с одним или несколькими конкретными размещениями.';

comment on column public.blogger_evidence_placement_links.placement_key is
  'Стабильный placementOverrideKey из CRM; связь не зависит от варианта написания ника.';
