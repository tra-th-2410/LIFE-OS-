'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
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
  Heart,
  Download,
  Check,
  UserPlus,
  Send,
  Sparkles,
  MoreVertical,
  Pencil,
  Trash2,
  EyeOff,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type {
  Community,
  ForumCategory,
  ForumPost,
  Profile,
  StudyGroup,
  CommunityPostAttachment,
  StudyGroupMessage,
} from '@/lib/types';
import { formatRelativeTime, getDisplayName, initials, slugify } from '@/lib/helpers';
import { ImageLightbox } from '@/components/my-life/image-lightbox';
import { toast } from 'sonner';

type CommunityTab =
  | 'feed'
  | 'forum'
  | 'study_groups'
  | 'chat'
  | 'friends'
  | 'documents'
  | 'images';

const EMOJI_OPTIONS = ['💬', '📚', '🎮', '🎨', '🏆', '🌱', '💻', '🎵', '⚽', '🔬', '🌍', '✨'];

/**
 * Robust helper to resolve an attachment's view/download URL.
 * Handles: full URLs, private 'community-files' signed URLs, and public/signed 'forum-images'.
 */
async function resolveAttachmentUrl(filePath: string): Promise<string> {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('data:')) {
    return filePath;
  }

  // 1. Primary: Private storage bucket 'community-files' (with signed URL)
  try {
    const { data, error } = await supabase.storage
      .from('community-files')
      .createSignedUrl(filePath, 3600);
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (e) {
    console.debug('[Community Storage] Failed to get signed URL from community-files:', e);
  }

  // 2. Secondary: Public storage bucket 'forum-images'
  try {
    const { data: pubData } = supabase.storage
      .from('forum-images')
      .getPublicUrl(filePath);
    if (pubData?.publicUrl) {
      return pubData.publicUrl;
    }
  } catch (e) {
    console.debug('[Community Storage] Failed to get public URL from forum-images:', e);
  }

  // 3. Fallback: Signed URL from 'forum-images'
  try {
    const { data, error } = await supabase.storage
      .from('forum-images')
      .createSignedUrl(filePath, 3600);
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (e) {
    console.debug('[Community Storage] Failed fallback to signed URL from forum-images:', e);
  }

  return '';
}

export default function CommunityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as CommunityTab) || 'feed';
  const initialGroupId = searchParams.get('group');
  const { user, profile, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<CommunityTab>(initialTab);

  // 1. Community Feed State
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

  // 2. Forum State
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

  // Forum Post Edit / Delete State
  const [editingForumPost, setEditingForumPost] = useState<(ForumPost & { author?: Profile | null; category?: ForumCategory | null }) | null>(null);
  const [editForumTitle, setEditForumTitle] = useState('');
  const [editForumContent, setEditForumContent] = useState('');
  const [editForumCategoryId, setEditForumCategoryId] = useState('');
  const [savingEditForum, setSavingEditForum] = useState(false);
  const [deletingForumPost, setDeletingForumPost] = useState<(ForumPost & { author?: Profile | null; category?: ForumCategory | null }) | null>(null);
  const [deletingForumLoading, setDeletingForumLoading] = useState(false);

  // 3. Study Groups State & Join Flow
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set());
  const [groupFilter, setGroupFilter] = useState<'all' | 'my'>('all');
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSubject, setGroupSubject] = useState('Toán');
  const [groupDescription, setGroupDescription] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // 4. Friends State
  const [friends, setFriends] = useState<Profile[]>([]);

  // 5. Shared Documents & Download State
  const [documents, setDocuments] = useState<CommunityPostAttachment[]>([]);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  // 6. Media Gallery & Lightbox
  const [images, setImages] = useState<CommunityPostAttachment[]>([]);
  const [imageUrlsMap, setImageUrlsMap] = useState<Record<string, string>>({});
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // 7. Live Chat Rooms & Direct Messages State
  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialGroupId || null);
  const [selectedChatType, setSelectedChatType] = useState<'group' | 'direct'>('group');
  const [selectedDirectFriend, setSelectedDirectFriend] = useState<Profile | null>(null);
  const [chatMessages, setChatMessages] = useState<StudyGroupMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChatMessage, setSendingChatMessage] = useState(false);
  const [loadingChatMessages, setLoadingChatMessages] = useState(false);
  const [showCreateChatRoom, setShowCreateChatRoom] = useState(false);
  const [chatRoomName, setChatRoomName] = useState('');
  const [chatRoomSubject, setChatRoomSubject] = useState('Chung');
  const [chatRoomDesc, setChatRoomDesc] = useState('');
  const [creatingChatRoom, setCreatingChatRoom] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Synchronize Tab with URL query param if changed
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as CommunityTab;
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
    const groupFromUrl = searchParams.get('group');
    if (groupFromUrl) {
      setSelectedChatId(groupFromUrl);
      setSelectedChatType('group');
    }
  }, [searchParams]);

  // Load All Community Data
  const loadData = useCallback(async () => {
    setLoadingCommunities(true);
    try {
      const [commRes, catRes, postsRes, groupsRes, commAttsRes, forumAttsRes] = await Promise.all([
        supabase.from('communities').select('*').is('archived_at', null).order('members_count', { ascending: false }),
        supabase.from('forum_categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('forum_posts').select('*, author:profiles!forum_posts_author_id_fkey(username, display_name, avatar_url, id), category:forum_categories!forum_posts_category_id_fkey(*)').eq('status', 'active').order('created_at', { ascending: false }).limit(20),
        supabase.from('study_groups').select('*').order('members_count', { ascending: false }),
        supabase.from('community_post_attachments').select('*').order('created_at', { ascending: false }).limit(40),
        supabase.from('forum_post_attachments').select('*').order('created_at', { ascending: false }).limit(40),
      ]);

      setCommunities((commRes.data as Community[]) ?? []);
      setForumCategories((catRes.data as ForumCategory[]) ?? []);
      setForumPosts((postsRes.data as (ForumPost & { author?: Profile | null; category?: ForumCategory | null })[]) ?? []);

      const grps = (groupsRes.data as StudyGroup[]) ?? [];
      setStudyGroups(grps);

      const allAtts: CommunityPostAttachment[] = [
        ...((commAttsRes.data as CommunityPostAttachment[]) ?? []),
        ...((forumAttsRes.data as any[]) ?? []),
      ];
      const docList = allAtts.filter((a) => !a.is_image);
      const imgList = allAtts.filter((a) => a.is_image);
      setDocuments(docList);
      setImages(imgList);

      // Pre-resolve signed/public URLs for all image attachments
      const imgMap: Record<string, string> = {};
      await Promise.all(
        imgList.map(async (img) => {
          const resolved = await resolveAttachmentUrl(img.file_path);
          if (resolved) {
            imgMap[img.id] = resolved;
          }
        })
      );
      setImageUrlsMap(imgMap);

      // Load user's joined study groups & friends
      if (user) {
        const [memberRes, friendRows] = await Promise.all([
          supabase.from('study_group_members').select('group_id').eq('user_id', user.id),
          supabase.from('friendships').select('friend:profiles!friendships_friend_id_fkey(*)').eq('user_id', user.id).eq('status', 'accepted'),
        ]);

        if (memberRes.data) {
          setJoinedGroupIds(new Set(memberRes.data.map((m: any) => m.group_id)));
        }

        if (friendRows.data && friendRows.data.length > 0) {
          setFriends(friendRows.data.map((r: any) => r.friend).filter(Boolean));
        } else {
          const { data: publicProfiles } = await supabase.from('profiles').select('*').neq('id', user.id).limit(8);
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

  // Load Live Chat Messages when selectedChatId changes
  useEffect(() => {
    if (!selectedChatId) return;
    let isMounted = true;
    setLoadingChatMessages(true);

    const loadMessages = async () => {
      try {
        const { data } = await supabase
          .from('study_group_messages')
          .select('*, sender:profiles(id, username, display_name, avatar_url)')
          .eq('group_id', selectedChatId)
          .order('created_at', { ascending: true })
          .limit(50);

        if (isMounted && data) {
          setChatMessages(data as StudyGroupMessage[]);
        }
      } catch (err) {
        console.error('Error loading chat messages:', err);
      } finally {
        if (isMounted) setLoadingChatMessages(false);
      }
    };

    loadMessages();

    // Setup Supabase Realtime Subscription for new chat messages
    const channel = supabase
      .channel(`study-group-chat-${selectedChatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'study_group_messages',
          filter: `group_id=eq.${selectedChatId}`,
        },
        async (payload) => {
          if (payload.new) {
            const { data: senderData } = await supabase
              .from('profiles')
              .select('id, username, display_name, avatar_url')
              .eq('id', (payload.new as any).sender_id)
              .maybeSingle();

            const newMsg: StudyGroupMessage = {
              ...(payload.new as any),
              sender: senderData ?? undefined,
            };

            setChatMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [selectedChatId]);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, loadingChatMessages]);

  // -------------------------------------------------------------
  // 1. JOIN STUDY GROUP HANDLER (FIXED FLOW)
  // -------------------------------------------------------------
  const handleJoinGroup = async (group: StudyGroup) => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (joinedGroupIds.has(group.id)) {
      toast.info('Bạn đã là thành viên của nhóm học này');
      return;
    }

    setJoiningGroupId(group.id);
    try {
      const { error } = await supabase.from('study_group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'member',
      });

      if (error && error.code !== '23505') {
        throw error;
      }

      await supabase
        .from('study_groups')
        .update({ members_count: (group.members_count || 1) + 1 })
        .eq('id', group.id);

      setJoinedGroupIds((prev) => {
        const next = new Set(Array.from(prev));
        next.add(group.id);
        return next;
      });
      setStudyGroups((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, members_count: (g.members_count || 1) + 1 } : g))
      );

      toast.success(`Đã tham gia nhóm học "${group.name}" thành công!`);
    } catch (err: any) {
      console.error('Error joining study group:', err);
      toast.error('Không thể tham gia nhóm. Vui lòng thử lại sau.');
    } finally {
      setJoiningGroupId(null);
    }
  };

  // -------------------------------------------------------------
  // 2. DOCUMENT DOWNLOAD HANDLER (FIXED FLOW)
  // -------------------------------------------------------------
  const handleDownloadDocument = async (doc: CommunityPostAttachment) => {
    setDownloadingDocId(doc.id);
    try {
      const downloadUrl = await resolveAttachmentUrl(doc.file_path);
      if (!downloadUrl) {
        throw new Error('Không tạo được đường dẫn tải tệp từ Storage');
      }

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = doc.file_name || 'tai-lieu-hoc-tap';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Đang tải xuống "${doc.file_name}"...`);
    } catch (err) {
      console.error('Error downloading document:', err);
      toast.error('Không thể tải xuống tệp. Vui lòng kiểm tra quyền truy cập tệp.');
    } finally {
      setDownloadingDocId(null);
    }
  };

  // -------------------------------------------------------------
  // 3. CREATE HANDLERS (COMMUNITY, FORUM, GROUP, CHAT ROOM)
  // -------------------------------------------------------------
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
      setCommunities((prev) => [newComm, ...prev]);
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
      setForumPosts((prev) => [data as any, ...prev]);
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

  const handleStartEditForumPost = (post: ForumPost & { author?: Profile | null; category?: ForumCategory | null }) => {
    setEditingForumPost(post);
    setEditForumTitle(post.title || '');
    setEditForumContent(post.content || '');
    setEditForumCategoryId(post.category_id || (forumCategories[0]?.id ?? ''));
  };

  const handleSaveEditForumPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingForumPost) return;
    if (!editForumTitle.trim() || !editForumContent.trim()) {
      toast.error('Vui lòng nhập tiêu đề và nội dung bài viết');
      return;
    }
    setSavingEditForum(true);
    try {
      const { data, error } = await supabase
        .from('forum_posts')
        .update({
          title: editForumTitle.trim(),
          content: editForumContent.trim(),
          category_id: editForumCategoryId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingForumPost.id)
        .eq('author_id', user.id)
        .select('*, author:profiles!forum_posts_author_id_fkey(username, display_name, avatar_url, id), category:forum_categories!forum_posts_category_id_fkey(*)')
        .single();

      if (error) throw error;

      setForumPosts((prev) =>
        prev.map((p) => (p.id === editingForumPost.id ? (data as any) : p))
      );
      setEditingForumPost(null);
      toast.success('Đã cập nhật bài thảo luận thành công!');
    } catch (err: any) {
      console.error('Error updating forum post:', err);
      toast.error('Không thể cập nhật bài viết. ' + (err?.message || ''));
    } finally {
      setSavingEditForum(false);
    }
  };

  const handleConfirmDeleteForumPost = async () => {
    if (!user || !deletingForumPost) return;
    setDeletingForumLoading(true);
    try {
      const { error } = await supabase
        .from('forum_posts')
        .delete()
        .eq('id', deletingForumPost.id)
        .eq('author_id', user.id);

      if (error) throw error;

      setForumPosts((prev) => prev.filter((p) => p.id !== deletingForumPost.id));
      setDeletingForumPost(null);
      toast.success('Đã xóa bài thảo luận thành công!');
    } catch (err: any) {
      console.error('Error deleting forum post:', err);
      toast.error('Không thể xóa bài viết. ' + (err?.message || ''));
    } finally {
      setDeletingForumLoading(false);
    }
  };

  const handleCreateStudyGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupName.trim()) return;
    setCreatingGroup(true);
    try {
      const slug = slugify(groupName.trim()) || `group-${Date.now().toString(36)}`;
      const { data: newGrp, error } = await supabase
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

      if (!error && newGrp) {
        await supabase.from('study_group_members').insert({
          group_id: newGrp.id,
          user_id: user.id,
          role: 'owner',
        });
        setStudyGroups((prev) => [newGrp as StudyGroup, ...prev]);
        setJoinedGroupIds((prev) => {
          const next = new Set(Array.from(prev));
          next.add(newGrp.id);
          return next;
        });
      }
      setShowCreateGroup(false);
      setGroupName('');
      setGroupDescription('');
      toast.success('Đã tạo nhóm học tập thành công!');
    } catch {
      toast.error('Không thể tạo nhóm học');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleCreateChatRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }
    if (!chatRoomName.trim()) {
      toast.error('Vui lòng nhập tên phòng chat');
      return;
    }

    setCreatingChatRoom(true);
    try {
      const slug = slugify(chatRoomName.trim()) || `room-${Date.now().toString(36)}`;
      const { data: newRoom, error: roomErr } = await supabase
        .from('study_groups')
        .insert({
          name: chatRoomName.trim(),
          slug,
          subject: chatRoomSubject.trim() || 'Chung',
          description: chatRoomDesc.trim(),
          creator_id: user.id,
          members_count: 1 + selectedFriendIds.length,
        })
        .select()
        .single();

      if (roomErr) throw roomErr;

      // Add creator as owner member
      await supabase.from('study_group_members').insert({
        group_id: newRoom.id,
        user_id: user.id,
        role: 'owner',
      });

      // Add invited friends if selected
      if (selectedFriendIds.length > 0) {
        const friendInserts = selectedFriendIds.map((fId) => ({
          group_id: newRoom.id,
          user_id: fId,
          role: 'member',
        }));
        await supabase.from('study_group_members').insert(friendInserts);
      }

      setStudyGroups((prev) => [newRoom, ...prev]);
      setJoinedGroupIds((prev) => {
        const next = new Set(Array.from(prev));
        next.add(newRoom.id);
        return next;
      });
      setSelectedChatId(newRoom.id);
      setSelectedChatType('group');
      setShowCreateChatRoom(false);
      setChatRoomName('');
      setChatRoomDesc('');
      setSelectedFriendIds([]);
      toast.success(`Đã tạo phòng chat "${newRoom.name}" thành công!`);
    } catch (err: any) {
      console.error('Error creating chat room:', err);
      toast.error('Không thể tạo phòng chat');
    } finally {
      setCreatingChatRoom(false);
    }
  };

  const handleSelectDirectFriend = async (friend: Profile) => {
    if (!user) {
      router.push('/login');
      return;
    }
    setSelectedDirectFriend(friend);
    setSelectedChatType('direct');
    setLoadingChatMessages(true);

    try {
      const { data: roomData, error } = await supabase.rpc('get_or_create_direct_room', {
        p_other_user_id: friend.id,
      });

      if (error) {
        console.error('Error creating direct room:', error);
        toast.error('Không thể mở phòng chat riêng: ' + error.message);
        setLoadingChatMessages(false);
        return;
      }

      if (roomData && (roomData as any).id) {
        const directRoom = roomData as StudyGroup;
        setSelectedChatId(directRoom.id);
        setStudyGroups((prev) => {
          if (prev.some((g) => g.id === directRoom.id)) return prev;
          return [directRoom, ...prev];
        });
      }
    } catch (err: any) {
      console.error('Error selecting direct friend:', err);
      toast.error('Lỗi khi mở phòng trò chuyện trực tiếp');
      setLoadingChatMessages(false);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedChatId || !user || sendingChatMessage) return;

    const content = chatInput.trim();
    setChatInput('');
    setSendingChatMessage(true);

    try {
      const { data, error } = await supabase
        .from('study_group_messages')
        .insert({
          group_id: selectedChatId,
          sender_id: user.id,
          content,
          attachments: [],
        })
        .select('*, sender:profiles(id, username, display_name, avatar_url)')
        .single();

      if (error) {
        console.error('Error sending message:', error);
        toast.error(`Không gửi được tin nhắn: ${error.message || 'Lỗi hệ thống'}`);
        setChatInput(content);
        return;
      }

      if (data) {
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data as StudyGroupMessage];
        });
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      toast.error('Không gửi được tin nhắn');
      setChatInput(content);
    } finally {
      setSendingChatMessage(false);
    }
  };

  // Filtered Study Groups
  const filteredStudyGroups = useMemo(() => {
    if (groupFilter === 'my') {
      return studyGroups.filter((g) => !g.is_direct && (joinedGroupIds.has(g.id) || g.creator_id === user?.id));
    }
    return studyGroups.filter((g) => !g.is_direct);
  }, [studyGroups, groupFilter, joinedGroupIds, user]);

  const activeGroup = useMemo(() => {
    if (selectedChatType === 'direct' && selectedDirectFriend) {
      return {
        id: selectedChatId || '',
        name: getDisplayName(selectedDirectFriend),
        description: `Trò chuyện trực tiếp với @${selectedDirectFriend.username}`,
        slug: `dm-${selectedDirectFriend.username}`,
        avatar_url: selectedDirectFriend.avatar_url,
        subject: 'direct',
        creator_id: user?.id || null,
        members_count: 2,
        created_at: '',
        updated_at: '',
      } as StudyGroup;
    }
    return studyGroups.find((g) => g.id === selectedChatId) || null;
  }, [studyGroups, selectedChatId, selectedChatType, selectedDirectFriend, user]);

  // Clean 7 Tab definitions (strictly removing Recent Activity)
  const tabItems = [
    { id: 'feed' as const, label: 'Cộng đồng', icon: Users },
    { id: 'forum' as const, label: 'Diễn đàn (Forum)', icon: MessageSquare },
    { id: 'study_groups' as const, label: 'Nhóm học tập', icon: BookOpen },
    { id: 'chat' as const, label: 'Trò chuyện & Phòng chat', icon: MessageCircle },
    { id: 'friends' as const, label: 'Bạn bè & Bạn học', icon: UserPlus },
    { id: 'documents' as const, label: 'Tài liệu chia sẻ', icon: FileText },
    { id: 'images' as const, label: 'Thư viện ảnh', icon: ImageIcon },
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
            Không gian trao đổi kiến thức, diễn đàn học thuật, nhóm học tập, phòng chat và chia sẻ tài liệu Life OS.
          </p>
        </div>

        {/* Dynamic Action Buttons based on Active Tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'forum' ? (
            <Button onClick={() => setShowCreateForumPost(true)} className="gap-1.5 rounded-xl">
              <Plus className="h-4 w-4" /> Đăng bài Diễn đàn
            </Button>
          ) : activeTab === 'study_groups' ? (
            <Button onClick={() => setShowCreateGroup(true)} className="gap-1.5 rounded-xl">
              <Plus className="h-4 w-4" /> Tạo nhóm học mới
            </Button>
          ) : activeTab === 'chat' ? (
            <Button onClick={() => setShowCreateChatRoom(true)} className="gap-1.5 rounded-xl bg-primary text-primary-foreground font-semibold">
              <Plus className="h-4 w-4" /> Tạo phòng chat
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
      {/* 1. TAB: FEED (COMMUNITIES DIRECTORY & DISCOVERY)          */}
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
          ) : communities.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Không tìm thấy cộng đồng nào phù hợp.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {communities
                .filter((c) => {
                  const q = communitySearch.toLowerCase();
                  return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
                })
                .map((c) => (
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
      {/* 2. TAB: FORUM (INTEGRATED FORUM MODULE)                   */}
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
          {forumPosts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground">Chưa có bài thảo luận nào phù hợp</p>
                <Button onClick={() => setShowCreateForumPost(true)} size="sm" className="mt-4 rounded-xl">
                  <Plus className="h-4 w-4 mr-1.5" /> Tạo bài thảo luận
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {forumPosts
                .filter((p) => {
                  const matchCat =
                    selectedForumCategory === 'all' ||
                    p.category_id === selectedForumCategory ||
                    (p.category && p.category.slug === selectedForumCategory);
                  const matchSearch =
                    !forumSearch ||
                    p.title.toLowerCase().includes(forumSearch.toLowerCase()) ||
                    p.content.toLowerCase().includes(forumSearch.toLowerCase());
                  return matchCat && matchSearch;
                })
                .map((p) => {
                  const isOwner = Boolean(user && (user.id === p.author_id || user.id === p.author?.id));
                  const authorDisplay = p.is_anonymous ? 'Sinh viên ẩn danh' : getDisplayName(p.author, 'Bạn học');
                  return (
                    <Card key={p.id} className="border-border/60 hover:border-primary/40 hover:shadow-xs transition-all bg-card/80 group relative">
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
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap text-xs">
                                <span className="font-semibold text-foreground">{authorDisplay}</span>
                                <span className="text-muted-foreground">• {formatRelativeTime(p.created_at)}</span>
                                {p.is_anonymous && (
                                  <Badge variant="outline" className="text-[10px] gap-1 border-muted-foreground/30 text-muted-foreground">
                                    <EyeOff className="h-2.5 w-2.5" /> Ẩn danh
                                  </Badge>
                                )}
                                {p.category && (
                                  <Badge variant="secondary" className="text-[10px] gap-1">
                                    {p.category.icon} {p.category.name}
                                  </Badge>
                                )}
                              </div>

                              {/* Owner Edit / Delete Menu (available for both anonymous and public posts) */}
                              {isOwner && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                      <span className="sr-only">Tùy chọn</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-36">
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEditForumPost(p);
                                      }}
                                      className="gap-2 cursor-pointer"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      <span>Chỉnh sửa</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingForumPost(p);
                                      }}
                                      className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      <span>Xóa bài viết</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>

                            <Link href={`/app/forum/post/${p.id}`} className="block mt-1">
                              <h3 className="font-bold text-base text-foreground leading-snug hover:text-primary transition-colors">
                                {p.title}
                              </h3>
                              <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed whitespace-pre-wrap">
                                {p.content}
                              </p>
                            </Link>

                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground pt-1 border-t border-border/40">
                              <Link href={`/app/forum/post/${p.id}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                                <MessageSquare className="h-3.5 w-3.5" /> {p.comments_count || 0} phản hồi
                              </Link>
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
      {/* 3. TAB: STUDY GROUPS (WITH FUNCTIONAL JOIN FLOW)          */}
      {/* ========================================================= */}
      {activeTab === 'study_groups' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Subfilter: Tất cả nhóm vs Nhóm của tôi */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGroupFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  groupFilter === 'all'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground'
                }`}
              >
                Tất cả nhóm ({studyGroups.length})
              </button>
              <button
                onClick={() => setGroupFilter('my')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  groupFilter === 'my'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground'
                }`}
              >
                Nhóm của tôi ({studyGroups.filter((g) => joinedGroupIds.has(g.id) || g.creator_id === user?.id).length})
              </button>
            </div>

            <Button onClick={() => setShowCreateGroup(true)} size="sm" className="gap-1.5 rounded-xl">
              <Plus className="h-4 w-4" /> Tạo nhóm học
            </Button>
          </div>

          {filteredStudyGroups.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground">
                  {groupFilter === 'my' ? 'Bạn chưa tham gia nhóm học tập nào' : 'Chưa có nhóm học tập nào'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Hãy tham gia một nhóm học hoặc tự tạo nhóm cùng bạn bè!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredStudyGroups.map((group) => {
                const isJoined = joinedGroupIds.has(group.id) || group.creator_id === user?.id;
                const isJoining = joiningGroupId === group.id;

                return (
                  <Card
                    key={group.id}
                    className={`border-border/60 hover:border-primary/40 hover:shadow-md transition-all bg-card/80 flex flex-col justify-between ${
                      isJoined ? 'border-primary/20 bg-primary/5' : ''
                    }`}
                  >
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                          📚
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-xs">
                            {group.subject}
                          </Badge>
                          {isJoined && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                              <Check className="h-3 w-3 mr-0.5" /> Đã tham gia
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold text-base text-foreground leading-snug">{group.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {group.description || 'Nhóm học tập, thảo luận kiến thức và chia sẻ tài liệu ôn thi.'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/40">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {group.members_count || 1} thành viên
                        </span>

                        {isJoined ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedChatId(group.id);
                              setSelectedChatType('group');
                              setActiveTab('chat');
                              router.push(`/app/community?tab=chat&group=${group.id}`, { scroll: false });
                            }}
                            className="rounded-xl h-8 text-xs font-semibold text-primary gap-1"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> Vào phòng chat
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleJoinGroup(group)}
                            disabled={isJoining}
                            className="rounded-xl h-8 text-xs font-semibold bg-primary text-primary-foreground gap-1"
                          >
                            {isJoining ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" /> Đang tham gia...
                              </>
                            ) : (
                              <>
                                <UserPlus className="h-3.5 w-3.5" /> Tham gia nhóm
                              </>
                            )}
                          </Button>
                        )}
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
      {/* 4. TAB: CHAT (DIRECT MESSAGES & LIVE CHAT ROOMS HUB)       */}
      {/* ========================================================= */}
      {activeTab === 'chat' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[650px] border border-border/60 rounded-2xl bg-card overflow-hidden shadow-sm">
            {/* Left Column: Room & Direct Message Directory */}
            <div className="border-r border-border/60 flex flex-col h-full bg-muted/20">
              <div className="p-3.5 border-b border-border/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <span className="font-bold text-sm text-foreground">Trò chuyện & Nhóm chat</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateChatRoom(true)}
                  className="h-8 text-xs font-semibold gap-1 px-2.5 rounded-lg border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Plus className="h-3.5 w-3.5" /> Tạo phòng
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-4 scrollbar-thin">
                {/* Section A: Chat Rooms (Nhóm học tập) */}
                <div className="space-y-1">
                  <p className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Phòng chat nhóm ({studyGroups.length})
                  </p>
                  {studyGroups.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground text-center">
                      Chưa có phòng chat nào. Nhấn &ldquo;+ Tạo phòng&rdquo; để bắt đầu!
                    </div>
                  ) : (
                    studyGroups.map((g) => {
                      const isSelected = selectedChatId === g.id && selectedChatType === 'group';
                      return (
                        <button
                          key={g.id}
                          onClick={() => {
                            setSelectedChatId(g.id);
                            setSelectedChatType('group');
                          }}
                          className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                            isSelected
                              ? 'bg-primary/15 text-primary font-semibold shadow-xs'
                              : 'hover:bg-muted/60 text-foreground'
                          }`}
                        >
                          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                            #
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate leading-tight">{g.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{g.members_count || 1} thành viên</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Section B: Direct Messages (Bạn bè) */}
                <div className="space-y-1 pt-2 border-t border-border/40">
                  <p className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Tin nhắn trực tiếp
                  </p>
                  {friends.length === 0 ? (
                    <p className="px-2 text-xs text-muted-foreground italic py-1">Chưa có bạn bè nào</p>
                  ) : (
                    friends.slice(0, 8).map((friend) => {
                      const isSelected = selectedChatType === 'direct' && selectedDirectFriend?.id === friend.id;
                      return (
                        <button
                          key={friend.id}
                          onClick={() => handleSelectDirectFriend(friend)}
                          className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all ${
                            isSelected
                              ? 'bg-primary/15 text-primary font-semibold'
                              : 'hover:bg-muted/60 text-foreground'
                          }`}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            {friend.avatar_url && <AvatarImage src={friend.avatar_url} />}
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                              {initials(getDisplayName(friend))}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{getDisplayName(friend)}</p>
                            <p className="text-[10px] text-muted-foreground truncate">@{friend.username}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Live Interactive Chat Stream */}
            <div className="md:col-span-2 flex flex-col h-full bg-background">
              {selectedChatId ? (
                <>
                  {/* Chat Top Bar */}
                  <div className="p-3 px-4 border-b border-border/60 flex items-center justify-between bg-card/60">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {selectedChatType === 'group' ? '#' : '@'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate">
                          {activeGroup?.name || 'Phòng thảo luận trực tiếp'}
                        </h4>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {activeGroup?.description || 'Kênh trao đổi bài tập và giải đề'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                    {loadingChatMessages ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-2 text-muted-foreground p-6">
                        <MessageCircle className="h-10 w-10 text-muted-foreground/30" />
                        <p className="text-xs font-medium text-foreground">Chưa có tin nhắn nào trong phòng này</p>
                        <p className="text-[11px]">Hãy gửi lời chào đầu tiên để bắt đầu buổi thảo luận!</p>
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isMe = msg.sender_id === user?.id;
                        const senderName = isMe ? 'Bạn' : getDisplayName(msg.sender, 'Bạn học');
                        return (
                          <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {!isMe && (
                              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                                {msg.sender?.avatar_url && <AvatarImage src={msg.sender.avatar_url} />}
                                <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
                                  {initials(senderName)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className="max-w-[75%] space-y-1">
                              {!isMe && (
                                <p className="text-[10px] font-semibold text-muted-foreground px-1">{senderName}</p>
                              )}
                              <div
                                className={`p-2.5 px-3 rounded-2xl text-xs leading-relaxed ${
                                  isMe
                                    ? 'bg-primary text-primary-foreground rounded-tr-xs'
                                    : 'bg-muted/70 text-foreground border border-border/40 rounded-tl-xs'
                                }`}
                              >
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              </div>
                              <p className={`text-[9px] text-muted-foreground px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                                {formatRelativeTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatMessagesEndRef} />
                  </div>

                  {/* Message Input Box */}
                  <form onSubmit={handleSendChatMessage} className="p-3 border-t border-border/60 flex items-center gap-2 bg-card">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Nhập tin nhắn trao đổi trong phòng..."
                      className="flex-1 text-xs h-9 bg-muted/40 rounded-xl"
                    />
                    <Button type="submit" disabled={!chatInput.trim() || sendingChatMessage} size="sm" className="h-9 px-3 rounded-xl gap-1">
                      {sendingChatMessage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 p-8">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
                    💬
                  </div>
                  <h4 className="font-bold text-base text-foreground">Chọn hoặc tạo phòng chat</h4>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Chọn một nhóm học tập bên trái để mở phòng trò chuyện trực tiếp, hoặc nhấn Tạo phòng để lập nhóm mới.
                  </p>
                  <Button onClick={() => setShowCreateChatRoom(true)} size="sm" className="gap-1.5 rounded-xl">
                    <Plus className="h-4 w-4" /> Tạo phòng chat mới
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. TAB: FRIENDS & STUDY MATES                             */}
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
      {/* 6. TAB: DOCUMENTS (WITH REAL DOWNLOAD FLOW)               */}
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
              {documents.map((doc) => {
                const isDownloading = downloadingDocId === doc.id;
                return (
                  <Card key={doc.id} className="border-border/60 p-4 bg-card/80 flex items-center justify-between hover:border-primary/40 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-xs text-foreground truncate" title={doc.file_name}>
                          {doc.file_name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{formatRelativeTime(doc.created_at)}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadDocument(doc)}
                      disabled={isDownloading}
                      className="h-8 px-2.5 rounded-xl shrink-0 gap-1 text-xs"
                      title="Tải tệp tài liệu xuống máy tính"
                    >
                      {isDownloading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5" /> Tải
                        </>
                      )}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. TAB: IMAGES (WITH LIGHTBOX VIEWER)                     */}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              {images.map((img) => (
                <CommunityImageCard
                  key={img.id}
                  attachment={img}
                  resolvedUrl={imageUrlsMap[img.id]}
                  onOpenLightbox={(url) => setLightboxImage(url)}
                />
              ))}
            </div>
          )}
        </div>
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
              <Input
                id="commName"
                value={commName}
                onChange={(e) => setCommName(e.target.value)}
                placeholder="VD: Ôn thi Đại học môn Toán, IELTS Speaking Club..."
                required
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="commDesc">Mô tả *</Label>
              <Textarea
                id="commDesc"
                value={commDescription}
                onChange={(e) => setCommDescription(e.target.value)}
                placeholder="Cộng đồng này dành cho ai và có những hoạt động gì?"
                required
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Biểu tượng (Icon)</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setCommIcon(emoji)}
                    className={`h-10 w-10 rounded-xl text-xl transition-all ${
                      commIcon === emoji ? 'bg-primary/20 ring-2 ring-primary' : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateCommunity(false)}>
                Hủy
              </Button>
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
              <Input
                id="postTitle"
                value={forumPostTitle}
                onChange={(e) => setForumPostTitle(e.target.value)}
                placeholder="Tóm tắt nội dung câu hỏi hoặc bài chia sẻ..."
                required
              />
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
              <Textarea
                id="postContent"
                value={forumPostContent}
                onChange={(e) => setForumPostContent(e.target.value)}
                placeholder="Viết nội dung thảo luận..."
                rows={5}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anonCheck"
                checked={forumPostAnonymous}
                onChange={(e) => setForumPostAnonymous(e.target.checked)}
                className="rounded border-input text-primary"
              />
              <Label htmlFor="anonCheck" className="text-xs text-muted-foreground cursor-pointer">
                Đăng ẩn danh (không hiển thị tên cá nhân của bạn)
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateForumPost(false)}>
                Hủy
              </Button>
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
              <Input
                id="grpName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="VD: Nhóm Luyện Đề Lý 12, Team Học IELTS 8.0..."
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grpSubject">Môn học / Lĩnh vực</Label>
              <Input
                id="grpSubject"
                value={groupSubject}
                onChange={(e) => setGroupSubject(e.target.value)}
                placeholder="Toán, Vật lý, Tiếng Anh, Tin học..."
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grpDesc">Mục tiêu & Quy chế nhóm</Label>
              <Textarea
                id="grpDesc"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Kế hoạch ôn thi, lịch họp nhóm..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateGroup(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={creatingGroup || !groupName.trim()}>
                {creatingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tạo nhóm'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* DIALOG 4: CREATE CHAT ROOM                                */}
      {/* ========================================================= */}
      <Dialog open={showCreateChatRoom} onOpenChange={setShowCreateChatRoom}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Tạo Phòng chat mới</DialogTitle>
            <DialogDescription>Mở phòng trò chuyện nhóm cho lớp học, đề thi hoặc câu lạc bộ.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateChatRoom} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="chatRoomName">Tên phòng chat *</Label>
              <Input
                id="chatRoomName"
                value={chatRoomName}
                onChange={(e) => setChatRoomName(e.target.value)}
                placeholder="VD: Phòng Học Toán 11, Luyện Speaking Nhóm 3..."
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chatRoomSubject">Môn học / Chủ đề</Label>
              <Input
                id="chatRoomSubject"
                value={chatRoomSubject}
                onChange={(e) => setChatRoomSubject(e.target.value)}
                placeholder="Toán, Tiếng Anh, Lập trình..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chatRoomDesc">Mô tả phòng</Label>
              <Input
                id="chatRoomDesc"
                value={chatRoomDesc}
                onChange={(e) => setChatRoomDesc(e.target.value)}
                placeholder="Mô tả mục đích trao đổi..."
              />
            </div>

            {/* Invite Friends section */}
            {friends.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-semibold text-muted-foreground">Mời bạn bè vào phòng (Tùy chọn):</Label>
                <div className="max-h-32 overflow-y-auto space-y-1 p-2 rounded-xl bg-muted/40 border border-border/40 scrollbar-thin">
                  {friends.map((fr) => {
                    const isSelected = selectedFriendIds.includes(fr.id);
                    return (
                      <label
                        key={fr.id}
                        className="flex items-center justify-between p-1.5 rounded-lg hover:bg-background/80 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Avatar className="h-6 w-6">
                            {fr.avatar_url && <AvatarImage src={fr.avatar_url} />}
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                              {initials(getDisplayName(fr))}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium truncate">{getDisplayName(fr)}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFriendIds([...selectedFriendIds, fr.id]);
                            } else {
                              setSelectedFriendIds(selectedFriendIds.filter((id) => id !== fr.id));
                            }
                          }}
                          className="rounded text-primary"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateChatRoom(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={creatingChatRoom || !chatRoomName.trim()} className="bg-primary text-primary-foreground">
                {creatingChatRoom ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tạo phòng'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* DIALOG 5: EDIT FORUM POST                                 */}
      {/* ========================================================= */}
      <Dialog open={Boolean(editingForumPost)} onOpenChange={(open) => !open && setEditingForumPost(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa bài thảo luận</DialogTitle>
            <DialogDescription>
              Cập nhật tiêu đề hoặc nội dung bài viết của bạn.
              {editingForumPost?.is_anonymous && ' Bài viết sẽ tiếp tục được giữ ẩn danh.'}
            </DialogDescription>
          </DialogHeader>
          {editingForumPost && (
            <form onSubmit={handleSaveEditForumPost} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="editPostTitle">Tiêu đề bài viết *</Label>
                <Input
                  id="editPostTitle"
                  value={editForumTitle}
                  onChange={(e) => setEditForumTitle(e.target.value)}
                  placeholder="Nhập tiêu đề bài thảo luận..."
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editPostCat">Chuyên mục</Label>
                <select
                  id="editPostCat"
                  value={editForumCategoryId}
                  onChange={(e) => setEditForumCategoryId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {forumCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editPostContent">Nội dung bài viết *</Label>
                <Textarea
                  id="editPostContent"
                  value={editForumContent}
                  onChange={(e) => setEditForumContent(e.target.value)}
                  placeholder="Nhập nội dung chia sẻ hoặc câu hỏi của bạn..."
                  rows={6}
                  required
                />
              </div>

              {editingForumPost.is_anonymous && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/40 text-xs text-muted-foreground">
                  <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>Bài viết này được đăng dưới chế độ <strong>Ẩn danh</strong>. Danh tính của bạn sẽ không bị tiết lộ.</span>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingForumPost(null)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={savingEditForum || !editForumTitle.trim() || !editForumContent.trim()}>
                  {savingEditForum ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu thay đổi'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* DIALOG 6: DELETE FORUM POST CONFIRMATION                  */}
      {/* ========================================================= */}
      <Dialog open={Boolean(deletingForumPost)} onOpenChange={(open) => !open && setDeletingForumPost(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa bài thảo luận?</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa bài viết &ldquo;{deletingForumPost?.title}&rdquo; không? Hành động này không thể hoàn tác và tất cả bình luận liên quan sẽ bị xóa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingForumPost(null)} disabled={deletingForumLoading}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteForumPost} disabled={deletingForumLoading}>
              {deletingForumLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Xóa bài viết'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox View for Media Gallery */}
      {lightboxImage && (
        <ImageLightbox src={lightboxImage} alt="Community Image Preview" onClose={() => setLightboxImage(null)} />
      )}
    </div>
  );
}

/**
 * Dedicated component to asynchronously load, render, and handle lightbox on community images.
 */
function CommunityImageCard({
  attachment,
  resolvedUrl,
  onOpenLightbox,
}: {
  attachment: CommunityPostAttachment;
  resolvedUrl?: string;
  onOpenLightbox: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(resolvedUrl || null);
  const [loading, setLoading] = useState(!resolvedUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (resolvedUrl) {
      setUrl(resolvedUrl);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setHasError(false);

    resolveAttachmentUrl(attachment.file_path)
      .then((res) => {
        if (!isCancelled) {
          if (res) {
            setUrl(res);
          } else {
            setHasError(true);
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setHasError(true);
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [attachment.file_path, resolvedUrl]);

  if (loading) {
    return (
      <div className="relative rounded-2xl overflow-hidden aspect-video border border-border/60 bg-muted/40 animate-shimmer flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  if (hasError || !url) {
    return (
      <div className="relative rounded-2xl overflow-hidden aspect-video border border-dashed border-border/60 bg-muted/30 p-3 flex flex-col items-center justify-center text-center space-y-1.5">
        <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
        <p className="text-[11px] text-muted-foreground truncate max-w-full font-medium px-2" title={attachment.file_name}>
          {attachment.file_name}
        </p>
        <span className="text-[10px] text-muted-foreground/60">Không thể tải ảnh</span>
      </div>
    );
  }

  return (
    <div
      onClick={() => onOpenLightbox(url)}
      className="relative rounded-2xl overflow-hidden aspect-video border border-border/60 bg-muted/40 cursor-pointer group hover:border-primary/50 hover:shadow-md transition-all"
      title={`Xem ảnh: ${attachment.file_name}`}
    >
      <img
        src={url}
        alt={attachment.file_name}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        onError={() => setHasError(true)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
        <p className="text-[11px] text-white truncate font-medium">{attachment.file_name}</p>
      </div>
    </div>
  );
}
