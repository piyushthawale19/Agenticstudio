import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Initialize i18next once for the entire app.
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    resources: {
      en: {
        translation: {},
      },
    },
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
