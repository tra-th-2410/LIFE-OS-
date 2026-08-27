'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, Trash2, Download, Lock, LogOut, Loader2, AlertCircle, Check, Globe } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh City (GMT+7)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (GMT+7)' },
  { value: 'Asia/Jakarta', label: 'Jakarta (GMT+7)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
  { value: 'Asia/Seoul', label: 'Seoul (GMT+9)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (GMT+8)' },
  { value: 'Asia/Kolkata', label: 'Kolkata (GMT+5:30)' },
  { value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
  { value: 'Europe/London', label: 'London (GMT+0/GMT+1)' },
  { value: 'Europe/Paris', label: 'Paris (GMT+1)' },
  { value: 'Europe/Berlin', label: 'Berlin (GMT+1)' },
  { value: 'Europe/Moscow', label: 'Moscow (GMT+3)' },
  { value: 'America/New_York', label: 'New York (GMT-5)' },
  { value: 'America/Chicago', label: 'Chicago (GMT-6)' },
  { value: 'America/Denver', label: 'Denver (GMT-7)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)' },
  { value: 'America/Sao_Paulo', label: 'Sao Paulo (GMT-3)' },
  { value: 'Australia/Sydney', label: 'Sydney (GMT+10)' },
  { value: 'Pacific/Auckland', label: 'Auckland (GMT+12)' },
  { value: 'UTC', label: 'UTC (GMT+0)' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [visibility, setVisibility] = useState(profile?.profile_visibility ?? 'public');
  const [timezone, setTimezone] = useState(profile?.timezone ?? 'Asia/Ho_Chi_Minh');
  const [savingTimezone, setSavingTimezone] = useState(false);

  useEffect(() => {
    setVisibility(profile?.profile_visibility ?? 'public');
    setTimezone(profile?.timezone ?? 'Asia/Ho_Chi_Minh');
  }, [profile]);

  const handleUpdateTimezone = async (v: string) => {
    setTimezone(v);
    if (!user) return;
    setSavingTimezone(true);
    const { error } = await supabase.from('profiles').update({ timezone: v }).eq('id', user.id);
    if (error) {
      toast.error('Failed to update timezone');
      setTimezone(profile?.timezone ?? 'Asia/Ho_Chi_Minh');
    } else {
      await refreshProfile();
      toast.success('Timezone updated');
    }
    setSavingTimezone(false);
  };

  const handleUpdateVisibility = async (v: 'public' | 'friends' | 'private') => {
    setVisibility(v);
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ profile_visibility: v }).eq('id', user.id);
    if (error) {
      toast.error('Failed to update privacy setting');
      setVisibility(profile?.profile_visibility ?? 'public');
    } else {
      await refreshProfile();
      toast.success('Privacy setting updated');
    }
  };

  const handleDeleteVerification = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { data: records, error: loadError } = await supabase
        .from('student_verifications')
        .select('student_id_url')
        .eq('user_id', user.id);
      if (loadError) throw loadError;
      const paths = (records ?? [])
        .map((record) => record.student_id_url)
        .filter((path): path is string => Boolean(path));
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage.from('student-verification').remove(paths);
        if (storageError) throw storageError;
      }
      const { error: deleteError } = await supabase.from('student_verifications').delete().eq('user_id', user.id);
      if (deleteError) throw deleteError;
      toast.success('Verification data deleted');
    } catch {
      toast.error('Failed to delete verification data');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    try {
      const [profileData, goals, habits, journals, projects] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('goals').select('*').eq('user_id', user.id),
        supabase.from('habits').select('*').eq('user_id', user.id),
        supabase.from('journal_entries').select('*').eq('user_id', user.id),
        supabase.from('projects').select('*').eq('owner_id', user.id),
      ]);
      const exportData = {
        profile: profileData.data,
        goals: goals.data,
        habits: habits.data,
        journals: journals.data,
        projects: projects.data,
        exported_at: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifeos-data-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported');
    } catch {
      toast.error('Failed to export data');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      await supabase.from('profiles').delete().eq('id', user.id);
      await supabase.auth.signOut();
      toast.success('Account deleted');
      router.push('/');
    } catch {
      toast.error('Failed to delete account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account, privacy, and security.</p>
      </div>

      {/* Verification status */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Student Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            {profile?.verification_status === 'verified' && <Badge className="gap-1 bg-success/10 text-success border-success/20"><Check className="h-3 w-3" /> Verified</Badge>}
            {profile?.verification_status === 'basic' && <Badge variant="outline">Not completed</Badge>}
          </div>
          {profile?.verification_status !== 'verified' && <Link href="/verify-student" className="block">
            <Button variant="outline" size="sm">Complete student onboarding</Button>
          </Link>}
        </CardContent>
      </Card>

      {/* Privacy settings */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Profile visibility</Label>
            <p className="text-xs text-muted-foreground mb-2">Who can see your profile?</p>
            <div className="flex gap-2">
              {(['public', 'friends', 'private'] as const).map((v) => (
                <Button key={v} size="sm" variant={visibility === v ? 'default' : 'outline'} onClick={() => handleUpdateVisibility(v)} className="capitalize">
                  {v}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timezone settings */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Timezone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Your timezone</Label>
            <p className="text-xs text-muted-foreground mb-2">Used for daily challenge reminders and report scheduling.</p>
            <Select value={timezone} onValueChange={handleUpdateTimezone} disabled={savingTimezone}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingTimezone && <p className="text-xs text-muted-foreground mt-1">Saving...</p>}
          </div>
        </CardContent>
      </Card>

      {/* Data management */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Export your data</p>
              <p className="text-xs text-muted-foreground">Download all your data as JSON</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportData} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete verification data</p>
              <p className="text-xs text-muted-foreground">Remove all verification records</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDeleteVerification} disabled={submitting} className="gap-1.5 text-destructive hover:text-destructive">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!deleteConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Delete account</p>
                <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)} className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Delete Account
              </Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg bg-destructive/10 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">This action cannot be undone. All your data will be permanently deleted.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={handleDeleteAccount} disabled={submitting}>
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm Delete'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
