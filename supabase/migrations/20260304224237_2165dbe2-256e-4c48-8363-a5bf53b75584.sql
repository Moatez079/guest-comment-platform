
-- Add unique constraint on ship_members for upsert support
ALTER TABLE public.ship_members ADD CONSTRAINT ship_members_ship_user_unique UNIQUE (ship_id, user_id);
