import { useTranslation } from 'react-i18next';

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  return (
    <div className="flex items-center h-7 rounded-full border border-[#7B6A9B] overflow-hidden text-[10px] sm:text-xs font-semibold flex-shrink-0">
      <button
        onClick={() => i18n.changeLanguage('en')}
        className={`px-2 sm:px-2.5 h-full transition-colors ${
          currentLang === 'en'
            ? 'bg-[#332847] text-white'
            : 'bg-transparent text-[#7B6A9B] hover:bg-[#E8E3F0]'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => i18n.changeLanguage('fr')}
        className={`px-2 sm:px-2.5 h-full transition-colors ${
          currentLang === 'fr'
            ? 'bg-[#332847] text-white'
            : 'bg-transparent text-[#7B6A9B] hover:bg-[#E8E3F0]'
        }`}
      >
        FR
      </button>
    </div>
  );
}
