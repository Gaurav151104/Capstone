import React, { useState } from 'react';
import Card from '../../components/Card';
import DisclaimerNote from '../../components/DisclaimerNote';
import { ShieldAlert, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';
import { riskService } from '../../services/riskService';
import { useAuth } from '../../hooks/useAuth';
import { useApp } from '../../hooks/useApp';

export default function RiskAssessment() {
  const { t } = useApp();
  const { user } = useAuth();
  const [assessment] = useState(() => riskService.calculateRisk(user));

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
                 <div className={`mt-0.5 h-2 w-2 rounded-full mr-3 ${detail.impact === 'High' ? 'bg-amber-500' : detail.impact === 'Moderate' ? 'bg-yellow-500' : detail.impact === 'Positive' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                 <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                       <span className="font-semibold text-slate-700 dark:text-slate-200">{mapLabel(detail.label)}</span>
                       <span className={`text-xs font-bold uppercase tracking-wider ${detail.impact === 'High' ? 'text-amber-600 dark:text-amber-400' : detail.impact === 'Moderate' ? 'text-yellow-600 dark:text-yellow-400' : detail.impact === 'Positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
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
      
      {assessment.suggestions.length > 0 && (
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
    </div>
  );
}