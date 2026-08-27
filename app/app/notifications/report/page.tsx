'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Trophy, Flame, Target, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ReportData {
  period: string;
  current_label: string;
  previous_label: string;
  current_count: number;
  previous_count: number;
  active_challenges: number;
  total_participations: number;
  completed_challenges: number;
  completion_rate: number;
  max_streak: number;
  pct_change: number | null;
}

function ReportContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const period = searchParams.get('type') === 'monthly' ? 'monthly' : 'weekly';

  useEffect(() => {
    if (!user) return;

    const loadReport = async () => {
      const { data, error } = await supabase.rpc('get_challenge_report', {
        p_user_id: user.id,
        p_period: period,
      });

      if (error) {
        setError(error.message);
      } else if (data) {
        setReport(data as ReportData);
      }
      setLoading(false);
    };

    loadReport();
  }, [user, period]);

  const maxBar = report
    ? Math.max(report.current_count, report.previous_count, 1)
    : 1;

  const currentBarWidth = report
    ? Math.round((report.current_count / maxBar) * 100)
    : 0;
  const previousBarWidth = report
    ? Math.round((report.previous_count / maxBar) * 100)
    : 0;

  const periodLabel = period === 'weekly' ? 'Weekly' : 'Monthly';
  const periodIcon = period === 'weekly' ? '📊' : '📅';

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-8 w-48 rounded-lg animate-shimmer" />
        <div className="h-64 rounded-xl animate-shimmer" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/app/notifications">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">Unable to load report: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!report) return null;

  const hasData = report.current_count > 0 || report.previous_count > 0;
  const hasPrevious = report.previous_count > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/app/notifications">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-display font-bold">
          {periodIcon} {periodLabel} Challenge Report
        </h1>
      </div>

      {/* Summary Card */}
      <Card>
        <CardContent className="p-6">
          <p className="text-lg font-medium mb-1">
            {period === 'weekly' ? 'This week' : 'This month'} you completed{' '}
            <span className="text-primary font-bold">{report.current_count}</span>{' '}
            Challenge{report.current_count !== 1 ? 's' : ''}.
          </p>
          {report.pct_change === null ? (
            <p className="text-sm text-muted-foreground">
              {hasData ? 'New activity this period!' : 'Not enough activity to compare yet.'}
            </p>
          ) : report.pct_change > 0 ? (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              That&apos;s {report.pct_change}% more than {period === 'weekly' ? 'last week' : 'last month'}!
            </p>
          ) : report.pct_change < 0 ? (
            <p className="text-sm text-orange-500 flex items-center gap-1">
              <TrendingDown className="h-4 w-4" />
              That&apos;s {Math.abs(report.pct_change)}% less than {period === 'weekly' ? 'last week' : 'last month'}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Minus className="h-4 w-4" />
              Same as {period === 'weekly' ? 'last week' : 'last month'}.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bar Chart Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Challenge Completions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Current Period Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {period === 'weekly' ? 'This Week' : 'This Month'}
              </span>
              <span className="font-bold">{report.current_count}</span>
            </div>
            <div className="h-8 rounded-lg bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-lg transition-all duration-700 ease-out flex items-center justify-end pr-2"
                style={{ width: `${Math.max(currentBarWidth, report.current_count > 0 ? 8 : 0)}%` }}
              >
                {report.current_count > 0 && (
                  <span className="text-xs font-bold text-primary-foreground">{report.current_count}</span>
                )}
              </div>
            </div>
          </div>

          {/* Previous Period Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-muted-foreground">
                {period === 'weekly' ? 'Last Week' : 'Last Month'}
              </span>
              <span className="font-bold text-muted-foreground">{report.previous_count}</span>
            </div>
            <div className="h-8 rounded-lg bg-muted overflow-hidden">
              <div
                className="h-full bg-muted-foreground/40 rounded-lg transition-all duration-700 ease-out flex items-center justify-end pr-2"
                style={{ width: `${Math.max(previousBarWidth, report.previous_count > 0 ? 8 : 0)}%` }}
              >
                {report.previous_count > 0 && (
                  <span className="text-xs font-bold text-muted-foreground">{report.previous_count}</span>
                )}
              </div>
            </div>
          </div>

          {/* Change indicator */}
          {hasPrevious && report.pct_change !== null && report.pct_change !== 0 && (
            <div className="flex items-center gap-2 pt-2 border-t">
              {report.pct_change > 0 ? (
                <>
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    +{report.pct_change}%
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-5 w-5 text-orange-500" />
                  <span className="text-lg font-bold text-orange-500">
                    {report.pct_change}%
                  </span>
                </>
              )}
            </div>
          )}
          {!hasPrevious && hasData && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">New activity this period</p>
            </div>
          )}
          {!hasData && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">Not enough activity to compare yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{report.active_challenges}</p>
              <p className="text-xs text-muted-foreground">Active Challenges</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Flame className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{report.max_streak}</p>
              <p className="text-xs text-muted-foreground">Longest Streak</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{report.completed_challenges}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <span className="text-lg font-bold text-blue-500">%</span>
            </div>
            <div>
              <p className="text-2xl font-bold">{report.completion_rate}%</p>
              <p className="text-xs text-muted-foreground">Completion Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Period labels */}
      <p className="text-xs text-muted-foreground text-center">
        {report.current_label} vs {report.previous_label}
      </p>
    </div>
  );
}

export default function ChallengeReportPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="h-8 w-48 rounded-lg animate-shimmer" />
          <div className="h-64 rounded-xl animate-shimmer" />
        </div>
      }
    >
      <ReportContent />
    </Suspense>
  );
}
