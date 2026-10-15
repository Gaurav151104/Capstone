import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, FileText, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { gameService } from '../services/gameService';

export default function CognitiveConsentModal({ 
  isOpen = true, 
  onConsentGranted, 
  onCancel,
  isPage = false,
  redirectTo = '/dashboard/games'
}) {
  const navigate = useNavigate();
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedData, setAgreedData] = useState(false);
  const [hasServerConsent, setHasServerConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    gameService.getServerConsent().then(consented => {
      if (isMounted && consented) {
        setHasServerConsent(true);
      }
    });
    return () => { isMounted = false; };
  }, [isOpen]);

  // If used as a modal and user already consented or not open, don't render modal
  if (!isPage && (!isOpen || hasServerConsent)) {
    return null;
  }

  const handleConfirm = async () => {
    if (!agreedTerms || !agreedData || submitting) return;
    setSubmitting(true);
    setErrorMsg('');

    try {
      await gameService.saveServerConsent('2.0');
      setHasServerConsent(true);

      if (onConsentGranted) {
        onConsentGranted();
      } else if (redirectTo) {
        navigate(redirectTo);
      }
    } catch (e) {
      console.warn('Consent recording error:', e);
      // Fallback: save local consent so participant is never stuck
      gameService.recordLocalConsent('2.0');
      setHasServerConsent(true);
      if (onConsentGranted) {
        onConsentGranted();
      } else if (redirectTo) {
        navigate(redirectTo);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelClick = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  const content = (
    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="h-12 w-12 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            Cognitive Assessment Consent
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Informed participation and secure data storage policy
          </p>
        </div>
      </div>

      <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-h-60 overflow-y-auto pr-2">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-primary-500" />
            1. Non-Diagnostic Screening Aid
          </div>
          <p className="text-muted text-xs">
            All cognitive screening measures (Word Recall, Image Recall, Reaction Time, and Memory Match)
            use provisional normative approximations. Screening aid only, not a medical diagnosis.
          </p>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Lock className="h-4 w-4 text-emerald-500" />
            2. Secure Server Storage & Pseudonymisation
          </div>
          <p className="text-muted text-xs">
            All trial latencies, response metrics, and error rates are transmitted over protected
            channels and stored pseudonymised at rest on our secure servers. No clinical trial data
            is retained in browser localStorage.
          </p>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-blue-500" />
            3. Longitudinal Tracking & Practice Controls
          </div>
          <p className="text-muted text-xs">
            Sessions rotate alternate forms without repetition to account for learning effects.
            Participation is voluntary, and you may review or withdraw consent at any time.
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <label className="flex items-start space-x-3 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={agreedTerms}
            onChange={(e) => setAgreedTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span>
            I understand that these cognitive assessments are for <strong>screening only</strong> and do not constitute a medical diagnosis.
          </span>
        </label>

        <label className="flex items-start space-x-3 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={agreedData}
            onChange={(e) => setAgreedData(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span>
            I consent to the <strong>secure server storage and scientific analysis</strong> of my pseudonymised session metrics.
          </span>
        </label>
      </div>

      {errorMsg && (
        <p className="text-xs text-rose-500 font-medium">{errorMsg}</p>
      )}

      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={handleCancelClick}
          className="btn-outline py-2 px-4 text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!agreedTerms || !agreedData || submitting}
          className="btn-primary py-2 px-6 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {submitting ? 'Recording Consent...' : 'I Agree & Continue'}
        </button>
      </div>
    </div>
  );

  if (isPage) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      {content}
    </div>
  );
}
