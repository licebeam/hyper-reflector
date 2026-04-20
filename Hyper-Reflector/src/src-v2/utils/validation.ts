import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity'

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
  const { min = 2, max = 16, label = 'Name' } = opts
  const trimmed = value.trim()
  if (!trimmed) return `${label} is required.`
  if (trimmed.length < min) return `At least ${min} characters required.`
  if (trimmed.length > max) return `Max ${max} characters.`
  if (!NAME_PATTERN.test(trimmed)) return 'Letters, numbers, spaces, _ and - only.'
  if (matcher.hasMatch(trimmed)) return 'Please choose a different name.'
  return null
}
