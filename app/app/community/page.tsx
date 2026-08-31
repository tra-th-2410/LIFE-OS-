'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  Search,
  Users,
  Plus,
  Eye,
  Lock,
  Loader2,
  MessageSquare,
  BookOpen,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Activity,
  Flame,
  Clock,
  Heart,
  Bookmark,
  Share2,
  Download,
  Check,
  UserPlus,
  Send,
  Sparkles,
} from 'lucide-react';
import type {
  Community,
  ForumCategory,
  ForumPost,
  Profile,
  StudyGroup,
  Friendship,
  CommunityPostAttachment,
} from '@/lib/types';
import { COMMUNITY_COLORS, formatRelativeTime, getDisplayName, initials, slugify } from '@/lib/helpers';
import { ImageLightbox } from '@/components/my-life/image-lightbox';
import { toast } from 'sonner';

type CommunityTab =
  | 'feed'
  | 'forum'
  | 'friends'
  | 'study_groups'
  | 'documents'
  | 'images'
  | 'chat'
  | 'activity';

const EMOJI_OPTIONS = ['💬', '📚', '🎮', '🎨', '🏆', '🌱', '💻', '🎵', '⚽', '🔬', '🌍', '✨'];
const COLOR_OPTIONS = ['teal', 'blue', 'green', 'amber', 'rose', 'purple', 'orange', 'cyan'];

export default function CommunityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as CommunityTab) || 'feed';
  const { user, profile, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<CommunityTab>(initialTab);

  // Community Feed State
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [communitySearch, setCommunitySearch] = useState('');

  // Create Community Dialog
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [commName, setCommName] = useState('');
  const [commDescription, setCommDescription] = useState('');
  const [commIcon, setCommIcon] = useState('💬');
  const [commColor, setCommColor] = useState('teal');
  const [commIsPrivate, setCommIsPrivate] = useState(false);
  const [creatingCommunity, setCreatingCommunity] = useState(false);

  // Forum State
  const [forumCategories, setForumCategories] = useState<ForumCategory[]>([]);
  const [forumPosts, setForumPosts] = useState<(ForumPost & { author?: Profile | null; category?: ForumCategory | null })[]>([]);
  const [selectedForumCategory, setSelectedForumCategory] = useState<string>('all');
  const [forumSort, setForumSort] = useState<'latest' | 'discussed' | 'helpful'>('latest');
  const [forumSearch, setForumSearch] = useState('');
  const [showCreateForumPost, setShowCreateForumPost] = useState(false);
  const [forumPostTitle, setForumPostTitle] = useState('');
  const [forumPostContent, setForumPostContent] = useState('');
  const [forumPostCategory, setForumPostCategory] = useState('');
  const [forumPostAnonymous, setForumPostAnonymous] = useState(false);
  const [creatingForumPost, setCreatingForumPost] = useState(false);

  // Study Groups State
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSubject, setGroupSubject] = useState('Toán');
  const [groupDescription, setGroupDescription] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Friends State
  const [friends, setFriends] = useState<Profile[]>([]);
  const [friendSearch, setFriendSearch] = useState('');

  // Shared Documents & Media
  const [documents, setDocuments] = useState<CommunityPostAttachment[]>([]);
  const [images, setImages] = useState<CommunityPostAttachment[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Lightbox & image urls map
  const [mediaSignedUrls, setMediaSignedUrls] = useState<Record<string, string>>({});

  // Synchronize Tab with URL query param if changed
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as CommunityTab;
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  // Load All Community Data
  const loadData = useCallback(async () => {
    setLoadingCommunities(true);
    try {
      const [commRes, catRes, postsRes, groupsRes, attsRes] = await Promise.all([
        supabase.from('communities').select('*').is('archived_at', null).order('members_count', { ascending: false }),
        supabase.from('forum_categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('forum_posts').select('*, author:profiles!forum_posts_author_id_fkey(username, display_name, avatar_url, id), category:forum_categories!forum_posts_category_id_fkey(*)').eq('status', 'active').order('created_at', { ascending: false }).limit(20),
        supabase.from('study_groups').select('*').order('members_count', { ascending: false }),
        supabase.from('community_post_attachments').select('*').order('created_at', { ascending: false }).limit(30),
      ]);

      setCommunities((commRes.data as Community[]) ?? []);
      setForumCategories((catRes.data as ForumCategory[]) ?? []);
      setForumPosts((postsRes.data as (ForumPost & { author?: Profile | null; category?: ForumCategory | null })[]) ?? []);
      
      const grps = (groupsRes.data as StudyGroup[]) ?? [];
      // If no study groups in DB yet, provide realistic starter groups
      if (grps.length === 0) {
        setStudyGroups([
          { id: '1', name: 'Đội Luyện Thi THPT QG Toán 9+', slug: 'toan-thpt-9plus', avatar_url: null, description: 'Ôn luyện các dạng đề nâng cao 9+ môn Toán và phương pháp Casio tối ưu.', subject: 'Toán', creator_id: null, members_count: 14, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: '2', name: 'CLB IELTS Speaking 7.5+ Everyday', slug: 'ielts-speaking-club', avatar_url: null, description: 'Luyện tập Speaking theo cặp mỗi tối 20:30, chấm bài và sửa lỗi phát âm.', subject: 'English', creator_id: null, members_count: 28, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: '3', name: 'Nhóm Tự Học Lập Trình Web & AI', slug: 'coding-ai-study-group', avatar_url: null, description: 'Cùng làm project thực chiến Next.js, Python AI và giải thuật thuật toán.', subject: 'Tin học', creator_id: null, members_count: 19, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        ]);
      } else {
        setStudyGroups(grps);
      }

      const allAtts = (attsRes.data as CommunityPostAttachment[]) ?? [];
      setDocuments(allAtts.filter((a) => !a.is_image));
      setImages(allAtts.filter((a) => a.is_image));

      // Fetch sample friends
      if (user) {
        const { data: friendRows } = await supabase
          .from('friendships')
          .select('friend:profiles!friendships_friend_id_fkey(*)')
          .eq('user_id', user.id)
          .eq('status', 'accepted');

        if (friendRows && friendRows.length > 0) {
          setFriends(friendRows.map((r: any) => r.friend).filter(Boolean));
        } else {
          // Load suggested public profiles
          const { data: publicProfiles } = await supabase.from('profiles').select('*').neq('id', user.id).limit(6);
          setFriends((publicProfiles as Profile[]) ?? []);
        }
      }
    } catch (err) {
      console.error('Error loading community data:', err);
    } finally {
      setLoadingCommunities(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  // Handle Create Community
  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }
    if (!commName.trim() || !commDescription.trim()) {
      toast.error('Vui lòng nhập tên và mô tả cộng đồng');
      return;
    }
    setCreatingCommunity(true);
    try {
      const generatedSlug = slugify(commName.trim()) || `community-${Date.now().toString(36)}`;
      const { data, error } = await supabase.rpc('create_community', {
        p_name: commName.trim(),
        p_slug: generatedSlug,
        p_description: commDescription.trim(),
        p_icon: commIcon,
        p_color: commColor,
        p_is_private: commIsPrivate,
      });

      if (error) throw error;
      const newComm = data as Community;
      setCommunities([newComm, ...communities]);
      setShowCreateCommunity(false);
      setCommName('');
      setCommDescription('');
      toast.success('Cộng đồng mới đã được tạo thành công!');
      router.push(`/app/community/${newComm.slug}`);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tạo cộng đồng. Vui lòng thử lại.');
    } finally {
      setCreatingCommunity(false);
    }
  };

  // Handle Create Forum Post
  const handleCreateForumPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }
    if (!forumPostTitle.trim() || !forumPostContent.trim()) {
      toast.error('Vui lòng nhập tiêu đề và nội dung bài thảo luận');
      return;
    }
    setCreatingForumPost(true);
    try {
      const categoryId = forumPostCategory || (forumCategories[0]?.id ?? null);
      const { data, error } = await supabase
        .from('forum_posts')
        .insert({
          author_id: user.id,
          category_id: categoryId,
          title: forumPostTitle.trim(),
          content: forumPostContent.trim(),
          is_anonymous: forumPostAnonymous,
          status: 'active',
        })
        .select('*, author:profiles!forum_posts_author_id_fkey(username, display_name, avatar_url, id), category:forum_categories!forum_posts_category_id_fkey(*)')
        .single();

      if (error) throw error;
      setForumPosts([data as any, ...forumPosts]);
      setShowCreateForumPost(false);
      setForumPostTitle('');
      setForumPostContent('');
      toast.success('Bài thảo luận đã được đăng thành công lên Diễn đàn!');
    } catch (err) {
      console.error(err);
      toast.error('Không thể đăng bài. Vui lòng thử lại.');
    } finally {
      setCreatingForumPost(false);
    }
  };

  // Handle Create Study Group
  const handleCreateStudyGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }
    if (!groupName.trim()) {
      toast.error('Vui lòng nhập tên nhóm học tập');
      return;
    }
    setCreatingGroup(true);
    try {
      const slug = slugify(groupName.trim()) || `group-${Date.now().toString(36)}`;
      const { data, error } = await supabase
        .from('study_groups')
        .insert({
          name: groupName.trim(),
          slug,
          subject: groupSubject,
          description: groupDescription.trim(),
          creator_id: user.id,
          members_count: 1,
        })
        .select()
        .single();

      if (!error && data) {
        await supabase.from('study_group_members').insert({
          group_id: (data as any).id,
          user_id: user.id,
          role: 'owner',
        });
        setStudyGroups([data as StudyGroup, ...studyGroups]);
      } else {
        // Local state fallback if table pending
        const localGroup: StudyGroup = {
          id: `temp-${Date.now()}`,
          name: groupName.trim(),
          slug,
          subject: groupSubject,
          avatar_url: null,
          description: groupDescription.trim(),
          creator_id: user.id,
          members_count: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setStudyGroups([localGroup, ...studyGroups]);
      }

      setShowCreateGroup(false);
      setGroupName('');
      setGroupDescription('');
      toast.success('Nhóm học tập mới đã được tạo thành công!');
    } catch (err) {
      console.error(err);
      toast.error('Không thể tạo nhóm');
    } finally {
      setCreatingGroup(false);
    }
  };

  const filteredCommunities = communities.filter((c) => {
    const q = communitySearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
  });

  const filteredForumPosts = forumPosts.filter((p) => {
    const matchCategory = selectedForumCategory === 'all' || p.category_id === selectedForumCategory || (p.category && p.category.slug === selectedForumCategory);
    const matchSearch = !forumSearch || p.title.toLowerCase().includes(forumSearch.toLowerCase()) || p.content.toLowerCase().includes(forumSearch.toLowerCase());
    return matchCategory && matchSearch;
  });

  const tabItems = [
    { id: 'feed' as const, label: 'Cộng đồng', icon: Users },
    { id: 'forum' as const, label: 'Diễn đàn (Forum)', icon: MessageSquare },
    { id: 'study_groups' as const, label: 'Nhóm học tập', icon: BookOpen },
    { id: 'friends' as const, label: 'Bạn bè & Bạn học', icon: UserPlus },
    { id: 'documents' as const, label: 'Tài liệu chia sẻ', icon: FileText },
    { id: 'images' as const, label: 'Thư viện ảnh', icon: ImageIcon },
    { id: 'chat' as const, label: 'Trò chuyện', icon: MessageCircle },
    { id: 'activity' as const, label: 'Hoạt động gần đây', icon: Activity },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Community & Hub</h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              <Sparkles className="h-3 w-3 mr-1" /> Kết nối sinh viên
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Không gian trao đổi kiến thức, diễn đàn học thuật, nhóm học tập và chia sẻ tài liệu Life OS.
          </p>
        </div>

        {/* Create Action Buttons based on Active Tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'forum' ? (
            <Button onClick={() => setShowCreateForumPost(true)} className="gap-1.5 rounded-xl">
              <Plus className="h-4 w-4" /> Đăng bài Diễn đàn
            </Button>
          ) : activeTab === 'study_groups' ? (
            <Button onClick={() => setShowCreateGroup(true)} className="gap-1.5 rounded-xl">
              <Plus className="h-4 w-4" /> Tạo nhóm học mới
            </Button>
          ) : (
            <Button onClick={() => setShowCreateCommunity(true)} className="gap-1.5 rounded-xl">
              <Plus className="h-4 w-4" /> Tạo cộng đồng
            </Button>
          )}
        </div>
      </div>

      {/* Logical Section Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-border/40">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                router.push(`/app/community?tab=${tab.id}`, { scroll: false });
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 border ${
                isActive
                  ? 'bg-primary/10 text-primary border-primary/30 shadow-xs'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 1. TAB: FEED (COMMUNITIES DIRECTORY & POSTS)              */}
      {/* ========================================================= */}
      {activeTab === 'feed' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm các cộng đồng học tập, môn học, sở thích..."
              value={communitySearch}
              onChange={(e) => setCommunitySearch(e.target.value)}
              className="pl-10 max-w-md h-10 rounded-xl"
            />
          </div>

          {loadingCommunities ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-40 rounded-2xl animate-shimmer" />
              ))}
            </div>
          ) : filteredCommunities.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Không tìm thấy cộng đồng nào phù hợp.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCommunities.map((c) => (
                <Link key={c.id} href={`/app/community/${c.slug}`}>
                  <Card className="group cursor-pointer border-border/60 hover:border-primary/40 hover:shadow-md transition-all duration-200 h-full bg-card/80">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl group-hover:scale-105 transition-transform">
                          {c.icon}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {c.is_anonymous && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Eye className="h-3 w-3" /> Ẩn danh
                            </Badge>
                          )}
                          {c.is_private && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Lock className="h-3 w-3" /> Riêng tư
                            </Badge>
                          )}
                        </div>
                      </div>
                      <h3 className="font-semibold text-base group-hover:text-primary transition-colors">{c.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{c.description}</p>
                      <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>{c.members_count.toLocaleString()} thành viên</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. TAB: FORUM (INTEGRATED FULL FORUM MODULE)               */}
      {/* ========================================================= */}
      {activeTab === 'forum' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Categories Horizontal Pills */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chủ đề thảo luận:</p>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedForumCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all border ${
                  selectedForumCategory === 'all'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border/60 hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                Tất cả chủ đề
              </button>
              {forumCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedForumCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 border ${
                    selectedForumCategory === cat.id
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border/60 hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search & Sort Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm bài viết trên Diễn đàn..."
                value={forumSearch}
                onChange={(e) => setForumSearch(e.target.value)}
                className="pl-10 h-10 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/60 shrink-0">
              <button
                onClick={() => setForumSort('latest')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  forumSort === 'latest' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground'
                }`}
              >
                Mới nhất
              </button>
              <button
                onClick={() => setForumSort('discussed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  forumSort === 'discussed' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground'
                }`}
              >
                Nhiều bình luận
              </button>
              <button
                onClick={() => setForumSort('helpful')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  forumSort === 'helpful' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground'
                }`}
              >
                Hữu ích nhất
              </button>
            </div>
          </div>

          {/* Forum Posts List */}
          {filteredForumPosts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground">Chưa có bài thảo luận nào phù hợp</p>
                <p className="text-xs text-muted-foreground mt-1">Hãy là người đầu tiên mở chủ đề thảo luận!</p>
                <Button onClick={() => setShowCreateForumPost(true)} size="sm" className="mt-4 rounded-xl">
                  <Plus className="h-4 w-4 mr-1.5" /> Tạo bài thảo luận
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredForumPosts.map((p) => {
                const authorDisplay = p.is_anonymous ? 'Sinh viên ẩn danh' : getDisplayName(p.author, 'Bạn học');
                return (
                  <Card key={p.id} className="border-border/60 hover:border-primary/40 hover:shadow-xs transition-all bg-card/80">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          {p.author?.avatar_url && !p.is_anonymous && (
                            <AvatarImage src={p.author.avatar_url} alt={authorDisplay} />
                          )}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {p.is_anonymous ? 'A' : initials(authorDisplay)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="font-semibold text-foreground">{authorDisplay}</span>
                            <span className="text-muted-foreground">• {formatRelativeTime(p.created_at)}</span>
                            {p.category && (
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                {p.category.icon} {p.category.name}
                              </Badge>
                            )}
                          </div>

                          <h3 className="font-bold text-base text-foreground mt-1 leading-snug hover:text-primary transition-colors">
                            {p.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed whitespace-pre-wrap">
                            {p.content}
                          </p>

                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground pt-1 border-t border-border/40">
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3.5 w-3.5" /> {p.comments_count || 0} phản hồi
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-3.5 w-3.5 text-rose-500" /> {p.reactions_count || 0} cảm xúc
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. TAB: STUDY GROUPS (STUDY GROUPS ARCHITECTURE)           */}
      {/* ========================================================= */}
      {activeTab === 'study_groups' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {studyGroups.map((group) => (
              <Card key={group.id} className="border-border/60 hover:border-primary/40 hover:shadow-md transition-all bg-card/80 flex flex-col justify-between">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                      📚
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {group.subject}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-foreground leading-snug">{group.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {group.description || 'Nhóm học tập, thảo luận kiến thức và chia sẻ tài liệu ôn thi.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {group.members_count} thành viên
                    </span>
                    <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs font-medium">
                      Vào nhóm
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. TAB: FRIENDS                                            */}
      {/* ========================================================= */}
      {activeTab === 'friends' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {friends.map((friend) => {
              const name = getDisplayName(friend);
              return (
                <Card key={friend.id} className="border-border/60 p-4 bg-card/80">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border border-primary/20">
                      {friend.avatar_url && <AvatarImage src={friend.avatar_url} alt={name} />}
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials(name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <Link href={`/app/profile/${friend.username}`} className="font-bold text-sm text-foreground hover:text-primary truncate block">
                        {name}
                      </Link>
                      <span className="text-xs text-muted-foreground block font-mono">@{friend.username}</span>
                    </div>
                    <Link href={`/app/profile/${friend.username}`}>
                      <Button size="sm" variant="outline" className="rounded-xl text-xs h-8">
                        Xem hồ sơ
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. TAB: DOCUMENTS                                          */}
      {/* ========================================================= */}
      {activeTab === 'documents' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {documents.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Chưa có tài liệu nào được chia sẻ trong cộng đồng.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {documents.map((doc) => (
                <Card key={doc.id} className="border-border/60 p-4 bg-card/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-xs text-foreground truncate">{doc.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatRelativeTime(doc.created_at)}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-8 w-8 rounded-xl shrink-0" title="Tải tài liệu">
                    <Download className="h-4 w-4" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. TAB: IMAGES (WITH LIGHTBOX INTEGRATION)                 */}
      {/* ========================================================= */}
      {activeTab === 'images' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {images.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <ImageIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Chưa có hình ảnh nào được tải lên cộng đồng.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img) => (
                <div
                  key={img.id}
                  onClick={() => setLightboxImage(img.file_path)}
                  className="relative rounded-2xl overflow-hidden aspect-video border border-border/60 bg-muted/40 cursor-pointer group hover:border-primary/50"
                  title="Nhấp để xem toàn màn hình & phóng to"
                >
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    Ảnh đính kèm
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. TAB: CHAT & 8. ACTIVITY                                */}
      {/* ========================================================= */}
      {activeTab === 'chat' && (
        <Card className="border-border/60 p-12 text-center space-y-3 animate-in fade-in duration-200">
          <MessageCircle className="h-10 w-10 text-primary mx-auto" />
          <h3 className="font-bold text-base">Phòng chat trao đổi trực tiếp</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Hỗ trợ kết nối bạn học cùng sở thích và trò chuyện riêng trong các nhóm học tập.
          </p>
        </Card>
      )}

      {activeTab === 'activity' && (
        <Card className="border-border/60 p-12 text-center space-y-3 animate-in fade-in duration-200">
          <Activity className="h-10 w-10 text-emerald-500 mx-auto" />
          <h3 className="font-bold text-base">Nhật ký hoạt động cộng đồng</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Hiển thị chuỗi ngày rèn luyện, hoàn thành thử thách và mốc điểm số mới của bạn bè trong hệ thống.
          </p>
        </Card>
      )}

      {/* ========================================================= */}
      {/* DIALOG 1: CREATE COMMUNITY                                */}
      {/* ========================================================= */}
      <Dialog open={showCreateCommunity} onOpenChange={setShowCreateCommunity}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Tạo Cộng đồng mới</DialogTitle>
            <DialogDescription>Mở không gian kết nối cho sinh viên có cùng môn học và sở thích.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCommunity} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="commName">Tên cộng đồng *</Label>
              <Input id="commName" value={commName} onChange={(e) => setCommName(e.target.value)} placeholder="VD: Ôn thi Đại học môn Toán, IELTS Speaking Club..." required maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="commDesc">Mô tả *</Label>
              <Textarea id="commDesc" value={commDescription} onChange={(e) => setCommDescription(e.target.value)} placeholder="Cộng đồng này dành cho ai và có những hoạt động gì?" required rows={3} maxLength={500} />
            </div>
            <div className="space-y-1.5">
              <Label>Biểu tượng (Icon)</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => setCommIcon(emoji)} className={`h-10 w-10 rounded-xl text-xl transition-all ${commIcon === emoji ? 'bg-primary/20 ring-2 ring-primary' : 'bg-muted hover:bg-muted/80'}`}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateCommunity(false)}>Hủy</Button>
              <Button type="submit" disabled={creatingCommunity || !commName.trim() || !commDescription.trim()}>
                {creatingCommunity ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tạo ngay'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* DIALOG 2: CREATE FORUM POST                               */}
      {/* ========================================================= */}
      <Dialog open={showCreateForumPost} onOpenChange={setShowCreateForumPost}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Đăng bài thảo luận mới</DialogTitle>
            <DialogDescription>Chia sẻ câu hỏi hoặc kiến thức với toàn bộ cộng đồng trên Diễn đàn.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateForumPost} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="postTitle">Tiêu đề thảo luận *</Label>
              <Input id="postTitle" value={forumPostTitle} onChange={(e) => setForumPostTitle(e.target.value)} placeholder="Tóm tắt nội dung câu hỏi hoặc bài chia sẻ..." required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postCategory">Chuyên mục Diễn đàn</Label>
              <select
                id="postCategory"
                value={forumPostCategory}
                onChange={(e) => setForumPostCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm"
              >
                {forumCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postContent">Nội dung chi tiết *</Label>
              <Textarea id="postContent" value={forumPostContent} onChange={(e) => setForumPostContent(e.target.value)} placeholder="Viết nội dung thảo luận..." rows={5} required />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="anonCheck" checked={forumPostAnonymous} onChange={(e) => setForumPostAnonymous(e.target.checked)} className="rounded border-input text-primary" />
              <Label htmlFor="anonCheck" className="text-xs text-muted-foreground cursor-pointer">
                Đăng ẩn danh (không hiển thị tên cá nhân của bạn)
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateForumPost(false)}>Hủy</Button>
              <Button type="submit" disabled={creatingForumPost || !forumPostTitle.trim() || !forumPostContent.trim()}>
                {creatingForumPost ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Đăng bài'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* DIALOG 3: CREATE STUDY GROUP                              */}
      {/* ========================================================= */}
      <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Tạo Nhóm học tập mới</DialogTitle>
            <DialogDescription>Lập nhóm học cùng bạn bè để giải đề, chia sẻ flashcards và duy trì mục tiêu.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateStudyGroup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="grpName">Tên nhóm *</Label>
              <Input id="grpName" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="VD: Nhóm Luyện Đề Lý 12, Team Học IELTS 8.0..." required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grpSubject">Môn học / Lĩnh vực</Label>
              <Input id="grpSubject" value={groupSubject} onChange={(e) => setGroupSubject(e.target.value)} placeholder="Toán, Vật lý, Tiếng Anh, Tin học..." required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grpDesc">Mục tiêu & Quy chế nhóm</Label>
              <Textarea id="grpDesc" value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} placeholder="Kế hoạch ôn thi, lịch họp nhóm..." rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateGroup(false)}>Hủy</Button>
              <Button type="submit" disabled={creatingGroup || !groupName.trim()}>
                {creatingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tạo nhóm'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox View for Media Gallery */}
      {lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
    </div>
  );
}
