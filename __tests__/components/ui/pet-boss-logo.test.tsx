import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { PetBossLogo } from '@/components/shared/pet-boss-logo'

describe('PetBossLogo UI Component Tests', () => {
  it('renders the emblem image, decorative when the wordmark is shown', () => {
    const { container } = render(<PetBossLogo size="md" variant="gold" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('image')?.getAttribute('href')).toBe('/images/logo-64.png')
  })

  it('names the emblem for screen readers when it is the only thing shown', () => {
    const { container } = render(<PetBossLogo size="md" showText={false} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-label')).toBe('نشان پت‌باس')
  })

  it('renders PET BOSS title and Persian subtitle by default', () => {
    render(<PetBossLogo size="md" variant="gold" showText={true} />)
    expect(screen.getByText('PET BOSS')).toBeDefined()
    expect(screen.getByText('کلینیک و پت شاپ')).toBeDefined()
  })

  it('renders English subtitle when subtitleEn is passed', () => {
    render(
      <PetBossLogo
        size="md"
        variant="gold"
        showText={true}
        subtitle="CLINIC & PET SHOP"
      />
    )
    expect(screen.getByText('CLINIC & PET SHOP')).toBeDefined()
  })

  it('hides text when showText is false', () => {
    render(<PetBossLogo size="xl" showText={false} />)
    expect(screen.queryByText('PET BOSS')).toBeNull()
  })
})
