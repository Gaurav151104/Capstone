import React from 'react';
import CognitiveConsentModal from '../../components/CognitiveConsentModal';

export default function CognitiveConsentPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <CognitiveConsentModal
        isOpen={true}
        isPage={true}
        redirectTo="/dashboard/games"
      />
    </div>
  );
}
