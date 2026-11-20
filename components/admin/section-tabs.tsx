import { AdminTabs } from '@/components/admin/kit/admin-tabs'

const GROUPS = {
  site: [
    { id: 'homepage', label: 'بخش‌های صفحه اصلی', href: '/admin/homepage' },
    { id: 'menus', label: 'منوها', href: '/admin/menus' },
    { id: 'social', label: 'شبکه‌های اجتماعی', href: '/admin/social' },
  ],
  clinic: [
    { id: 'services', label: 'خدمات', href: '/admin/services' },
    { id: 'divisions', label: 'بخش‌های درمانی', href: '/admin/divisions' },
    { id: 'staff', label: 'کادر درمان', href: '/admin/staff' },
  ],
  community: [
    { id: 'faqs', label: 'پرسش‌های متداول', href: '/admin/faqs' },
    { id: 'testimonials', label: 'نظرات مشتریان', href: '/admin/testimonials' },
  ],
} as const

export type SectionGroup = keyof typeof GROUPS

/** Tab strip that ties merged admin sections together (the sidebar shows one item per group). */
export function SectionTabs({ group, current }: { group: SectionGroup; current: string }) {
  return (
    <div className="mb-4">
      <AdminTabs items={[...GROUPS[group]]} value={current} testIdPrefix="section-tab" />
    </div>
  )
}
