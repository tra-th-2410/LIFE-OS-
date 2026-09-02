'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft, Loader2, MessageSquare, Heart, HandHeart, Lightbulb, Sparkles, Bookmark,
  Flag, Share2, Trash2, Pencil, Send, EyeOff, Paperclip, Download, X, MoreVertical,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { ForumPost, ForumComment, ForumCategory, Profile, ForumReactionType, ForumPostAttachment, ForumPostReaction } from '@/lib/types';
import { formatRelativeTime, initials } from '@/lib/helpers';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/components/language-provider';

const REACTIONS: { type: ForumReactionType; icon: typeof Heart; label: string; color: string }[] = [
  { type: 'helpful', icon: Heart, label: 'Helpful', color: 'text-rose-500' },
  { type: 'understand', icon: HandHeart, label: 'I understand', color: 'text-amber-500' },
  { type: 'interesting', icon: Lightbulb, label: 'Interesting', color: 'text-yellow-500' },
  { type: 'well_done', icon: Sparkles, label: 'Well done', color: 'text-green-500' },
];

const EMOJI_REACTION_TYPES = ['❤️', '👍', '😂', '😮', '😢', '😡', '🎉', '🔥'] as const;
type EmojiReactionType = typeof EMOJI_REACTION_TYPES[number];

const REPORT_REASONS = ['Bullying', 'Harassment', 'Hate speech', 'Personal information exposed', 'Spam', 'Scam', 'Inappropriate content', 'Dangerous content', 'Other'];
const MAX_DEPTH = 3;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ForumPostPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const postId = params.id as string;

  const [post, setPost] = useState<(ForumPost & { author?: Profile | null; category?: ForumCategory | null; attachments?: ForumPostAttachment[] }) | null>(null);
  const [comments, setComments] = useState<(ForumComment & { author?: Profile | null; reactions?: ForumReactionRecord[] })[]>([]);
  const [emojiReactions, setEmojiReactions] = useState<ForumPostReaction[]>([]);
  const [userEmojiReactions, setUserEmojiReactions] = useState<string[]>([]);
  const [showEmojiReactionPicker, setShowEmojiReactionPicker] = useState(false);
  const [imageLightbox, setImageLightbox] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [userReactions, setUserReactions] = useState<string[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [showDeletePostModal, setShowDeletePostModal] = useState(false);
  const [deletingPostLoading, setDeletingPostLoading] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  type ForumReactionRecord = { id: string; reaction_type: ForumReactionType; user_id: string };

  const loadPost = useCallback(async () => {
    const { data } = await supabase
      .from('forum_posts')
      .select('*, author:profiles!forum_posts_author_id_fkey(username, avatar_url, id), category:forum_categories!forum_posts_category_id_fkey(*)')
      .eq('id', postId)
      .maybeSingle();
    const postData = data as (ForumPost & { author?: Profile | null; category?: ForumCategory | null }) | null;
    if (postData) {
      const { data: atts } = await supabase
        .from('forum_post_attachments')
        .select('*')
        .eq('post_id', postId);
      setPost({ ...postData, attachments: (atts as ForumPostAttachment[]) ?? [] });
    } else {
      setPost(null);
    }
    setLoading(false);
  }, [postId]);

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from('forum_comments')
      .select('*, author:profiles!forum_comments_author_id_fkey(username, avatar_url, id)')
      .eq('post_id', postId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true });
    setComments((data as (ForumComment & { author?: Profile | null })[]) ?? []);
  }, [postId]);

  const loadUserInteractions = useCallback(async () => {
    if (!user) return;
    const [reactions, bookmark, emojiReacts] = await Promise.all([
      supabase.from('forum_reactions').select('id, reaction_type').eq('post_id', postId).eq('user_id', user.id),
      supabase.from('forum_bookmarks').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle(),
      supabase.from('forum_post_reactions').select('*').eq('post_id', postId),
    ]);
    setUserReactions((reactions.data as { id: string; reaction_type: ForumReactionType }[])?.map((r) => r.reaction_type) ?? []);
    setIsBookmarked(!!bookmark.data);
    const allEmoji = (emojiReacts.data as ForumPostReaction[]) ?? [];
    setEmojiReactions(allEmoji);
    setUserEmojiReactions(allEmoji.filter((r) => r.user_id === user.id).map((r) => r.reaction_type));
  }, [postId, user]);

  useEffect(() => {
    loadPost();
    loadComments();
    loadUserInteractions();
  }, [loadPost, loadComments, loadUserInteractions]);

  const handleReaction = async (type: ForumReactionType) => {
    if (!user) return;
    if (userReactions.includes(type)) {
      await supabase.from('forum_reactions').delete().eq('post_id', postId).eq('user_id', user.id).eq('reaction_type', type);
      setUserReactions(userReactions.filter((r) => r !== type));
      setPost((p) => p ? { ...p, reactions_count: Math.max(p.reactions_count - 1, 0) } : p);
    } else {
      await supabase.from('forum_reactions').insert({ post_id: postId, user_id: user.id, reaction_type: type });
      setUserReactions([...userReactions, type]);
      setPost((p) => p ? { ...p, reactions_count: p.reactions_count + 1 } : p);
    }
  };

  const handleEmojiReaction = async (type: EmojiReactionType) => {
    if (!user) return;
    if (userEmojiReactions.includes(type)) {
      const existing = emojiReactions.find((r) => r.user_id === user.id && r.reaction_type === type);
      if (!existing) return;
      const { error } = await supabase.from('forum_post_reactions').delete().eq('id', existing.id);
      if (error) { toast.error('Failed to remove reaction'); return; }
      setEmojiReactions(emojiReactions.filter((r) => r.id !== existing.id));
      setUserEmojiReactions(userEmojiReactions.filter((r) => r !== type));
    } else {
      const { data, error } = await supabase.from('forum_post_reactions').insert({ post_id: postId, user_id: user.id, reaction_type: type }).select('*').single();
      if (error) { toast.error('Failed to react'); return; }
      setEmojiReactions([...emojiReactions, data as ForumPostReaction]);
      setUserEmojiReactions([...userEmojiReactions, type]);
    }
  };

  const handleDownload = async (attachment: ForumPostAttachment) => {
    try {
      const { data, error } = await supabase.storage.from('community-files').createSignedUrl(attachment.file_path, 3600);
      if (error || !data) { toast.error('Failed to get download link'); return; }
      window.open(data.signedUrl, '_blank');
    } catch { toast.error('Failed to download file'); }
  };

  const handleImageClick = async (attachment: ForumPostAttachment) => {
    try {
      const { data, error } = await supabase.storage.from('community-files').createSignedUrl(attachment.file_path, 3600);
      if (error || !data) { toast.error('Failed to load image'); return; }
      setImageLightbox(data.signedUrl);
    } catch { toast.error('Failed to load image'); }
  };

  const handleBookmark = async () => {
    if (!user) return;
    if (isBookmarked) {
      await supabase.from('forum_bookmarks').delete().eq('post_id', postId).eq('user_id', user.id);
      setIsBookmarked(false);
      toast.success(t('Bookmark removed'));
    } else {
      await supabase.from('forum_bookmarks').insert({ post_id: postId, user_id: user.id });
      setIsBookmarked(true);
      toast.success(t('Bookmarked'));
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  const handleReport = async () => {
    if (!user || !reportReason) return;
    setSubmittingReport(true);
    try {
      const { error } = await supabase.from('forum_reports').insert({
        reporter_id: user.id,
        target_type: 'post',
        target_id: postId,
        reason: reportReason,
        description: reportDesc || null,
        status: 'pending',
      });
      if (error) throw error;
      toast.success(t('Report submitted. Thank you.'));
      setShowReportModal(false);
      setReportReason('');
      setReportDesc('');
    } catch {
      toast.error(t('Failed to submit report'));
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const { data, error } = await supabase.from('forum_comments').insert({
        post_id: postId,
        author_id: user.id,
        content: commentText.trim(),
        is_anonymous: post?.is_anonymous ?? false,
        depth: 0,
      }).select('id').single();
      if (error) throw error;
      setCommentText('');
      await loadComments();
      await loadPost();
    } catch {
      toast.error(t('Failed to post comment'));
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReply = async (parentId: string, parentDepth: number) => {
    if (!user || !replyText.trim()) return;
    if (parentDepth >= MAX_DEPTH) {
      toast.error(t('Reply depth limit reached'));
      return;
    }
    setSubmittingReply(true);
    try {
      const { error } = await supabase.from('forum_comments').insert({
        post_id: postId,
        author_id: user.id,
        parent_id: parentId,
        content: replyText.trim(),
        is_anonymous: post?.is_anonymous ?? false,
        depth: parentDepth + 1,
      });
      if (error) throw error;
      setReplyText('');
      setReplyTo(null);
      await loadComments();
      await loadPost();
    } catch {
      toast.error(t('Failed to post reply'));
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleEditPost = async () => {
    if (!user || !post) return;
    setSubmittingEdit(true);
    try {
      const { error } = await supabase.from('forum_posts').update({
        title: editTitle.trim(),
        content: editContent.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', postId);
      if (error) throw error;
      setEditing(false);
      await loadPost();
      toast.success(t('Post updated'));
    } catch {
      toast.error(t('Failed to update post'));
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleConfirmDeletePost = async () => {
    if (!user || !post) return;
    setDeletingPostLoading(true);
    try {
      const { error } = await supabase.from('forum_posts').delete().eq('id', postId).eq('author_id', user.id);
      if (error) throw error;
      toast.success(t('Post deleted'));
      router.push('/app/forum');
    } catch (err: any) {
      console.error(err);
      toast.error(t('Failed to delete post'));
      setDeletingPostLoading(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('forum_comments').update({
        content: editCommentText.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', commentId);
      if (error) throw error;
      setEditingComment(null);
      await loadComments();
      toast.success(t('Comment updated'));
    } catch {
      toast.error(t('Failed to update comment'));
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    if (!confirm(t('Delete this comment?'))) return;
    try {
      const { error } = await supabase.from('forum_comments').delete().eq('id', commentId);
      if (error) throw error;
      await loadComments();
      await loadPost();
      toast.success(t('Comment deleted'));
    } catch {
      toast.error(t('Failed to delete comment'));
    }
  };

  const handleReportComment = async (commentId: string) => {
    if (!user) return;
    const reason = prompt(t('Report reason (e.g. Spam, Bullying, Harassment):'));
    if (!reason) return;
    try {
      const { error } = await supabase.from('forum_reports').insert({
        reporter_id: user.id,
        target_type: 'comment',
        target_id: commentId,
        reason,
        status: 'pending',
      });
      if (error) throw error;
      toast.success(t('Comment reported'));
    } catch {
      toast.error(t('Failed to report comment'));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-lg font-medium">Post not found</p>
        <Link href="/app/forum" className="mt-4 inline-block"><Button variant="outline">Back to Forum</Button></Link>
      </div>
    );
  }

  const isOwner = Boolean(user && (user.id === post.author_id || user.id === post.author?.id));
  const displayName = post.is_anonymous ? t('Anonymous Student') : (post.author?.username ?? t('Unknown'));
  const avatarInit = post.is_anonymous ? 'A' : initials(post.author?.username ?? 'U');

  // Build comment tree
  type CommentTreeNode = ForumComment & { author?: Profile | null; children: CommentTreeNode[] };
  const commentMap = new Map<string, CommentTreeNode>();
  const rootComments: CommentTreeNode[] = [];
  comments.forEach((c) => {
    const node: CommentTreeNode = { ...c, children: [] };
    commentMap.set(c.id, node);
  });
  comments.forEach((c) => {
    const node = commentMap.get(c.id)!;
    if (c.parent_id) {
      const parent = commentMap.get(c.parent_id);
      if (parent) parent.children.push(node);
      else rootComments.push(node);
    } else {
      rootComments.push(node);
    }
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href={post.category ? `/app/forum/${post.category.slug}` : '/app/forum'} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> {t('Back to')} {post.category ? post.category.name : t('Forum')}
      </Link>

      {/* Post */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{avatarInit}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{displayName}</span>
                <span className="text-xs text-muted-foreground">{formatRelativeTime(post.created_at)}</span>
                {post.is_anonymous && <Badge variant="outline" className="text-xs gap-1"><EyeOff className="h-3 w-3" /> Anonymous</Badge>}
                {post.category && <Link href={`/app/forum/${post.category.slug}`}><Badge variant="secondary" className="text-xs">{post.category.icon} {post.category.name}</Badge></Link>}
              </div>
            </div>
            {isOwner && !editing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditTitle(post.title);
                      setEditContent(post.content);
                      setEditing(true);
                    }}
                    className="gap-2 cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>{t('Edit')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeletePostModal(true)}
                    className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t('Delete')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-lg font-semibold" />
              <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={8} />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" onClick={handleEditPost} disabled={submittingEdit}>{submittingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}</Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-display font-bold mb-2">{post.title}</h1>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{post.content}</p>
              {post.image_url && <img src={post.image_url} alt="" className="mt-4 rounded-lg max-h-96 w-auto" />}
              {(() => {
                const atts = post.attachments ?? [];
                const imageAtts = atts.filter((a) => a.is_image);
                const fileAtts = atts.filter((a) => !a.is_image);
                return (
                  <>
                    {imageAtts.length > 0 && (
                      <div className={`mt-4 gap-2 ${imageAtts.length === 1 ? 'flex' : 'grid grid-cols-2'}`}>
                        {imageAtts.map((att) => (
                          <button key={att.id} onClick={() => handleImageClick(att)} className="rounded-lg overflow-hidden border border-border/60 hover:opacity-90 transition-opacity">
                            <AsyncForumImage attachment={att} />
                          </button>
                        ))}
                      </div>
                    )}
                    {fileAtts.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {fileAtts.map((att) => (
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
                  </>
                );
              })()}
              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">{post.tags.map((t) => <Badge key={t} variant="outline" className="text-xs">#{t}</Badge>)}</div>
              )}
            </>
          )}

          {!editing && (
            <>
              {/* Reactions */}
              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border/40">
                {REACTIONS.map((r) => {
                  const active = userReactions.includes(r.type);
                  return (
                    <button
                      key={r.type}
                      onClick={() => handleReaction(r.type)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        active ? `${r.color} bg-current/10` : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                      style={active ? { color: 'inherit' } : {}}
                    >
                      <r.icon className={`h-3.5 w-3.5 ${active ? r.color : ''}`} />
                      {t(r.label)}
                    </button>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3">
                <Button variant="ghost" size="sm" onClick={handleBookmark} className={`gap-1.5 ${isBookmarked ? 'text-primary' : ''}`}>
                  <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-current' : ''}`} /> {isBookmarked ? 'Saved' : 'Save'}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1.5"><Share2 className="h-3.5 w-3.5" /> Share</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowReportModal(true)} className="gap-1.5 text-muted-foreground"><Flag className="h-3.5 w-3.5" /> Report</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Comments */}
      <div className="space-y-4">
        <h2 className="text-lg font-display font-bold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> {post.comments_count} {post.comments_count === 1 ? t('Comment') : t('Comments')}
        </h2>

        {/* Comment form */}
        <form onSubmit={handleComment} className="flex gap-2">
          <Textarea placeholder="Write a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={2} className="flex-1" />
          <Button type="submit" size="icon" disabled={submittingComment || !commentText.trim()} className="self-end">
            {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>

        {/* Comment tree */}
        {rootComments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t('No comments yet. Be the first to share your thoughts.')}</p>
        ) : (
          <div className="space-y-3">
            {rootComments.map((c) => (
              <CommentNode
                key={c.id}
                comment={c}
                currentUserId={user?.id ?? null}
                isPostAnonymous={post.is_anonymous}
                replyTo={replyTo}
                setReplyTo={setReplyTo}
                replyText={replyText}
                setReplyText={setReplyText}
                onSubmitReply={handleReply}
                submittingReply={submittingReply}
                editingComment={editingComment}
                setEditingComment={setEditingComment}
                editCommentText={editCommentText}
                setEditCommentText={setEditCommentText}
                onEditComment={handleEditComment}
                onDeleteComment={handleDeleteComment}
                onReportComment={handleReportComment}
              />
            ))}
          </div>
        )}
      </div>

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

      {/* Report modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowReportModal(false)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-display font-bold text-lg">Report this post</h3>
              <div className="space-y-2">
                <Label>Reason</Label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a reason</option>
                  {REPORT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Additional details (optional)</Label>
                <Textarea value={reportDesc} onChange={(e) => setReportDesc(e.target.value)} rows={3} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowReportModal(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleReport} disabled={submittingReport || !reportReason}>
                  {submittingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Report'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeletePostModal} onOpenChange={setShowDeletePostModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Delete Post')}</DialogTitle>
            <DialogDescription>
              {t('Are you sure you want to delete this post? This action cannot be undone.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeletePostModal(false)} disabled={deletingPostLoading}>
              {t('Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeletePost} disabled={deletingPostLoading}>
              {deletingPostLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AsyncForumImage({ attachment }: { attachment: ForumPostAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage.from('community-files').createSignedUrl(attachment.file_path, 3600);
      if (!cancelled && !error && data) setUrl(data.signedUrl);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [attachment.file_path]);

  if (loading) return <div className="h-48 w-full bg-muted animate-shimmer" />;
  if (!url) return <div className="h-48 w-full bg-muted/50 flex items-center justify-center text-sm text-muted-foreground">Failed to load</div>;
  return <img src={url} alt={attachment.file_name} className="max-h-80 w-full object-contain" />;
}

function CommentNode({
  comment,
  currentUserId,
  isPostAnonymous,
  replyTo,
  setReplyTo,
  replyText,
  setReplyText,
  onSubmitReply,
  submittingReply,
  editingComment,
  setEditingComment,
  editCommentText,
  setEditCommentText,
  onEditComment,
  onDeleteComment,
  onReportComment,
}: {
  comment: ForumComment & { author?: Profile | null; children: (ForumComment & { author?: Profile | null; children: unknown[] })[] };
  currentUserId: string | null;
  isPostAnonymous: boolean;
  replyTo: string | null;
  setReplyTo: (id: string | null) => void;
  replyText: string;
  setReplyText: (s: string) => void;
  onSubmitReply: (parentId: string, depth: number) => void;
  submittingReply: boolean;
  editingComment: string | null;
  setEditingComment: (id: string | null) => void;
  editCommentText: string;
  setEditCommentText: (s: string) => void;
  onEditComment: (id: string) => void;
  onDeleteComment: (id: string) => void;
  onReportComment: (id: string) => void;
}) {
  const { t } = useLanguage();
  const isOwner = currentUserId === comment.author_id;
  const displayName = (comment.is_anonymous || isPostAnonymous) ? t('Anonymous Student') : (comment.author?.username ?? t('Unknown'));
  const avatarInit = (comment.is_anonymous || isPostAnonymous) ? 'A' : initials(comment.author?.username ?? 'U');
  const indentClass = comment.depth === 0 ? '' : comment.depth === 1 ? 'ml-4' : comment.depth === 2 ? 'ml-8' : 'ml-12';

  return (
    <div className="space-y-2">
      <div className={`rounded-lg border border-border/60 p-4 ${indentClass}`}>
        <div className="flex items-start gap-2.5">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{avatarInit}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{displayName}</span>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(comment.created_at)}</span>
            </div>

            {editingComment === comment.id ? (
              <div className="mt-2 space-y-2">
                <Textarea value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} rows={2} />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingComment(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => onEditComment(comment.id)}>Save</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
            )}

            <div className="flex items-center gap-3 mt-2">
              {comment.depth < MAX_DEPTH && (
                <button onClick={() => { setReplyTo(replyTo === comment.id ? null : comment.id); setReplyText(''); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Reply
                </button>
              )}
              {isOwner && editingComment !== comment.id && (
                <>
                  <button onClick={() => { setEditingComment(comment.id); setEditCommentText(comment.content); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Edit</button>
                  <button onClick={() => onDeleteComment(comment.id)} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Delete</button>
                </>
              )}
              {!isOwner && (
                <button onClick={() => onReportComment(comment.id)} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Report</button>
              )}
            </div>

            {replyTo === comment.id && (
              <div className="mt-3 flex gap-2">
                <Textarea placeholder="Write a reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} className="flex-1" />
                <Button size="icon" onClick={() => onSubmitReply(comment.id, comment.depth)} disabled={submittingReply || !replyText.trim()} className="self-end">
                  {submittingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {comment.children.length > 0 && (
        <div className={`ml-4 space-y-2`}>
          {comment.children.map((child) => (
            <CommentNode
              key={child.id}
              comment={child as unknown as ForumComment & { author?: Profile | null; children: (ForumComment & { author?: Profile | null; children: unknown[] })[] }}
              currentUserId={currentUserId}
              isPostAnonymous={isPostAnonymous}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              replyText={replyText}
              setReplyText={setReplyText}
              onSubmitReply={onSubmitReply}
              submittingReply={submittingReply}
              editingComment={editingComment}
              setEditingComment={setEditingComment}
              editCommentText={editCommentText}
              setEditCommentText={setEditCommentText}
              onEditComment={onEditComment}
              onDeleteComment={onDeleteComment}
              onReportComment={onReportComment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
