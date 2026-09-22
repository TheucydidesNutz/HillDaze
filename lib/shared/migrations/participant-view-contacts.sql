-- Adds a per-participant "view contacts" permission for the events module.
-- When true, that participant may tap a teammate's name in their event card
-- to reveal the teammate's email/phone. Off by default; only editable on the
-- admin Participants page. Applied manually via the Supabase SQL editor
-- (the events tables are managed directly in Supabase, not via CLI migrations).

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS view_contacts boolean NOT NULL DEFAULT false;
