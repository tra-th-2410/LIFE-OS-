'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  BookOpen,
  FileText,
  Upload,
  Plus,
  Sparkles,
  Search,
  Download,
  Trash2,
  ExternalLink,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  File,
  Loader2,
} from 'lucide-react';
import { AiCreateSetDialog } from './ai-create-set-dialog';
import type { StudyMaterial, StudySet } from '@/lib/types';
import { formatRelativeTime } from '@/lib/helpers';
import { toast } from 'sonner';

export function StudyLibraryView() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  // Upload/Create Material Dialog
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialSubject, setMaterialSubject] = useState('Toán');
  const [materialTopic, setMaterialTopic] = useState('');
  const [materialSummary, setMaterialSummary] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // AI Dialog state triggered from material
  const [aiDialogMat, setAiDialogMat] = useState<StudyMaterial | null>(null);
  const [showAiDialog, setShowAiDialog] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMaterials = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('study_materials')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMaterials((data as StudyMaterial[]) ?? []);
    } catch (err) {
      console.error('Error loading study materials:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    if (!materialTitle.trim()) {
      // Auto-set title from file name (strip extension)
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      setMaterialTitle(baseName);
    }

    // Auto-detect subject hint from name
    const lowerName = file.name.toLowerCase();
    if (lowerName.includes('toan') || lowerName.includes('math') || lowerName.includes('giai tich') || lowerName.includes('hinh hoc')) {
      setMaterialSubject('Toán');
    } else if (lowerName.includes('anh') || lowerName.includes('english') || lowerName.includes('ielts') || lowerName.includes('toeic')) {
      setMaterialSubject('Tiếng Anh');
    } else if (lowerName.includes('ly') || lowerName.includes('physics')) {
      setMaterialSubject('Vật lý');
    } else if (lowerName.includes('hoa') || lowerName.includes('chemistry')) {
      setMaterialSubject('Hóa học');
    } else if (lowerName.includes('tin') || lowerName.includes('code') || lowerName.includes('it')) {
      setMaterialSubject('Tin học');
    }
  };

  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !materialTitle.trim()) {
      toast.error('Vui lòng nhập tên tài liệu');
      return;
    }

    setUploading(true);
    try {
      let filePath: string | null = null;
      let fileName: string | null = selectedFile ? selectedFile.name : `${materialTitle.trim()}.pdf`;
      let fileType: string = 'document';
      let fileSize: number = selectedFile ? selectedFile.size : 0;
      let mimeType: string = selectedFile ? selectedFile.type : 'application/octet-stream';

      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'bin';
        fileType = ext;
        const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${user.id}/${Date.now()}_${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from('study_materials')
          .upload(storagePath, selectedFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          toast.error('Lỗi khi tải file lên kho lưu trữ: ' + uploadError.message);
          setUploading(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('study_materials')
          .getPublicUrl(storagePath);

        filePath = publicUrlData?.publicUrl || storagePath;
      }

      const { data, error } = await supabase
        .from('study_materials')
        .insert({
          user_id: user.id,
          title: materialTitle.trim(),
          subject: materialSubject.trim(),
          topic: materialTopic.trim() || null,
          content_summary: materialSummary.trim() || null,
          file_name: fileName,
          file_path: filePath,
          file_type: fileType,
          file_size: fileSize,
          mime_type: mimeType,
        })
        .select()
        .single();

      if (error) {
        console.error('DB insert error:', error);
        toast.error('Không thể lưu thông tin tài liệu: ' + error.message);
      } else if (data) {
        setMaterials((prev) => [data as StudyMaterial, ...prev]);
        toast.success('Đã tải lên và lưu tài liệu vào Thư viện thành công!');
        setShowUploadModal(false);
        setMaterialTitle('');
        setMaterialTopic('');
        setMaterialSummary('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Upload exception:', err);
      toast.error('Có lỗi xảy ra trong quá trình tải tài liệu');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMaterial = async (mat: StudyMaterial) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài liệu "${mat.title}"?`)) return;

    try {
      // 1. Delete record from database
      const { error } = await supabase
        .from('study_materials')
        .delete()
        .eq('id', mat.id)
        .eq('user_id', user?.id);

      if (error) throw error;

      // 2. Cleanup file from storage if path exists
      if (mat.file_path && mat.file_path.includes('/study_materials/')) {
        const parts = mat.file_path.split('/study_materials/');
        if (parts[1]) {
          await supabase.storage.from('study_materials').remove([parts[1]]);
        }
      }

      setMaterials((prev) => prev.filter((m) => m.id !== mat.id));
      toast.success('Đã xóa tài liệu khỏi Thư viện');
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error('Không thể xóa tài liệu: ' + (err.message || ''));
    }
  };

  const handleOpenAiGenerator = (mat: StudyMaterial) => {
    setAiDialogMat(mat);
    setShowAiDialog(true);
  };

  const handleAiSetSuccess = (newSet: StudySet) => {
    setShowAiDialog(false);
    setAiDialogMat(null);
    toast.success(`Đã tạo thành công bộ học "${newSet.title}"! Đang chuyển đến trang luyện tập...`);
    router.push(`/app/study/sets/${newSet.id}`);
  };

  const getFileIcon = (fileType?: string | null) => {
    const t = (fileType || '').toLowerCase();
    if (t.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (t.includes('doc') || t.includes('word')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (t.includes('xls') || t.includes('sheet')) return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
    if (t.includes('ppt') || t.includes('powerpoint')) return <FileText className="h-5 w-5 text-orange-500" />;
    if (t.includes('png') || t.includes('jpg') || t.includes('jpeg') || t.includes('image')) return <ImageIcon className="h-5 w-5 text-purple-500" />;
    if (t.includes('txt') || t.includes('code')) return <FileCode className="h-5 w-5 text-cyan-500" />;
    return <File className="h-5 w-5 text-primary" />;
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredMaterials = materials.filter((m) => {
    const matchSub = selectedSubject === 'all' || (m.subject || '').toLowerCase() === selectedSubject.toLowerCase();
    const matchQ =
      !search ||
      (m.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.topic || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.content_summary || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.file_name || '').toLowerCase().includes(search.toLowerCase());
    return matchSub && matchQ;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Upload Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold">{t('Thư viện tài liệu học tập')}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t('Lưu trữ tài liệu PDF, Word, PowerPoint, Excel, Ghi chú và sử dụng AI để tự động tạo Flashcards & Đề trắc nghiệm.')}
          </p>
        </div>

        <Button onClick={() => setShowUploadModal(true)} className="gap-1.5 rounded-xl">
          <Upload className="h-4 w-4" /> {t('Tải lên tài liệu')}
        </Button>
      </div>

      {/* Search & Subject Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('Tìm kiếm tài liệu, bài tập, công thức...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {['all', 'Toán', 'Tiếng Anh', 'Vật lý', 'Hóa học', 'Sinh học', 'Tin học', 'Ngữ văn', 'Lịch sử', 'Địa lý'].map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSubject(sub)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border ${
                selectedSubject === sub
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {sub === 'all' ? t('Tất cả môn') : t(sub)}
            </button>
          ))}
        </div>
      </div>

      {/* Material Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 rounded-2xl animate-shimmer" />
          ))}
        </div>
      ) : filteredMaterials.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">{t('Chưa có tài liệu nào trong thư viện')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('Tải lên file giáo trình, đề cương hoặc tóm tắt để AI tạo bộ câu hỏi trắc nghiệm và flashcards cho bạn!')}
            </p>
            <Button onClick={() => setShowUploadModal(true)} size="sm" className="mt-4 rounded-xl">
              <Plus className="h-4 w-4 mr-1" /> {t('Tải tài liệu lên ngay')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMaterials.map((mat) => (
            <Card key={mat.id} className="border-border/60 bg-card/80 p-5 space-y-3.5 hover:border-primary/40 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                    {getFileIcon(mat.file_type)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-foreground truncate leading-snug">{mat.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">{t(mat.subject || 'Toán')}</Badge>
                      {mat.topic && <span>• {mat.topic}</span>}
                      {mat.file_size ? <span>• {formatFileSize(mat.file_size)}</span> : null}
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteMaterial(mat)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  title={t('Xóa tài liệu')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {mat.content_summary ? (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed bg-muted/30 p-2.5 rounded-xl border border-border/40">
                  {mat.content_summary}
                </p>
              ) : mat.file_name ? (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                  <File className="h-3.5 w-3.5 shrink-0" /> {mat.file_name}
                </p>
              ) : null}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-border/40 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{formatRelativeTime(mat.created_at)}</span>
                  {mat.file_path && (
                    <a
                      href={mat.file_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                    >
                      <Download className="h-3 w-3" /> {t('Mở / Tải về')}
                    </a>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenAiGenerator(mat)}
                  className="rounded-xl h-8 text-xs font-semibold gap-1.5 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('AI sinh Quiz & Flashcards')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>{t('Tải lên tài liệu học tập')}</DialogTitle>
            <DialogDescription>
              {t('Hỗ trợ file PDF, Word (.doc, .docx), PowerPoint (.ppt, .pptx), Excel (.xls, .xlsx), Text (.txt) hoặc Ảnh tài liệu.')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadMaterial} className="space-y-4 pt-2">
            {/* File Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t('Chọn file tài liệu')}</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                  selectedFile
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/60 hover:border-primary/30 bg-card/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*"
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2 text-foreground font-medium text-sm">
                    {getFileIcon(selectedFile.name.split('.').pop())}
                    <span className="truncate max-w-[280px]">{selectedFile.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {formatFileSize(selectedFile.size)}
                    </Badge>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-6 w-6 text-muted-foreground mx-auto" />
                    <p className="text-xs font-medium text-foreground">{t('Click để chọn file từ thiết bị của bạn')}</p>
                    <p className="text-[10px] text-muted-foreground">PDF, DOCX, PPTX, XLSX, TXT, PNG, JPG ({t('Tối đa 50MB')})</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t('Tên tài liệu / Ghi chú *')}</Label>
              <Input
                value={materialTitle}
                onChange={(e) => setMaterialTitle(e.target.value)}
                placeholder="VD: Tổng hợp công thức Hình học không gian 12..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t('Môn học')}</Label>
                <Input value={materialSubject} onChange={(e) => setMaterialSubject(e.target.value)} placeholder="Toán, Tiếng Anh..." required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t('Chủ đề (Topic)')}</Label>
                <Input value={materialTopic} onChange={(e) => setMaterialTopic(e.target.value)} placeholder="Khảo sát hàm số..." />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t('Tóm tắt nội dung chính / Ghi chú')}</Label>
              <Textarea
                value={materialSummary}
                onChange={(e) => setMaterialSummary(e.target.value)}
                placeholder={t('Dán nội dung bài giảng, tóm tắt lý thuyết hoặc công thức cốt lõi tại đây...')}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowUploadModal(false)}>{t('Hủy')}</Button>
              <Button type="submit" disabled={uploading || !materialTitle.trim()}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('Đang tải lên...')}
                  </>
                ) : (
                  t('Tải lên & Lưu tài liệu')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AI Create Set Dialog triggered from a Material */}
      {showAiDialog && (
        <AiCreateSetDialog
          open={showAiDialog}
          onOpenChange={setShowAiDialog}
          onSuccess={handleAiSetSuccess}
          initialContent={aiDialogMat?.content_summary || aiDialogMat?.title || ''}
          initialSubject={aiDialogMat?.subject || 'general'}
          initialTopic={aiDialogMat?.topic || aiDialogMat?.title || ''}
        />
      )}
    </div>
  );
}
