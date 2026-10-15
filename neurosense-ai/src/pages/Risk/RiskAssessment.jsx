import React, { useState, useEffect } from 'react';
import Card from '../../components/Card';
import DisclaimerNote from '../../components/DisclaimerNote';
import CognitiveConsentModal from '../../components/CognitiveConsentModal';
import { 
  ShieldAlert, AlertTriangle, CheckCircle, Lightbulb, 
  Brain, Check, X, ShieldCheck, AlertCircle, RefreshCw 
} from 'lucide-react';
import { riskService } from '../../services/riskService';
import { gameService } from '../../services/gameService';
import { useAuth } from '../../hooks/useAuth';
import { useApp } from '../../hooks/useApp';

export default function RiskAssessment() {
  const { t } = useApp();
  const { user } = useAuth();

  // Baseline clinical & lifestyle calculation
  const [assessment] = useState(() => riskService.calculateRisk(user));

  // Cognitive norming composite state (Phase 1 & 4)
  const [cognitiveScoring, setCognitiveScoring] = useState(null);
  const [loadingCognitive, setLoadingCognitive] = useState(false);
  const [consentGranted, setConsentGranted] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  // Check consent gating and fetch cognitive normative score
  const loadCognitiveScore = async () => {
    setLoadingCognitive(true);
    try {
      const consented = await gameService.getServerConsent();
      setConsentGranted(Boolean(consented));

      if (consented && user?.id) {
        const history = await gameService.getUserHistory(user.id);
        const rawMeasures = {
          age: user.age || user.lifestyle?.Age
        };

        if (history.reactions && history.reactions.length > 0) {
          const lastRt = history.reactions[history.reactions.length - 1];
          if (lastRt.avgReactionTimeMs) rawMeasures.reaction_time_mean_ms = lastRt.avgReactionTimeMs;
          if (lastRt.variabilityMs) rawMeasures.reaction_time_sd_ms = lastRt.variabilityMs;
        }

        if (history.games && history.games.length > 0) {
          history.games.forEach(g => {
            if (g.gameType === 'Word Recall') {
              if (g.immediateCorrect !== undefined) rawMeasures.word_recall_immediate_count = g.immediateCorrect;
              if (g.delayedCorrect !== undefined) rawMeasures.word_recall_delayed_count = g.delayedCorrect;
            } else if (g.gameType === 'Image Recall' && g.score !== undefined) {
              rawMeasures.image_recall_forward_span = g.score;
            } else if (g.gameType === 'Memory Match' && g.errors !== undefined) {
              rawMeasures.memory_match_errors = g.errors;
            }
          });
        }

        // Request normative scoring from backend
        const scored = await gameService.scoreSession(rawMeasures);
        if (scored) {
          setCognitiveScoring(scored);
        }
      }
    } catch (e) {
      console.warn('[RiskAssessment] Could not evaluate cognitive norms:', e);
    } finally {
      setLoadingCognitive(false);
    }
  };

  useEffect(() => {
    loadCognitiveScore();
  }, [user]);

  if (!assessment) return null;

  const getRiskBandTranslated = (level) => {
    if (level === 'Low') return `${t.low || 'Lower Relative Risk Band'}`;
    if (level === 'Medium') return `${t.medium || 'Moderate Risk Band'}`;
    if (level === 'High') return `${t.high || 'Higher Relative Risk Band'}`;
    return t.unknown || 'Evaluation Pending';
  };

  const mapLabel = (label) => {
    const mapping = {
      'Age Factor': t.age_factor,
      'Stroke History': t.stroke_history,
      'Comorbidities': t.comorbidities,
      'Family History': t.family_risk,
      'Subjective Symptoms': t.subjective_symptoms,
      'Game Performance': t.game_performance,
      'Clinical Health': t.clinical_health
    };
    return mapping[label] || label;
  };

  const mapDesc = (desc, label) => {
    if (label === 'Age Factor') return t.age_desc;
    if (label === 'Stroke History') return t.stroke_desc;
    if (label === 'Comorbidities') return desc.replace('indicated underlying medical conditions.', t.comorbidities_desc);
    if (label === 'Family History') return t.family_desc;
    if (label === 'Subjective Symptoms') return desc.replace('self-reported cognitive concerns.', t.symptoms_desc);
    if (label === 'Game Performance') {
      if (desc.includes('Above average')) return t.game_perf_positive;
      if (desc.includes('Consistent baseline')) return t.game_perf_neutral;
      return t.game_perf_high;
    }
    if (label === 'Clinical Health') return t.healthy_desc;
    return desc;
  };

  const mapSuggestion = (sug) => {
    const titles = {
      'Medical Consultation': t.medical_consult,
      'Smoking Cessation': t.smoking_cessation,
      'Physical Activity': t.physical_activity,
      'Continue Training': t.continue_training,
      'Cognitive Baseline': t.cog_baseline,
      'Maintain Lifestyle': t.maintain_lifestyle
    };
    const descs = {
      'Discuss your reported cognitive symptoms with a physician.': t.consult_desc,
      'Quitting smoking significantly improves vascular brain health.': t.smoking_desc,
      'Incorporate 30 mins of moderate aerobic exercise daily.': t.activity_desc,
      'Regular cognitive assessment stabilizes our predictive accuracy.': t.training_desc,
      'Play your first games on the Dashboard to generate a dynamic risk composite.': t.baseline_desc,
      'Keep up your current healthy habits and consider preventative monitoring.': t.maintain_desc,
      'Target 7-8 hours of sleep to improve memory consolidation.': t.sleep_tip
    };
    return { title: titles[sug.title] || sug.title, desc: descs[sug.desc] || sug.desc };
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center">
          <ShieldAlert className="mr-2 h-6 w-6 text-primary-600 dark:text-primary-400" /> 
          {assessment.isComposite ? (t.composite_risk + ' ' + t.risk_assessment) : t.clinical_assessment}
        </h2>
        <p className="text-muted">
          {assessment.isComposite 
            ? t.risk_assessment_desc
            : t.clinical_history_desc}
        </p>
      </div>

      {/* Reusable Disclaimer */}
      <DisclaimerNote compact />

      {/* Baseline Clinical & Lifestyle Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className={`col-span-1 border-t-4 ${assessment.riskLevel === 'Low' ? 'border-t-emerald-500' : assessment.riskLevel === 'Medium' ? 'border-t-yellow-500' : 'border-t-amber-500'}`}>
          <div className="text-center py-6">
            <div className={`inline-flex h-20 w-20 rounded-full items-center justify-center mb-4 
              ${assessment.riskLevel === 'Low' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : assessment.riskLevel === 'Medium' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-500'}`}>
              {assessment.riskLevel === 'Low' ? <CheckCircle className="h-10 w-10" /> : <AlertTriangle className="h-10 w-10" />}
            </div>
            <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">{t.baseline_risk}</h3>
            <p className={`text-2xl font-extrabold mt-2 
              ${assessment.riskLevel === 'Low' ? 'text-emerald-600 dark:text-emerald-400' : assessment.riskLevel === 'Medium' ? 'text-yellow-600 dark:text-yellow-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {getRiskBandTranslated(assessment.riskLevel)}
            </p>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Relative Indicator Score: {assessment.score} / 100
            </p>
            <p className="text-sm text-muted mt-4 px-2 leading-relaxed">
              {assessment.explanation}
            </p>
          </div>
        </Card>

        <Card className="col-span-1 md:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t.assessment_details}</h3>
          <div className="space-y-4">
            {assessment.details.map((detail, idx) => (
              <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-start transition-colors duration-200">
                 <div className={`mt-0.5 h-2 w-2 rounded-full mr-3 ${detail.impact === 'High' || detail.impact === 'Increases Risk' ? 'bg-amber-500' : detail.impact === 'Moderate' ? 'bg-yellow-500' : detail.impact === 'Positive' || detail.impact === 'Protective / Lowers Risk' ? 'bg-emerald-500' : detail.impact === 'No clear effect' ? 'bg-slate-400' : 'bg-blue-500'}`} />
                 <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                       <span className="font-semibold text-slate-700 dark:text-slate-200">{mapLabel(detail.label)}</span>
                       <span className={`text-xs font-bold uppercase tracking-wider ${detail.impact === 'High' || detail.impact === 'Increases Risk' ? 'text-amber-600 dark:text-amber-400' : detail.impact === 'Moderate' ? 'text-yellow-600 dark:text-yellow-400' : detail.impact === 'Positive' || detail.impact === 'Protective / Lowers Risk' ? 'text-emerald-600 dark:text-emerald-400' : detail.impact === 'No clear effect' ? 'text-slate-500 dark:text-slate-400' : 'text-blue-600 dark:text-blue-400'}`} title={detail.impact === 'No clear effect' ? 'Negligible statistical contribution to the predicted risk profile.' : undefined}>
                         {detail.impact === 'High' ? t.high : detail.impact === 'Moderate' ? t.medium : detail.impact === 'Positive' ? 'Preserved' : detail.impact}
                       </span>
                    </div>
                    <p className="text-sm text-muted">{mapDesc(detail.desc, detail.label)}</p>
                 </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Consent Gating Card */}
      {!consentGranted && (
        <Card className="border-l-4 border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-sm">
                  Cognitive Assessment Consent Required
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Informed participation consent is required on the server before normative psychometric composite scores can be calculated.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowConsentModal(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-sm shrink-0"
            >
              Review & Provide Consent
            </button>
          </div>
        </Card>
      )}

      {/* Used / Skipped Measures Card (Phase 1: Composite Gating) */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center">
              <Brain className="mr-2 h-5 w-5 text-purple-600 dark:text-purple-400" />
              Cognitive Battery Normative Composite & Measures Status
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Psychometric norming breakdown (MIN_MEASURES = 3 gating enforced). Never re-normalises down to a single measure.
            </p>
          </div>
          {cognitiveScoring && cognitiveScoring.composite !== null ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Composite Index:</span>
              <span className="px-3 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-bold border border-purple-200 dark:border-purple-800 font-mono">
                {cognitiveScoring.composite} / 100 (z: {cognitiveScoring.composite_z > 0 ? '+' : ''}{cognitiveScoring.composite_z})
              </span>
            </div>
          ) : (
            <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold border border-amber-200 dark:border-amber-800 font-mono">
              Status: {cognitiveScoring?.status || 'INSUFFICIENT_NORMS'}
            </span>
          )}
        </div>

        {/* State 1: Insufficient Norms Banner */}
        {cognitiveScoring && cognitiveScoring.status === 'INSUFFICIENT_NORMS' && (
          <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 space-y-2">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wide">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              Composite Score Withheld (Status: INSUFFICIENT_NORMS)
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Fewer than 3 measures currently have valid, applicable normative reference values ({cognitiveScoring.valid_measures_count || 0}/3 available). Single-measure normalisation is withheld to prevent misleading clinical distortion. Displaying per-measure raw values below:
            </p>
            {cognitiveScoring.raw_values && Object.keys(cognitiveScoring.raw_values).length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-amber-200/60 dark:border-amber-900/40">
                {Object.entries(cognitiveScoring.raw_values).map(([k, val]) => (
                  <div key={k} className="p-2 bg-white/80 dark:bg-slate-900/60 rounded-lg border border-amber-100 dark:border-amber-900/30">
                    <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      {k.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-800 dark:text-white">
                      {typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(2)) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Breakdown of Evaluated vs Skipped Measures */}
        {cognitiveScoring ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Used Measures */}
            <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
              <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Check className="h-4 w-4" /> Evaluated Measures ({cognitiveScoring.used_measures?.length || 0})
              </h4>
              {cognitiveScoring.used_measures && cognitiveScoring.used_measures.length > 0 ? (
                <ul className="space-y-2 text-xs">
                  {cognitiveScoring.used_measures.map(m => {
                    const z = cognitiveScoring.per_measure_z?.[m];
                    const w = cognitiveScoring.active_weights?.[m];
                    return (
                      <li key={m} className="flex items-center justify-between py-1 border-b border-emerald-100/60 dark:border-emerald-900/20 last:border-0">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">
                          {m.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-2">
                          {z !== undefined && (
                            <span className="font-mono text-emerald-700 dark:text-emerald-300">
                              z: {z > 0 ? '+' : ''}{z}
                            </span>
                          )}
                          {w !== undefined && (
                            <span className="text-[10px] text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              wt: {Math.round(w * 100)}%
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 italic">No evaluated measures applicable to user profile.</p>
              )}
            </div>

            {/* Skipped Measures */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <X className="h-4 w-4 text-slate-400" /> Skipped Measures ({cognitiveScoring.skipped_measures?.length || 0})
              </h4>
              {cognitiveScoring.skipped_measures && cognitiveScoring.skipped_measures.length > 0 ? (
                <ul className="space-y-2 text-xs">
                  {cognitiveScoring.skipped_measures.map(m => (
                    <li key={m} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80 last:border-0">
                      <span className="font-medium text-slate-600 dark:text-slate-400 capitalize">
                        {m.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded font-mono">
                        No applicable norm
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">All measures evaluated!</p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-500">
            {loadingCognitive 
              ? "Loading cognitive session records..."
              : "Complete the cognitive games (Word Recall, Image Recall, Reaction Time, Memory Match) to view your normative psychometric profile."}
          </div>
        )}

        {/* Dynamic Disclaimer generated from norms.json */}
        <div className="mt-4 p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 rounded-xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
          <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            {cognitiveScoring?.disclaimer || "Provisional norm: Reaction Time (Mean) (age 60-64). No norm available yet, raw score only: Word Recall (Immediate), Word Recall (Delayed), Image Recall (Forward Span), Image Recall (Backward Span), Reaction Time (SD), Memory Match (Time), Memory Match (Errors). Screening aid only, not a medical diagnosis."}
          </span>
        </div>
      </Card>

      {/* Wellness Recommendations Card */}
      {assessment.suggestions && assessment.suggestions.length > 0 && (
         <Card title={t.ai_recommendations || 'Wellness Recommendations'} icon={Lightbulb}>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {assessment.suggestions.map((sug, idx) => {
                   const mapped = mapSuggestion(sug);
                   return (
                    <div key={idx} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg p-4">
                       <h4 className="font-semibold text-blue-900 dark:text-blue-300">{mapped.title}</h4>
                       <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">{mapped.desc}</p>
                    </div>
                   );
                })}
             </div>
         </Card>
      )}

      {/* Full Medical Disclaimer Box */}
      <DisclaimerNote />

      {/* Consent Modal */}
      <CognitiveConsentModal
        isOpen={showConsentModal}
        onConsentGranted={() => {
          setShowConsentModal(false);
          loadCognitiveScore();
        }}
        onCancel={() => setShowConsentModal(false)}
      />
    </div>
  );
}