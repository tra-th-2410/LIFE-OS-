'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { BookOpen, Clock, MoreVertical, Pencil, Trash2, Layers, Sparkles } from 'lucide-react';
import { getSubjectMeta } from '@/lib/study';
import type { StudySet } from '@/lib/types';

interface StudySetCardProps {
  studySet: StudySet;
  onEdit: (set: StudySet) => void;
  onDelete: (setId: string) => void;
}

export function StudySetCard({ studySet, onEdit, onDelete }: StudySetCardProps) {
  const subjectMeta = getSubjectMeta(studySet.subject);
  const qCount = studySet.questions_count ?? 0;

  return (
    <Card className="border-border/80 shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-between overflow-hidden">
      <CardContent className="p-5 space-y-4">
        {/* Top bar */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl">{subjectMeta.icon}</span>
            <Badge variant="outline" className="text-xs font-semibold bg-muted/40">
              {subjectMeta.labelVi}
            </Badge>
            {studySet.is_system ? (
              <Badge variant="secondary" className="text-[11px] font-semibold bg-primary/10 text-primary border-primary/20">
                🏛️ Mẫu chuẩn
              </Badge>
            ) : studySet.default_type ? (
              <Badge variant="outline" className="text-[11px] text-muted-foreground bg-muted/20">
                {studySet.default_type === 'multiple_choice'
                  ? '🔘 Trắc nghiệm'
                  : studySet.default_type === 'fill_blank'
                  ? '✏️ Điền từ'
                  : '🃏 Flashcard'}
              </Badge>
            ) : null}
            {studySet.topic && (
              <Badge variant="outline" className="text-xs text-muted-foreground bg-transparent border-dashed">
                {studySet.topic}
              </Badge>
            )}
          </div>

          {!studySet.is_system && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1 text-muted-foreground hover:text-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onEdit(studySet)} className="gap-2 cursor-pointer">
                  <Pencil className="h-4 w-4" /> Chỉnh sửa
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(studySet.id)}
                  className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" /> Xóa bộ học
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5">
          <Link href={`/app/study/sets/${studySet.id}`} className="block group-hover:text-primary transition-colors">
            <h3 className="font-bold text-base sm:text-lg leading-snug line-clamp-2">{studySet.title}</h3>
          </Link>
          {studySet.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{studySet.description}</p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/40">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Layers className="h-3.5 w-3.5 text-primary" />
            {qCount} câu hỏi
          </span>

          {qCount > 0 && studySet.mastered_count !== undefined && studySet.mastered_count > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              Đã thuộc: {studySet.mastered_count}/{qCount}
            </span>
          )}
        </div>
      </CardContent>

      {/* Card Action Buttons */}
      <div className="p-3 bg-muted/30 border-t border-border/50 grid grid-cols-2 gap-2">
        <Link href={`/app/study/sets/${studySet.id}/practice`}>
          <Button
            variant="outline"
            size="sm"
            disabled={qCount === 0}
            className="w-full text-xs font-medium rounded-xl h-9 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
          >
            <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Luyện tập
          </Button>
        </Link>

        <Link href={`/app/study/sets/${studySet.id}/exam`}>
          <Button
            size="sm"
            disabled={qCount === 0}
            className="w-full text-xs font-medium rounded-xl h-9"
          >
            <Clock className="h-3.5 w-3.5 mr-1.5" /> Thi thử
          </Button>
        </Link>
      </div>
    </Card>
  );
}
