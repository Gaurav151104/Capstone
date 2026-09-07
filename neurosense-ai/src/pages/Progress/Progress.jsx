import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Clock, 
  FileText, 
  Database, 
  Download, 
  Brain, 
  Zap, 
  MessageSquareText, 
  AlertCircle,
  Calendar,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import Card from '../../components/Card';
import Chart from '../../components/Chart';
import DisclaimerNote from '../../components/DisclaimerNote';
import { gameService } from '../../services/gameService';
import { interviewService } from '../../services/interviewService';
import { riskService } from '../../services/riskService';
import { useAuth } from '../../hooks/useAuth';

export default function Progress() {
  const { user } = useAuth();

  const [gameLogs] = useState(() => gameService.getUserLogs());
  const [reactionLogs] = useState(() => gameService.getReactionTimeHistory(user?.id));
  const [interviewLogs] = useState(() => interviewService.getInterviewHistory(user?.id));
  const [riskAssessment] = useState(() => riskService.calculateRisk(user));
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [backendHistory, setBackendHistory] = useState(null);

  // Attempt backend history fetch with fallback to local state
  useEffect(() => {
    if (!user?.id) return;
    fetch(`http://localhost:5000/api/user-history/${user.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setBackendHistory(data);
      })
      .catch(() => {
        // Transparent local fallback
      });
  }, [user?.id]);

  // Combine all activity sessions into chronological event timeline
  const combinedSessions = [];

  interviewLogs.forEach((intvw) => {
    combinedSessions.push({
      id: intvw.id,
      date: intvw.date,
      type: 'Cognitive Interview',
      icon: MessageSquareText,
      score: intvw.score,
      detail: `${intvw.confidenceBand || 'Score'}`
    });
  });

  reactionLogs.forEach((rx) => {
    combinedSessions.push({
      id: rx.id,
      date: rx.date,
      type: 'Reaction & Attention',
      icon: Zap,
      score: rx.score,
      detail: `${rx.avgReactionTimeMs} ms avg (±${rx.variabilityMs || 0}ms)`
    });
  });

  gameLogs.forEach((g) => {
    combinedSessions.push({
      id: g.id,
      date: g.date,
      type: g.gameType,
      icon: Brain,
      score: g.score,
      detail: `${g.timeTaken || 0} ms duration`
    });
  });

  // Sort chronological
  combinedSessions.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Compute Composite Trend Timeline
  const compositeChartData = [];
  let runningScoreSum = 0;

  combinedSessions.forEach((sess, idx) => {
    runningScoreSum += sess.score;
    const runningAvg = Math.round(runningScoreSum / (idx + 1));
    const riskFactor = riskAssessment?.score ? Math.max(0, 100 - riskAssessment.score) : 80;
    const blendedComposite = Math.round((runningAvg * 0.7) + (riskFactor * 0.3));

    compositeChartData.push({
      name: new Date(sess.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      composite: blendedComposite,
      score: sess.score
    });
  });

  // Detect downward trend in last 3 sessions (Phase 5 requirement)
  const hasDownwardTrend = (() => {
    if (compositeChartData.length < 3) return false;
    const len = compositeChartData.length;
    const s1 = compositeChartData[len - 3].score;
    const s2 = compositeChartData[len - 2].score;
    const s3 = compositeChartData[len - 1].score;
    return s3 < s2 && s2 < s1;
  })();

  // Current latest composite score
  const latestComposite = compositeChartData.length > 0 
    ? compositeChartData[compositeChartData.length - 1].composite 
    : (backendHistory?.latestComposite || 75);

  const getCompositeBand = (score) => {
    if (score >= 80) {
      return {
        band: 'Lower Relative Risk Band',
        badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        note: 'Cognitive responses indicate stable processing across recall, attention, and executive tasks.'
      };
    } else if (score >= 55) {
      return {
        band: 'Moderate Risk Band',
        badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        note: 'Cognitive metrics show moderate variability across sessions. Routine mental exercises advised.'
      };
    } else {
      return {
        band: 'Higher Relative Risk Band',
        badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        note: 'Performance patterns show noticeable fluctuations. Consider discussing these trends with a healthcare professional.'
      };
    }
  };

  const bandInfo = getCompositeBand(latestComposite);
  const hasData = combinedSessions.length > 0;

  // Phase 7: PDF Report download handler
  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const uid = user?.id || 'guest_user';
      const res = await fetch(`http://localhost:5000/api/report/${uid}`);
      if (!res.ok) throw new Error('PDF report generation failed on backend');

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `NeuroSense_Summary_Report_${uid}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.warn('PDF download fallback/offline:', err.message);
      alert('PDF generation requires the backend server. Please verify python app.py is running.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
      {/* Header & Clinical PDF Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center">
            <TrendingUp className="mr-2.5 h-6 w-6 text-primary-600 dark:text-primary-400" />
            Longitudinal Progress & Fusion Trends
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Multi-modal tracking combining text screening, reaction time latency, and cognitive game metrics
          </p>
        </div>

        <button
          onClick={handleDownloadPdf}
          disabled={isDownloadingPdf}
          className="btn-primary py-2.5 px-4 flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow"
        >
          <Download className="h-4 w-4" />
          <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download Clinical Report (PDF)'}</span>
        </button>
      </div>

      {/* Reusable Medical Disclaimer Note */}
      <DisclaimerNote compact />

      {!hasData ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-12 text-center flex flex-col items-center">
          <div className="h-20 w-20 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-6">
            <Database className="h-10 w-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            No Longitudinal Activity Logged Yet
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6 text-sm">
            Complete a Cognitive Interview or play our cognitive games (Memory Match, Reaction Time, Word Recall) to begin building your trend charts.
          </p>
        </div>
      ) : (
        <>
          {/* Fusion Score Banner */}
          <Card className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Latest Composite Fusion Score
                  </span>
                </div>
                <div className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white">
                  {latestComposite} <span className="text-2xl text-slate-400 font-normal">/ 100</span>
                </div>
                <div className="inline-block px-3 py-1 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700">
                  <span className={bandInfo.badge}>{bandInfo.band}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl">
                  {bandInfo.note}
                </p>
              </div>

              {/* Metric Pill Badges */}
              <div className="grid grid-cols-3 gap-3 w-full md:w-auto text-center">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <MessageSquareText className="h-4 w-4 text-primary-500 mx-auto mb-1" />
                  <span className="text-[11px] text-slate-400 block">Interview</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {interviewLogs.length > 0 ? `${interviewLogs[interviewLogs.length - 1].score}/100` : '—'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <Zap className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                  <span className="text-[11px] text-slate-400 block">Reaction</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {reactionLogs.length > 0 ? `${reactionLogs[reactionLogs.length - 1].avgReactionTimeMs}ms` : '—'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <Brain className="h-4 w-4 text-purple-500 mx-auto mb-1" />
                  <span className="text-[11px] text-slate-400 block">Games</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {gameLogs.length} Played
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Downward Trend Plain-Language Flag (Phase 5) */}
          {hasDownwardTrend && (
            <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 flex items-start gap-3 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-950 dark:text-blue-100">
                  Observation Note: Score Variation Trend
                </p>
                <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-300 mt-0.5 leading-relaxed">
                  Your recent scores show a downward trend over the last 3 assessment sessions. Daily variations are common and can be influenced by sleep, fatigue, or stress. Consider discussing this pattern with a healthcare professional during routine wellness check-ins.
                </p>
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Composite Wellness Score Trend" subtitle="Blended longitudinal tracking over time" icon={TrendingUp}>
              <div className="h-72 mt-4">
                <Chart 
                  data={compositeChartData} 
                  type="line" 
                  dataKeys={['composite']} 
                  colors={['#0284c7']} 
                />
              </div>
            </Card>

            <Card title="Session Performance Scores" subtitle="Individual task scores per session" icon={Clock}>
              <div className="h-72 mt-4">
                <Chart 
                  data={compositeChartData} 
                  type="line" 
                  dataKeys={['score']} 
                  colors={['#10b981']} 
                />
              </div>
            </Card>
          </div>

          {/* Activity Log Table */}
          <Card title="Comprehensive Activity History" icon={FileText} className="overflow-hidden">
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Assessment Module</th>
                    <th className="p-4 text-center">Score</th>
                    <th className="p-4">Performance Metrics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {combinedSessions.slice().reverse().map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 text-slate-600 dark:text-slate-400 flex items-center whitespace-nowrap">
                        <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                        {new Date(item.date).toLocaleString()}
                      </td>
                      <td className="p-4 font-medium text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4 text-primary-500" />
                          <span>{item.type}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center font-bold text-slate-900 dark:text-white">
                        {item.score} / 100
                      </td>
                      <td className="p-4 text-xs text-slate-500 dark:text-slate-400">
                        {item.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Full Disclaimer at bottom of progress page */}
          <DisclaimerNote />
        </>
      )}
    </div>
  );
}