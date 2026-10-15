import { useAppContext } from '../context/AppContext';
import { translations } from '../utils/translations';

export const useApp = () => {
  const { theme, toggleTheme, language, setLanguage } = useAppContext();
  
  const t = translations[language] || translations.en || {};

  return {
    theme,
    toggleTheme,
    language,
    setLanguage,
    t
  };
};
