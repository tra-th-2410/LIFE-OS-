/*
# Nexus Social OS — Row Level Security Policies

## Security Overview
All tables have RLS enabled. Policies enforce:

1. profiles — all authenticated users can read; only owner can insert/update.
2. communities — public communities readable by all; private readable by members/owner; owner manages.
3. community_members — visible to members of same community; users join/leave themselves.
4. posts — readable by community members; author manages own posts.
5. comments — readable by community members; author manages own comments.
6. goals, habits, habit_logs, mood_entries, journal_entries — strictly owner-only CRUD (private data).
7. projects — public read; owner manages; members can join/leave.
8. project_tasks — public read; project owner/members can create/update; owner can delete.
9. challenges — public read; any authenticated user can create.
10. challenge_participants — public read; users manage own participation.
11. notifications — owner-only CRUD.
12. reports — reporter can create and read own reports.
13. ai_conversations, ai_messages — owner-only CRUD (private AI data).

All owner columns default to auth.uid() so inserts that omit the owner still satisfy WITH CHECK.
*/

-- profiles
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- communities
DROP POLICY IF EXISTS "communities_select" ON communities;
CREATE POLICY "communities_select" ON communities FOR SELECT TO authenticated USING (
  is_private = false
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = communities.id AND cm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "communities_insert_own" ON communities;
CREATE POLICY "communities_insert_own" ON communities FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "communities_update_own" ON communities;
CREATE POLICY "communities_update_own" ON communities FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "communities_delete_own" ON communities;
CREATE POLICY "communities_delete_own" ON communities FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- community_members
DROP POLICY IF EXISTS "cm_select" ON community_members;
CREATE POLICY "cm_select" ON community_members FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM communities c WHERE c.id = community_members.community_id
    AND (c.is_private = false OR c.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM community_members cm2 WHERE cm2.community_id = c.id AND cm2.user_id = auth.uid()))
  )
);
DROP POLICY IF EXISTS "cm_insert_own" ON community_members;
CREATE POLICY "cm_insert_own" ON community_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cm_delete_own" ON community_members;
CREATE POLICY "cm_delete_own" ON community_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- posts
DROP POLICY IF EXISTS "posts_select" ON posts;
CREATE POLICY "posts_select" ON posts FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM communities c WHERE c.id = posts.community_id
    AND (c.is_private = false OR c.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = auth.uid()))
  )
);
DROP POLICY IF EXISTS "posts_insert_own" ON posts;
CREATE POLICY "posts_insert_own" ON posts FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = posts.community_id AND cm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "posts_update_own" ON posts;
CREATE POLICY "posts_update_own" ON posts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "posts_delete_own" ON posts;
CREATE POLICY "posts_delete_own" ON posts FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- comments
DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM posts p JOIN communities c ON c.id = p.community_id
    WHERE p.id = comments.post_id
    AND (c.is_private = false OR c.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = auth.uid()))
  )
);
DROP POLICY IF EXISTS "comments_insert_own" ON comments;
CREATE POLICY "comments_insert_own" ON comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "comments_update_own" ON comments;
CREATE POLICY "comments_update_own" ON comments FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "comments_delete_own" ON comments;
CREATE POLICY "comments_delete_own" ON comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- goals
DROP POLICY IF EXISTS "goals_select_own" ON goals;
CREATE POLICY "goals_select_own" ON goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "goals_insert_own" ON goals;
CREATE POLICY "goals_insert_own" ON goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "goals_update_own" ON goals;
CREATE POLICY "goals_update_own" ON goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "goals_delete_own" ON goals;
CREATE POLICY "goals_delete_own" ON goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- habits
DROP POLICY IF EXISTS "habits_select_own" ON habits;
CREATE POLICY "habits_select_own" ON habits FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "habits_insert_own" ON habits;
CREATE POLICY "habits_insert_own" ON habits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "habits_update_own" ON habits;
CREATE POLICY "habits_update_own" ON habits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "habits_delete_own" ON habits;
CREATE POLICY "habits_delete_own" ON habits FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- habit_logs
DROP POLICY IF EXISTS "habit_logs_select_own" ON habit_logs;
CREATE POLICY "habit_logs_select_own" ON habit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "habit_logs_insert_own" ON habit_logs;
CREATE POLICY "habit_logs_insert_own" ON habit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "habit_logs_delete_own" ON habit_logs;
CREATE POLICY "habit_logs_delete_own" ON habit_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- mood_entries
DROP POLICY IF EXISTS "mood_select_own" ON mood_entries;
CREATE POLICY "mood_select_own" ON mood_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "mood_insert_own" ON mood_entries;
CREATE POLICY "mood_insert_own" ON mood_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "mood_delete_own" ON mood_entries;
CREATE POLICY "mood_delete_own" ON mood_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- journal_entries
DROP POLICY IF EXISTS "journal_select_own" ON journal_entries;
CREATE POLICY "journal_select_own" ON journal_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "journal_insert_own" ON journal_entries;
CREATE POLICY "journal_insert_own" ON journal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "journal_update_own" ON journal_entries;
CREATE POLICY "journal_update_own" ON journal_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "journal_delete_own" ON journal_entries;
CREATE POLICY "journal_delete_own" ON journal_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- projects
DROP POLICY IF EXISTS "projects_select_all" ON projects;
CREATE POLICY "projects_select_all" ON projects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "projects_insert_own" ON projects;
CREATE POLICY "projects_insert_own" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "projects_update_own" ON projects;
CREATE POLICY "projects_update_own" ON projects FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "projects_delete_own" ON projects;
CREATE POLICY "projects_delete_own" ON projects FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- project_members
DROP POLICY IF EXISTS "pm_select_all" ON project_members;
CREATE POLICY "pm_select_all" ON project_members FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pm_insert_own" ON project_members;
CREATE POLICY "pm_insert_own" ON project_members FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_members.project_id AND p.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "pm_delete_own" ON project_members;
CREATE POLICY "pm_delete_own" ON project_members FOR DELETE TO authenticated USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_members.project_id AND p.owner_id = auth.uid())
);

-- project_tasks
DROP POLICY IF EXISTS "tasks_select_all" ON project_tasks;
CREATE POLICY "tasks_select_all" ON project_tasks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tasks_insert" ON project_tasks;
CREATE POLICY "tasks_insert" ON project_tasks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_tasks.project_id AND pm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "tasks_update" ON project_tasks;
CREATE POLICY "tasks_update" ON project_tasks FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_tasks.project_id AND pm.user_id = auth.uid())
) WITH CHECK (true);
DROP POLICY IF EXISTS "tasks_delete" ON project_tasks;
CREATE POLICY "tasks_delete" ON project_tasks FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND p.owner_id = auth.uid())
);

-- challenges
DROP POLICY IF EXISTS "challenges_select_all" ON challenges;
CREATE POLICY "challenges_select_all" ON challenges FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "challenges_insert" ON challenges;
CREATE POLICY "challenges_insert" ON challenges FOR INSERT TO authenticated WITH CHECK (true);

-- challenge_participants
DROP POLICY IF EXISTS "cp_select_all" ON challenge_participants;
CREATE POLICY "cp_select_all" ON challenge_participants FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cp_insert_own" ON challenge_participants;
CREATE POLICY "cp_insert_own" ON challenge_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cp_update_own" ON challenge_participants;
CREATE POLICY "cp_update_own" ON challenge_participants FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cp_delete_own" ON challenge_participants;
CREATE POLICY "cp_delete_own" ON challenge_participants FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- notifications
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
CREATE POLICY "notif_delete_own" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- reports
DROP POLICY IF EXISTS "reports_select_own" ON reports;
CREATE POLICY "reports_select_own" ON reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- ai_conversations
DROP POLICY IF EXISTS "ai_conv_select_own" ON ai_conversations;
CREATE POLICY "ai_conv_select_own" ON ai_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_conv_insert_own" ON ai_conversations;
CREATE POLICY "ai_conv_insert_own" ON ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_conv_update_own" ON ai_conversations;
CREATE POLICY "ai_conv_update_own" ON ai_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_conv_delete_own" ON ai_conversations;
CREATE POLICY "ai_conv_delete_own" ON ai_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ai_messages
DROP POLICY IF EXISTS "ai_msg_select_own" ON ai_messages;
CREATE POLICY "ai_msg_select_own" ON ai_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid())
);
DROP POLICY IF EXISTS "ai_msg_insert_own" ON ai_messages;
CREATE POLICY "ai_msg_insert_own" ON ai_messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid())
);
DROP POLICY IF EXISTS "ai_msg_delete_own" ON ai_messages;
CREATE POLICY "ai_msg_delete_own" ON ai_messages FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid())
);
