export function formatRelativeTime(date?: string | Date | null, language: 'en' | 'vi' = typeof document !== 'undefined' && document.documentElement.lang === 'vi' ? 'vi' : 'en'): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return language === 'vi' ? 'vừa xong' : 'just now';
  if (minutes < 60) return language === 'vi' ? `${minutes} phút trước` : `${minutes}m ago`;
  if (hours < 24) return language === 'vi' ? `${hours} giờ trước` : `${hours}h ago`;
  if (days < 7) return language === 'vi' ? `${days} ngày trước` : `${days}d ago`;
  if (days < 30) return language === 'vi' ? `${Math.floor(days / 7)} tuần trước` : `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric' });
}

export function formatDate(date?: string | Date | null, language: 'en' | 'vi' = typeof document !== 'undefined' && document.documentElement.lang === 'vi' ? 'vi' : 'en'): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function getDisplayName(
  profile?: { display_name?: string | null; full_name?: string | null; username?: string | null } | null,
  fallback = 'User'
): string {
  if (!profile) return fallback;
  if (profile.display_name && profile.display_name.trim()) return profile.display_name.trim();
  if (profile.full_name && profile.full_name.trim()) return profile.full_name.trim();
  if (profile.username && profile.username.trim()) return profile.username.trim();
  return fallback;
}

export function initials(name?: string | null): string {
  if (!name || !name.trim()) return 'U';
  return name
    .trim()
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function moodEmoji(mood: number): string {
  const emojis = ['😞', '😕', '😐', '🙂', '😄'];
  return emojis[mood - 1] ?? '😐';
}

export function moodLabel(mood: number, language: 'en' | 'vi' = typeof document !== 'undefined' && document.documentElement.lang === 'vi' ? 'vi' : 'en'): string {
  const labels = language === 'vi' ? ['Tệ', 'Buồn', 'Bình thường', 'Tốt', 'Tuyệt vời'] : ['Low', 'Down', 'Neutral', 'Good', 'Great'];
  return labels[mood - 1] ?? 'Neutral';
}

export const COMMUNITY_COLORS: Record<string, string> = {
  teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  green: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
};

export const HABIT_CATEGORIES: Record<string, { labelVi: string; labelEn: string; color: string; icon: string }> = {
  study: { labelVi: 'Học tập', labelEn: 'Study', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', icon: '📚' },
  health: { labelVi: 'Sức khỏe & Thể chất', labelEn: 'Health & Fitness', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: '💪' },
  mindfulness: { labelVi: 'Tâm trí & Cảm xúc', labelEn: 'Mindfulness', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', icon: '🧘' },
  language: { labelVi: 'Ngoại ngữ', labelEn: 'Languages', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: '🗣️' },
  skill: { labelVi: 'Kỹ năng & Sáng tạo', labelEn: 'Skills & Craft', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20', icon: '💻' },
  routine: { labelVi: 'Nề nếp hàng ngày', labelEn: 'Daily Routine', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: '🧹' },
};

export function getISODate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPast7Days(): { dateStr: string; dayName: string; dayShort: string; isToday: boolean }[] {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = getISODate(d);
    const dayName = d.toLocaleDateString('vi-VN', { weekday: 'short' });
    const dayShort = d.toLocaleDateString('en-US', { weekday: 'narrow' });
    result.push({
      dateStr,
      dayName,
      dayShort,
      isToday: i === 0,
    });
  }
  return result;
}

export function calculateHabitStreak(completedDates: string[]): number {
  if (!completedDates || completedDates.length === 0) return 0;
  const set = new Set(completedDates);
  let streak = 0;
  const today = new Date();
  const todayStr = getISODate(today);

  // Check from today or yesterday
  let checkDate = new Date();
  if (!set.has(todayStr)) {
    // If not completed today, check if completed yesterday to maintain streak
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (set.has(getISODate(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

/**
 * Known legacy / deprecated domains that must NEVER be redirected to.
 */
export const LEGACY_DISALLOWED_DOMAINS = [
  'bejewelled-froyo-d5b8de.netlify.app',
  'life-os-study.netlify.app',
];

/**
 * Primary production site URL for Life OS.
 */
export const PRODUCTION_SITE_URL = 'https://life-os-study.vercel.app';

/**
 * Helper to check whether a given domain/URL is allowed.
 * Prevents redirecting to legacy domains or localhost in production.
 */
export function isAllowedHost(
  hostOrUrl?: string | null,
  isProduction: boolean = process.env.NODE_ENV === 'production'
): boolean {
  if (!hostOrUrl || typeof hostOrUrl !== 'string') return false;
  const clean = hostOrUrl.trim().toLowerCase();

  // Block any legacy domain
  for (const legacy of LEGACY_DISALLOWED_DOMAINS) {
    if (clean.includes(legacy)) return false;
  }

  // Block localhost and internal loopback addresses in production
  if (isProduction && (clean.includes('localhost') || clean.includes('127.0.0.1') || clean.includes('0.0.0.0'))) {
    return false;
  }

  return true;
}

/**
 * Resolves the primary site URL dynamically and safely for both
 * local development (localhost) and production (Netlify / custom domain).
 * Guarantees that legacy domains and localhost (in production) are NEVER returned.
 */
export function getSiteUrl(): string {
  const isProd = process.env.NODE_ENV === 'production';

  // 1. Client-side browser resolution (dynamically adapts to current production/preview domain)
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.trim().replace(/\/+$/, '');
    if (origin && origin !== 'null' && origin !== 'about:blank' && isAllowedHost(origin, isProd)) {
      return origin;
    }
  }

  // 2. Explicit env configuration (e.g. from NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_URL, or SITE_URL)
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || process.env.SITE_URL;
  if (envUrl && envUrl.trim()) {
    const trimmedEnv = envUrl.trim().replace(/\/+$/, '');
    if (isAllowedHost(trimmedEnv, isProd)) {
      return trimmedEnv;
    }
  }

  // 3. Vercel deployment URL support (e.g. *.vercel.app)
  if (process.env.VERCEL_URL && process.env.VERCEL_URL.trim()) {
    const vercelHost = process.env.VERCEL_URL.trim().replace(/\/+$/, '');
    if (isAllowedHost(vercelHost, isProd)) {
      return `https://${vercelHost}`;
    }
  }

  // 4. Guaranteed production fallback (Netlify URL)
  return PRODUCTION_SITE_URL;
}

/**
 * Returns the absolute redirect URL for Supabase Auth callback.
 */
export function getAuthCallbackUrl(): string {
  return `${getSiteUrl()}/auth/callback`;
}

/**
 * Returns the absolute redirect URL for password reset.
 */
export function getResetPasswordUrl(): string {
  return `${getSiteUrl()}/reset-password`;
}


