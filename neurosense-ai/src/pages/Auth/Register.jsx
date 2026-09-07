import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useApp } from '../../hooks/useApp';
import { BrainCircuit, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import ThemeLanguageToggle from '../../components/ThemeLanguageToggle';
import { validateRegisterStep1 } from '../../utils/validation';
import { getFromStorage } from '../../services/api';

export default function Register() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  
  const { register } = useAuth();
  const { t } = useApp();
  const navigate = useNavigate();

  // Step 1 State: PII
  const [pii, setPii] = useState({ name: '', email: '', password: '', age: '' });
  
  // Step 2 State: Medical
  const [conditions, setConditions] = useState({ diabetes: false, hypertension: false, heartDisease: false, stroke: false, depression: false });
  const [medications, setMedications] = useState('');
  const [familyHistory, setFamilyHistory] = useState(''); 
  const [familyHistorySpec, setFamilyHistorySpec] = useState('');
  const [lifestyle, setLifestyle] = useState({ sleep: '', smoking: '', alcohol: '', activity: '' });
  const [symptoms, setSymptoms] = useState({ forgetfulness: false, concentration: false, speech: false });
  const [hasScanReport, setHasScanReport] = useState('');
  const [scanFile, setScanFile] = useState(null);

  // Handlers
  const handleNext = () => {
    const existingUsers = getFromStorage('neurosense_users', []) || [];
    const existingEmails = existingUsers.map(u => (u.email || '').toLowerCase());
    
    const validation = validateRegisterStep1(pii, existingEmails);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setError('Please review and resolve the errors below.');
      return;
    }
    setFieldErrors({});
    setError('');
    setStep(2);
  };

  const handleCheckbox = (setter) => (e) => {
    setter(prev => ({ ...prev, [e.target.name]: e.target.checked }));
  };

  const handleRadio = (setter) => (e) => {
    setter(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!familyHistory || !lifestyle.sleep || !lifestyle.smoking || !lifestyle.alcohol || !lifestyle.activity || !hasScanReport) {
      setError('Please complete all mandatory lifestyle, history, and scan report selections.');
      window.scrollTo(0,0);
      return;
    }

    if (hasScanReport === 'yes' && !scanFile) {
      setError('Please upload your scan report if you selected Yes.');
      window.scrollTo(0,0);
      return;
    }

    setLoading(true);
    
    const payload = {
      ...pii,
      conditions,
      medications,
      familyHistory,
      familyHistorySpec: familyHistory === 'yes' ? familyHistorySpec : '',
      lifestyle,
      symptoms,
      hasScanReport,
      scanFileName: scanFile ? scanFile.name : null
    };
    
    try {
      await register(payload);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200 relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeLanguageToggle />
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary-50 dark:bg-primary-900/30 mb-4 shadow-sm border border-primary-100 dark:border-primary-900/30">
            <BrainCircuit className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">{t.create_account}</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {step === 1 ? t.step_1_desc : t.step_2_desc}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow-xl border border-slate-100 dark:border-slate-800 sm:rounded-2xl sm:px-10 transition-colors">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-100 dark:border-red-900/30 font-medium">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t.full_name}</label>
                <input
                  type="text"
                  value={pii.name}
                  onChange={e => {
                    setPii({...pii, name: e.target.value});
                    if (fieldErrors.name) setFieldErrors({...fieldErrors, name: ''});
                  }}
                  className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border ${fieldErrors.name ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'} text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow`}
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {fieldErrors.name}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t.email}</label>
                <input
                  type="email"
                  value={pii.email}
                  onChange={e => {
                    setPii({...pii, email: e.target.value});
                    if (fieldErrors.email) setFieldErrors({...fieldErrors, email: ''});
                  }}
                  className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border ${fieldErrors.email ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'} text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow`}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {fieldErrors.email}
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t.age}</label>
                  <input
                    type="number" min="1" max="120"
                    value={pii.age}
                    onChange={e => {
                      setPii({...pii, age: e.target.value});
                      if (fieldErrors.age) setFieldErrors({...fieldErrors, age: ''});
                    }}
                    className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border ${fieldErrors.age ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'} text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow`}
                  />
                  {fieldErrors.age && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {fieldErrors.age}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t.password}</label>
                  <input
                    type="password"
                    value={pii.password}
                    onChange={e => {
                      setPii({...pii, password: e.target.value});
                      if (fieldErrors.password) setFieldErrors({...fieldErrors, password: ''});
                    }}
                    className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border ${fieldErrors.password ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'} text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow`}
                  />
                  {fieldErrors.password && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {fieldErrors.password}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-8 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t.already_account} <Link to="/login" className="text-primary-600 dark:text-primary-400 font-bold hover:underline">{t.login}</Link>
                </p>
                <button onClick={handleNext} className="btn-primary py-3 px-8 flex items-center">
                  {t.next} <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-8">
              
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">{t.existing_conditions}</h3>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {['diabetes', 'hypertension', 'heartDisease', 'stroke', 'depression'].map(key => (
                    <label key={key} className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <input type="checkbox" name={key} checked={conditions[key]} onChange={handleCheckbox(setConditions)} className="h-5 w-5 rounded text-primary-600 focus:ring-primary-500 border-slate-300 dark:border-slate-600 dark:bg-slate-800" />
                      <span className="text-slate-700 dark:text-slate-200 capitalize text-sm font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                 <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t.current_meds}</label>
                 <textarea value={medications} onChange={e => setMedications(e.target.value)} rows="2" className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-primary-500 outline-none" placeholder="..." />
              </div>

              <div>
                 <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t.family_dementia} <span className="text-red-500">*</span></h3>
                 <div className="flex space-x-6">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="radio" name="family" value="yes" checked={familyHistory === 'yes'} onChange={() => setFamilyHistory('yes')} className="h-5 w-5 text-primary-600 focus:ring-primary-500 dark:bg-slate-800 dark:border-slate-600" />
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{t.yes}</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="radio" name="family" value="no" checked={familyHistory === 'no'} onChange={() => setFamilyHistory('no')} className="h-5 w-5 text-primary-600 focus:ring-primary-500 dark:bg-slate-800 dark:border-slate-600" />
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{t.no}</span>
                    </label>
                 </div>
                 {familyHistory === 'yes' && (
                    <input type="text" value={familyHistorySpec} onChange={(e) => setFamilyHistorySpec(e.target.value)} placeholder="..." className="w-full mt-3 px-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg outline-none focus:ring-1 focus:ring-primary-500" />
                 )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">{t.lifestyle_factors}</h3>
                <div className="space-y-4 mt-3">
                  <div>
                    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t.sleep_quality} <span className="text-red-500">*</span></span>
                    <div className="flex space-x-4">
                       {['good', 'average', 'poor'].map(val => (
                         <label key={val} className="flex items-center space-x-2">
                            <input type="radio" name="sleep" value={val} checked={lifestyle.sleep === val} onChange={handleRadio(setLifestyle)} className="h-4 w-4 text-primary-600 dark:bg-slate-800 dark:border-slate-600" />
                            <span className="text-slate-600 dark:text-slate-400 capitalize text-sm">{val}</span>
                         </label>
                       ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t.smoke_q} <span className="text-red-500">*</span></span>
                      <div className="flex space-x-4">
                         {['yes', 'no'].map(val => <label key={val} className="flex items-center space-x-2"><input type="radio" name="smoking" value={val} checked={lifestyle.smoking === val} onChange={handleRadio(setLifestyle)} className="h-4 w-4 text-primary-600 dark:bg-slate-800 dark:border-slate-600" /><span className="text-slate-600 dark:text-slate-400 capitalize text-sm">{t[val] || val}</span></label>)}
                      </div>
                    </div>
                    <div>
                      <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t.alcohol_q} <span className="text-red-500">*</span></span>
                      <div className="flex space-x-4">
                         {['yes', 'no'].map(val => <label key={val} className="flex items-center space-x-2"><input type="radio" name="alcohol" value={val} checked={lifestyle.alcohol === val} onChange={handleRadio(setLifestyle)} className="h-4 w-4 text-primary-600 dark:bg-slate-800 dark:border-slate-600" /><span className="text-slate-600 dark:text-slate-400 capitalize text-sm">{t[val] || val}</span></label>)}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t.activity_level} <span className="text-red-500">*</span></span>
                    <div className="flex space-x-6">
                       {['low', 'medium', 'high'].map(val => (
                         <label key={val} className="flex items-center space-x-2">
                            <input type="radio" name="activity" value={val} checked={lifestyle.activity === val} onChange={handleRadio(setLifestyle)} className="h-4 w-4 text-primary-600 dark:bg-slate-800 dark:border-slate-600" />
                            <span className="text-slate-600 dark:text-slate-400 capitalize text-sm">{t[val] || val}</span>
                         </label>
                       ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">{t.recent_cog_symptoms}</h3>
                <div className="space-y-2 mt-3">
                  {['forgetfulness', 'concentration', 'speech'].map(key => (
                    <label key={key} className="flex items-center space-x-3 bg-red-50/50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100/50 dark:border-red-900/30 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <input type="checkbox" name={key} checked={symptoms[key]} onChange={handleCheckbox(setSymptoms)} className="h-5 w-5 rounded text-red-600 focus:ring-red-500 border-slate-300 dark:border-slate-600 dark:bg-slate-800" />
                      <span className="text-slate-700 dark:text-slate-300 capitalize text-sm font-medium">{key === 'concentration' ? 'Difficulty Concentrating' : key === 'speech' ? 'Speech Problems' : key}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                 <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t.mri_reports} <span className="text-red-500">*</span></h3>
                 <div className="flex space-x-6">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="radio" name="scanReport" value="yes" checked={hasScanReport === 'yes'} onChange={() => setHasScanReport('yes')} className="h-5 w-5 text-primary-600 focus:ring-primary-500 dark:bg-slate-800 dark:border-slate-600" />
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{t.yes}</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="radio" name="scanReport" value="no" checked={hasScanReport === 'no'} onChange={() => { setHasScanReport('no'); setScanFile(null); }} className="h-5 w-5 text-primary-600 focus:ring-primary-500 dark:bg-slate-800 dark:border-slate-600" />
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{t.no}</span>
                    </label>
                 </div>
                 {hasScanReport === 'yes' && (
                    <div className="mt-3">
                      <input 
                        type="file" 
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setScanFile(e.target.files[0])} 
                        className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary-50 dark:file:bg-primary-900/40 file:text-primary-700 dark:file:text-primary-300 hover:file:bg-primary-100 dark:hover:file:bg-primary-900/60 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 rounded-xl p-2" 
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 pl-1">{t.supported_formats}</p>
                    </div>
                 )}
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button type="button" onClick={() => { setError(''); setStep(1); }} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold flex items-center px-4 py-2">
                  <ArrowLeft className="mr-2 h-4 w-4" /> {t.back}
                </button>
                <button type="submit" disabled={loading} className="btn-primary py-3 px-8 text-lg shadow-md">
                  {loading ? t.creating : t.complete_account}
                </button>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}