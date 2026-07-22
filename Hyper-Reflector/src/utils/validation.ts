import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity'
import i18n from '../i18n'

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
})

export type NameValidationOptions = {
  min?: number
  max?: number
  label?: string
}

const NAME_PATTERN = /^[a-zA-Z0-9 _\-]+$/

export function validateName(value: string, opts: NameValidationOptions = {}): string | null {
  const { min = 2, max = 16, label = i18n.t('validation.labelName') } = opts
  const trimmed = value.trim()
  if (!trimmed) return i18n.t('validation.required', { label })
  if (trimmed.length < min) return i18n.t('validation.minLength', { min })
  if (trimmed.length > max) return i18n.t('validation.maxLength', { max })
  if (!NAME_PATTERN.test(trimmed)) return i18n.t('validation.invalidChars')
  if (matcher.hasMatch(trimmed)) return i18n.t('validation.inappropriateName')
  return null
}
