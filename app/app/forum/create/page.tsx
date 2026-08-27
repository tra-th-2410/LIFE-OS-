'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Plus, X, Shield, Eye, EyeOff, Smile, Paperclip, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { ForumCategory } from '@/lib/types';
import { useLanguage } from '@/components/language-provider';

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
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CreateForumPostPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('forum_categories').select('*').order('sort_order').then(({ data }) => {
      setCategories((data as ForumCategory[]) ?? []);
      const preselect = searchParams.get('category');
      if (preselect) {
        const cat = (data as ForumCategory[])?.find((c) => c.slug === preselect);
        if (cat) setCategoryId(cat.id);
      }
      setLoading(false);
    });
  }, [searchParams]);

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-');
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => setTags(tags.filter((x) => x !== tag));

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
    setContent((prev) => prev + emoji);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error(t('Please log in before creating a post'));
      router.push('/login');
      return;
    }
    if (!title.trim() || !content.trim() || !categoryId) {
      toast.error(t('Please fill in all required fields'));
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('forum_posts').insert({
        author_id: user.id,
        category_id: categoryId,
        title: title.trim(),
        content: content.trim(),
        is_anonymous: isAnonymous,
        tags,
        image_url: null,
        status: 'active',
      }).select('id').single();

      if (error) throw error;

      for (const file of pendingFiles) {
        const isImg = IMAGE_TYPES.includes(file.type);
        const ext = file.name.split('.').pop() || 'bin';
        const fileName = `${user.id}/forum-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('community-files')
          .upload(fileName, file);

        if (uploadError) {
          console.error('upload failed', uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { error: attError } = await supabase
          .from('forum_post_attachments')
          .insert({
            post_id: data.id,
            uploader_id: user.id,
            file_name: file.name,
            file_path: fileName,
            file_type: file.type,
            file_size: file.size,
            is_image: isImg,
          });

        if (attError) {
          console.error('attachment insert failed', attError);
        }
      }

      toast.success(t('Post created!'));
      router.push(`/app/forum/post/${data.id}`);
    } catch (cause) {
      console.error('forum post creation failed', cause);
      const message = cause instanceof Error ? cause.message : '';
      if (message.includes('row-level security') || message.includes('42501')) {
        toast.error(profile?.verification_status === 'verified'
          ? t('Unable to save the post. Please try again.')
          : t('Please verify your student account before posting.'));
      } else if (message.includes('foreign key') || message.includes('category')) {
        toast.error(t('Please select a valid category.'));
      } else {
        toast.error(t('Unable to save the post. Please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/app/forum" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Forum
      </Link>

      <Card className="border-border/60 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-display">Create a Post</CardTitle>
          <CardDescription>Share your thoughts, ask a question, or start a discussion.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select a category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" placeholder="What do you want to discuss?" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="content">Content *</Label>
              <Textarea id="content" placeholder="Write your post..." value={content} onChange={(e) => setContent(e.target.value)} required rows={8} maxLength={5000} />
              <p className="text-xs text-muted-foreground">{content.length} / 5000 {t('characters')}</p>
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

            <div className="space-y-2">
              <Label>Tags (max 5)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={addTag} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add</Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      #{tag}
                      <button type="button" onClick={() => removeTag(tag)} className="ml-0.5"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Pending files preview */}
            {pendingFiles.length > 0 && (
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
            </div>

            <div className="space-y-3 rounded-lg border border-border/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-1.5 cursor-pointer">
                    {isAnonymous ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    Post anonymously
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAnonymous
                      ? 'Your identity will be hidden from other users. Admins can still see who you are for safety.'
                      : 'Your username will be visible on this post.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${isAnonymous ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${isAnonymous ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => router.push('/app/forum')}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish Post'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-lg bg-muted/50 p-3 flex items-start gap-2">
        <Shield className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Be kind and respectful. Posts that violate community guidelines may be removed by moderators.
          Your identity is always known to admins for safety, even when posting anonymously.
        </p>
      </div>
    </div>
  );
}
