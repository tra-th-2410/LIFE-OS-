import { supabase } from '@/lib/supabase';
import type {
  UserGamification,
  XpLedgerEntry,
  XpSourceType,
  UserReward,
  RewardType,
} from '@/lib/types';

export const SYSTEM_REWARDS_CATALOG: {
  reward_id: string;
  reward_type: RewardType;
  name: string;
  icon: string;
  level_required: number;
}[] = [
  { reward_id: 'plant-sprout', reward_type: 'plant', name: 'Mầm Xanh Hy Vọng', icon: '🌱', level_required: 1 },
  { reward_id: 'plant-succulent', reward_type: 'plant', name: 'Sen Đá Kiên Trì', icon: '🪴', level_required: 3 },
  { reward_id: 'pet-cat', reward_type: 'pet', name: 'Mèo Học Bài Chăm Chỉ', icon: '🐱', level_required: 5 },
  { reward_id: 'plant-sunflower', reward_type: 'plant', name: 'Hoa Hướng Dương Năng Lượng', icon: '🌻', level_required: 7 },
  { reward_id: 'pet-owl', reward_type: 'pet', name: 'Cú Mèo Tri Thức', icon: '🦉', level_required: 10 },
  { reward_id: 'room-desk-lamp', reward_type: 'room', name: 'Đèn Bàn Cổ Điển', icon: '💡', level_required: 12 },
  { reward_id: 'room-bookshelf', reward_type: 'room', name: 'Kệ Sách Gỗ Thông', icon: '📚', level_required: 15 },
  { reward_id: 'pet-dragon', reward_type: 'pet', name: 'Rồng Con Huyền Thoại', icon: '🐲', level_required: 20 },
  { reward_id: 'garden-zen', reward_type: 'garden', name: 'Khu Vườn Thiền Tĩnh Lặng', icon: '⛩️', level_required: 25 },
];

/**
 * Safely award XP with duplicate protection
 */
export async function awardXP(
  userId: string,
  amount: number,
  sourceType: XpSourceType,
  sourceId: string | null,
  description: string
): Promise<{ success: boolean; newXp: number; newLevel: number; leveledUp: boolean }> {
  try {
    // 1. Check if XP already awarded for this unique source (e.g. same quiz session or same task)
    if (sourceId) {
      const { data: existing } = await supabase
        .from('xp_ledger')
        .select('id')
        .eq('user_id', userId)
        .eq('source_type', sourceType)
        .eq('source_id', sourceId)
        .maybeSingle();

      if (existing) {
        return { success: false, newXp: 0, newLevel: 0, leveledUp: false };
      }
    }

    // 2. Insert into ledger
    await supabase.from('xp_ledger').insert({
      user_id: userId,
      xp_amount: amount,
      source_type: sourceType,
      source_id: sourceId,
      description,
    });

    // 3. Fetch or initialize user gamification record
    const { data: gameData } = await supabase
      .from('user_gamification')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const todayStr = new Date().toISOString().split('T')[0];
    const prevXp = gameData?.xp || 0;
    const prevLevel = gameData?.level || 1;
    const prevStreak = gameData?.streak_days || 0;
    const lastActive = gameData?.last_active_date;

    const newXp = prevXp + amount;
    // Level formula: Level 1 = 0..999 XP, Level 2 = 1000..1999 XP, etc.
    const newLevel = Math.floor(newXp / 1000) + 1;
    const leveledUp = newLevel > prevLevel;

    // Calculate streak
    let newStreak = prevStreak;
    if (!lastActive) {
      newStreak = 1;
    } else if (lastActive !== todayStr) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastActive === yesterdayStr) {
        newStreak += 1;
      } else {
        newStreak = 1; // Streak reset if missed
      }
    }

    await supabase.from('user_gamification').upsert({
      user_id: userId,
      xp: newXp,
      level: newLevel,
      streak_days: newStreak,
      last_active_date: todayStr,
      updated_at: new Date().toISOString(),
    });

    // 4. Check and unlock rewards for new level
    if (leveledUp) {
      await unlockRewardsForLevel(userId, newLevel);
    }

    return { success: true, newXp, newLevel, leveledUp };
  } catch (err) {
    console.error('Error awarding XP:', err);
    return { success: false, newXp: 0, newLevel: 0, leveledUp: false };
  }
}

/**
 * Unlock rewards from catalog when user levels up
 */
export async function unlockRewardsForLevel(userId: string, level: number) {
  const eligible = SYSTEM_REWARDS_CATALOG.filter((r) => r.level_required <= level);

  for (const reward of eligible) {
    await supabase
      .from('user_rewards')
      .upsert(
        {
          user_id: userId,
          reward_id: reward.reward_id,
          reward_type: reward.reward_type,
          name: reward.name,
          icon: reward.icon,
          level_required: reward.level_required,
          is_unlocked: true,
          unlocked_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,reward_id' }
      );
  }
}

/**
 * Fetch gamification stats for user
 */
export async function getUserGamification(userId: string): Promise<UserGamification | null> {
  const { data } = await supabase
    .from('user_gamification')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return (data as UserGamification) ?? null;
}

/**
 * Fetch all rewards with unlock status
 */
export async function getUserRewardsCatalog(userId: string): Promise<UserReward[]> {
  const { data: userRewards } = await supabase
    .from('user_rewards')
    .select('*')
    .eq('user_id', userId);

  const unlockedMap = new Map((userRewards || []).map((r: any) => [r.reward_id, r]));

  return SYSTEM_REWARDS_CATALOG.map((cat) => {
    const userRec = unlockedMap.get(cat.reward_id);
    return {
      id: userRec?.id || cat.reward_id,
      user_id: userId,
      reward_id: cat.reward_id,
      reward_type: cat.reward_type,
      name: cat.name,
      icon: cat.icon,
      level_required: cat.level_required,
      is_unlocked: userRec?.is_unlocked || false,
      is_equipped: userRec?.is_equipped || false,
      unlocked_at: userRec?.unlocked_at || null,
      created_at: userRec?.created_at || new Date().toISOString(),
    };
  });
}

/**
 * Calculate level from total XP
 */
export function calculateLevel(xp: number): number {
  return Math.max(1, Math.floor((xp || 0) / 1000) + 1);
}
