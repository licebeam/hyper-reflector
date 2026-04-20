import '/node_modules/flag-icons/css/flag-icons.min.css'

// Uses Intl.DisplayNames to resolve a 2-letter ISO 3166-1 alpha-2 code to a
// full English country name for the tooltip. Falls back to the raw code.
const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })

function getCountryName(code: string): string {
  try {
    return displayNames.of(code.toUpperCase()) || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

type CountryFlagProps = {
  code?: string | null
  /** Extra class names forwarded to the <span> */
  className?: string
}

/**
 * Renders a CSS-based country flag from the `flag-icons` package.
 * Renders nothing when the code is absent or not exactly 2 characters.
 */
export function CountryFlag({ code, className = '' }: CountryFlagProps) {
  if (!code || code.length !== 2) return null
  const lower = code.toLowerCase()
  const name = getCountryName(code)
  return (
    <span
      className={`fi fi-${lower} ${className}`}
      title={name}
      aria-label={name}
      style={{ fontSize: '1em', lineHeight: 1 }}
    />
  )
}
