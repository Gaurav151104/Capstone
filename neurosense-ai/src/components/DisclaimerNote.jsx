import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function DisclaimerNote({ className = '', compact = false }) {
  if (compact) {
    return (
      <div className={`flex items-center gap-2 p-2.5 rounded-lg text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 ${className}`}>
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>
          <strong>Wellness Prototype:</strong> Not a medical diagnosis or clinical instrument. Results are non-diagnostic estimates. Consult a healthcare professional for clinical advice.
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 transition-colors ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="text-xs sm:text-sm space-y-1">
          <p className="font-semibold text-amber-900 dark:text-amber-100">
            Important Medical & Prototype Disclaimer
          </p>
          <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
            NeuroSense AI is designed exclusively for cognitive wellness monitoring and educational demonstration. It is <strong>not a certified clinical diagnosis or medical instrument</strong>. Scores and confidence bands are prototype estimates only. If you or a loved one have concerns regarding memory or neurological health, please consult a qualified physician or neurologist.
          </p>
        </div>
      </div>
    </div>
  );
}
