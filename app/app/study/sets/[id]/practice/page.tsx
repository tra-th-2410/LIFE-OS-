'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { PracticeMode } from '@/components/study/practice-mode';
import { fetchStudySetById, fetchStudyQuestions } from '@/lib/study';
import type { StudySet, StudyQuestion } from '@/lib/types';
import { toast } from 'sonner';

export default function PracticePage() {
  const params = useParams();
  const setId = params.id as string;

  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!setId) return;
      try {
        const [s, q] = await Promise.all([
          fetchStudySetById(setId),
          fetchStudyQuestions(setId),
        ]);
        setStudySet(s);
        setQuestions(q);
      } catch (err) {
        toast.error('Không thể tải dữ liệu luyện tập');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [setId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!studySet) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <p className="text-lg font-medium">Không tìm thấy bộ câu hỏi</p>
        <Link href="/app/study">
          <Button variant="outline">Quay lại</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="py-2 sm:py-6">
      <PracticeMode studySet={studySet} initialQuestions={questions} />
    </div>
  );
}
