import { gameService } from './gameService';

export const riskService = {
  calculateRisk(user) {
    if (!user) return { riskLevel: 'Unknown', score: 0, details: [] };
    
    const logs = gameService.getUserLogs() || [];
    const hasGameData = logs.length > 0;
    
    let baselineScore = 0;
    const details = [];
    const suggestions = [];
    
    // 1. Age Factor
    const age = parseInt(user.age) || 0;
    if (age > 75) { baselineScore += 15; details.push({ label: 'Age Factor', impact: 'High', desc: 'Age > 75 increases baseline risk.' }); }
    else if (age > 60) { baselineScore += 10; details.push({ label: 'Age Factor', impact: 'Moderate', desc: 'Age > 60 increases baseline risk.' }); }

    // 2. Medical Conditions (Checkboxes)
    const conditions = user.conditions || {};
    if (conditions.stroke) { baselineScore += 20; details.push({ label: 'Stroke History', impact: 'High', desc: 'Prior stroke is a significant clinical indicator.' }); }
    if (conditions.heartDisease) { baselineScore += 10; }
    if (conditions.diabetes) { baselineScore += 10; }
    if (conditions.hypertension) { baselineScore += 5; }
    if (conditions.depression) { baselineScore += 5; }
    
    const medCount = Object.values(conditions).filter(Boolean).length;
    if (medCount > 0 && !conditions.stroke) {
      details.push({ label: 'Comorbidities', impact: medCount > 2 ? 'High' : 'Moderate', desc: `${medCount} indicated underlying medical conditions.` });
    }

    // 3. Family History
    if (user.familyHistory === 'yes') {
      baselineScore += 15;
      details.push({ label: 'Family History', impact: 'High', desc: 'Genetic predisposition noted.' });
    }

    // 4. Lifestyle
    const lifestyle = user.lifestyle || {};
    if (lifestyle.sleep === 'poor') { 
      baselineScore += 10; 
      suggestions.push({ title: 'Sleep Hygiene', desc: 'Target 7-8 hours of sleep to improve memory consolidation.' }); 
    }
    if (lifestyle.smoking === 'yes') { baselineScore += 10; suggestions.push({ title: 'Smoking Cessation', desc: 'Quitting smoking significantly improves vascular brain health.' });}
    if (lifestyle.alcohol === 'yes') { baselineScore += 5; }
    if (lifestyle.activity === 'low') { 
      baselineScore += 10; 
      suggestions.push({ title: 'Physical Activity', desc: 'Incorporate 30 mins of moderate aerobic exercise daily.' });
    }

    // 5. Cognitive Symptoms
    const symptoms = user.symptoms || {};
    let sympCount = 0;
    if (symptoms.forgetfulness) { baselineScore += 10; sympCount++; }
    if (symptoms.concentration) { baselineScore += 10; sympCount++; }
    if (symptoms.speech) { baselineScore += 15; sympCount++; }
    
    if (sympCount > 0) {
      details.push({ label: 'Subjective Symptoms', impact: 'High', desc: `${sympCount} self-reported cognitive concerns.` });
      suggestions.push({ title: 'Medical Consultation', desc: 'Discuss your reported cognitive symptoms with a physician.' });
    }

    // Combine Game Logs if available
    let compositeScore = baselineScore;
    
    if (hasGameData) {
      // Calculate average game performance (simple metric)
      const avgGameScore = logs.reduce((acc, log) => acc + log.score, 0) / logs.length;
      
      if (avgGameScore < 40) {
        compositeScore += 20; // Poor performance penalty
        details.push({ label: 'Game Performance', impact: 'High', desc: 'Below average assessment scores.' });
      } else if (avgGameScore > 80) {
        compositeScore = Math.max(0, compositeScore - 20); // Excellent performance bonus deduction
        details.push({ label: 'Game Performance', impact: 'Positive', desc: 'Above average assessment scores mitigate baseline risks.' });
      } else {
        details.push({ label: 'Game Performance', impact: 'Neutral', desc: 'Consistent baseline assessment scores.' });
      }
      
      suggestions.push({ title: 'Continue Training', desc: 'Regular cognitive assessment stabilizes our predictive accuracy.' });
    } else {
      suggestions.push({ title: 'Cognitive Baseline', desc: 'Play your first games on the Dashboard to generate a dynamic risk composite.' });
    }

    // Thresholds
    // Max theoretic baseline is around ~120
    let riskLevel = 'Low';
    let explanation = '';
    
    if (compositeScore >= 60) {
      riskLevel = 'High';
      explanation = hasGameData 
        ? "Based on your clinical baseline and supported by recent cognitive task assessments, you show high risk indicators."
        : "Based strictly on your submitted medical history and lifestyle, you show high clinical risk indicators.";
    } else if (compositeScore >= 30) {
      riskLevel = 'Medium';
      explanation = hasGameData 
        ? "Your combined medical and activity profiles indicate moderate risk."
        : "Based on your medical history and lifestyle, you show moderate risk indicators.";
    } else {
      riskLevel = 'Low';
      explanation = hasGameData 
        ? "Your clinical profile and strong assessment scores reflect low risk."
        : "Your medical history indicates a low probability baseline risk.";
    }
    
    // Fill up empty details if user is completely healthy
    if (details.length === 0) {
      details.push({ label: 'Clinical Health', impact: 'Positive', desc: 'No significant risk factors reported in survey.' });
    }

    if (suggestions.length === 0) {
      suggestions.push({ title: 'Maintain Lifestyle', desc: 'Keep up your current healthy habits and consider preventative monitoring.' });
    }

    return {
      riskLevel,
      score: compositeScore,
      isComposite: hasGameData,
      explanation,
      details,
      suggestions
    };
  }
};
