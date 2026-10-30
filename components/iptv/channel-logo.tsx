'use client'

import { Tv } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ChannelLogoProps {
  src?: string
  name: string
  className?: string
  iconClassName?: string
}

export function ChannelLogo({ src, name, className, iconClassName }: ChannelLogoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = !!src && failedSrc !== src

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary',
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src || '/placeholder.svg'}
          alt={`Логотип ${name}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-contain p-[8%]"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <Tv aria-hidden="true" className={cn('h-1/2 w-1/2 text-muted-foreground', iconClassName)} />
      )}
    </div>
  )
}
