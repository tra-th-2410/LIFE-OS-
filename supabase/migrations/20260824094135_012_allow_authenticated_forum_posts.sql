/*
# Allow Authenticated Forum Posts

1. Modified Table Policies
- Updates the `forum_posts_insert` policy.
- Authenticated users may create posts when `author_id` matches their session user.
- The existing verified-student restriction is removed from post creation because the post form is available to all signed-in users and the requested product flow requires logged-in users to be able to publish.

2. Security
- Anonymous users still cannot create posts.
- Users cannot submit a post on behalf of another account.
- Existing read, update, and delete policies remain unchanged.

3. Important Notes
- Student verification remains available for verification-specific features and moderation.
- This change fixes the mismatch between the UI's authenticated-user flow and the database's verified-only insert policy.
*/

DROP POLICY IF EXISTS "forum_posts_insert" ON public.forum_posts;

CREATE POLICY "forum_posts_insert" ON public.forum_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());
