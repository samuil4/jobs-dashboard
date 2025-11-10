import { createI18n } from 'vue-i18n'

import bg from '../locales/bg'
import en from '../locales/en'
import uk from '../locales/uk'

export const AVAILABLE_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'bg', label: 'Български' },
  { code: 'uk', label: 'Українська' },
] as const

export type LocaleCode = (typeof AVAILABLE_LOCALES)[number]['code']

function resolveLocale(): LocaleCode {
  const saved = localStorage.getItem('jobs-dashboard-locale')
  if (saved && ['en', 'bg', 'uk'].includes(saved)) {
    return saved as LocaleCode
  }

  return 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: resolveLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    bg,
    uk,
  },
})

export function setLocale(locale: LocaleCode) {
  i18n.global.locale.value = locale
  localStorage.setItem('jobs-dashboard-locale', locale)
}

