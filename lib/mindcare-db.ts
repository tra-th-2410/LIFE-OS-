import { supabase } from '@/lib/supabase';
import type {
  MindCareConversation,
  MindCareMessage,
  MindCareMemory,
} from './mindcare-types';

const LOCAL_STORAGE_CONVS_PREFIX = 'life_os_mindcare_convs_';
const LOCAL_STORAGE_MSGS_PREFIX = 'life_os_mindcare_msgs_';
const LOCAL_STORAGE_MEMS_PREFIX = 'life_os_mindcare_mems_';

function getLocalData<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function setLocalData<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore quota errors
  }
}

// ----------------------------------------------------------------------
// CONVERSATIONS
// ----------------------------------------------------------------------

export async function getMindCareConversations(
  userId: string
): Promise<MindCareConversation[]> {
  try {
    const { data, error } = await supabase
      .from('mindcare_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      // Sync local cache
      setLocalData(`${LOCAL_STORAGE_CONVS_PREFIX}${userId}`, data);
      return data as MindCareConversation[];
    }
  } catch {
    // Fallback to local storage
  }

  // Graceful fallback
  return getLocalData<MindCareConversation>(
    `${LOCAL_STORAGE_CONVS_PREFIX}${userId}`
  ).sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export async function getMindCareConversation(
  convId: string,
  userId: string
): Promise<MindCareConversation | null> {
  try {
    const { data, error } = await supabase
      .from('mindcare_conversations')
      .select('*')
      .eq('id', convId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      return data as MindCareConversation;
    }
  } catch {
    // Fallback
  }

  const local = getLocalData<MindCareConversation>(
    `${LOCAL_STORAGE_CONVS_PREFIX}${userId}`
  );
  return local.find((c) => c.id === convId) || null;
}

export async function createMindCareConversation(
  userId: string,
  title: string = 'Cuộc trò chuyện mới'
): Promise<MindCareConversation> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `conv_${Date.now()}`;
  const now = new Date().toISOString();

  const item: MindCareConversation = {
    id: newId,
    user_id: userId,
    title,
    created_at: now,
    updated_at: now,
  };

  try {
    const { data, error } = await supabase
      .from('mindcare_conversations')
      .insert({
        id: newId,
        user_id: userId,
        title,
      })
      .select()
      .maybeSingle();

    if (!error && data) {
      const conv = data as MindCareConversation;
      const cached = getLocalData<MindCareConversation>(
        `${LOCAL_STORAGE_CONVS_PREFIX}${userId}`
      );
      setLocalData(`${LOCAL_STORAGE_CONVS_PREFIX}${userId}`, [conv, ...cached.filter((c) => c.id !== conv.id)]);
      return conv;
    }
  } catch {
    // Continue with local storage
  }

  const cached = getLocalData<MindCareConversation>(
    `${LOCAL_STORAGE_CONVS_PREFIX}${userId}`
  );
  setLocalData(`${LOCAL_STORAGE_CONVS_PREFIX}${userId}`, [item, ...cached]);
  return item;
}

export async function updateMindCareConversationTitle(
  convId: string,
  userId: string,
  title: string
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await supabase
      .from('mindcare_conversations')
      .update({ title, updated_at: now })
      .eq('id', convId)
      .eq('user_id', userId);
  } catch {
    // Ignore
  }

  const cached = getLocalData<MindCareConversation>(
    `${LOCAL_STORAGE_CONVS_PREFIX}${userId}`
  );
  const updated = cached.map((c) =>
    c.id === convId ? { ...c, title, updated_at: now } : c
  );
  setLocalData(`${LOCAL_STORAGE_CONVS_PREFIX}${userId}`, updated);
}

export async function deleteMindCareConversation(
  convId: string,
  userId: string
): Promise<void> {
  try {
    await supabase
      .from('mindcare_conversations')
      .delete()
      .eq('id', convId)
      .eq('user_id', userId);
  } catch {
    // Ignore
  }

  const cachedConvs = getLocalData<MindCareConversation>(
    `${LOCAL_STORAGE_CONVS_PREFIX}${userId}`
  );
  setLocalData(
    `${LOCAL_STORAGE_CONVS_PREFIX}${userId}`,
    cachedConvs.filter((c) => c.id !== convId)
  );

  const cachedMsgs = getLocalData<MindCareMessage>(
    `${LOCAL_STORAGE_MSGS_PREFIX}${userId}_${convId}`
  );
  if (typeof window !== 'undefined') {
    localStorage.removeItem(`${LOCAL_STORAGE_MSGS_PREFIX}${userId}_${convId}`);
  }
}

// ----------------------------------------------------------------------
// MESSAGES
// ----------------------------------------------------------------------

export async function getMindCareMessages(
  convId: string,
  userId: string
): Promise<MindCareMessage[]> {
  try {
    const { data, error } = await supabase
      .from('mindcare_messages')
      .select('*')
      .eq('conversation_id', convId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setLocalData(
        `${LOCAL_STORAGE_MSGS_PREFIX}${userId}_${convId}`,
        data as MindCareMessage[]
      );
      return data as MindCareMessage[];
    }
  } catch {
    // Fallback to local storage
  }

  return getLocalData<MindCareMessage>(
    `${LOCAL_STORAGE_MSGS_PREFIX}${userId}_${convId}`
  ).sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export async function addMindCareMessage(
  msg: Omit<MindCareMessage, 'id' | 'created_at'>
): Promise<MindCareMessage> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg_${Date.now()}`;
  const now = new Date().toISOString();

  const item: MindCareMessage = {
    id: newId,
    conversation_id: msg.conversation_id,
    user_id: msg.user_id,
    role: msg.role,
    content: msg.content,
    is_safety_triggered: msg.is_safety_triggered ?? false,
    created_at: now,
  };

  try {
    const { data, error } = await supabase
      .from('mindcare_messages')
      .insert({
        id: newId,
        conversation_id: msg.conversation_id,
        user_id: msg.user_id,
        role: msg.role,
        content: msg.content,
        is_safety_triggered: msg.is_safety_triggered ?? false,
      })
      .select()
      .maybeSingle();

    // Also update parent conversation's updated_at
    await supabase
      .from('mindcare_conversations')
      .update({ updated_at: now })
      .eq('id', msg.conversation_id)
      .eq('user_id', msg.user_id);

    if (!error && data) {
      const created = data as MindCareMessage;
      const cached = getLocalData<MindCareMessage>(
        `${LOCAL_STORAGE_MSGS_PREFIX}${msg.user_id}_${msg.conversation_id}`
      );
      setLocalData(`${LOCAL_STORAGE_MSGS_PREFIX}${msg.user_id}_${msg.conversation_id}`, [
        ...cached,
        created,
      ]);
      return created;
    }
  } catch {
    // Local fallback
  }

  const cached = getLocalData<MindCareMessage>(
    `${LOCAL_STORAGE_MSGS_PREFIX}${msg.user_id}_${msg.conversation_id}`
  );
  setLocalData(`${LOCAL_STORAGE_MSGS_PREFIX}${msg.user_id}_${msg.conversation_id}`, [
    ...cached,
    item,
  ]);

  // Update conversation cache
  const convs = getLocalData<MindCareConversation>(
    `${LOCAL_STORAGE_CONVS_PREFIX}${msg.user_id}`
  );
  const updatedConvs = convs.map((c) =>
    c.id === msg.conversation_id ? { ...c, updated_at: now } : c
  );
  setLocalData(`${LOCAL_STORAGE_CONVS_PREFIX}${msg.user_id}`, updatedConvs);

  return item;
}

// ----------------------------------------------------------------------
// MEMORIES
// ----------------------------------------------------------------------

export async function getMindCareMemories(
  userId: string
): Promise<MindCareMemory[]> {
  try {
    const { data, error } = await supabase
      .from('mindcare_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLocalData(`${LOCAL_STORAGE_MEMS_PREFIX}${userId}`, data as MindCareMemory[]);
      return data as MindCareMemory[];
    }
  } catch {
    // Fallback
  }

  return getLocalData<MindCareMemory>(
    `${LOCAL_STORAGE_MEMS_PREFIX}${userId}`
  ).filter((m) => m.is_active);
}

export async function addMindCareMemory(
  userId: string,
  keyPoint: string,
  category: MindCareMemory['category'] = 'general'
): Promise<MindCareMemory> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mem_${Date.now()}`;
  const now = new Date().toISOString();

  const item: MindCareMemory = {
    id: newId,
    user_id: userId,
    key_point: keyPoint.trim(),
    category,
    confidence: 1.0,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  try {
    const { data, error } = await supabase
      .from('mindcare_memories')
      .insert({
        id: newId,
        user_id: userId,
        key_point: keyPoint.trim(),
        category,
        confidence: 1.0,
        is_active: true,
      })
      .select()
      .maybeSingle();

    if (!error && data) {
      const created = data as MindCareMemory;
      const cached = getLocalData<MindCareMemory>(
        `${LOCAL_STORAGE_MEMS_PREFIX}${userId}`
      );
      setLocalData(`${LOCAL_STORAGE_MEMS_PREFIX}${userId}`, [created, ...cached]);
      return created;
    }
  } catch {
    // Local fallback
  }

  const cached = getLocalData<MindCareMemory>(
    `${LOCAL_STORAGE_MEMS_PREFIX}${userId}`
  );
  setLocalData(`${LOCAL_STORAGE_MEMS_PREFIX}${userId}`, [item, ...cached]);
  return item;
}

export async function deleteMindCareMemory(
  memoryId: string,
  userId: string
): Promise<void> {
  try {
    await supabase
      .from('mindcare_memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', userId);
  } catch {
    // Ignore
  }

  const cached = getLocalData<MindCareMemory>(
    `${LOCAL_STORAGE_MEMS_PREFIX}${userId}`
  );
  setLocalData(
    `${LOCAL_STORAGE_MEMS_PREFIX}${userId}`,
    cached.filter((m) => m.id !== memoryId)
  );
}
