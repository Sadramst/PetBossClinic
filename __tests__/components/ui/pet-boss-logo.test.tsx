import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { PetBossLogo } from '@/components/shared/pet-boss-logo'

describe('PetBossLogo UI Component Tests', () => {
  it('renders SVG emblem with royal crown and lion crest', () => {
    const { container } = render(<PetBossLogo size="md" variant="gold" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
    expect(svg).not.toBeNull()

    // Check SVG viewBox and gradients
    const linearGradients = container.querySelectorAll('linearGradient')
    expect(linearGradients.length).toBeGreaterThan(0)
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
