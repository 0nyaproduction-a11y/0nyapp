import React, { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import {
  createTypography,
  type AppLanguage,
} from "../theme/tokens";
import {
  getAppLanguagePreference,
  setAppLanguagePreference,
  type StoredAppLanguage,
} from "./settingsPreferences";

export type { AppLanguage };

// Typography prototype test translations for representative screens.
// Strictly isolated to prototype demonstration strings; CMS metadata remains untranslated.
const HINDI_PROTOTYPE_STRINGS: Record<string, string> = {
  // Navigation / Tabs
  "nav.home": "होम",
  "nav.explore": "एक्सप्लोर",
  "nav.profile": "प्रोफ़ाइल",

  // Home (app-owned labels)
  "home.spotlight": "चुनिंदा",
  "home.watch": "देखें",
  "home.continue_watching": "देखना जारी रखें",
  "home.no_history": "यहाँ जारी रखने के लिए देखना शुरू करें।",
  "home.wallet": "वॉलेट",

  // Profile / Account
  "profile.title": "प्रोफ़ाइल",
  "profile.guest_account": "अतिथि खाता",
  "profile.guest_subtitle":
    "अपने देखने के इतिहास, अनलॉक किए गए एपिसोड और कॉइन्स को सिंक रखने के लिए साइन इन करें।",
  "profile.sign_in": "साइन इन करें",
  "profile.settings": "सेटिंग्स",
  "profile.restore_sync": "रीस्टोर / सिंक",
  "profile.version": "संस्करण",
  "profile.signed_in": "साइन इन हैं",
  "profile.free_account": "मुफ़्त खाता",
  "profile.sign_out": "साइन आउट करें",
  "profile.delete_account": "खाता हटाएं",

  // Settings
  "settings.title": "सेटिंग्स",
  "settings.auto": "स्वतः",
  "settings.app_language": "ऐप भाषा",
  "settings.app_language_detail": "ऐप इंटरफ़ेस की भाषा चुनें।",
  "settings.section_playback": "प्लेबैक",
  "settings.autoplay_next": "अगला स्वतः चलाएं",
  "settings.autoplay_next_detail": "वर्तमान एपिसोड समाप्त होने पर अगला एपिसोड शुरू करें।",
  "settings.streaming_quality": "स्ट्रीमिंग गुणवत्ता",
  "settings.streaming_quality_detail": "प्लेबैक के दौरान स्वतः समायोजित होती है।",
  "settings.streaming_quality_free_detail": "हर दृश्य को अधिक स्पष्टता के साथ देखें।",
  "settings.streaming_quality_plus_detail": "चुनें कि आपकी कहानियां कितनी स्पष्ट चलें।",
  "settings.pip": "पिक्चर इन पिक्चर",
  "settings.pip_detail": "फ़ोन पर अन्य काम करते हुए भी कहानी देखते रहें।",
  "settings.section_subtitles": "सबटाइटल्स",
  "settings.default_subtitle_language": "डिफ़ॉल्ट भाषा",
  "settings.default_subtitle_detail": "उपलब्ध होने पर पसंदीदा सबटाइटल भाषा।",
  "settings.section_notifications": "सूचनाएं",
  "settings.new_releases": "नई रिलीज़",
  "settings.new_releases_detail": "नए एपिसोड और फ़िल्में आने पर सूचनाएं पाएं।",
  "settings.marketing": "मार्केटिंग",
  "settings.marketing_detail": "फ़ीचर्ड रिलीज़ और विशेष ऑफ़र के अपडेट।",
  "settings.section_parental_controls": "पैरेंटल कंट्रोल्स",
  "settings.parental_restrictions": "पैरेंटल प्रतिबंध",
  "settings.parental_restrictions_detail": "बंद होने पर, सभी सामग्री सामान्य रूप से चलती है।",
  "settings.section_privacy": "गोपनीयता",
  "settings.data_permissions": "डेटा / अनुमतियां",
  "settings.section_support_legal": "सहायता और कानूनी",
  "settings.help_support": "सहायता एवं समर्थन",
  "settings.report_content": "सामग्री समस्या की रिपोर्ट करें",
  "settings.grievance": "शिकायत / संपर्क",
  "settings.terms": "नियम एवं शर्तें",
  "settings.privacy_policy": "गोपनीयता नीति",
  "settings.section_app": "ऐप",
  "settings.version": "संस्करण",

  // Sign In
  "signin.title": "साइन इन",
  "signin.header": "0nya में साइन इन करें",
  "signin.subtitle": "जारी रखने के लिए अपना मोबाइल नंबर दर्ज करें",
  "signin.phone_label": "मोबाइल नंबर",
  "signin.phone_placeholder": "10 अंकों का मोबाइल नंबर",
  "signin.help_text": "आपका नंबर आपके 0nya खाते की पुष्टि के लिए उपयोग किया जाता है।",
  "signin.get_otp": "ओटीपी प्राप्त करें",
  "signin.verify_otp": "ओटीपी सत्यापित करें",
  "signin.enter_code": "कोड दर्ज करें",
  "signin.resend_code": "कोड पुनः भेजें",
  "signin.continue": "जारी रखें",

  // Explore
  "explore.search_placeholder": "सीरीज़, फ़िल्में, जॉनर खोजें...",
  "explore.all": "सभी",
  "explore.micro_dramas": "माइक्रो ड्रामा",
  "explore.short_films": "लघु फ़िल्में",
  "explore.discover": "खोजें",
  "explore.micro_drama_tag": "माइक्रो ड्रामा",
  "explore.short_film_tag": "लघु फ़िल्म",
  "explore.browse_by_genre": "जॉनर अनुसार ब्राउज़ करें",
  "explore.trending": "ट्रेंडिंग",
  "explore.recent_searches": "हाल की खोजें",

  // Short Film Detail
  "shortfilm.watch_now": "अभी देखें",
  "shortfilm.resume": "देखना जारी रखें",
  "shortfilm.share": "शेयर करें",
  "shortfilm.type_badge": "लघु फ़िल्म",
  "shortfilm.directed_by": "निर्देशन:",
  "shortfilm.more_like_this": "इस जैसी और फ़िल्में",
};

type AppLanguageContextValue = {
  language: AppLanguage;
  setLanguage: (nextLanguage: AppLanguage) => void;
  typography: ReturnType<typeof createTypography>;
  t: (key: string, fallback: string) => string;
};

const AppLanguageContext = createContext<AppLanguageContextValue>({
  language: "en",
  setLanguage: () => {},
  typography: createTypography("en"),
  t: (_key, fallback) => fallback,
});

export function AppLanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<AppLanguage>("en");

  useEffect(() => {
    let isActive = true;
    void getAppLanguagePreference().then((stored) => {
      if (isActive && (stored === "en" || stored === "hi")) {
        setLanguageState(stored);
      }
    });
    return () => {
      isActive = false;
    };
  }, []);

  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    void setAppLanguagePreference(nextLanguage);
  };

  const typography = createTypography(language);

  const t = (key: string, fallback: string) => {
    if (language === "hi" && HINDI_PROTOTYPE_STRINGS[key]) {
      return HINDI_PROTOTYPE_STRINGS[key];
    }
    return fallback;
  };

  return (
    <AppLanguageContext.Provider
      value={{
        language,
        setLanguage,
        typography,
        t,
      }}
    >
      {children}
    </AppLanguageContext.Provider>
  );
}

export function useAppLanguage() {
  return useContext(AppLanguageContext);
}
