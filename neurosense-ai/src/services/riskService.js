import { gameService } from './gameService';
import { COGNITIVE_ASSESSMENT_CONFIG } from '../config/cognitiveConfig';

export const riskService = {
  /**
   * Calculate transparent, multi-domain cognitive and clinical risk metrics
   * Distinguishes clinical medical baseline, game-based performance, and speech biomarkers.
   * Does NOT penalize uncompleted modules with zero scores.
   */
  calculateRisk(user) {
    if (!user) {
      return { 
        riskLevel: 'Unknown', 
        score: 0, 
        details: [], 
        cognitiveDomains: {},
        isDiagnostic: false,
        disclaimer: COGNITIVE_ASSESSMENT_CONFIG.clinicalNotice 
      };
    }
    
    const logs = gameService.getUserLogs() || [];
    const reactionRecords = gameService.getReactionTimeHistory() || [];
    
    let baselineScore = 0;
    const details = [];
    const suggestions = [];
    
    // -------------------------------------------------------------------------
    // 1. Clinical Baseline Factors (Medical & Demographic History)
    // -------------------------------------------------------------------------
    const age = parseInt(user.age) || parseInt(user.lifestyle?.Age) || 0;
    if (age > 75) { 
      baselineScore += 15; 
      details.push({ label: 'Age Factor', impact: 'Moderate', desc: 'Age > 75 is an established non-modifiable epidemiological risk factor.' }); 
    } else if (age > 60) { 
      baselineScore += 10; 
      details.push({ label: 'Age Factor', impact: 'Low', desc: 'Age > 60 noted as standard screening demographic baseline.' }); 
    }

    const conditions = (user && typeof user.conditions === 'object' && user.conditions !== null) ? user.conditions : {};
    if (conditions.stroke) { 
      baselineScore += 20; 
      details.push({ label: 'Vascular / Stroke History', impact: 'High', desc: 'Prior cerebrovascular event is a primary clinical indicator.' }); 
    }
    if (conditions.heartDisease) baselineScore += 10;
    if (conditions.diabetes) baselineScore += 10;
    if (conditions.hypertension) baselineScore += 5;
    if (conditions.depression) baselineScore += 5;
    
    const medCount = Object.values(conditions).filter(Boolean).length;
    if (medCount > 0 && !conditions.stroke) {
      details.push({ 
        label: 'Vascular Comorbidities', 
        impact: medCount > 2 ? 'Moderate' : 'Low', 
        desc: `${medCount} self-reported vascular risk factors.` 
      });
    }

    if (user.familyHistory === 'yes' || user.familyHistory === 1 || user.lifestyle?.FamilyHistoryAlzheimers === 1) {
      baselineScore += 15;
      details.push({ label: 'Family History', impact: 'Moderate', desc: 'First-degree familial cognitive history reported.' });
    }

    // Lifestyle metrics
    const lifestyle = (user && typeof user.lifestyle === 'object' && user.lifestyle !== null) ? user.lifestyle : {};
    if (lifestyle.sleep === 'poor' || (lifestyle.SleepQuality && lifestyle.SleepQuality < 5)) { 
      baselineScore += 8; 
      suggestions.push({ title: 'Sleep Architecture', desc: 'Target 7-8 hours of regular sleep to promote glymphatic clearance and memory consolidation.' }); 
    }
    if (lifestyle.smoking === 'yes' || lifestyle.Smoking === 1) { 
      baselineScore += 10; 
      suggestions.push({ title: 'Smoking Cessation', desc: 'Cessation reduces neurovascular inflammation and microvascular damage.' });
    }
    if (lifestyle.activity === 'low' || (lifestyle.PhysicalActivity !== undefined && lifestyle.PhysicalActivity < 3)) { 
      baselineScore += 8; 
      suggestions.push({ title: 'Aerobic Exercise', desc: 'Aim for 150 mins weekly of moderate physical exercise to stimulate neuroplasticity (BDNF).' });
    }

    // -------------------------------------------------------------------------
    // 2. Separate Game-Based Cognitive Assessment Metrics
    // -------------------------------------------------------------------------
    const cognitiveDomains = {
      wordRecall: null,
      imageRecall: null,
      memoryMatch: null,
      reactionTime: null
    };

    // Analyze Word Recall
    const wordSessions = logs.filter(l => l.gameType && l.gameType.toLowerCase().includes('word'));
    if (wordSessions.length > 0) {
      const latest = wordSessions[wordSessions.length - 1];
      cognitiveDomains.wordRecall = {
        name: 'Verbal Retention',
        status: 'Completed',
        score: latest.score,
        immediateCorrect: latest.metadata?.immediateCorrect,
        delayedCorrect: latest.metadata?.delayedCorrect,
        totalWords: latest.metadata?.totalWords || 10,
        completedSessions: wordSessions.length
      };
    }

    // Analyze Image Recall
    const imageSessions = logs.filter(l => l.gameType && l.gameType.toLowerCase().includes('image'));
    if (imageSessions.length > 0) {
      const latest = imageSessions[imageSessions.length - 1];
      cognitiveDomains.imageRecall = {
        name: 'Visuospatial Working Memory',
        status: 'Completed',
        score: latest.score,
        forwardSpan: latest.metadata?.inOrderMatches,
        completedSessions: imageSessions.length
      };
    }

    // Analyze Memory Match
    const memorySessions = logs.filter(l => l.gameType && l.gameType.toLowerCase().includes('memory'));
    if (memorySessions.length > 0) {
      const latest = memorySessions[memorySessions.length - 1];
      cognitiveDomains.memoryMatch = {
        name: 'Paired Associates',
        status: 'Completed',
        score: latest.score,
        errors: latest.errors !== undefined ? latest.errors : latest.metadata?.errors,
        moves: latest.metadata?.moves,
        completedSessions: memorySessions.length
      };
    }

    // Analyze Reaction Time
    if (reactionRecords.length > 0) {
      const latest = reactionRecords[reactionRecords.length - 1];
      cognitiveDomains.reactionTime = {
        name: 'Processing Speed',
        status: 'Completed',
        score: latest.score,
        meanMs: latest.avgReactionTimeMs,
        variabilityMs: latest.variabilityMs,
        falseStarts: latest.falseStarts,
        completedSessions: reactionRecords.length
      };
    }

    // Count completed distinct cognitive modules
    const completedModules = Object.values(cognitiveDomains).filter(d => d !== null);
    const completedCount = completedModules.length;

    let cognitiveRiskAdjustment = 0;
    let cognitiveAssessmentStatus = 'INCOMPLETE';

    if (completedCount >= 2) {
      // Calculate average standardized score across COMPLETED modules only
      const avgCognitiveScore = completedModules.reduce((acc, m) => acc + m.score, 0) / completedCount;

      if (avgCognitiveScore < 45) {
        cognitiveRiskAdjustment = +20;
        details.push({ 
          label: 'Cognitive Task Performance', 
          impact: 'Moderate', 
          desc: `Lower performance across ${completedCount} completed screening exercises.` 
        });
      } else if (avgCognitiveScore >= 80) {
        cognitiveRiskAdjustment = -15; // Protective
        details.push({ 
          label: 'Cognitive Task Performance', 
          impact: 'Protective', 
          desc: `Strong performance across ${completedCount} screening exercises mitigates baseline risk.` 
        });
      } else {
        details.push({ 
          label: 'Cognitive Task Performance', 
          impact: 'Neutral', 
          desc: `Consistent screening scores within normative expectations (${completedCount} exercises).` 
        });
      }
      cognitiveAssessmentStatus = completedCount >= 3 ? 'ROBUST' : 'PROVISIONAL';
    } else {
      suggestions.push({ 
        title: 'Cognitive Testing Incomplete', 
        desc: `Complete at least 3 cognitive games to enable a multi-measure psychometric risk composite. (Currently: ${completedCount}/4 completed)` 
      });
    }

    const compositeScore = Math.max(0, baselineScore + cognitiveRiskAdjustment);

    // Non-diagnostic risk band assignment
    let riskLevel = 'Low';
    let explanation = '';

    if (compositeScore >= 60) {
      riskLevel = 'High';
      explanation = completedCount >= 2
        ? "Evaluation indicates higher relative risk based on medical history combined with preliminary cognitive assessment metrics."
        : "Evaluation indicates higher relative risk based strictly on medical history and lifestyle survey indicators.";
    } else if (compositeScore >= 30) {
      riskLevel = 'Medium';
      explanation = completedCount >= 2
        ? "Evaluation indicates moderate risk across reported health factors and completed cognitive exercises."
        : "Evaluation indicates moderate baseline risk based on reported clinical factors.";
    } else {
      riskLevel = 'Low';
      explanation = "Evaluation indicates lower relative risk across screening parameters.";
    }

    return {
      riskLevel,
      score: compositeScore,
      baselineScore,
      cognitiveRiskAdjustment,
      completedModulesCount: completedCount,
      cognitiveAssessmentStatus,
      cognitiveDomains,
      details,
      suggestions,
      explanation,
      isDiagnostic: false,
      disclaimer: COGNITIVE_ASSESSMENT_CONFIG.clinicalNotice
    };
  }
};
