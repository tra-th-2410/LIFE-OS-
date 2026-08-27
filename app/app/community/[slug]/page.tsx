'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Users, Plus, Search, MessageSquare, Heart, Flag,
  Eye, Lock, Send, Loader2, ChevronDown, ChevronUp, MoreVertical, Pencil, Trash2,
  Smile, Paperclip, Image as ImageIcon, X, Download,
} from 'lucide-react';
import { formatRelativeTime, initials } from '@/lib/helpers';
import type { Community, Post, Comment, Profile, CommunityPostAttachment, CommunityPostReaction, ReactionType } from '@/lib/types';
import { toast } from 'sonner';

type SortMode = 'new' | 'popular' | 'recent';

const REACTION_TYPES: ReactionType[] = ['❤️', '👍', '😂', '😮', '😢', '😡', '🎉', '🔥'];
const EMOJI_PICKER_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
  '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
  '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😪', '😴', '🤤',
  '😢', '😭', '😤', '😡', '😠', '🤬', '🥺', '😱', '😨', '😰',
  '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
  '👏', '🙌', '🎉', '🔥', '💯', '✨', '⭐', '🌟', '💫', '⚡',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❤️‍🔥',
  '📚', '✏️', '📝', '💻', '🎨', '🎵', '⚽', '🏀', '🏆', '🎮',
];

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CommunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user, profile } = useAuth();

  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<(Post & { author?: Profile | null; attachments?: CommunityPostAttachment[]; reactions?: CommunityPostReaction[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('new');
  const [showCreate, setShowCreate] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [creatingPost, setCreatingPost] = useState(false);
  const [showEditCommunity, setShowEditCommunity] = useState(false);
  const [showDeleteCommunity, setShowDeleteCommunity] = useState(false);
  const [deletingCommunity, setDeletingCommunity] = useState(false);

  // Composer state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isOwner = user?.id === community?.created_by;

  const loadCommunity = useCallback(async () => {
    const { data: c } = await supabase.from('communities').select('*').eq('slug', slug).is('archived_at', null).maybeSingle();
    if (!c) {
      setLoading(false);
      return;
    }
    setCommunity(c as Community);

    if (user) {
      const { data: member } = await supabase
        .from('community_members')
        .select('user_id')
        .eq('community_id', c.id)
        .eq('user_id', user.id)
        .maybeSingle();
      setIsMember(!!member);
    }
  }, [slug, user]);

  const loadPosts = useCallback(async () => {
    if (!community) return;
    let query = supabase
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(username, avatar_url, id)')
      .eq('community_id', community.id)
      .is('deleted_at', null);

    if (sort === 'popular') query = query.order('reactions_count', { ascending: false });
    else if (sort === 'recent') query = query.order('updated_at', { ascending: false });
    else query = query.order('created_at', { ascending: false });

    const { data } = await query;
    let p = (data as (Post & { author?: Profile | null })[]) ?? [];
    if (search) {
      const q = search.toLowerCase();
      p = p.filter(
        (post) =>
          post.title?.toLowerCase().includes(q) || post.content.toLowerCase().includes(q)
      );
    }

    if (p.length === 0) {
      setPosts([]);
      return;
    }

    const postIds = p.map((post) => post.id);

    // Batch load attachments — no N+1
    const { data: atts } = await supabase
      .from('community_post_attachments')
      .select('*')
      .in('post_id', postIds);

    // Batch load reactions — no N+1
    const { data: reacts } = await supabase
      .from('community_post_reactions')
      .select('*')
      .in('post_id', postIds);

    const attMap = new Map<string, CommunityPostAttachment[]>();
    (atts as CommunityPostAttachment[] | null)?.forEach((a) => {
      const arr = attMap.get(a.post_id) ?? [];
      arr.push(a);
      attMap.set(a.post_id, arr);
    });

    const reactMap = new Map<string, CommunityPostReaction[]>();
    (reacts as CommunityPostReaction[] | null)?.forEach((r) => {
      const arr = reactMap.get(r.post_id) ?? [];
      arr.push(r);
      reactMap.set(r.post_id, arr);
    });

    setPosts(p.map((post) => ({
      ...post,
      attachments: attMap.get(post.id) ?? [],
      reactions: reactMap.get(post.id) ?? [],
    })));
  }, [community, sort, search]);

  useEffect(() => {
    loadCommunity().finally(() => setLoading(false));
  }, [loadCommunity]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleJoinLeave = async () => {
    if (!user || !community) return;
    setJoining(true);
    try {
      if (isMember) {
        const { error } = await supabase.from('community_members').delete().eq('community_id', community.id).eq('user_id', user.id);
        if (error) throw error;
        setIsMember(false);
        await supabase.from('communities').update({ members_count: Math.max(0, community.members_count - 1) }).eq('id', community.id);
        setCommunity({ ...community, members_count: Math.max(0, community.members_count - 1) });
        toast.success('Left community');
      } else {
        const { error } = await supabase.from('community_members').insert({ community_id: community.id, user_id: user.id, role: 'member' });
        if (error) throw error;
        setIsMember(true);
        await supabase.from('communities').update({ members_count: community.members_count + 1 }).eq('id', community.id);
        setCommunity({ ...community, members_count: community.members_count + 1 });
        toast.success('Joined community!');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setJoining(false);
    }
  };

  const handleFileSelect = (files: FileList | null, isImage: boolean) => {
    if (!files) return;
    const arr = Array.from(files);
    for (const file of arr) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 10MB limit`);
        continue;
      }
      const allowed = isImage ? IMAGE_TYPES : [...IMAGE_TYPES, ...DOC_TYPES];
      if (!allowed.includes(file.type)) {
        toast.error(`${file.name}: unsupported file type`);
        continue;
      }
      setPendingFiles((prev) => [...prev, file]);
      if (IMAGE_TYPES.includes(file.type)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreviews((prev) => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const insertEmoji = (emoji: string) => {
    setNewPostContent((prev) => prev + emoji);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !community || !isMember) return;
    if (!newPostContent.trim() && pendingFiles.length === 0) return;
    setCreatingPost(true);
    try {
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          community_id: community.id,
          author_id: user.id,
          title: newPostTitle || null,
          content: newPostContent,
          type: 'text',
        })
        .select('*, author:profiles!posts_author_id_fkey(username, avatar_url, id)')
        .single();
      if (postError) throw postError;
      const newPost = postData as Post & { author?: Profile | null };

      // Upload attachments
      const uploadedAttachments: CommunityPostAttachment[] = [];
      for (const file of pendingFiles) {
        const isImg = IMAGE_TYPES.includes(file.type);
        const ext = file.name.split('.').pop() || 'bin';
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('community-files')
          .upload(fileName, file);

        if (uploadError) {
          console.error('upload failed', uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: attData, error: attError } = await supabase
          .from('community_post_attachments')
          .insert({
            post_id: newPost.id,
            community_id: community.id,
            uploader_id: user.id,
            file_name: file.name,
            file_path: fileName,
            file_type: file.type,
            file_size: file.size,
            is_image: isImg,
          })
          .select('*')
          .single();

        if (attError) {
          console.error('attachment insert failed', attError);
        } else {
          uploadedAttachments.push(attData as CommunityPostAttachment);
        }
      }

      setPosts([{
        ...newPost,
        attachments: uploadedAttachments,
        reactions: [],
      }, ...posts]);
      setNewPostTitle('');
      setNewPostContent('');
      setPendingFiles([]);
      setImagePreviews([]);
      setShowEmojiPicker(false);
      setShowCreate(false);
      toast.success('Post created!');
    } catch (err) {
      console.error('create post failed', err);
      toast.error('Failed to create post');
    } finally {
      setCreatingPost(false);
    }
  };

  const handleReaction = async (postId: string, reactionType: ReactionType) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const existing = (post.reactions ?? []).find(
      (r) => r.user_id === user.id && r.reaction_type === reactionType
    );

    if (existing) {
      // Toggle off
      const { error } = await supabase
        .from('community_post_reactions')
        .delete()
        .eq('id', existing.id);
      if (error) {
        toast.error('Failed to remove reaction');
        return;
      }
      setPosts(posts.map((p) =>
        p.id === postId
          ? { ...p, reactions: (p.reactions ?? []).filter((r) => r.id !== existing.id) }
          : p
      ));
    } else {
      // Add reaction
      const { data, error } = await supabase
        .from('community_post_reactions')
        .insert({ post_id: postId, user_id: user.id, reaction_type: reactionType })
        .select('*')
        .single();
      if (error) {
        toast.error('Failed to react');
        return;
      }
      setPosts(posts.map((p) =>
        p.id === postId
          ? { ...p, reactions: [...(p.reactions ?? []), data as CommunityPostReaction] }
          : p
      ));
    }
  };

  const handleEditPost = (postId: string, newTitle: string | null, newContent: string) => {
    setPosts(posts.map((p) => (p.id === postId ? { ...p, title: newTitle, content: newContent } : p)));
  };

  const handleDeletePost = (postId: string) => {
    setPosts(posts.filter((p) => p.id !== postId));
  };

  const handleDeleteCommunity = async () => {
    if (!user || !community) return;
    setDeletingCommunity(true);
    try {
      const { error } = await supabase
        .from('communities')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', community.id)
        .eq('created_by', user.id);
      if (error) throw error;
      toast.success('Community deleted');
      router.push('/app/community');
    } catch {
      toast.error('Failed to delete community');
    } finally {
      setDeletingCommunity(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-32 rounded-2xl animate-shimmer" />
        <div className="h-64 rounded-2xl animate-shimmer" />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-lg font-medium">Community not found</p>
        <Link href="/app/community" className="mt-4 inline-block">
          <Button variant="outline">Back to Communities</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/app/community" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Communities
      </Link>

      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 text-4xl shrink-0">
              {community.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-display font-bold">{community.name}</h1>
                {community.is_anonymous && (
                  <Badge variant="outline" className="gap-1"><Eye className="h-3 w-3" /> Anonymous</Badge>
                )}
                {community.is_private && (
                  <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Private</Badge>
                )}
              </div>
              <p className="mt-2 text-muted-foreground">{community.description}</p>
              <div className="mt-3 flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" /> {community.members_count.toLocaleString()} members
                </span>
                {user && (
                  <Button
                    size="sm"
                    variant={isMember ? 'outline' : 'default'}
                    onClick={handleJoinLeave}
                    disabled={joining}
                    className="gap-1.5"
                  >
                    {joining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {isMember ? 'Leave' : 'Join Community'}
                  </Button>
                )}
                {isOwner && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Button size="sm" variant="ghost" onClick={() => setShowEditCommunity(true)} className="gap-1.5">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowDeleteCommunity(true)} className="gap-1.5 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search posts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          {(['new', 'popular', 'recent'] as SortMode[]).map((m) => (
            <Button key={m} size="sm" variant={sort === m ? 'default' : 'outline'} onClick={() => setSort(m)} className="capitalize">{m}</Button>
          ))}
        </div>
      </div>

      {isMember && (
        <div className="space-y-3">
          {!showCreate ? (
            <Button onClick={() => setShowCreate(true)} className="gap-1.5 w-full">
              <Plus className="h-4 w-4" /> Create Post
            </Button>
          ) : (
            <Card className="border-border/60">
              <CardHeader className="pb-3"><h3 className="font-semibold">Create a post</h3></CardHeader>
              <CardContent className="space-y-3">
                <form onSubmit={handleCreatePost} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="title">Title (optional)</Label>
                    <Input id="title" value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} placeholder="Post title..." />
                  </div>
                  <div className="space-y-1.5 relative">
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="What's on your mind?"
                      rows={4}
                      className="resize-none"
                    />
                    {showEmojiPicker && (
                      <div className="absolute z-20 bottom-full mb-2 left-0 right-0 sm:right-auto sm:w-80 max-h-64 overflow-y-auto rounded-lg border border-border bg-background shadow-lg p-3 grid grid-cols-8 gap-1">
                        {EMOJI_PICKER_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="flex h-9 w-9 items-center justify-center rounded hover:bg-muted transition-colors text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pending files preview */}
                  {(pendingFiles.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                      {pendingFiles.map((file, i) => {
                        const isImg = IMAGE_TYPES.includes(file.type);
                        const preview = imagePreviews[i];
                        return (
                          <div key={i} className="relative group rounded-lg border border-border/60 p-2 flex items-center gap-2 max-w-[200px]">
                            {isImg && preview ? (
                              <img src={preview} alt={file.name} className="h-12 w-12 rounded object-cover shrink-0" />
                            ) : (
                              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
                                <Paperclip className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removePendingFile(i)}
                              className="p-1 rounded hover:bg-muted transition-colors shrink-0"
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Composer toolbar */}
                  <div className="flex items-center gap-1 border-t border-border/60 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Smile className="h-4 w-4" /> Emoji
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Paperclip className="h-4 w-4" /> File
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept={DOC_TYPES.join(',') + ',' + IMAGE_TYPES.join(',')}
                      onChange={(e) => { handleFileSelect(e.target.files, false); e.target.value = ''; }}
                      multiple
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => imageInputRef.current?.click()}
                      className="gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <ImageIcon className="h-4 w-4" /> Image
                    </Button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      className="hidden"
                      accept={IMAGE_TYPES.join(',')}
                      onChange={(e) => { handleFileSelect(e.target.files, true); e.target.value = ''; }}
                      multiple
                    />
                    <Button type="submit" disabled={creatingPost || (!newPostContent.trim() && pendingFiles.length === 0)} className="ml-auto gap-1.5">
                      {creatingPost ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Post
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {posts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {isMember ? 'No posts yet. Be the first to post!' : 'No posts yet. Join to start posting.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              communityId={community.id}
              currentUserId={user?.id}
              onReact={handleReaction}
              onEdit={handleEditPost}
              onDelete={handleDeletePost}
            />
          ))}
        </div>
      )}

      {showEditCommunity && community && (
        <EditCommunityDialog community={community} onOpenChange={setShowEditCommunity} onUpdated={(updated) => setCommunity(updated)} />
      )}

      <Dialog open={showDeleteCommunity} onOpenChange={setShowDeleteCommunity}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this community?</DialogTitle>
            <DialogDescription>
              This will archive the community and hide it from public lists. Posts and members will be preserved but hidden. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={handleDeleteCommunity} disabled={deletingCommunity}>
              {deletingCommunity ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PostCard({
  post,
  communityId,
  currentUserId,
  onReact,
  onEdit,
  onDelete,
}: {
  post: Post & { author?: Profile | null; attachments?: CommunityPostAttachment[]; reactions?: CommunityPostReaction[] };
  communityId: string;
  currentUserId?: string;
  onReact: (postId: string, reactionType: ReactionType) => void;
  onEdit: (postId: string, title: string | null, content: string) => void;
  onDelete: (postId: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<(Comment & { author?: Profile | null })[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title ?? '');
  const [editContent, setEditContent] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [imageLightbox, setImageLightbox] = useState<string | null>(null);

  const isOwner = currentUserId === post.author_id;
  const reactions = post.reactions ?? [];
  const attachments = post.attachments ?? [];

  // Group reactions by type with counts
  const reactionSummary = REACTION_TYPES.map((type) => ({
    type,
    count: reactions.filter((r) => r.reaction_type === type).length,
    hasMine: reactions.some((r) => r.reaction_type === type && r.user_id === currentUserId),
  })).filter((r) => r.count > 0);

  const loadComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from('comments')
      .select('*, author:profiles!comments_author_id_fkey(username, avatar_url, id)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    setComments((data as (Comment & { author?: Profile | null })[]) ?? []);
    setLoadingComments(false);
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !newComment.trim()) return;
    setPostingComment(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: post.id, author_id: currentUserId, content: newComment })
        .select('*, author:profiles!comments_author_id_fkey(username, avatar_url, id)')
        .single();
      if (error) throw error;
      setComments([...comments, data as Comment & { author?: Profile | null }]);
      setNewComment('');
      await supabase.from('posts').update({ comments_count: post.comments_count + 1 }).eq('id', post.id);
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  const handleReport = async () => {
    if (!currentUserId) return;
    try {
      await supabase.from('reports').insert({
        reporter_id: currentUserId,
        target_type: 'post',
        target_id: post.id,
        reason: 'Reported by user',
      });
      toast.success('Report submitted. Our team will review it.');
    } catch {
      toast.error('Failed to submit report');
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ title: editTitle || null, content: editContent })
        .eq('id', post.id)
        .eq('author_id', currentUserId!);
      if (error) throw error;
      onEdit(post.id, editTitle || null, editContent);
      setShowEdit(false);
      toast.success('Post updated');
    } catch {
      toast.error('Failed to update post');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', post.id)
        .eq('author_id', currentUserId!);
      if (error) throw error;
      onDelete(post.id);
      setShowDelete(false);
      toast.success('Post deleted');
    } catch {
      toast.error('Failed to delete post');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (attachment: CommunityPostAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('community-files')
        .createSignedUrl(attachment.file_path, 3600);
      if (error || !data) {
        toast.error('Failed to get download link');
        return;
      }
      window.open(data.signedUrl, '_blank');
    } catch {
      toast.error('Failed to download file');
    }
  };

  const handleImageClick = async (attachment: CommunityPostAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('community-files')
        .createSignedUrl(attachment.file_path, 3600);
      if (error || !data) {
        toast.error('Failed to load image');
        return;
      }
      setImageLightbox(data.signedUrl);
    } catch {
      toast.error('Failed to load image');
    }
  };

  const authorName = post.is_anonymous ? 'Anonymous' : post.author?.username ?? 'Unknown';
  const authorInitials = post.is_anonymous ? 'A' : initials(authorName);
  const imageAttachments = attachments.filter((a) => a.is_image);
  const fileAttachments = attachments.filter((a) => !a.is_image);

  return (
    <Card className="border-border/60 hover:border-border transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{authorInitials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{authorName}</span>
              <span className="text-muted-foreground">· {formatRelativeTime(post.created_at)}</span>
              {isOwner && (
                <div className="ml-auto relative">
                  <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded hover:bg-muted transition-colors">
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-8 z-10 rounded-lg border border-border bg-background shadow-md py-1 w-32">
                      <button onClick={() => { setShowEdit(true); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted transition-colors">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button onClick={() => { setShowDelete(true); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-destructive hover:bg-muted transition-colors">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {post.title && <h3 className="mt-2 font-semibold text-base">{post.title}</h3>}
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{post.content}</p>

            {/* Images */}
            {imageAttachments.length > 0 && (
              <div className={`mt-3 gap-2 ${imageAttachments.length === 1 ? 'flex' : 'grid grid-cols-2'}`}>
                {imageAttachments.map((att) => (
                  <button
                    key={att.id}
                    onClick={() => handleImageClick(att)}
                    className="rounded-lg overflow-hidden border border-border/60 hover:opacity-90 transition-opacity"
                  >
                    <AsyncImage attachment={att} />
                  </button>
                ))}
              </div>
            )}

            {/* Files */}
            {fileAttachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {fileAttachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Paperclip className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{att.file_name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(att.file_size)}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(att)} className="gap-1.5 shrink-0">
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Reactions */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {reactionSummary.map(({ type, count, hasMine }) => (
                <button
                  key={type}
                  onClick={() => onReact(post.id, type)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm transition-colors border ${
                    hasMine
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-muted/50 border-transparent text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="text-base">{type}</span>
                  <span className="font-medium text-xs">{count}</span>
                </button>
              ))}

              {/* Add reaction button */}
              <div className="relative">
                <button
                  onClick={() => setShowReactionPicker(!showReactionPicker)}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-transparent"
                >
                  <Heart className="h-4 w-4" /> React
                </button>
                {showReactionPicker && (
                  <div className="absolute bottom-full mb-2 left-0 z-10 rounded-full border border-border bg-background shadow-lg p-1.5 flex gap-0.5">
                    {REACTION_TYPES.map((type) => (
                      <button
                        key={type}
                        onClick={() => { onReact(post.id, type); setShowReactionPicker(false); }}
                        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted hover:scale-125 transition-all text-lg"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => { if (!showComments) loadComments(); setShowComments(!showComments); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors ml-1"
              >
                <MessageSquare className="h-4 w-4" /> {post.comments_count}
                {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <button onClick={handleReport} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors">
                <Flag className="h-4 w-4" /> Report
              </button>
            </div>

            {showComments && (
              <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
                {loadingComments ? (
                  <p className="text-sm text-muted-foreground">Loading comments...</p>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2.5">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="bg-muted text-xs">{c.is_anonymous ? 'A' : initials(c.author?.username ?? 'U')}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium">{c.is_anonymous ? 'Anonymous' : c.author?.username ?? 'Unknown'}</span>
                          <span className="text-muted-foreground">· {formatRelativeTime(c.created_at)}</span>
                        </div>
                        <p className="mt-0.5 text-sm">{c.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {currentUserId && (
                  <form onSubmit={handleComment} className="flex gap-2">
                    <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment..." className="h-9" />
                    <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={postingComment || !newComment.trim()}>
                      {postingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Post</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Title</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Post title..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea id="edit-content" value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>This action cannot be undone. The post will be hidden but comments are preserved.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image lightbox */}
      {imageLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setImageLightbox(null)}
        >
          <img src={imageLightbox} alt="Full size" className="max-h-full max-w-full rounded-lg object-contain" />
          <button className="absolute top-4 right-4 p-2 rounded-full bg-background/20 text-white hover:bg-background/40 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </Card>
  );
}

function AsyncImage({ attachment }: { attachment: CommunityPostAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage
        .from('community-files')
        .createSignedUrl(attachment.file_path, 3600);
      if (!cancelled && !error && data) {
        setUrl(data.signedUrl);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [attachment.file_path]);

  if (loading) return <div className="h-48 w-full bg-muted animate-shimmer" />;
  if (!url) return <div className="h-48 w-full bg-muted/50 flex items-center justify-center text-sm text-muted-foreground">Failed to load</div>;
  return <img src={url} alt={attachment.file_name} className="max-h-80 w-full object-contain" />;
}

function EditCommunityDialog({
  community,
  onOpenChange,
  onUpdated,
}: {
  community: Community;
  onOpenChange: (v: boolean) => void;
  onUpdated: (c: Community) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [icon, setIcon] = useState(community.icon);
  const [saving, setSaving] = useState(false);

  const EMOJI_OPTIONS = ['💬', '📚', '🎮', '🎨', '🏆', '🌱', '💻', '🎵', '⚽', '🔬', '🌍', '✨'];

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('communities')
        .update({ name: name.trim(), description: description.trim(), icon })
        .eq('id', community.id)
        .eq('created_by', user.id)
        .select('*')
        .single();
      if (error) throw error;
      onUpdated(data as Community);
      onOpenChange(false);
      toast.success('Community updated');
    } catch {
      toast.error('Failed to update community');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Community</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">Description</Label>
            <Textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => setIcon(emoji)}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-all ${icon === emoji ? 'bg-primary/15 ring-2 ring-primary' : 'bg-muted hover:bg-muted/80'}`}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
