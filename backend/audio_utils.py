import librosa
import numpy as np
import warnings

warnings.filterwarnings('ignore')

FEATURE_NAMES = [
    'mfcc_0_mean', 'mfcc_0_std', 'mfcc_1_mean', 'mfcc_1_std', 'mfcc_2_mean', 'mfcc_2_std',
    'mfcc_3_mean', 'mfcc_3_std', 'mfcc_4_mean', 'mfcc_4_std', 'mfcc_5_mean', 'mfcc_5_std',
    'mfcc_6_mean', 'mfcc_6_std', 'mfcc_7_mean', 'mfcc_7_std', 'mfcc_8_mean', 'mfcc_8_std',
    'mfcc_9_mean', 'mfcc_9_std', 'mfcc_10_mean', 'mfcc_10_std', 'mfcc_11_mean', 'mfcc_11_std',
    'mfcc_12_mean', 'mfcc_12_std', 'pitch_mean', 'pitch_std', 'energy_mean', 'energy_std',
    'pause_count', 'pause_mean', 'pause_max', 'speech_ratio'
]

def extract_features(audio_path):
    """
    Extract exactly 34 acoustic features from the input audio file
    to correspond to the trained XGBoost / Pitt audio dataset model expectations.
    """
    # Load audio
    y, sr = librosa.load(audio_path, sr=None)
    
    # Feature 1: MFCCs (indices 0 to 12 = 13 coefficients -> 26 features)
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    
    feature_dict = {}
    
    for i in range(13):
        feature_dict[f'mfcc_{i}_mean'] = float(np.mean(mfccs[i, :]))
        feature_dict[f'mfcc_{i}_std'] = float(np.std(mfccs[i, :]))
        
    # Feature 2: Pitch (2 features)
    # Using magnitude-weighted piptrack
    pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
    pitch_values = []
    for t in range(pitches.shape[1]):
        idx = np.argmax(magnitudes[:, t])
        pitch = pitches[idx, t]
        if pitch > 0:
            pitch_values.append(pitch)
            
    if pitch_values:
        feature_dict['pitch_mean'] = float(np.mean(pitch_values))
        feature_dict['pitch_std'] = float(np.std(pitch_values))
    else:
        feature_dict['pitch_mean'] = 0.0
        feature_dict['pitch_std'] = 0.0

    # Feature 3: Energy (RMS) (2 features)
    rms = librosa.feature.rms(y=y)[0]
    feature_dict['energy_mean'] = float(np.mean(rms))
    feature_dict['energy_std'] = float(np.std(rms))
    
    # Feature 4: Pauses & Speech Ratio (4 features)
    non_silent_intervals = librosa.effects.split(y, top_db=20)
    
    total_samples = len(y)
    duration_sec = float(total_samples) / float(sr) if sr else 10.0
    speech_samples = sum([end - start for start, end in non_silent_intervals])
    
    silence_segments = []
    prev_end = 0
    for start, end in non_silent_intervals:
        if start > prev_end:
            silence_segments.append(start - prev_end)
        prev_end = end
    
    if total_samples > prev_end:
        silence_segments.append(total_samples - prev_end)
        
    silence_durations = [s / sr for s in silence_segments]
    
    raw_pause_count = float(len(silence_durations))
    # Normalize pause count to standard 60-second baseline matching the clinical Pitt corpus
    if duration_sec < 45.0:
        pause_scale = 60.0 / max(5.0, duration_sec)
        feature_dict['pause_count'] = float(raw_pause_count * pause_scale)
    else:
        feature_dict['pause_count'] = raw_pause_count
        
    feature_dict['pause_mean'] = float(np.mean(silence_durations)) if silence_durations else 0.4
    feature_dict['pause_max'] = float(np.max(silence_durations)) if silence_durations else 1.2
    feature_dict['speech_ratio'] = float(speech_samples / total_samples) if total_samples > 0 else 0.8
    
    # Store raw metric metadata for UI reporting
    feature_dict['_raw_pause_count'] = raw_pause_count
    feature_dict['_duration_sec'] = duration_sec
    
    return feature_dict
