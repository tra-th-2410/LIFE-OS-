'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, Check, ImagePlus, Loader2, School, Shield } from 'lucide-react';

type EducationLevel = 'high_school' | 'university';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function VerifyStudentPage() {
  const router = useRouter();
  const { user, loading, refreshProfile } = useAuth();
  const [educationLevel, setEducationLevel] = useState<EducationLevel | ''>('');
  const [schoolName, setSchoolName] = useState('');
  const [gradeOrYear, setGradeOrYear] = useState('');
  const [studentIdFile, setStudentIdFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    if (!file) {
      setStudentIdFile(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setStudentIdFile(null);
      setError('Upload a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      setStudentIdFile(null);
      setError('Your image must be larger than 0 bytes and no more than 5 MB.');
      return;
    }
    setStudentIdFile(file);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!user || !educationLevel || schoolName.trim().length < 2 || !gradeOrYear.trim() || !studentIdFile) {
      setError('Complete all fields and choose a valid student ID image.');
      return;
    }

    setSubmitting(true);
    const extension = studentIdFile.type === 'image/png' ? 'png' : studentIdFile.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${user.id}/student-id-${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from('student-verification').upload(path, studentIdFile, {
        contentType: studentIdFile.type,
        upsert: false,
      });
      if (uploadError) throw new Error('Unable to upload your student ID. Please try again.');

      const { error: verificationError } = await supabase.rpc('complete_student_onboarding', {
        p_education_level: educationLevel,
        p_school_name: schoolName.trim(),
        p_grade_or_year: gradeOrYear.trim(),
        p_student_id_path: path,
      });
      if (verificationError) {
        await supabase.storage.from('student-verification').remove([path]);
        throw new Error('We could not complete verification. Please try again.');
      }
      await refreshProfile();
      setComplete(true);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to complete verification.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="relative w-full max-w-lg">
        <Link href="/app" className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Life OS
        </Link>
        <Card className="border-border/60 shadow-lg">
          <CardHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10"><Shield className="h-6 w-6 text-primary" /></div>
            <CardTitle className="text-2xl font-display">Optional student verification</CardTitle>
            <CardDescription>Life OS works without verification. Complete this form only if you want a verified student profile.</CardDescription>
          </CardHeader>
          <CardContent>
            {complete ? (
              <div className="space-y-4 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success"><Check className="h-6 w-6" /></div><p className="text-sm text-muted-foreground">Your student profile is verified.</p><Button className="w-full" onClick={() => router.push('/app')}>Continue to Life OS</Button></div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setEducationLevel('high_school')} className={`rounded-xl border p-4 text-left transition-colors ${educationLevel === 'high_school' ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40'}`}><School className="mb-2 h-5 w-5 text-primary" /><p className="font-medium">High school</p></button><button type="button" onClick={() => setEducationLevel('university')} className={`rounded-xl border p-4 text-left transition-colors ${educationLevel === 'university' ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40'}`}><School className="mb-2 h-5 w-5 text-primary" /><p className="font-medium">University</p></button></div>
                <div className="space-y-2"><Label htmlFor="school-name">School / University</Label><Input id="school-name" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} required maxLength={200} /></div>
                <div className="space-y-2"><Label htmlFor="grade-year">Grade / Year</Label><Input id="grade-year" value={gradeOrYear} onChange={(event) => setGradeOrYear(event.target.value)} required maxLength={80} placeholder="For example, Grade 10 or Year 1" /></div>
                <label htmlFor="student-id" className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/70 p-7 text-center hover:border-primary/50 hover:bg-primary/5"><ImagePlus className="mb-3 h-8 w-8 text-primary" /><span className="font-medium">{studentIdFile ? studentIdFile.name : 'Choose your student ID image'}</span><span className="mt-1 text-xs text-muted-foreground">JPG, PNG, or WebP up to 5 MB</span><Input id="student-id" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="sr-only" /></label>
                <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground"><Shield className="mt-0.5 h-4 w-4 shrink-0" />Your upload is stored privately and is not shown to other students.</div>
                {error && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>}
                <Button type="submit" className="w-full" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify student profile'}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
