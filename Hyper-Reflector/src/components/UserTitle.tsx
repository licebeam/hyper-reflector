import type { UserTitleData } from '../types'

type UserTitleProps = {
  title?: UserTitleData | null
  size?: 'xs' | 'sm'
}

export function UserTitle({ title, size = 'xs' }: UserTitleProps) {
  if (!title?.title) return null
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-medium leading-none ${size === 'sm' ? 'text-xs' : 'text-[10px]'}`}
      style={{
        background: title.bgColor || 'transparent',
        color: title.color || 'inherit',
        border: `1px solid ${title.border || 'transparent'}`,
      }}
    >
      {title.title}
    </span>
  )
}
