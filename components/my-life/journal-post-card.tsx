'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Heart,
  MessageSquare,
  Share2,
  MoreVertical,
  Edit2,
  Trash2,
  Lock,
  Globe,
  Users,
  Send,
  Loader2,
  Sparkles,
  Paperclip,
  Download,
  Check,
  Copy,
} from 'lucide-react';
import { formatRelativeTime, initials, moodEmoji, moodLabel, getDisplayName } from '@/lib/helpers';
import { ImageLightbox } from '@/components/my-life/image-lightbox';
import type {
  JournalEntryWithRelations,
  JournalPostComment,
  JournalPostReaction,
  JournalPostAttachment,
} from '@/lib/types';
import { toast } from 'sonner';

const REACTION_TYPES = ['❤️', '👍', '😂', '🎉', '🔥', '💡'];

interface JournalPostCardProps {
  post: JournalEntryWithRelations;
  onPostUpdated: (updated: JournalEntryWithRelations) => void;
  onPostDeleted: (postId: string) => void;
  onEditRequested: (post: JournalEntryWithRelations) => void;
}

export function JournalPostCard({
  post,
  onPostUpdated,
  onPostDeleted,
  onEditRequested,
}: JournalPostCardProps) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<JournalPostComment[]>(post.comments || []);
  const [reactions, setReactions] = useState<JournalPostReaction[]>(post.reactions || []);
  const [attachments, setAttachments] = useState<JournalPostAttachment[]>(post.attachments || []);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const isOwner = user?.id === post.user_id;
  const userReaction = reactions.find((r) => r.user_id === user?.id)?.reaction_type;

  // Load signed URLs for private attachments if needed
  useEffect(() => {
    if (attachments.length === 0) return;
    const fetchUrls = async () => {
      const urls: Record<string, string> = {};
      for (const att of attachments) {
        if (att.file_path) {
          const { data } = await supabase.storage
            .from('community-files')
            .createSignedUrl(att.file_path, 3600);
          if (data?.signedUrl) {
            urls[att.id] = data.signedUrl;
          }
        }
      }
      setAttachmentUrls(urls);
    };
    fetchUrls();
  }, [attachments]);

  // Load comments
  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const { data } = await supabase
        .from('journal_post_comments')
        .select('*, author:profiles!journal_post_comments_author_id_fkey(username, avatar_url, verification_status)')
        .eq('journal_id', post.id)
        .order('created_at', { ascending: true });

      setComments((data as JournalPostComment[]) ?? []);
    } catch {
      // Error fallback
    } finally {
      setLoadingComments(false);
    }
  }, [post.id]);

  useEffect(() => {
    if (showComments && comments.length === 0) {
      loadComments();
    }
  }, [showComments, loadComments, comments.length]);

  // Handle reaction toggle or change
  const handleToggleReaction = async (reactionType: string) => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để tương tác');
      return;
    }

    const existing = reactions.find((r) => r.user_id === user.id);

    if (existing?.reaction_type === reactionType) {
      // Remove reaction
      setReactions((prev) => prev.filter((r) => r.user_id !== user.id));
      try {
        await supabase
          .from('journal_post_reactions')
          .delete()
          .eq('journal_id', post.id)
          .eq('user_id', user.id);

        const newCount = Math.max(0, (post.reactions_count || 1) - 1);
        await supabase
          .from('journal_entries')
          .update({ reactions_count: newCount })
          .eq('id', post.id);

        onPostUpdated({ ...post, reactions_count: newCount });
      } catch {
        toast.error('Không thể bỏ cảm xúc');
      }
    } else {
      // Insert or update reaction
      const newReactObj: JournalPostReaction = {
        id: `temp-${Date.now()}`,
        journal_id: post.id,
        user_id: user.id,
        reaction_type: reactionType,
        created_at: new Date().toISOString(),
      };

      setReactions((prev) => [
        ...prev.filter((r) => r.user_id !== user.id),
        newReactObj,
      ]);

      try {
        await supabase.from('journal_post_reactions').upsert(
          {
            journal_id: post.id,
            user_id: user.id,
            reaction_type: reactionType,
          },
          { onConflict: 'journal_id,user_id' }
        );

        if (!existing) {
          const newCount = (post.reactions_count || 0) + 1;
          await supabase
            .from('journal_entries')
            .update({ reactions_count: newCount })
            .eq('id', post.id);

          onPostUpdated({ ...post, reactions_count: newCount });
        }
      } catch {
        toast.error('Không thể thả cảm xúc');
      }
    }
  };

  // Submit comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const { data, error } = await supabase
        .from('journal_post_comments')
        .insert({
          journal_id: post.id,
          author_id: user.id,
          content: newComment.trim(),
        })
        .select('*, author:profiles!journal_post_comments_author_id_fkey(username, avatar_url, verification_status)')
        .single();

      if (error) throw error;

      setComments((prev) => [...prev, data as JournalPostComment]);
      setNewComment('');

      const newCount = (post.comments_count || 0) + 1;
      await supabase
        .from('journal_entries')
        .update({ comments_count: newCount })
        .eq('id', post.id);

      onPostUpdated({ ...post, comments_count: newCount });
      toast.success('Đã gửi bình luận!');
    } catch {
      toast.error('Không thể gửi bình luận');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    try {
      await supabase.from('journal_post_comments').delete().eq('id', commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      const newCount = Math.max(0, (post.comments_count || 1) - 1);
      await supabase
        .from('journal_entries')
        .update({ comments_count: newCount })
        .eq('id', post.id);
      onPostUpdated({ ...post, comments_count: newCount });
      toast.success('Đã xóa bình luận');
    } catch {
      toast.error('Không thể xóa bình luận');
    }
  };

  // Delete entire journal post
  const handleDeletePost = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài nhật ký này không?')) return;
    try {
      const { error } = await supabase.from('journal_entries').delete().eq('id', post.id);
      if (error) throw error;
      onPostDeleted(post.id);
      toast.success('Đã xóa bài nhật ký');
    } catch {
      toast.error('Không thể xóa bài nhật ký');
    }
  };

  const handleCopyLink = () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/app/my-life` : '';
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Đã sao chép liên kết!');
    setTimeout(() => setCopied(false), 2000);
  };

  const authorName = getDisplayName(post.author, 'Bạn học');
  const authorUsername = post.author?.username || '';
  const isVerified = post.author?.verification_status === 'verified';

  // Group reactions by emoji
  const reactionCounts: Record<string, number> = {};
  reactions.forEach((r) => {
    reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + 1;
  });

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-sm shadow-sm overflow-hidden hover:border-border transition-all">
      <CardContent className="p-4 sm:p-5 space-y-3.5">
        {/* Post Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href={authorUsername ? `/app/profile/${authorUsername}` : '#'}>
              <Avatar className="h-10 w-10 border border-border/60 hover:ring-2 hover:ring-primary/30 transition-all">
                {post.author?.avatar_url && <img src={post.author.avatar_url} alt={authorName} className="h-full w-full object-cover rounded-full" />}
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                  {initials(authorName)}
                </AvatarFallback>
              </Avatar>
            </Link>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={authorUsername ? `/app/profile/${authorUsername}` : '#'}
                  className="font-semibold text-sm hover:text-primary transition-colors"
                >
                  {authorName}
                </Link>
                {isVerified && (
                  <Badge className="bg-success/10 text-success border-success/20 text-[10px] px-1.5 py-0">
                    Verified
                  </Badge>
                )}
                {post.mood && (
                  <Badge
                    variant="outline"
                    className="text-xs gap-1 bg-muted/40 font-normal px-2 py-0.5"
                    title={`Tâm trạng: ${moodLabel(post.mood)}`}
                  >
                    <span>{moodEmoji(post.mood)}</span>
                    <span className="text-[11px] text-muted-foreground">{moodLabel(post.mood)}</span>
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{formatRelativeTime(post.created_at)}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  {post.visibility === 'public' ? (
                    <>
                      <Globe className="h-3 w-3 text-emerald-500" /> Công khai
                    </>
                  ) : post.visibility === 'private' ? (
                    <>
                      <Lock className="h-3 w-3" /> Riêng tư
                    </>
                  ) : (
                    <>
                      <Users className="h-3 w-3 text-primary" /> Bạn bè
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Post Options Menu */}
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onEditRequested(post)}
                  className="gap-2 cursor-pointer"
                >
                  <Edit2 className="h-4 w-4" /> Chỉnh sửa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDeletePost}
                  className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" /> Xóa bài viết
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Post Content */}
        <div className="space-y-2">
          {post.title && (
            <h3 className="font-semibold text-base text-foreground leading-snug">{post.title}</h3>
          )}
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {post.content}
          </p>
        </div>

        {/* Attachments & Images Gallery */}
        {attachments.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {attachments
                .filter((a) => a.is_image)
                .map((att) => {
                  const url = attachmentUrls[att.id];
                  return (
                    <div
                      key={att.id}
                      onClick={() => url && setLightboxSrc(url)}
                      className="relative rounded-xl overflow-hidden border border-border/60 bg-muted/30 aspect-video max-h-48 group cursor-pointer hover:border-primary/50 transition-colors"
                      title="Nhấp để xem ảnh lớn & phóng to"
                    >
                      {url ? (
                        <img
                          src={url}
                          alt={att.file_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center animate-shimmer bg-muted" />
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Non-image documents */}
            {attachments
              .filter((a) => !a.is_image)
              .map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/20 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <Paperclip className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium truncate">{att.file_name}</span>
                  </div>
                  {attachmentUrls[att.id] && (
                    <a
                      href={attachmentUrls[att.id]}
                      download={att.file_name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Reactions Summary Bar */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className="flex items-center gap-1 pt-1">
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => handleToggleReaction(emoji)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                  userReaction === emoji
                    ? 'bg-primary/10 border-primary/40 font-semibold'
                    : 'bg-muted/40 border-border/60 hover:bg-muted text-muted-foreground'
                }`}
              >
                <span>{emoji}</span>
                <span>{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Action Bar (React, Comment, Share) */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          {/* Reaction Quick Picker */}
          <div className="flex items-center gap-0.5">
            {REACTION_TYPES.map((emoji) => {
              const isSelected = userReaction === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleToggleReaction(emoji)}
                  className={`p-1.5 rounded-lg text-lg transition-transform hover:scale-125 ${
                    isSelected ? 'bg-primary/15 scale-110 shadow-sm' : 'opacity-70 hover:opacity-100'
                  }`}
                  title={`Thả ${emoji}`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className="h-8 px-2.5 text-xs text-muted-foreground gap-1.5 hover:text-foreground"
            >
              <MessageSquare className="h-4 w-4" />
              <span>{post.comments_count || comments.length || 0}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShareOpen(true)}
              className="h-8 px-2.5 text-xs text-muted-foreground gap-1.5 hover:text-foreground"
            >
              <Share2 className="h-4 w-4" />
              <span>Chia sẻ</span>
            </Button>
          </div>
        </div>

        {/* Collapsible Comments Thread */}
        {showComments && (
          <div className="pt-3 border-t border-border/40 space-y-3 animate-in fade-in duration-200">
            {/* New comment input */}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Viết lời động viên hoặc nhận xét..."
                rows={1}
                className="text-xs resize-none bg-background/50 border-border/60 min-h-[38px] py-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment(e);
                  }
                }}
              />
              <Button
                type="submit"
                size="sm"
                disabled={submittingComment || !newComment.trim()}
                className="h-[38px] px-3 shrink-0"
              >
                {submittingComment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </form>

            {/* Comments List */}
            {loadingComments ? (
              <div className="space-y-2 py-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 rounded-lg animate-shimmer bg-muted/40" />
                ))}
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                Chưa có bình luận nào. Hãy là người đầu tiên để lại lời nhắn!
              </p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {comments.map((comment) => {
                  const isCommentOwner = user?.id === comment.author_id;
                  const canDelete = isCommentOwner || isOwner;
                  const cAuthor = comment.author?.username || 'Bạn học';

                  return (
                    <div
                      key={comment.id}
                      className="flex items-start justify-between gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/40 text-xs"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-[10px]">
                            {initials(cAuthor)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{cAuthor}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeTime(comment.created_at)}
                            </span>
                          </div>
                          <p className="text-foreground/90 whitespace-pre-wrap mt-0.5">
                            {comment.content}
                          </p>
                        </div>
                      </div>

                      {canDelete && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-1 text-muted-foreground/60 hover:text-destructive transition-colors shrink-0"
                          title="Xóa bình luận"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Share Dialog */}
        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" /> Chia sẻ bài nhật ký
              </DialogTitle>
              <DialogDescription>
                Sao chép liên kết để chia sẻ nhật ký học tập với bạn bè trong hệ thống Life OS.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-xl border border-border/60 bg-muted/30 space-y-1 text-xs">
                <p className="font-semibold text-foreground">{post.title || authorName}</p>
                <p className="text-muted-foreground line-clamp-2 italic">&quot;{post.content}&quot;</p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCopyLink} className="w-full gap-2 text-xs">
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Đã sao chép liên kết!' : 'Sao chép liên kết bài viết'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* Image Lightbox View (Full zoom / Pan / Fullscreen / Mobile pinch-to-zoom) */}
        {lightboxSrc && (
          <ImageLightbox
            src={lightboxSrc}
            alt={post.title || authorName}
            onClose={() => setLightboxSrc(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
