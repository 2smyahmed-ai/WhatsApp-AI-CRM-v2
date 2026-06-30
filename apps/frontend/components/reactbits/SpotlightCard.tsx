'use client'

import { useRef, ReactNode, MouseEvent } from 'react'

interface SpotlightCardProps {
  children: ReactNode
  className?: string
  spotlightColor?: string
}

export default function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(37, 211, 102, 0.12)',
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    card.style.setProperty('--mouse-x', `${x}%`)
    card.style.setProperty('--mouse-y', `${y}%`)
    card.style.setProperty('--spotlight-color', spotlightColor)
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`spotlight-card ${className}`}
      style={
        {
          '--mouse-x': '50%',
          '--mouse-y': '50%',
          '--spotlight-color': spotlightColor,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}
