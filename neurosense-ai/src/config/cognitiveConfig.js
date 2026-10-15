/**
 * NeuroSense-AI — Cognitive Assessment Central Configuration
 *
 * Evidence-based task lengths, exposure durations, timing bounds,
 * and psychometric scoring parameters for cognitive screening modules.
 *
 * CLINICAL NOTICE:
 * This software is a preliminary cognitive screening and brain training tool,
 * NOT a medical diagnostic device. Performance metrics reflect provisional normative
 * approximations. Clinically validated protocols require supervised administration
 * against established diagnostic batteries (such as MoCA or MMSE) and demographic-matched cohorts.
 */

export const COGNITIVE_ASSESSMENT_CONFIG = {
  // Global Disclaimer Notice
  clinicalNotice: "Screening aid only, not a medical diagnosis. Provisional normative approximations.",

  // 1. Word Recall (Verbal Episodic Memory)
  // Rationale: Based on validated verbal list-learning paradigms (ADAS-Cog 10-word list,
  // Rey Auditory Verbal Learning Test / RAVLT, and MoCA 5-word delayed recall).
  // Words are controlled for high concreteness, imageability, and balanced semantic domains.
  wordRecall: {
    presentationCount: 5,                  // Number of words presented in the standard protocol
    shortScreeningCount: 5,                // Short screening variant (MoCA-aligned)
    exposureDurationPerWordMs: 2000,       // 2.0 seconds per word (standard pacing)
    distractorDurationSeconds: 15,         // 15-second interference interval before delayed recall
    recallTimeLimitSeconds: 60,            // 60-second time window for recall entry
    minValidWords: 3,                      // Minimum responses required for valid assessment
    weights: {
      immediateRecall: 0.40,
      delayedRecall: 0.60
    },
    evidenceRationale: "Aligned with ADAS-Cog 10-word list and MoCA verbal delayed recall protocols."
  },

  // 2. Image Recall (Visuospatial Working Memory)
  // Rationale: Based on Corsi Block-Tapping forward spatial span and visual pattern recognition.
  // Healthy adult normative forward span is ~5 +/- 1 items (Miller 1956, Cowan 2001).
  imageRecall: {
    difficulties: {
      easy: { spanLength: 4, countdownSeconds: 4, label: 'Easy (4 items)' },
      medium: { spanLength: 5, countdownSeconds: 5, label: 'Standard (5 items)' },
      hard: { spanLength: 6, countdownSeconds: 7, label: 'Challenging (6 items)' }
    },
    defaultDifficulty: 'medium',
    availableChoiceCount: 12,              // Total choices presented during recognition (target + distractors)
    exposureDurationPerItemMs: 1000,       // 1.0s exposure per item in sequential mode
    evidenceRationale: "Adapted from Corsi Block-Tapping forward spatial span (normative healthy capacity 5 +/- 1)."
  },

  // 3. Memory Match (Visuospatial Paired Associate Learning)
  // Rationale: Derived from paired associate learning paradigms (Benton Visual Retention,
  // UK Biobank Pairs Matching). Assesses working memory, search efficiency, and error accumulation.
  memoryMatch: {
    grids: {
      small: { rows: 3, cols: 4, pairCount: 6, label: 'Small (4x3 - 6 pairs)' },
      large: { rows: 4, cols: 4, pairCount: 8, label: 'Standard (4x4 - 8 pairs)' }
    },
    defaultGrid: 'small',
    maxTestDurationMs: 180000,             // 3 minutes maximum duration before session timeout
    cardFlipDelayMs: 900,                  // Delay before non-matching cards flip back
    evidenceRationale: "Adapted from UK Biobank visual paired associate matching; tracks error rate and completion moves."
  },

  // 4. Reaction Time (Simple Visual Reaction Time - SRT)
  // Rationale: Based on Deary-Liewald simple reaction time protocol. Random inter-stimulus interval (ISI)
  // between 1500ms and 3500ms prevents predictive rhythm strategies.
  // Responses <150ms represent physiologically implausible anticipations / false starts.
  reactionTime: {
    numPracticeTrials: 3,                  // Practice trials to familiarize participant
    numTestTrials: 10,                     // Test trials for reliable mean and intra-individual variability (SD)
    minDelayMs: 1500,                      // Minimum foreperiod delay (ms)
    maxDelayMs: 3500,                      // Maximum foreperiod delay (ms)
    prematureClickThresholdMs: 150,        // Physiological anticipation cutoff (<150ms)
    lapseThresholdMs: 1000,                // Attentional lapse threshold (>1000ms)
    evidenceRationale: "Based on Deary-Liewald SRT paradigm; uses variable 1.5-3.5s foreperiod and 150ms physiological threshold."
  },

  // 5. Composite Psychometric Gating
  scoring: {
    minMeasuresForComposite: 3,            // Minimum completed valid measures required for composite score
    weights: {
      word_recall_immediate: 0.25,
      word_recall_delayed: 0.30,
      image_recall_forward_span: 0.25,
      reaction_time_mean_ms: 0.06,
      reaction_time_sd_ms: 0.04,
      memory_match_errors: 0.10
    }
  }
};
