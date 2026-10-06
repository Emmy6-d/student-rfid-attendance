create extension if not exists pgcrypto;

create table if not exists public.students (
    id uuid primary key default gen_random_uuid(),
    student_id text not null unique check (length(btrim(student_id)) > 0),
    first_name text not null check (length(btrim(first_name)) > 0),
    last_name text not null check (length(btrim(last_name)) > 0),
    email text,
    phone text,
    class_name text,
    status boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.rfid_cards (
    id uuid primary key default gen_random_uuid(),
    uid text not null unique
        check (uid = upper(btrim(uid)) and length(btrim(uid)) > 0),
    student_id uuid not null references public.students(id) on delete restrict,
    active boolean not null default true,
    assigned_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create unique index if not exists rfid_cards_one_active_per_student
    on public.rfid_cards(student_id)
    where active = true;

create table if not exists public.attendance (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete restrict,
    rfid_card_id uuid not null references public.rfid_cards(id) on delete restrict,
    scanned_at timestamptz not null default now(),
    attendance_date date not null,
    device_id text,
    status text not null default 'present' check (status = 'present'),
    constraint attendance_one_per_student_per_day unique (student_id, attendance_date)
);

create table if not exists public.rfid_enrollment_requests (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete restrict,
    status text not null default 'pending'
        check (status in ('pending', 'completed', 'cancelled')),
    rfid_card_id uuid references public.rfid_cards(id) on delete restrict,
    card_uid text,
    last_scanned_uid text,
    device_id text,
    last_error text,
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

alter table public.rfid_enrollment_requests
    add column if not exists last_scanned_uid text;

create index if not exists attendance_date_scanned_at_idx
    on public.attendance(attendance_date, scanned_at desc);

create index if not exists attendance_student_scanned_at_idx
    on public.attendance(student_id, scanned_at desc);

create unique index if not exists rfid_enrollment_one_pending_per_student
    on public.rfid_enrollment_requests(student_id)
    where status = 'pending';

create index if not exists rfid_enrollment_pending_created_at_idx
    on public.rfid_enrollment_requests(created_at)
    where status = 'pending';

alter table public.students enable row level security;
alter table public.rfid_cards enable row level security;
alter table public.attendance enable row level security;
alter table public.rfid_enrollment_requests enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.students to service_role;
grant select, insert, update, delete on public.rfid_cards to service_role;
grant select, insert, update, delete on public.attendance to service_role;
grant select, insert, update, delete on public.rfid_enrollment_requests to service_role;