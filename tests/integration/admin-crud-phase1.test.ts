import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mockDb so it can be safely referenced inside vi.mock('@/lib/db')
const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      $transaction: vi.fn().mockImplementation(async (fns) => (Array.isArray(fns) ? Promise.all(fns) : fns)),
      socialLink: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      navigationMenu: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      menuItem: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        updateMany: vi.fn(),
      },
      homepageSection: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      testimonial: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      staffMember: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      service: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  }
})

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
}))

// Mock audit log
vi.mock('@/lib/audit', () => ({
  logAdminChange: vi.fn().mockResolvedValue({ id: 'audit_1' }),
}))

// Mock auth session as authenticated ADMIN
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: 'admin_test_1',
    email: 'admin@petboss.com',
    role: 'ADMIN',
    name: 'مدیر کلینیک',
  }),
  hashPassword: vi.fn((p: string) => `hashed_${p}`),
  verifyPassword: vi.fn(() => true),
}))

// Mock database operations
vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

import {
  upsertSocialLinkAction,
  toggleSocialLinkAction,
  deleteSocialLinkAction,
} from '@/app/actions/social'
import {
  upsertMenuItemAction,
  deleteMenuItemAction,
  reorderMenuItemsAction,
} from '@/app/actions/menus'
import {
  updateHomepageSectionAction,
  toggleHomepageSectionVisibilityAction,
} from '@/app/actions/homepage'
import {
  upsertTestimonialAction,
  deleteTestimonialAction,
} from '@/app/actions/testimonials'
import {
  createStaffAction,
  updateStaffAction,
  deleteStaffAction,
} from '@/app/actions/staff'
import {
  createServiceAction,
  updateServiceAction,
  deleteServiceAction,
} from '@/app/actions/services'
import {
  createProductAction,
  updateProductAction,
  toggleProductFeaturedAction,
  deleteProductAction,
} from '@/app/actions/products'

describe('Phase 1 Admin Modules — Authenticated CRUD & Reorder Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── 1. Social Links Module ────────────────────────────────────
  describe('Social Links Admin Action Module (/admin/social)', () => {
    it('creates a new social link when not existing', async () => {
      mockDb.socialLink.findUnique.mockResolvedValueOnce(null)
      mockDb.socialLink.create.mockResolvedValueOnce({
        id: 'soc_1',
        platform: 'INSTAGRAM',
        url: 'https://instagram.com/petbossclinic',
        icon: 'Instagram',
        sortOrder: 1,
        isActive: true,
      })

      const formData = new FormData()
      formData.append('platform', 'INSTAGRAM')
      formData.append('url', 'https://instagram.com/petbossclinic')
      formData.append('sortOrder', '1')
      formData.append('isActive', 'true')

      const result = await upsertSocialLinkAction(formData)
      expect(result.success).toBe(true)
      expect(mockDb.socialLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platform: 'INSTAGRAM',
            url: 'https://instagram.com/petbossclinic',
            isActive: true,
          }),
        })
      )
    })

    it('updates an existing social link', async () => {
      mockDb.socialLink.findUnique.mockResolvedValueOnce({
        id: 'soc_1',
        platform: 'INSTAGRAM',
        url: 'https://instagram.com/old',
        isActive: true,
      })
      mockDb.socialLink.update.mockResolvedValueOnce({
        id: 'soc_1',
        platform: 'INSTAGRAM',
        url: 'https://instagram.com/petbossclinic_official',
        isActive: true,
      })

      const formData = new FormData()
      formData.append('id', 'soc_1')
      formData.append('platform', 'INSTAGRAM')
      formData.append('url', 'https://instagram.com/petbossclinic_official')
      formData.append('isActive', 'true')

      const result = await upsertSocialLinkAction(formData)
      expect(result.success).toBe(true)
      expect(mockDb.socialLink.update).toHaveBeenCalled()
    })

    it('toggles social link active state', async () => {
      mockDb.socialLink.update.mockResolvedValueOnce({
        id: 'soc_1',
        isActive: false,
      })

      const result = await toggleSocialLinkAction('soc_1', false)
      expect(result.success).toBe(true)
      expect(mockDb.socialLink.update).toHaveBeenCalledWith({
        where: { id: 'soc_1' },
        data: { isActive: false },
      })
    })

    it('deletes a social link', async () => {
      mockDb.socialLink.delete.mockResolvedValueOnce({
        id: 'soc_1',
        platform: 'INSTAGRAM',
        url: 'https://instagram.com/petbossclinic',
      })

      const result = await deleteSocialLinkAction('soc_1')
      expect(result.success).toBe(true)
      expect(mockDb.socialLink.delete).toHaveBeenCalledWith({
        where: { id: 'soc_1' },
      })
    })
  })

  // ─── 2. Navigation Menus Module ─────────────────────────────────
  describe('Navigation Menus Admin Action Module (/admin/menus)', () => {
    it('creates a new menu item and links to menu', async () => {
      mockDb.navigationMenu.findUnique.mockResolvedValueOnce({ id: 'menu_hdr', name: 'header' })
      mockDb.menuItem.findFirst.mockResolvedValueOnce({ sortOrder: 2 })
      mockDb.menuItem.create.mockResolvedValueOnce({
        id: 'item_1',
        labelFa: 'خدمات تخصصی',
        labelEn: 'Services',
        url: '/services',
        sortOrder: 3,
        menuId: 'menu_hdr',
      })

      const formData = new FormData()
      formData.append('menuName', 'header')
      formData.append('labelFa', 'خدمات تخصصی')
      formData.append('labelEn', 'Services')
      formData.append('url', '/services')

      const result = await upsertMenuItemAction(formData)
      expect(result.success).toBe(true)
      expect(mockDb.menuItem.create).toHaveBeenCalled()
    })

    it('updates a menu item label and target url', async () => {
      mockDb.menuItem.update.mockResolvedValueOnce({
        id: 'item_1',
        labelFa: 'کلینیک و خدمات',
        url: '/services',
      })

      const formData = new FormData()
      formData.append('id', 'item_1')
      formData.append('labelFa', 'کلینیک و خدمات')
      formData.append('labelEn', 'Services')
      formData.append('url', '/services')

      const result = await upsertMenuItemAction(formData)
      expect(result.success).toBe(true)
      expect(mockDb.menuItem.update).toHaveBeenCalled()
    })

    it('reorders menu items in batch', async () => {
      mockDb.menuItem.update.mockResolvedValue({})

      const result = await reorderMenuItemsAction([
        { id: 'item_1', sortOrder: 0 },
        { id: 'item_2', sortOrder: 1 },
      ])
      expect(result.success).toBe(true)
    })

    it('deletes a menu item', async () => {
      mockDb.menuItem.delete.mockResolvedValueOnce({
        id: 'item_1',
        labelFa: 'خدمات',
      })

      const result = await deleteMenuItemAction('item_1')
      expect(result.success).toBe(true)
      expect(mockDb.menuItem.delete).toHaveBeenCalledWith({
        where: { id: 'item_1' },
      })
    })
  })

  // ─── 3. Homepage Sections Module ────────────────────────────────
  describe('Homepage Sections Admin Action Module (/admin/homepage)', () => {
    it('updates homepage section content and CTA', async () => {
      mockDb.homepageSection.findUnique.mockResolvedValueOnce({
        id: 'sec_1',
        key: 'HERO',
        titleFa: 'عنوان قبلی',
      })
      mockDb.homepageSection.upsert.mockResolvedValueOnce({
        id: 'sec_1',
        key: 'HERO',
        titleFa: 'مراقبت با عشق در پت‌باس',
      })

      const formData = new FormData()
      formData.append('titleFa', 'مراقبت با عشق در پت‌باس')
      formData.append('subtitleFa', 'کلینیک دامپزشکی و پت‌شاپ قیطریه')
      formData.append('ctaLabelFa', 'تماس با کلینیک')
      formData.append('ctaHref', 'tel:+982126429715')
      formData.append('isVisible', 'true')

      const result = await updateHomepageSectionAction('HERO', formData)
      expect(result.success).toBe(true)
      expect(mockDb.homepageSection.upsert).toHaveBeenCalled()
    })

    it('toggles homepage section visibility', async () => {
      mockDb.homepageSection.update.mockResolvedValueOnce({
        id: 'sec_staff',
        key: 'STAFF',
        isVisible: false,
      })

      const result = await toggleHomepageSectionVisibilityAction('STAFF', false)
      expect(result.success).toBe(true)
      expect(mockDb.homepageSection.update).toHaveBeenCalledWith({
        where: { key: 'STAFF' },
        data: { isVisible: false },
      })
    })
  })

  // ─── 4. Testimonials Module ─────────────────────────────────────
  describe('Testimonials Admin Action Module (/admin/testimonials)', () => {
    it('creates a verified client testimonial', async () => {
      mockDb.testimonial.create.mockResolvedValueOnce({
        id: 'testi_1',
        nameFa: 'رویا حسینی',
        nameEn: 'Roya Hosseini',
        petName: 'میلو',
        species: 'سگ شیتزو',
        contentFa: 'جراحی میلو با مهارت دکتر حدیدی بسیار عالی انجام شد.',
        rating: 5,
        isActive: true,
      })

      const formData = new FormData()
      formData.append('nameFa', 'رویا حسینی')
      formData.append('nameEn', 'Roya Hosseini')
      formData.append('petName', 'میلو')
      formData.append('species', 'سگ شیتزو')
      formData.append('contentFa', 'جراحی میلو با مهارت دکتر حدیدی بسیار عالی انجام شد.')
      formData.append('rating', '5')
      formData.append('isActive', 'true')

      const result = await upsertTestimonialAction(formData)
      expect(result.success).toBe(true)
      expect(mockDb.testimonial.create).toHaveBeenCalled()
    })

    it('updates an existing testimonial', async () => {
      mockDb.testimonial.update.mockResolvedValueOnce({
        id: 'testi_1',
        nameFa: 'رویا حسینی',
        rating: 5,
      })

      const formData = new FormData()
      formData.append('id', 'testi_1')
      formData.append('nameFa', 'رویا حسینی')
      formData.append('contentFa', 'مراقبت‌های بعد از عمل فوق‌العاده بود.')
      formData.append('rating', '5')
      formData.append('isActive', 'true')

      const result = await upsertTestimonialAction(formData)
      expect(result.success).toBe(true)
      expect(mockDb.testimonial.update).toHaveBeenCalled()
    })

    it('deletes a testimonial', async () => {
      mockDb.testimonial.delete.mockResolvedValueOnce({
        id: 'testi_1',
        nameFa: 'رویا حسینی',
      })

      const result = await deleteTestimonialAction('testi_1')
      expect(result.success).toBe(true)
      expect(mockDb.testimonial.delete).toHaveBeenCalledWith({
        where: { id: 'testi_1' },
      })
    })
  })

  // ─── 5. Staff Module ───────────────────────────────────────────
  describe('Staff Admin Action Module (/admin/staff)', () => {
    it('creates Dr. Ali Hadidi medical staff record', async () => {
      mockDb.staffMember.findFirst.mockResolvedValueOnce({ sortOrder: 1 })
      mockDb.staffMember.create.mockResolvedValueOnce({
        id: 'staff_1',
        nameFa: 'دکتر علی حدیدی',
        nameEn: 'Dr. Ali Hadidi',
        titleFa: 'جراح ارشد دامپزشک و مدیر مجموعه',
        titleEn: 'Chief Veterinary Surgeon & Medical Director',
        licenseNo: '۹۰۴۵۲',
        isActive: true,
      })

      const formData = new FormData()
      formData.append('nameFa', 'دکتر علی حدیدی')
      formData.append('nameEn', 'Dr. Ali Hadidi')
      formData.append('titleFa', 'جراح ارشد دامپزشک و مدیر مجموعه')
      formData.append('titleEn', 'Chief Veterinary Surgeon & Medical Director')
      formData.append('licenseNo', '۹۰۴۵۲')
      formData.append('isActive', 'true')

      const result = await createStaffAction(formData)
      expect(result.success).toBe(true)
      expect(mockDb.staffMember.create).toHaveBeenCalled()
    })

    it('updates staff bio, license and photo', async () => {
      mockDb.staffMember.findUnique.mockResolvedValueOnce({
        id: 'staff_1',
        nameFa: 'دکتر علی حدیدی',
      })
      mockDb.staffMember.update.mockResolvedValueOnce({
        id: 'staff_1',
        photoId: '/images/staff/dr-ali-hadidi.svg',
      })

      const formData = new FormData()
      formData.append('nameFa', 'دکتر علی حدیدی')
      formData.append('photoId', '/images/staff/dr-ali-hadidi.svg')
      formData.append('isActive', 'true')

      const result = await updateStaffAction('staff_1', formData)
      expect(result.success).toBe(true)
      expect(mockDb.staffMember.update).toHaveBeenCalled()
    })

    it('deletes staff member record', async () => {
      mockDb.staffMember.delete.mockResolvedValueOnce({
        id: 'staff_1',
        nameFa: 'دکتر علی حدیدی',
      })

      const result = await deleteStaffAction('staff_1')
      expect(result.success).toBe(true)
      expect(mockDb.staffMember.delete).toHaveBeenCalledWith({
        where: { id: 'staff_1' },
      })
    })
  })

  // ─── 6. Service Pricing Mode & CRUD ─────────────────────────────
  describe('Service Admin Action Module with PriceDisplayMode', () => {
    it('creates service with explicit ON_REQUEST priceDisplayMode', async () => {
      mockDb.service.findFirst.mockResolvedValueOnce({ sortOrder: 1 })
      mockDb.service.create.mockResolvedValueOnce({
        id: 'srv_1',
        nameFa: 'جراحی بافت نرم',
        priceDisplayMode: 'ON_REQUEST',
        price: null,
      })

      const formData = new FormData()
      formData.append('nameFa', 'جراحی بافت نرم')
      formData.append('nameEn', 'Soft Tissue Surgery')
      formData.append('divisionId', 'div_clinic')
      formData.append('priceDisplayMode', 'ON_REQUEST')

      const result = await createServiceAction(formData)
      expect(result.success).toBe(true)
      expect(mockDb.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priceDisplayMode: 'ON_REQUEST',
          }),
        })
      )
    })

    it('updates service with RANGE priceDisplayMode and prices', async () => {
      mockDb.service.update.mockResolvedValueOnce({
        id: 'srv_1',
        priceDisplayMode: 'RANGE',
        priceFrom: 350000,
        priceTo: 500000,
      })

      const formData = new FormData()
      formData.append('divisionId', 'div_clinic')
      formData.append('nameFa', 'ویزیت تخصصی')
      formData.append('priceDisplayMode', 'RANGE')
      formData.append('priceFrom', '350000')
      formData.append('priceTo', '500000')

      const result = await updateServiceAction('srv_1', formData)
      expect(result.success).toBe(true)
      expect(mockDb.service.update).toHaveBeenCalled()
    })

    it('deletes service record', async () => {
      mockDb.service.delete.mockResolvedValueOnce({
        id: 'srv_1',
        nameFa: 'ویزیت تخصصی',
      })

      const result = await deleteServiceAction('srv_1')
      expect(result.success).toBe(true)
      expect(mockDb.service.delete).toHaveBeenCalledWith({
        where: { id: 'srv_1' },
      })
    })
  })

  // ─── 7. Products Featured Flag & CRUD ───────────────────────────
  describe('Product Admin Action Module with isFeatured flag', () => {
    it('creates product with isFeatured flag set to true', async () => {
      mockDb.product.create.mockResolvedValueOnce({
        id: 'prod_1',
        nameFa: 'غذای خشک رویال کنین',
        isFeatured: true,
        price: 850000,
      })

      const formData = new FormData()
      formData.append('nameFa', 'غذای خشک رویال کنین')
      formData.append('nameEn', 'Royal Canin Dry Food')
      formData.append('price', '850000')
      formData.append('categoryId', 'cat_dry')
      formData.append('isFeatured', 'true')

      const result = await createProductAction(formData)
      expect(result.success).toBe(true)
      expect(mockDb.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isFeatured: true,
          }),
        })
      )
    })

    it('updates product price and name', async () => {
      mockDb.product.findUnique.mockResolvedValueOnce({
        id: 'prod_1',
        nameFa: 'غذای خشک رویال کنین',
        price: 850000,
      })
      mockDb.product.update.mockResolvedValueOnce({
        id: 'prod_1',
        nameFa: 'غذای خشک رویال کنین مینی ادالت',
        price: 920000,
      })

      const formData = new FormData()
      formData.append('categoryId', 'cat_dry')
      formData.append('nameFa', 'غذای خشک رویال کنین مینی ادالت')
      formData.append('price', '920000')

      const result = await updateProductAction('prod_1', formData)
      expect(result.success).toBe(true)
      expect(mockDb.product.update).toHaveBeenCalled()
    })

    it('toggles isFeatured flag for homepage showcase curation', async () => {
      mockDb.product.findUnique.mockResolvedValueOnce({
        id: 'prod_1',
        nameFa: 'غذای خشک رویال کنین',
        isFeatured: false,
      })
      mockDb.product.update.mockResolvedValueOnce({
        id: 'prod_1',
        isFeatured: true,
      })

      const result = await toggleProductFeaturedAction('prod_1', true)
      expect(result.success).toBe(true)
      expect(mockDb.product.update).toHaveBeenCalledWith({
        where: { id: 'prod_1' },
        data: { isFeatured: true },
      })
    })

    it('deletes product record', async () => {
      mockDb.product.delete.mockResolvedValueOnce({
        id: 'prod_1',
        nameFa: 'غذای خشک رویال کنین',
      })

      const result = await deleteProductAction('prod_1')
      expect(result.success).toBe(true)
      expect(mockDb.product.delete).toHaveBeenCalledWith({
        where: { id: 'prod_1' },
      })
    })
  })
})
