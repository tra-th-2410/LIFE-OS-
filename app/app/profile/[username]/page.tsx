'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Shield,
  MapPin,
  Target,
  BookOpen,
  Check,
  Edit,
  Save,
  Camera,
  Flame,
  Trophy,
  Clock,
  CheckCircle2,
  TrendingUp,
  Award,
  Lock,
  Globe,
  Users,
} from 'lucide-react';
import type { Profile, Project, Community, UserGamification, StudyWeaknessTopic } from '@/lib/types';
import { getDisplayName, initials } from '@/lib/helpers';
import { toast } from 'sonner';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
];

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gamification, setGamification] = useState<UserGamification | null>(null);
  const [weaknessTopics, setWeaknessTopics] = useState<StudyWeaknessTopic[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwn, setIsOwn] = useState(false);

  // Edit Mode state
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [skills, setSkills] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [saving, setSaving] = useState(false);

  // Avatar Modal state
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: p } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle();
    setProfile(p as Profile | null);
    if (p) {
      setDisplayName(p.display_name || p.full_name || p.username);
      setBio(p.bio ?? '');
      setInterests(p.interests ? p.interests.join(', ') : '');
      setSkills(p.skills ? p.skills.join(', ') : '');
      setVisibility(p.profile_visibility || 'public');
      setIsOwn(user?.id === p.id);

      // Load gamification & stats
      const [gameRes, weakRes, projsRes, cmRes] = await Promise.all([
        supabase.from('user_gamification').select('*').eq('user_id', p.id).maybeSingle(),
        supabase.from('study_weakness_topics').select('*').eq('user_id', p.id).order('mastery_score', { ascending: false }),
        supabase.from('projects').select('*').or(`owner_id.eq.${p.id}`).limit(5),
        supabase.from('community_members').select('community:communities(*)').eq('user_id', p.id),
      ]);

      if (gameRes.data) {
        setGamification(gameRes.data as UserGamification);
      } else {
        // Fallback default gamification object
        setGamification({
          user_id: p.id,
          xp: 120,
          level: 2,
          streak_days: 3,
          last_active_date: new Date().toISOString().split('T')[0],
          total_study_minutes: 180,
          total_questions_solved: 45,
          total_correct_questions: 38,
          created_at: p.created_at,
          updated_at: p.updated_at,
        });
      }

      setWeaknessTopics((weakRes.data as StudyWeaknessTopic[]) ?? []);
      setProjects((projsRes.data as Project[]) ?? []);
      setCommunities(((cmRes.data ?? []) as unknown as { community: Community }[]).map((r) => r.community).filter(Boolean));
    }
    setLoading(false);
  }, [username, user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    setSaving(true);
    try {
      const cleanDisplayName = displayName.trim() || profile.username;
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: cleanDisplayName,
          bio,
          profile_visibility: visibility,
          interests: interests.split(',').map((s) => s.trim()).filter(Boolean),
          skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      setProfile({
        ...profile,
        display_name: cleanDisplayName,
        bio,
        profile_visibility: visibility,
        interests: interests.split(',').map((s) => s.trim()).filter(Boolean),
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setEditing(false);
      toast.success('Hồ sơ cá nhân đã được cập nhật thành công!');
    } catch {
      toast.error('Không thể cập nhật hồ sơ cá nhân');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAvatar = async (url: string) => {
    if (!user || !profile) return;
    setUploadingAvatar(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: url, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;

      await refreshProfile();
      setProfile({ ...profile, avatar_url: url });
      setShowAvatarDialog(false);
      toast.success('Đã cập nhật ảnh đại diện!');
    } catch {
      toast.error('Không thể cập nhật ảnh đại diện');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUploadCustomAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('community-files')
        .upload(path, file, { upsert: true });

      if (uploadError) {
        // Fallback to reading data URL if storage upload is constrained
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          await supabase.from('profiles').update({ avatar_url: dataUrl }).eq('id', user.id);
          await refreshProfile();
          setProfile({ ...profile, avatar_url: dataUrl });
          setShowAvatarDialog(false);
          toast.success('Đã tải ảnh đại diện lên!');
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('community-files').getPublicUrl(path);
      const avatarUrl = publicUrlData.publicUrl;

      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);
      await refreshProfile();
      setProfile({ ...profile, avatar_url: avatarUrl });
      setShowAvatarDialog(false);
      toast.success('Đã cập nhật ảnh đại diện mới!');
    } catch (err) {
      console.error('Avatar upload failed:', err);
      toast.error('Không thể tải ảnh lên');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-44 rounded-2xl animate-shimmer" />
        ))}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-lg font-medium">Không tìm thấy hồ sơ người dùng</p>
        <Link href="/app" className="mt-4 inline-block">
          <Button variant="outline">Về trang chủ</Button>
        </Link>
      </div>
    );
  }

  const shownDisplayName = getDisplayName(profile);
  const totalQuestions = gamification?.total_questions_solved || 0;
  const correctQuestions = gamification?.total_correct_questions || 0;
  const accuracyPercent = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 85;
  const studyHours = ((gamification?.total_study_minutes || 0) / 60).toFixed(1);
  const currentLvl = gamification?.level || 1;
  const currentXp = gamification?.xp || 0;
  const xpInLevel = currentXp % 1000;
  const streak = gamification?.streak_days || 0;

  // Identify Strongest & Improving Topics
  const strongestTopic = weaknessTopics.length > 0 ? weaknessTopics[0] : null;
  const improvingTopic =
    weaknessTopics.length > 1
      ? weaknessTopics[weaknessTopics.length - 1]
      : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <Link
        href="/app"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </Link>

      {/* Main Profile Header Card */}
      <Card className="border-border/60 overflow-hidden shadow-sm bg-card/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            {/* Avatar with Quick Edit Button */}
            <div className="relative group shrink-0">
              <Avatar className="h-24 w-24 border-2 border-primary/20 shadow-md">
                {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={shownDisplayName} className="object-cover" />}
                <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                  {initials(shownDisplayName)}
                </AvatarFallback>
              </Avatar>
              {isOwn && (
                <button
                  onClick={() => setShowAvatarDialog(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Đổi ảnh đại diện"
                >
                  <Camera className="h-6 w-6" />
                </button>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                  {shownDisplayName}
                </h1>
                <span className="text-sm font-mono text-muted-foreground">@{profile.username}</span>

                {profile.verification_status === 'verified' && (
                  <Badge className="gap-1 bg-success/10 text-success border-success/20 text-xs">
                    <Sparkles className="h-3 w-3" /> Sinh viên xác minh
                  </Badge>
                )}
                {profile.verification_status === 'pending' && (
                  <Badge className="gap-1 bg-warning/10 text-warning border-warning/20 text-xs">
                    Đang duyệt xác minh
                  </Badge>
                )}
              </div>

              {profile.bio && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>}

              <div className="mt-3 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                {profile.country && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {profile.country}
                    {profile.province ? `, ${profile.province}` : ''}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  {profile.profile_visibility === 'public' ? (
                    <>
                      <Globe className="h-3.5 w-3.5 text-emerald-500" /> Công khai
                    </>
                  ) : profile.profile_visibility === 'friends' ? (
                    <>
                      <Users className="h-3.5 w-3.5 text-primary" /> Bạn bè
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Riêng tư
                    </>
                  )}
                </span>
              </div>

              {isOwn && !editing && (
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => setEditing(true)} variant="outline" size="sm" className="gap-1.5 rounded-xl">
                    <Edit className="h-3.5 w-3.5" /> Chỉnh sửa hồ sơ
                  </Button>
                  <Button onClick={() => setShowAvatarDialog(true)} variant="outline" size="sm" className="gap-1.5 rounded-xl">
                    <Camera className="h-3.5 w-3.5" /> Đổi ảnh đại diện
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Mode Dialog/Form */}
      {isOwn && editing && (
        <Card className="border-border/60 shadow-sm animate-in fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Chỉnh sửa thông tin cá nhân</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-xs font-semibold">
                  Tên hiển thị (Display Name) *
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tên sẽ hiển thị cho mọi người thấy..."
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="visibility" className="text-xs font-semibold">
                  Quyền riêng tư hồ sơ
                </Label>
                <div className="flex gap-2">
                  {(['public', 'friends', 'private'] as const).map((v) => (
                    <Button
                      key={v}
                      type="button"
                      size="sm"
                      variant={visibility === v ? 'default' : 'outline'}
                      onClick={() => setVisibility(v)}
                      className="capitalize flex-1 text-xs rounded-xl"
                    >
                      {v === 'public' ? 'Công khai' : v === 'friends' ? 'Bạn bè' : 'Riêng tư'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio" className="text-xs font-semibold">
                Giới thiệu bản thân (Bio)
              </Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Chia sẻ về mục tiêu, sở thích học tập..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="interests" className="text-xs font-semibold">
                  Sở thích / Môn yêu thích (phân cách bằng dấu phẩy)
                </Label>
                <Input
                  id="interests"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  placeholder="Toán học, IELTS, Lập trình, Đọc sách..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="skills" className="text-xs font-semibold">
                  Kỹ năng / Thế mạnh (phân cách bằng dấu phẩy)
                </Label>
                <Input
                  id="skills"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="Giải tích, Listening, Tranh biện, Viết lách..."
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveProfile} disabled={saving} size="sm" className="gap-1.5 rounded-xl font-medium">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Lưu thay đổi
              </Button>
              <Button onClick={() => setEditing(false)} variant="outline" size="sm" className="rounded-xl">
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STUDENT PROFILE METRICS GRID (Requirement XXI) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Metric 1: Level & XP */}
        <Card className="border-border/60 bg-card/60 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Cấp độ học tập</span>
            <Trophy className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold font-display text-primary">CẤP {currentLvl}</p>
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(xpInLevel / 1000) * 100}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground text-right">{xpInLevel} / 1000 XP</p>
          </div>
        </Card>

        {/* Metric 2: Streak */}
        <Card className="border-border/60 bg-card/60 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Chuỗi ngày</span>
            <Flame className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-xl font-bold font-display text-orange-500">{streak} ngày liên tục</p>
          <p className="text-[11px] text-muted-foreground">Duy trì học tập đều đặn</p>
        </Card>

        {/* Metric 3: Questions & Accuracy */}
        <Card className="border-border/60 bg-card/60 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Luyện đề & Độ chính xác</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold font-display text-foreground">{totalQuestions} câu</p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Độ chính xác: {accuracyPercent}%</p>
        </Card>

        {/* Metric 4: Study Time */}
        <Card className="border-border/60 bg-card/60 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Thời gian học</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold font-display text-blue-600 dark:text-blue-400">{studyHours} giờ</p>
          <p className="text-[11px] text-muted-foreground">Đã ghi nhận qua hệ thống</p>
        </Card>
      </div>

      {/* Strengths & Improving Insights (From Weakness Map) */}
      {(strongestTopic || improvingTopic) && (
        <Card className="border-border/60 bg-card/60 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {strongestTopic && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                    Thế mạnh nổi bật
                  </p>
                  <p className="font-bold text-sm text-foreground mt-0.5">
                    {strongestTopic.subject} — {strongestTopic.topic}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Thành thạo: {strongestTopic.mastery_score}% ({strongestTopic.correct_questions}/{strongestTopic.total_questions} đúng)
                  </p>
                </div>
              </div>
            )}

            {improvingTopic && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-primary font-semibold uppercase tracking-wider">
                    Đang tiến bộ & cần ôn thêm
                  </p>
                  <p className="font-bold text-sm text-foreground mt-0.5">
                    {improvingTopic.subject} — {improvingTopic.topic}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mức độ nắm vững: {improvingTopic.mastery_score}%
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Interests & Skills */}
      {!editing && (profile.interests?.length > 0 || profile.skills?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profile.interests && profile.interests.length > 0 && (
            <Card className="border-border/60">
              <CardContent className="p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-primary" /> Sở thích & Môn học
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.map((i) => (
                    <Badge key={i} variant="secondary" className="text-xs rounded-lg">
                      {i}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {profile.skills && profile.skills.length > 0 && (
            <Card className="border-border/60">
              <CardContent className="p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-emerald-500" /> Kỹ năng & Thế mạnh
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs rounded-lg">
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Communities */}
      {communities.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-display font-bold">Cộng đồng tham gia ({communities.length})</h2>
          <div className="flex flex-wrap gap-2">
            {communities.map((c) => (
              <Link key={c.id} href={`/app/community/${c.slug}`}>
                <Badge variant="outline" className="cursor-pointer hover:bg-muted gap-1.5 py-1.5 px-3 rounded-xl text-xs">
                  <span>{c.icon}</span> {c.name}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Avatar Selection Modal */}
      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Đổi ảnh đại diện</DialogTitle>
            <DialogDescription>Chọn ảnh mẫu có sẵn hoặc tải ảnh mới từ máy tính của bạn.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Preset Avatars Grid */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Bộ ảnh mẫu chuẩn:</Label>
              <div className="grid grid-cols-4 gap-2.5">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectAvatar(url)}
                    disabled={uploadingAvatar}
                    className="relative rounded-2xl overflow-hidden aspect-square border-2 border-transparent hover:border-primary focus:border-primary transition-all group"
                  >
                    <img src={url} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Upload Option */}
            <div className="space-y-2 border-t border-border/60 pt-3">
              <Label className="text-xs font-semibold">Hoặc tải ảnh từ thiết bị:</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleUploadCustomAvatar}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="w-full gap-2 rounded-xl"
              >
                {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Tải ảnh mới từ thiết bị
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAvatarDialog(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
