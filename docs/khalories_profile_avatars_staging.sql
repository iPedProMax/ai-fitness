-- Khalories AI profile avatar Storage setup; ADDITIVE, staging-first.
-- One private WebP avatar per authenticated user: <auth uid>/avatar.webp.
-- No existing object or user is modified.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('khalories-avatars', 'khalories-avatars', false, 131072, ARRAY['image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "khalories_avatar_select_owner" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'khalories-avatars' AND name = ((SELECT auth.uid())::text || '/avatar.webp'));

CREATE POLICY "khalories_avatar_insert_owner" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'khalories-avatars' AND name = ((SELECT auth.uid())::text || '/avatar.webp'));

CREATE POLICY "khalories_avatar_update_owner" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'khalories-avatars' AND name = ((SELECT auth.uid())::text || '/avatar.webp'))
WITH CHECK (bucket_id = 'khalories-avatars' AND name = ((SELECT auth.uid())::text || '/avatar.webp'));

CREATE POLICY "khalories_avatar_delete_owner" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'khalories-avatars' AND name = ((SELECT auth.uid())::text || '/avatar.webp'));
