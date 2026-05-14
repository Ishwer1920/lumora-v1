
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  bio text,
  avatar_url text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_self" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_self" on public.profiles for update using (auth.uid() = id);

-- POSTS
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null,
  caption text,
  location text,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create policy "posts_select_all" on public.posts for select using (true);
create policy "posts_insert_own" on public.posts for insert with check (auth.uid() = user_id);
create policy "posts_update_own" on public.posts for update using (auth.uid() = user_id);
create policy "posts_delete_own" on public.posts for delete using (auth.uid() = user_id);
create index posts_user_idx on public.posts(user_id);
create index posts_created_idx on public.posts(created_at desc);

-- LIKES
create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.likes enable row level security;
create policy "likes_select_all" on public.likes for select using (true);
create policy "likes_insert_self" on public.likes for insert with check (auth.uid() = user_id);
create policy "likes_delete_self" on public.likes for delete using (auth.uid() = user_id);

-- COMMENTS
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
create policy "comments_select_all" on public.comments for select using (true);
create policy "comments_insert_self" on public.comments for insert with check (auth.uid() = user_id);
create policy "comments_delete_own" on public.comments for delete using (auth.uid() = user_id);
create index comments_post_idx on public.comments(post_id);

-- FOLLOWS
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
alter table public.follows enable row level security;
create policy "follows_select_all" on public.follows for select using (true);
create policy "follows_insert_self" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete_self" on public.follows for delete using (auth.uid() = follower_id);

-- SAVES
create table public.saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.saves enable row level security;
create policy "saves_select_self" on public.saves for select using (auth.uid() = user_id);
create policy "saves_insert_self" on public.saves for insert with check (auth.uid() = user_id);
create policy "saves_delete_self" on public.saves for delete using (auth.uid() = user_id);

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade, -- recipient
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('like','comment','follow')),
  post_id uuid references public.posts(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "notif_select_self" on public.notifications for select using (auth.uid() = user_id);
create policy "notif_update_self" on public.notifications for update using (auth.uid() = user_id);
create policy "notif_insert_actor" on public.notifications for insert with check (auth.uid() = actor_id);
create index notif_user_idx on public.notifications(user_id, created_at desc);

-- AUTO PROFILE on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uname text;
begin
  uname := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  -- ensure uniqueness by appending suffix on conflict
  begin
    insert into public.profiles (id, username, display_name)
    values (new.id, uname, coalesce(new.raw_user_meta_data->>'display_name', uname));
  exception when unique_violation then
    insert into public.profiles (id, username, display_name)
    values (new.id, uname || '_' || substr(new.id::text,1,6), coalesce(new.raw_user_meta_data->>'display_name', uname));
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- REALTIME
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.likes;
alter publication supabase_realtime add table public.comments;

-- STORAGE bucket for media
insert into storage.buckets (id, name, public) values ('media','media', true)
on conflict (id) do nothing;

create policy "media_public_read" on storage.objects for select using (bucket_id = 'media');
create policy "media_user_insert" on storage.objects for insert
  with check (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "media_user_update" on storage.objects for update
  using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "media_user_delete" on storage.objects for delete
  using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
