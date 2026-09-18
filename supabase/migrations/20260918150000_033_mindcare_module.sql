-- ==============================================================================
-- 033_mindcare_module.sql
-- MindCare AI Module: Dedicated, private, and secure tables for psychological companion
-- ==============================================================================

-- 1. Table: mindcare_conversations
CREATE TABLE IF NOT EXISTS public.mindcare_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Cuộc trò chuyện mới',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Table: mindcare_messages
CREATE TABLE IF NOT EXISTS public.mindcare_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.mindcare_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  is_safety_triggered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Table: mindcare_memories
-- Stores user-approved contextual memory strictly to enhance companion empathy
CREATE TABLE IF NOT EXISTS public.mindcare_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key_point text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('feeling', 'relationship', 'pressure', 'preference', 'general')),
  confidence numeric NOT NULL DEFAULT 1.0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_mindcare_conv_user ON public.mindcare_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mindcare_msg_conv ON public.mindcare_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_mindcare_msg_user ON public.mindcare_messages(user_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_mindcare_mem_user ON public.mindcare_memories(user_id, is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE public.mindcare_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mindcare_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mindcare_memories ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: Private to the authenticated user only
-- mindcare_conversations
DROP POLICY IF EXISTS "mindcare_conv_select_own" ON public.mindcare_conversations;
CREATE POLICY "mindcare_conv_select_own" ON public.mindcare_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mindcare_conv_insert_own" ON public.mindcare_conversations;
CREATE POLICY "mindcare_conv_insert_own" ON public.mindcare_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mindcare_conv_update_own" ON public.mindcare_conversations;
CREATE POLICY "mindcare_conv_update_own" ON public.mindcare_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mindcare_conv_delete_own" ON public.mindcare_conversations;
CREATE POLICY "mindcare_conv_delete_own" ON public.mindcare_conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- mindcare_messages
DROP POLICY IF EXISTS "mindcare_msg_select_own" ON public.mindcare_messages;
CREATE POLICY "mindcare_msg_select_own" ON public.mindcare_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mindcare_msg_insert_own" ON public.mindcare_messages;
CREATE POLICY "mindcare_msg_insert_own" ON public.mindcare_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mindcare_msg_update_own" ON public.mindcare_messages;
CREATE POLICY "mindcare_msg_update_own" ON public.mindcare_messages
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mindcare_msg_delete_own" ON public.mindcare_messages;
CREATE POLICY "mindcare_msg_delete_own" ON public.mindcare_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- mindcare_memories
DROP POLICY IF EXISTS "mindcare_mem_select_own" ON public.mindcare_memories;
CREATE POLICY "mindcare_mem_select_own" ON public.mindcare_memories
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mindcare_mem_insert_own" ON public.mindcare_memories;
CREATE POLICY "mindcare_mem_insert_own" ON public.mindcare_memories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mindcare_mem_update_own" ON public.mindcare_memories;
CREATE POLICY "mindcare_mem_update_own" ON public.mindcare_memories
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mindcare_mem_delete_own" ON public.mindcare_memories;
CREATE POLICY "mindcare_mem_delete_own" ON public.mindcare_memories
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
