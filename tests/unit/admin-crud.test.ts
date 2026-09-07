import { describe, it, expect } from 'vitest'
import { loginAction } from '@/app/actions/auth'
import { createServiceAction } from '@/app/actions/services'
import { createDivisionAction } from '@/app/actions/divisions'
import { createStaffAction } from '@/app/actions/staff'
import { createProductAction } from '@/app/actions/products'
import { createFaqAction } from '@/app/actions/faqs'
import { updateLeadStatusAction } from '@/app/actions/leads'
import { toggleMessageReadAction } from '@/app/actions/messages'
import { updateSiteSettingsAction } from '@/app/actions/settings'

describe('Admin Authentication & CRUD Server Actions Unit Tests', () => {
  describe('Authentication Action', () => {
    it('returns error when email or password is missing in Farsi', async () => {
      const formData = new FormData()
      formData.append('email', '')
      formData.append('password', '')
      formData.append('locale', 'fa')

      const result = await loginAction(undefined, formData)
      expect(result.error).toBe('لطفاً ایمیل و کلمه عبور را وارد نمایید.')
    })

    it('returns error when email or password is missing in English', async () => {
      const formData = new FormData()
      formData.append('email', 'admin@petboss.com')
      formData.append('password', '')
      formData.append('locale', 'en')

      const result = await loginAction(undefined, formData)
      expect(result.error).toBe('Please enter both email and password.')
    })
  })

  describe('Unauthenticated Security Guards on All CRUD Actions', () => {
    it('blocks unauthenticated createServiceAction', async () => {
      const formData = new FormData()
      formData.append('nameFa', 'تست ویزیت')
      formData.append('divisionId', 'div_1')

      const result = await createServiceAction(formData)
      expect(result.error).toContain('دسترسی غیرمجاز')
    })

    it('blocks unauthenticated createDivisionAction', async () => {
      const formData = new FormData()
      formData.append('nameFa', 'بخش انکولوژی')

      const result = await createDivisionAction(formData)
      expect(result.error).toContain('دسترسی غیرمجاز')
    })

    it('blocks unauthenticated createStaffAction', async () => {
      const formData = new FormData()
      formData.append('nameFa', 'دکتر علی کاظمی')

      const result = await createStaffAction(formData)
      expect(result.error).toContain('دسترسی غیرمجاز')
    })

    it('blocks unauthenticated createProductAction', async () => {
      const formData = new FormData()
      formData.append('nameFa', 'شامپو ضد خارش')
      formData.append('price', '250000')

      const result = await createProductAction(formData)
      expect(result.error).toContain('دسترسی غیرمجاز')
    })

    it('blocks unauthenticated createFaqAction', async () => {
      const formData = new FormData()
      formData.append('questionFa', 'شرایط پذیرش چیست؟')
      formData.append('answerFa', 'پذیرش با رزرو قبلی انجام می‌شود.')

      const result = await createFaqAction(formData)
      expect(result.error).toContain('دسترسی غیرمجاز')
    })

    it('blocks unauthenticated updateLeadStatusAction', async () => {
      const result = await updateLeadStatusAction('lead_1', 'CONTACTED')
      expect(result.error).toContain('دسترسی غیرمجاز')
    })

    it('blocks unauthenticated toggleMessageReadAction', async () => {
      const result = await toggleMessageReadAction('msg_1')
      expect(result.error).toContain('دسترسی غیرمجاز')
    })

    it('blocks unauthenticated updateSiteSettingsAction', async () => {
      const formData = new FormData()
      formData.append('nameFa', 'کلینیک پت‌باس')

      const result = await updateSiteSettingsAction(formData)
      expect(result.error).toContain('دسترسی غیرمجاز')
    })
  })
})
