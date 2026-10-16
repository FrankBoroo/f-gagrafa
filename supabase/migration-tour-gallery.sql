-- =========================================================
-- Tour / gallery page: the property and neighbourhood photos you manage in
-- Admin → Tour. (Residence photos on the Tour page come from each unit automatically.)
-- Safe to run once, and safe to re-run. Paste the whole file into the SQL Editor.
-- =========================================================

create table if not exists gallery_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('property', 'neighbourhood')),
  image_url text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_gallery_items_order on gallery_items (category, sort_order);

alter table gallery_items enable row level security;

-- The gallery is public content, so anyone may read it. There are deliberately no write
-- policies: only the server's service key (used by the admin) can add, edit or remove photos.
drop policy if exists "gallery_items: public read" on gallery_items;
create policy "gallery_items: public read" on gallery_items for select using (true);
