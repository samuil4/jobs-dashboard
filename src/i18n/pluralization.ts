import type { PluralizationRule, PluralizationRulesMap } from 'vue-i18n'

const ukPluralCategories = new Intl.PluralRules('uk')

/**
 * Ukrainian needs three plural forms: one (1, 21…), few (2–4, 22–24…) and
 * many (0, 5–20, 25–30…). vue-i18n's built-in rule is English-only, so map the
 * Intl categories onto the message indexes used by our plural strings.
 */
const ukPluralRule: PluralizationRule = (choice) => {
  const category = ukPluralCategories.select(Math.abs(choice))
  if (category === 'one') return 0
  if (category === 'few') return 1
  return 2
}

export const pluralRules: PluralizationRulesMap = {
  uk: ukPluralRule,
}
