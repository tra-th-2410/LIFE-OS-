export function formatRelativeTime(date: string | Date, language: 'en' | 'vi' = typeof document !== 'undefined' && document.documentElement.lang === 'vi' ? 'vi' : 'en'): string {
  const now = new Date();
  const d = new Date(date);
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

export function formatDate(date: string | Date, language: 'en' | 'vi' = typeof document !== 'undefined' && document.documentElement.lang === 'vi' ? 'vi' : 'en'): string {
  return new Date(date).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
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

export function initials(name: string): string {
  return name
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
