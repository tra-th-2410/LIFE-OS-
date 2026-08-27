'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  Image as ImageIcon,
  Paperclip,
  Smile,
  Globe,
  Users,
  Lock,
  Loader2,
  X,
  Send,
} from 'lucide-react';
import { moodEmoji } from '@/lib/helpers';
import type { JournalEntry, JournalVisibility } from '@/lib/types';
import { toast } from 'sonner';

const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😋', '😜',
  '🤔', '🤗', '🤫', '😴', '🤤', '😢', '😭', '😤', '😡', '🤯',
  '👍', '👎', '👏', '🙌', '🎉', '🔥', '💯', '✨', '⭐', '🌟',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💪', '🎯',
  '📚', '✏️', '📝', '💻', '🎨', '🎵', '🏆', '💡', '☕', '🌱',
];

interface JournalComposerProps {
  onPostCreated: (newEntry: JournalEntry) => void;
  entryToEdit?: JournalEntry | null;
  onCancelEdit?: () => void;
}

export function JournalComposer({
  onPostCreated,
  entryToEdit,
  onCancelEdit,
}: JournalComposerProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState(entryToEdit?.title || '');
  const [content, setContent] = useState(entryToEdit?.content || '');
  const [mood, setMood] = useState<number | null>(entryToEdit?.mood || 4);
  const [visibility, setVisibility] = useState<JournalVisibility>(
    entryToEdit?.visibility || 'friends'
  );
  const [submitting, setSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Attachments
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null, isImageOnly: boolean) => {
    if (!files) return;
    const incoming = Array.from(files);

    if (isImageOnly) {
      const validImages = incoming.filter((f) => f.type.startsWith('image/'));
      setPendingFiles((prev) => [...prev, ...validImages]);
      validImages.forEach((f) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setImagePreviews((prev) => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(f);
      });
    } else {
      setPendingFiles((prev) => [...prev, ...incoming]);
    }
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim()) {
      toast.error('Vui lòng nhập nội dung nhật ký');
      return;
    }

    setSubmitting(true);
    try {
      if (entryToEdit) {
        // Update existing entry
        const { data, error } = await supabase
          .from('journal_entries')
          .update({
            title: title.trim() || null,
            content: content.trim(),
            mood,
            visibility,
            is_private: visibility === 'private',
            updated_at: new Date().toISOString(),
          })
          .eq('id', entryToEdit.id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        toast.success('Đã cập nhật bài nhật ký!');
        onPostCreated(data as JournalEntry);
        if (onCancelEdit) onCancelEdit();
      } else {
        // Create new journal post
        const { data: newEntry, error } = await supabase
          .from('journal_entries')
          .insert({
            user_id: user.id,
            title: title.trim() || null,
            content: content.trim(),
            mood,
            visibility,
            is_private: visibility === 'private',
            reactions_count: 0,
            comments_count: 0,
          })
          .select()
          .single();

        if (error) throw error;

        // Upload attachments if any
        if (pendingFiles.length > 0 && newEntry) {
          for (const file of pendingFiles) {
            const ext = file.name.split('.').pop();
            const filePath = `${user.id}/${newEntry.id}/${Date.now()}.${ext}`;

            // Upload file to community-files or bucket
            const { error: uploadError } = await supabase.storage
              .from('community-files')
              .upload(filePath, file);

            if (!uploadError) {
              await supabase.from('journal_post_attachments').insert({
                journal_id: newEntry.id,
                uploader_id: user.id,
                file_name: file.name,
                file_path: filePath,
                file_type: file.type,
                file_size: file.size,
                is_image: file.type.startsWith('image/'),
              });
            }
          }
        }

        toast.success('Đã đăng bài nhật ký học tập! ✨');
        onPostCreated(newEntry as JournalEntry);
        setTitle('');
        setContent('');
        setPendingFiles([]);
        setImagePreviews([]);
      }
    } catch {
      toast.error('Không thể đăng bài nhật ký. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-sm shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Header row: Mood + Visibility */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium mr-1">Cảm xúc:</span>
              {[1, 2, 3, 4, 5].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(mood === m ? null : m)}
                  className={`text-xl p-1 rounded-lg transition-transform ${
                    mood === m
                      ? 'bg-primary/15 scale-110 shadow-sm shadow-primary/10'
                      : 'opacity-50 hover:opacity-100 hover:scale-105'
                  }`}
                  title={`Cảm xúc mức ${m}`}
                >
                  {moodEmoji(m)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Quyền xem:</span>
              <Select
                value={visibility}
                onValueChange={(val) => setVisibility(val as JournalVisibility)}
              >
                <SelectTrigger className="h-8 text-xs w-[140px] bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="friends" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-primary" /> Bạn bè
                    </span>
                  </SelectItem>
                  <SelectItem value="public" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-emerald-500" /> Công khai
                    </span>
                  </SelectItem>
                  <SelectItem value="private" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Chỉ mình tôi
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title input (optional) */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề nhật ký (VD: Hành trình ôn thi IELTS hôm nay, Những điều học được...)"
            className="text-sm font-medium bg-background/40 border-border/60"
          />

          {/* Content textarea */}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Hôm nay bạn đã học được điều gì mới? Chia sẻ cảm xúc, trải nghiệm hoặc kiến thức thú vị cùng bạn bè..."
            rows={4}
            required
            className="text-sm resize-none bg-background/40 border-border/60"
          />

          {/* Image Previews */}
          {imagePreviews.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {imagePreviews.map((src, idx) => (
                <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-border">
                  <img src={src} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Emoji Picker Popup */}
          {showEmojiPicker && (
            <div className="p-2 rounded-xl border border-border/70 bg-card shadow-lg max-h-36 overflow-y-auto grid grid-cols-10 gap-1 animate-in fade-in zoom-in-95">
              {EMOJI_LIST.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    setContent((prev) => prev + em);
                    setShowEmojiPicker(false);
                  }}
                  className="text-lg p-1 rounded hover:bg-muted transition-transform hover:scale-125"
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <div className="flex items-center gap-1">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files, true)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              >
                <ImageIcon className="h-4 w-4 text-emerald-500" /> Ảnh
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files, false)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              >
                <Paperclip className="h-4 w-4 text-blue-500" /> Tệp đính kèm
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 ${
                  showEmojiPicker ? 'bg-muted' : ''
                }`}
              >
                <Smile className="h-4 w-4 text-amber-500" /> Emoji
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {entryToEdit && onCancelEdit && (
                <Button type="button" variant="outline" size="sm" onClick={onCancelEdit}>
                  Hủy
                </Button>
              )}
              <Button type="submit" size="sm" disabled={submitting || !content.trim()} className="gap-1.5">
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {entryToEdit ? 'Lưu cập nhật' : 'Đăng nhật ký'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
