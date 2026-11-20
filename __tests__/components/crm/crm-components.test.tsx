import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/admin/leads',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(''), useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/app/actions/crm-customers', () => ({ loadTimelineAction: vi.fn(), assignCustomerOwnerAction: vi.fn(), quickNoteAction: vi.fn() }))

import { LeadsBoard } from '@/components/admin/crm/leads-board'
import { Timeline } from '@/components/admin/crm/timeline'
import type { LeadView } from '@/components/admin/crm/lead-drawer'

const lead = (over: Partial<LeadView>): LeadView => ({
  id: 'l1',
  name: 'سارا',
  phone: '09121234567',
  email: null,
  petType: null,
  serviceInterest: 'واکسن',
  message: null,
  source: null,
  stage: 'NEW',
  lostReason: null,
  ownerId: null,
  customerId: null,
  followUpDate: null,
  createdAt: new Date().toISOString(),
  ...over,
})

describe('LeadsBoard', () => {
  it('renders one column per stage with cards in the right column', () => {
    render(<LeadsBoard leads={[lead({}), lead({ id: 'l2', stage: 'WON', name: 'علی' })]} counts={{}} staff={[]} onOpen={vi.fn()} onMove={vi.fn()} />)
    expect(screen.getAllByTestId(/^leads-col-/)).toHaveLength(6)
    expect(screen.getByTestId('leads-col-NEW').textContent).toContain('سارا')
    expect(screen.getByTestId('leads-col-WON').textContent).toContain('علی')
  })
  it('offers only legal transitions in the move menu and reports the pick', () => {
    const onMove = vi.fn()
    render(<LeadsBoard leads={[lead({})]} counts={{}} staff={[]} onOpen={vi.fn()} onMove={onMove} />)
    const select = screen.getByTestId('lead-card-move') as HTMLSelectElement
    const values = Array.from(select.options).map((o) => o.value).filter(Boolean)
    expect(values).toEqual(['CONTACTED', 'QUALIFIED', 'LOST'])
    fireEvent.change(select, { target: { value: 'CONTACTED' } })
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }), 'CONTACTED')
  })
  it('gives a won lead no move menu (terminal stage)', () => {
    render(<LeadsBoard leads={[lead({ stage: 'WON' })]} counts={{}} staff={[]} onOpen={vi.fn()} onMove={vi.fn()} />)
    expect(screen.queryByTestId('lead-card-move')).toBeNull()
  })
  it('opens a lead from its card', () => {
    const onOpen = vi.fn()
    render(<LeadsBoard leads={[lead({})]} counts={{}} staff={[]} onOpen={onOpen} onMove={vi.fn()} />)
    fireEvent.click(screen.getByTestId('lead-card-open'))
    expect(onOpen).toHaveBeenCalled()
  })
})

describe('Timeline', () => {
  it('shows entries and an empty state when there are none', () => {
    render(
      <Timeline customerId="c1" initialCursor={null} initial={[{ key: 'a', type: 'ORDER_PLACED', label: 'سفارش ثبت شد', summary: '#۱۰۱', occurredAt: new Date().toISOString() }]} />,
    )
    expect(screen.getAllByTestId('timeline-item')).toHaveLength(1)
    expect(screen.queryByTestId('timeline-more')).toBeNull()
  })
  it('shows an empty state without entries', () => {
    render(<Timeline customerId="c1" initialCursor={null} initial={[]} />)
    expect(screen.getByTestId('empty-state')).toBeTruthy()
  })
  it('shows the load-more button only when a cursor exists', () => {
    render(<Timeline customerId="c1" initialCursor="2026-01-01T00:00:00.000Z" initial={[{ key: 'a', type: 'NOTE_ADDED', label: 'یادداشت ثبت شد', summary: '', occurredAt: new Date().toISOString() }]} />)
    expect(screen.getByTestId('timeline-more')).toBeTruthy()
  })
})
