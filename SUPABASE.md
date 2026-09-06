# Swapping the mock for Supabase

`lib/api.ts` is the only file that knows where data comes from. Every screen
imports from it, so this swap touches one file plus a new client module.

## 1. Schema

Two tables, exactly as in the brief.

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  activity text not null check (char_length(activity) between 3 and 60),
  location text not null check (char_length(location) between 2 and 60),
  starts_at timestamptz not null,
  capacity_wanted int not null check (capacity_wanted between 1 and 20),
  host_id uuid not null references auth.users (id) on delete cascade,
  host_name text not null,
  created_at timestamptz not null default now()
);

create table joins (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index events_starts_at_idx on events (starts_at);
```

The composite primary key on `joins` makes double-joining impossible at the
database level, so the client never has to guard against a double tap.

## 2. Row Level Security

This is the part that needs care. Without these policies the anon key can read
and write everything.

```sql
alter table events enable row level security;
alter table joins  enable row level security;

-- Anyone signed in can read the feed.
create policy events_read on events
  for select to authenticated using (true);

-- You can only create events in your own name.
create policy events_insert on events
  for insert to authenticated with check (auth.uid() = host_id);

-- Hosts can cancel or edit only their own events.
create policy events_update on events
  for update to authenticated using (auth.uid() = host_id);
create policy events_delete on events
  for delete to authenticated using (auth.uid() = host_id);

create policy joins_read on joins
  for select to authenticated using (true);

-- You can only join or leave as yourself.
create policy joins_insert on joins
  for insert to authenticated with check (auth.uid() = user_id);
create policy joins_delete on joins
  for delete to authenticated using (auth.uid() = user_id);
```

Verify by hitting the REST endpoint with the anon key and no session — every
request should come back empty or 401, never with rows.

## 3. Client

```ts
// lib/supabase.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);
```

Put the two values in `.env.local`. The `EXPO_PUBLIC_` prefix is what makes
them readable from app code. The anon key is safe to ship — RLS is what
protects the data, not key secrecy.

## 4. Replace each function in `lib/api.ts`

**`listLiveEvents`** — the expiry rule is a `where` clause, which is why there
is no background job to run:

```ts
const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

const { data, error } = await supabase
  .from('events')
  .select('*, joins(user_id)')
  .gte('starts_at', cutoff)
  .order('starts_at', { ascending: true });
```

`joins(user_id)` pulls the join rows in the same request, so `joinCount` is
`row.joins.length` and `joinedByMe` is whether the current user's id appears in
it — no second round trip and no count column to keep in sync.

**`createEvent`** — `.insert(...).select().single()` returns the created row.

**`joinEvent`** — `.from('joins').insert({ event_id, user_id })`. Because of the
composite primary key, a duplicate returns error code `23505`; treat that as
success rather than as a failure.

**`leaveEvent`** — `.from('joins').delete().match({ event_id, user_id })`.

## 5. Auth

Swap the generated id in `lib/session.tsx` for a real anonymous session:

```ts
const { data } = await supabase.auth.signInAnonymously({
  options: { data: { name } },
});
```

Enable "Anonymous sign-ins" in Authentication → Providers first. The display
name lives in `user_metadata.name`, and `events.host_name` denormalizes it so
the feed doesn't need a profiles join.

## 6. Analytics

No separate tool — these are the numbers that matter at this scale:

```sql
-- signups
select count(*) from auth.users;

-- events per day, and how many were hosted by someone outside the team
select date_trunc('day', created_at) as day, count(*)
from events group by 1 order by 1;

-- the retention question: how many people came back to host or join twice
select count(*) from (
  select user_id from joins group by user_id having count(*) > 1
) repeat_joiners;
```
