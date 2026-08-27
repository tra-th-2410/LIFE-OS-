'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Shield,
  Check,
  X,
  Loader2,
  Mail,
  Upload,
  School,
  Clock,
  FileImage,
  Search,
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  History,
} from 'lucide-react';
import type { StudentVerification, Profile, VerificationAuditLog } from '@/lib/types';
import { initials, formatDate } from '@/lib/helpers';
import { toast } from 'sonner';

type Filter = 'pending' | 'approved' | 'rejected';

interface VerificationWithProfile extends StudentVerification {
  profile?: Profile | null;
}

interface VerificationWithAudit extends VerificationWithProfile {
  audit_logs?: (VerificationAuditLog & { admin?: Profile | null })[];
}

const REJECTION_REASONS = [
  'Student ID is unclear',
  'Information does not match',
  'Document appears invalid',
  'Document is expired',
  'Unable to verify student status',
  'Other',
];

export default function AdminVerificationsPage() {
  const router = useRouter();
  const { user, loading, role } = useAuth();
  const [verifications, setVerifications] = useState<VerificationWithProfile[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [pageLoading, setPageLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  // Detail dialog state
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedV, setSelectedV] = useState<VerificationWithAudit | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);

  // Reject dialog state
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Statistics
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });

  // Audit logs for detail view
  const [auditLogs, setAuditLogs] = useState<(VerificationAuditLog & { admin?: Profile | null })[]>([]);

  useEffect(() => {
    if (!loading && user && role !== 'admin' && role !== 'super_admin') {
      router.push('/app');
    }
  }, [user, loading, role, router]);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('student_verifications')
      .select('*, profile:profiles!student_verifications_user_id_fkey(username, avatar_url, id, country, province, full_name)')
      .order('created_at', { ascending: false });
    setVerifications((data as VerificationWithProfile[]) ?? []);

    // Calculate stats
    const all = (data as VerificationWithProfile[]) ?? [];
    setStats({
      pending: all.filter((v) => v.status === 'pending').length,
      approved: all.filter((v) => v.status === 'approved').length,
      rejected: all.filter((v) => v.status === 'rejected').length,
      total: all.length,
    });

    setPageLoading(false);
  }, []);

  useEffect(() => {
    if (role === 'admin' || role === 'super_admin') {
      loadData();
    } else {
      setPageLoading(false);
    }
  }, [role, loadData]);

  const loadAuditLogs = useCallback(async (verificationId: string) => {
    const { data } = await supabase
      .from('verification_audit_logs')
      .select('*, admin:profiles!verification_audit_logs_admin_id_fkey(username, avatar_url, full_name)')
      .eq('verification_request_id', verificationId)
      .order('created_at', { ascending: false });
    setAuditLogs((data as (VerificationAuditLog & { admin?: Profile | null })[]) ?? []);
  }, []);

  const openDetail = async (v: VerificationWithProfile) => {
    setSelectedV(v as VerificationWithAudit);
    setDetailOpen(true);
    setSignedUrl(null);
    setAuditLogs([]);
    setDetailLoading(true);

    await loadAuditLogs(v.id);

    // Generate signed URL for student ID if exists
    if (v.student_id_url) {
      setUrlLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('student-verification')
          .createSignedUrl(v.student_id_url, 300);
        if (error) throw error;
        setSignedUrl(data.signedUrl);
      } catch {
        console.error('Failed to generate signed URL for student ID');
        setSignedUrl(null);
      } finally {
        setUrlLoading(false);
      }
    }

    setDetailLoading(false);
  };

  const handleApprove = async (id: string) => {
    setActing(id);
    try {
      const { error } = await supabase.rpc('approve_student_verification', {
        p_verification_id: id,
        p_approve: true,
      });
      if (error) throw error;
      toast.success('Student verification approved.');
      setDetailOpen(false);
      await loadData();
    } catch {
      toast.error('Failed to approve verification');
    } finally {
      setActing(null);
    }
  };

  const openReject = (id: string) => {
    setRejectingId(id);
    setRejectReason('');
    setCustomReason('');
    setRejectOpen(true);
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    const reason = rejectReason === 'Other' ? customReason : rejectReason;
    if (!reason || !reason.trim()) {
      toast.error('Please select or enter a rejection reason');
      return;
    }
    setActing(rejectingId);
    try {
      const { error } = await supabase.rpc('approve_student_verification', {
        p_verification_id: rejectingId,
        p_approve: false,
        p_rejection_reason: reason.trim(),
      });
      if (error) throw error;
      toast.success('Verification rejected');
      setRejectOpen(false);
      setDetailOpen(false);
      await loadData();
    } catch {
      toast.error('Failed to reject verification');
    } finally {
      setActing(null);
    }
  };

  // Get unique schools for filter
  const uniqueSchools = useMemo(() => {
    const schools = new Set<string>();
    verifications.forEach((v) => {
      if (v.school_name) schools.add(v.school_name);
    });
    return Array.from(schools).sort();
  }, [verifications]);

  // Filter and search
  const filtered = useMemo(() => {
    let result = verifications.filter((v) => v.status === filter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (v) =>
          v.profile?.username?.toLowerCase().includes(q) ||
          v.profile?.full_name?.toLowerCase().includes(q) ||
          v.school_email?.toLowerCase().includes(q) ||
          v.school_name?.toLowerCase().includes(q) ||
          v.id.toLowerCase().includes(q)
      );
    }

    if (schoolFilter !== 'all') {
      result = result.filter((v) => v.school_name === schoolFilter);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const days = dateFilter === 'today' ? 1 : dateFilter === 'week' ? 7 : dateFilter === 'month' ? 30 : 0;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      result = result.filter((v) => new Date(v.created_at) >= cutoff);
    }

    return result;
  }, [verifications, filter, searchQuery, schoolFilter, dateFilter]);

  if (loading || pageLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (role !== 'admin' && role !== 'super_admin') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <Shield className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <p className="text-lg font-medium">Admin access required</p>
        <p className="text-sm text-muted-foreground mt-2">You don&apos;t have permission to view this page.</p>
        <Link href="/app" className="mt-4 inline-block"><Button variant="outline">Back to Home</Button></Link>
      </div>
    );
  }

  const methodIcon = (m: string) => (m === 'school_email' ? Mail : m === 'student_id' ? Upload : School);
  const methodLabel = (m: string) => (m === 'school_email' ? 'School Email' : m === 'student_id' ? 'Student ID' : 'Manual');

  const statCards = [
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Verified', value: stats.approved, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Total', value: stats.total, icon: FileCheck, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href="/app/admin" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-display font-bold">Student Verifications</h1>
        <p className="text-muted-foreground mt-1">Review and approve student verification requests.</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold font-display">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, username, email, school, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={schoolFilter} onValueChange={setSchoolFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="School" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {uniqueSchools.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Past Week</SelectItem>
            <SelectItem value="month">Past Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            {f} ({verifications.filter((v) => v.status === f).length})
          </button>
        ))}
      </div>

      {/* Verification List */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No {filter} verifications{searchQuery || schoolFilter !== 'all' || dateFilter !== 'all' ? ' match your filters' : ''}.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => {
            const Icon = methodIcon(v.method);
            return (
              <Card key={v.id} className="border-border/60 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer" onClick={() => openDetail(v)}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {v.profile ? initials(v.profile.username) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {v.profile?.full_name || v.profile?.username || 'Unknown'}
                        </span>
                        <Badge variant="outline" className="text-xs gap-1">
                          <Icon className="h-3 w-3" /> {methodLabel(v.method)}
                        </Badge>
                        {v.status === 'pending' && <Badge className="bg-warning/10 text-warning text-xs">Pending</Badge>}
                        {v.status === 'approved' && <Badge className="bg-success/10 text-success text-xs">Approved</Badge>}
                        {v.status === 'rejected' && <Badge className="bg-destructive/10 text-destructive text-xs">Rejected</Badge>}
                      </div>

                      <div className="text-sm text-muted-foreground space-y-0.5">
                        {v.profile?.username && <p>Username: {v.profile.username}</p>}
                        {v.school_email && <p>Email: {v.school_email}</p>}
                        {v.school_name && <p>School: {v.school_name}</p>}
                        {v.grade_or_year && <p>Grade/Year: {v.grade_or_year}</p>}
                        {v.country && <p>Country: {v.country}</p>}
                        <p className="text-xs font-mono text-muted-foreground/70">ID: {v.id.slice(0, 8)}...</p>
                        <p>Submitted: {formatDate(v.created_at)}</p>
                        {v.reviewed_at && <p>Reviewed: {formatDate(v.reviewed_at)}</p>}
                        {v.rejection_reason && <p className="text-destructive">Reason: {v.rejection_reason}</p>}
                      </div>

                      {v.status === 'pending' && (
                        <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" onClick={() => handleApprove(v.id)} disabled={acting === v.id} className="gap-1.5">
                            {acting === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openReject(v.id)} disabled={acting === v.id} className="gap-1.5 text-destructive hover:text-destructive">
                            <X className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Verification Request Details</DialogTitle>
            <DialogDescription>
              Review the student&apos;s information and verification document.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedV ? (
            <div className="space-y-5">
              {/* Student Information */}
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-muted-foreground" /> Student Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="Name" value={selectedV.profile?.full_name || 'Not provided'} />
                  <InfoRow label="Username" value={selectedV.profile?.username || 'Unknown'} />
                  <InfoRow label="Email" value={selectedV.school_email || 'Not provided'} />
                  <InfoRow label="Country" value={selectedV.country || 'Not provided'} />
                  <InfoRow label="Province" value={selectedV.province || 'Not provided'} />
                  <InfoRow label="School" value={selectedV.school_name || 'Not provided'} />
                  <InfoRow label="Grade/Year" value={selectedV.grade_or_year || 'Not provided'} />
                  <InfoRow label="Request ID" value={selectedV.id} mono />
                </div>
              </div>

              {/* Verification Information */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <FileCheck className="h-4 w-4 text-muted-foreground" /> Verification Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="Method" value={methodLabel(selectedV.method)} />
                  <InfoRow label="Status" value={
                    <Badge className={
                      selectedV.status === 'pending' ? 'bg-warning/10 text-warning' :
                      selectedV.status === 'approved' ? 'bg-success/10 text-success' :
                      'bg-destructive/10 text-destructive'
                    }>
                      {selectedV.status}
                    </Badge>
                  } />
                  <InfoRow label="Submitted" value={formatDate(selectedV.created_at)} />
                  {selectedV.reviewed_at && <InfoRow label="Reviewed" value={formatDate(selectedV.reviewed_at)} />}
                  {selectedV.rejection_reason && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Rejection Reason</p>
                      <p className="text-sm text-destructive">{selectedV.rejection_reason}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Student ID Document */}
              {selectedV.student_id_url && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <FileImage className="h-4 w-4 text-muted-foreground" /> Student ID Document
                  </h3>
                  <div className="rounded-lg border border-border/60 overflow-hidden bg-muted/30">
                    {urlLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={signedUrl} alt="Student ID" className="w-full" />
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">Failed to load document</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    This is a temporary secure link. The document is not publicly accessible.
                  </p>
                </div>
              )}

              {/* Audit History */}
              {auditLogs.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <History className="h-4 w-4 text-muted-foreground" /> Audit History
                  </h3>
                  <div className="space-y-2">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 text-sm">
                        {log.action === 'approved' ? (
                          <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium capitalize">{log.action} by {log.admin?.username || 'Admin'}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                          {log.rejection_reason && <p className="text-xs text-destructive mt-0.5">{log.rejection_reason}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {selectedV.status === 'pending' && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    onClick={() => handleApprove(selectedV.id)}
                    disabled={acting === selectedV.id}
                    className="flex-1 gap-1.5"
                  >
                    {acting === selectedV.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Approve Verification
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openReject(selectedV.id)}
                    disabled={acting === selectedV.id}
                    className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" /> Reject Verification
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Reject Verification
            </DialogTitle>
            <DialogDescription>
              Please select a reason for rejecting this verification request. The student will see this reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              {REJECTION_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setRejectReason(reason)}
                  className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                    rejectReason === reason
                      ? 'border-primary bg-primary/5'
                      : 'border-border/60 hover:border-primary/30'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            {rejectReason === 'Other' && (
              <div className="space-y-2">
                <Label htmlFor="customReason">Custom reason</Label>
                <Textarea
                  id="customReason"
                  placeholder="Enter the rejection reason..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={acting === rejectingId || (!rejectReason || (rejectReason === 'Other' && !customReason.trim()))}
              className="gap-1.5"
            >
              {acting === rejectingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Reject Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}
