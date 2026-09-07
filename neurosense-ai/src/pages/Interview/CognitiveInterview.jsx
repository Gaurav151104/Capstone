import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  MessageSquareText, 
  ArrowRight, 
  RotateCcw, 
  CheckCircle2, 
  Brain, 
  Clock, 
  Calendar, 
  Sparkles, 
  AlertCircle,
  LayoutDashboard
} from 'lucide-react';
import Card from '../../components/Card';
import DisclaimerNote from '../../components/DisclaimerNote';
import { matchWordList, cleanString, isFuzzyMatch } from '../../utils/semanticMatch';
import { interviewService } from '../../services/interviewService';

const REGISTRATION_WORDS = ['apple', 'table', 'penny'];

const SEASONS = ['spring', 'summer', 'monsoon', 'autumn', 'fall', 'winter'];
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export default function CognitiveInterview() {
  // Interview state machine: 'intro' | 'active' | 'completed'
  const [stage, setStage] = useState('intro');
  const [currentStep, setCurrentStep] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [validationError, setValidationError] = useState('');
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const steps = [
    {
      id: 'orientation_day',
      category: 'orientation',
      title: 'Orientation Check',
      prompt: 'What day of the week is it today?',
      placeholder: 'e.g., Monday, Tuesday...',
      hint: 'Please enter today\'s day of the week.'
    },
    {
      id: 'orientation_month',
      category: 'orientation',
      title: 'Orientation Check',
      prompt: 'What month or approximate date is it today?',
      placeholder: 'e.g., September, or September 7...',
      hint: 'Enter current month or date.'
    },
    {
      id: 'orientation_season',
      category: 'orientation',
      title: 'Orientation Check',
      prompt: 'What season of the year are we currently in?',
      placeholder: 'e.g., Summer, Autumn, Winter, Spring, Monsoon...',
      hint: 'Enter the current season.'
    },
    {
      id: 'registration_show',
      category: 'registration',
      title: 'Memory Registration',
      isInstruction: true,
      prompt: 'Please carefully read and memorize these 3 words:',
      words: ['APPLE', 'TABLE', 'PENNY'],
      hint: 'Take 5 seconds to commit these three words to memory. You will be asked about them now and later.'
    },
    {
      id: 'registration_recall',
      category: 'registration',
      title: 'Immediate Registration Recall',
      prompt: 'Please type the 3 words you just read (separate with spaces or commas):',
      placeholder: 'Type the 3 words...',
      hint: 'Type as many as you remember right now.'
    },
    {
      id: 'attention_spell',
      category: 'attention',
      title: 'Attention & Mental Manipulation',
      prompt: 'Please spell the word "WORLD" backwards:',
      placeholder: 'e.g., D-L-R-O-W',
      hint: 'Spell the 5 letters in reverse order.'
    },
    {
      id: 'language_object',
      category: 'language',
      title: 'Language & Object Identification',
      prompt: 'What device worn on the wrist is used to tell time?',
      placeholder: 'e.g., Watch, clock...',
      hint: 'Name the object.'
    },
    {
      id: 'language_phrase',
      category: 'language',
      title: 'Language & Phrase Completion',
      prompt: 'Complete this familiar common phrase: "Better late than..."',
      placeholder: 'Enter the finishing word...',
      hint: 'A common idiom.'
    },
    {
      id: 'delayed_recall',
      category: 'delayedRecall',
      title: 'Delayed Memory Recall',
      prompt: 'Earlier in our conversation, we asked you to remember 3 words. What were those 3 words?',
      placeholder: 'Type the remembered words...',
      hint: 'Type the words memorized in the first section.'
    }
  ];

  const handleStart = () => {
    setStage('active');
    setCurrentStep(0);
    setInputVal('');
    setValidationError('');
    setAnswers({});
  };

  const handleNextStep = () => {
    const step = steps[currentStep];

    if (!step.isInstruction) {
      const trimmed = inputVal.trim();
      if (!trimmed || trimmed.length < 2) {
        setValidationError('Please enter a brief answer before proceeding.');
        return;
      }
      setValidationError('');
      setAnswers((prev) => ({ ...prev, [step.id]: trimmed }));
    }

    if (currentStep + 1 < steps.length) {
      setCurrentStep((prev) => prev + 1);
      setInputVal('');
    } else {
      // Calculate and finalize results
      calculateAndSaveResults({ ...answers, [step.id]: inputVal.trim() });
    }
  };

  const calculateAndSaveResults = async (finalAnswers) => {
    setIsSaving(true);

    // 1. Orientation Scoring (up to 20 pts)
    let orientationScore = 0;
    const today = new Date();
    const currentDayName = DAYS[today.getDay()];
    const userDay = cleanString(finalAnswers.orientation_day || '');
    if (DAYS.includes(userDay)) {
      if (userDay === currentDayName) orientationScore += 8;
      else orientationScore += 4; // Near or reasonable day
    }

    const userMonth = cleanString(finalAnswers.orientation_month || '');
    const currentMonthName = today.toLocaleString('en-US', { month: 'long' }).toLowerCase();
    if (userMonth.includes(currentMonthName) || userMonth.length > 2) {
      orientationScore += 6;
    }

    const userSeason = cleanString(finalAnswers.orientation_season || '');
    if (SEASONS.some((s) => userSeason.includes(s))) {
      orientationScore += 6;
    }

    // 2. Immediate Registration (up to 20 pts)
    const regResult = matchWordList(finalAnswers.registration_recall || '', REGISTRATION_WORDS);
    const registrationScore = Math.round((regResult.matchedCount / 3) * 20);

    // 3. Attention (up to 20 pts)
    let attentionScore = 0;
    const attentionAns = cleanString(finalAnswers.attention_spell || '');
    if (attentionAns === 'dlrow' || attentionAns === 'd l r o w') {
      attentionScore = 20;
    } else if (attentionAns.startsWith('dl') || attentionAns.endsWith('ow')) {
      attentionScore = 12;
    } else if (attentionAns.length >= 3) {
      attentionScore = 6;
    }

    // 4. Language (up to 20 pts)
    let languageScore = 0;
    const objAns = cleanString(finalAnswers.language_object || '');
    if (isFuzzyMatch(objAns, 'watch') || isFuzzyMatch(objAns, 'wristwatch') || isFuzzyMatch(objAns, 'clock')) {
      languageScore += 10;
    }
    const phraseAns = cleanString(finalAnswers.language_phrase || '');
    if (isFuzzyMatch(phraseAns, 'never')) {
      languageScore += 10;
    }

    // 5. Delayed Recall (up to 20 pts)
    const delResult = matchWordList(finalAnswers.delayed_recall || '', REGISTRATION_WORDS);
    const delayedScore = Math.round((delResult.matchedCount / 3) * 20);

    const totalComposite = orientationScore + registrationScore + attentionScore + languageScore + delayedScore;

    // Confidence banding (Non-diagnostic)
    let confidenceBand = 'Lower Relative Risk Band';
    let bandColor = 'text-emerald-600 dark:text-emerald-400';
    let bandBg = 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
    let bandDescription = 'Responses indicate preserved orientation, verbal attention, and short-term retention within expected parameters.';

    if (totalComposite < 55) {
      confidenceBand = 'Higher Relative Variation Band';
      bandColor = 'text-amber-600 dark:text-amber-400';
      bandBg = 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800';
      bandDescription = 'Observed variations in delayed recall or attention tasks. Consistent longitudinal tracking and routine wellness consultation recommended.';
    } else if (totalComposite < 80) {
      confidenceBand = 'Moderate Cognitive Score Band';
      bandColor = 'text-blue-600 dark:text-blue-400';
      bandBg = 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800';
      bandDescription = 'Performance shows mild fluctuations in attention or recall. Continuing brain exercises and regular check-ins advised.';
    }

    const summaryResult = {
      score: totalComposite,
      confidenceBand,
      bandColor,
      bandBg,
      bandDescription,
      sections: {
        orientation: { score: orientationScore, max: 20 },
        registration: { score: registrationScore, max: 20 },
        attention: { score: attentionScore, max: 20 },
        language: { score: languageScore, max: 20 },
        delayedRecall: { score: delayedScore, max: 20 }
      },
      answers: finalAnswers
    };

    await interviewService.saveInterviewResult(summaryResult);
    setResult(summaryResult);
    setStage('completed');
    setIsSaving(false);
  };

  const activeStep = steps[currentStep];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 flex items-center justify-center">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                Cognitive Wellness Interview
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Structured conversational screening for orientation, recall, and attention
              </p>
            </div>
          </div>
        </div>

        <Link
          to="/dashboard"
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <LayoutDashboard className="h-4 w-4 mr-1.5" />
          Dashboard
        </Link>
      </div>

      {/* Persistent Non-Diagnostic Disclaimer */}
      <DisclaimerNote compact />

      {/* Stage: Intro */}
      {stage === 'intro' && (
        <Card className="p-8">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-primary-500 to-secondary-500 text-white flex items-center justify-center mx-auto shadow-md">
              <Brain className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                Welcome to Your Cognitive Check-in
              </h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
                This conversational assessment takes approximately 3 to 4 minutes. You will be asked simple questions assessing five core cognitive domains:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <Calendar className="h-5 w-5 text-primary-500 mb-1.5" />
                <p className="font-semibold text-xs text-slate-800 dark:text-slate-100">Orientation</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Time & temporal awareness</p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <Sparkles className="h-5 w-5 text-teal-500 mb-1.5" />
                <p className="font-semibold text-xs text-slate-800 dark:text-slate-100">Registration & Recall</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Short-term verbal retention</p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <Clock className="h-5 w-5 text-purple-500 mb-1.5" />
                <p className="font-semibold text-xs text-slate-800 dark:text-slate-100">Attention & Language</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Mental manipulation & words</p>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleStart}
                className="btn-primary text-base px-8 py-3 w-full sm:w-auto inline-flex items-center justify-center shadow-md hover:shadow-lg transition-all"
              >
                Begin Screening <ArrowRight className="h-5 w-5 ml-2" />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Stage: Active Interview */}
      {stage === 'active' && activeStep && (
        <div className="space-y-6">
          {/* Step Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium capitalize">
                Section: {activeStep.category} ({activeStep.title})
              </span>
              <span>
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary-600 dark:bg-primary-500 transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          <Card className="p-6 sm:p-8">
            <div className="max-w-xl mx-auto space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                  {activeStep.title}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white leading-snug">
                  {activeStep.prompt}
                </h3>
                {activeStep.hint && (
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    {activeStep.hint}
                  </p>
                )}
              </div>

              {/* Instruction Mode with visual chips */}
              {activeStep.isInstruction && activeStep.words ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-4">
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {activeStep.words.map((word) => (
                      <span 
                        key={word}
                        className="px-6 py-3 rounded-xl bg-white dark:bg-slate-900 border-2 border-primary-500 text-primary-700 dark:text-primary-300 font-bold text-xl tracking-wide shadow-sm"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Read them aloud or in your mind, then press continue.
                  </p>
                </div>
              ) : (
                /* Text Input */
                <div className="space-y-2">
                  <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => {
                      setInputVal(e.target.value);
                      if (validationError) setValidationError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleNextStep();
                      }
                    }}
                    placeholder={activeStep.placeholder || 'Type your response...'}
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base sm:text-lg transition-all"
                  />
                  {validationError && (
                    <div className="flex items-center space-x-1.5 text-xs text-red-500 dark:text-red-400 mt-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{validationError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Action */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleNextStep}
                  disabled={isSaving}
                  className="btn-primary px-6 py-2.5 flex items-center space-x-2"
                >
                  <span>{currentStep + 1 === steps.length ? 'Submit & Review' : 'Continue'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Stage: Completed / Results View */}
      {stage === 'completed' && result && (
        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <div className="space-y-8">
              {/* Top Banner */}
              <div className="text-center space-y-3 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">
                  Interview Assessment Complete
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Your responses have been processed through cognitive scoring rubrics.
                </p>
              </div>

              {/* Score & Band Card */}
              <div className={`p-6 rounded-2xl border ${result.bandBg} text-center space-y-3`}>
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                  Composite Wellness Score
                </span>
                <div className="text-5xl font-extrabold text-slate-900 dark:text-white">
                  {result.score} <span className="text-2xl text-slate-500 font-normal">/ 100</span>
                </div>
                <div className={`text-lg font-bold ${result.bandColor}`}>
                  {result.confidenceBand}
                </div>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
                  {result.bandDescription}
                </p>
              </div>

              {/* Section Breakdown Grid */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Domain Performance Breakdown
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(result.sections).map(([key, sec]) => {
                    const pct = Math.round((sec.score / sec.max) * 100);
                    return (
                      <div 
                        key={key}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold capitalize text-slate-700 dark:text-slate-300">
                            {key === 'delayedRecall' ? 'Delayed Recall' : key}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {sec.score}/{sec.max}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary-500 rounded-full" 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {pct >= 80 ? 'Well preserved' : pct >= 50 ? 'Moderate' : 'Mild variation'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Full Disclaimer */}
              <DisclaimerNote />

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleStart}
                  className="btn-outline w-full sm:w-auto flex items-center justify-center space-x-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Retake Interview</span>
                </button>

                <div className="flex space-x-3 w-full sm:w-auto">
                  <Link
                    to="/dashboard/progress"
                    className="btn-primary w-full sm:w-auto text-center"
                  >
                    View Progress & Trends
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
