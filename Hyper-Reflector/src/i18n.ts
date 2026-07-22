import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ja from './locales/ja.json'
import { useSettingsStore } from './state/store'

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ja: { translation: ja },
    },
    lng: useSettingsStore.getState().appLanguage || 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

// Settings page writes the chosen language into the persisted store; keep
// i18next in sync whenever that value changes instead of duplicating state.
useSettingsStore.subscribe((state, prevState) => {
  if (state.appLanguage !== prevState.appLanguage) {
    void i18n.changeLanguage(state.appLanguage)
  }
})

export default i18n
