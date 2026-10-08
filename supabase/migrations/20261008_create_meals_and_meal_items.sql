create table public.meals (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  created_at timestamptz not null
    default now(),

  total_calories numeric not null
    check (total_calories >= 0),

  total_protein numeric not null
    check (total_protein >= 0),

  total_carbs numeric not null
    check (total_carbs >= 0),

  total_fat numeric not null
    check (total_fat >= 0),

  notes text not null
    default '',

  analysis_snapshot jsonb not null,

  constraint meals_id_user_id_unique
    unique (id, user_id)
);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),

  meal_id uuid not null,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  name text not null,

  estimated_grams numeric not null
    check (estimated_grams >= 0),

  calories numeric not null
    check (calories >= 0),

  protein numeric not null
    check (protein >= 0),

  carbs numeric not null
    check (carbs >= 0),

  fat numeric not null
    check (fat >= 0),

  confidence numeric not null
    check (
      confidence >= 0
      and confidence <= 1
    ),

  weight_source text
    check (
      weight_source in (
        'AI_ESTIMATE',
        'SCALE_MEASURED'
      )
    ),

  nutrition_source text
    check (
      nutrition_source in (
        'AI_ESTIMATE',
        'NUTRITION_LABEL'
      )
    ),

  created_at timestamptz not null
    default now(),

  constraint meal_items_meal_owner_fkey
    foreign key (meal_id, user_id)
    references public.meals(id, user_id)
    on delete cascade
);

create index meals_user_created_at_idx
  on public.meals (
    user_id,
    created_at desc
  );

create index meal_items_meal_id_idx
  on public.meal_items (
    meal_id
  );

alter table public.meals
  enable row level security;

alter table public.meal_items
  enable row level security;

create policy meals_select_own
on public.meals
for select
to authenticated
using (
  auth.uid() = user_id
);

create policy meals_insert_own
on public.meals
for insert
to authenticated
with check (
  auth.uid() = user_id
);

create policy meals_update_own
on public.meals
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

create policy meals_delete_own
on public.meals
for delete
to authenticated
using (
  auth.uid() = user_id
);

create policy meal_items_select_own
on public.meal_items
for select
to authenticated
using (
  auth.uid() = user_id
);

create policy meal_items_insert_own
on public.meal_items
for insert
to authenticated
with check (
  auth.uid() = user_id
);

create policy meal_items_update_own
on public.meal_items
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

create policy meal_items_delete_own
on public.meal_items
for delete
to authenticated
using (
  auth.uid() = user_id
);

grant select, insert, update, delete
on public.meals
to authenticated;

grant select, insert, update, delete
on public.meal_items
to authenticated;
