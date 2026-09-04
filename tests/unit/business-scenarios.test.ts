import { describe, it, expect } from 'vitest'
import { hasRoleAccess, hashPassword, verifyPassword } from '@/lib/auth'

describe('Pet Boss Veterinary Clinic — End-to-End Business Scenarios', () => {
  // ─── Scenario 1: Emergency Triage & Lead Capture ─────────────
  describe('Scenario 1: Emergency Patient Consultation & Triage', () => {
    interface EmergencyTriageInput {
      patientName: string
      species: 'CANINE' | 'FELINE' | 'EXOTIC'
      urgency: 'CRITICAL' | 'URGENT' | 'ROUTINE'
      ownerName: string
      phone: string
      symptoms: string
    }

    function triagePatient(input: EmergencyTriageInput) {
      // Validate Iranian mobile phone format (e.g. 0912xxxxxxx)
      const phoneRegex = /^09\d{9}$/
      const isValidPhone = phoneRegex.test(input.phone.replace(/\s+/g, ''))

      if (!isValidPhone) {
        throw new Error('شماره تلفن وارد شده نامعتبر است.')
      }

      const isImmediateAttentionRequired = input.urgency === 'CRITICAL' || input.urgency === 'URGENT'
      const assignedDivision = 'Clinical, Internal Medicine & Surgery'

      return {
        ticketId: `EMG-${Date.now()}`,
        status: isImmediateAttentionRequired ? 'TRIAGE_PRIORITY_1' : 'SCHEDULED_APPOINTMENT',
        assignedDivision,
        requiresOnCallSurgeon: input.urgency === 'CRITICAL',
        directLine: '+982122000000',
      }
    }

    it('successfully processes critical canine emergency triage', () => {
      const caseData: EmergencyTriageInput = {
        patientName: 'ماکس (Max)',
        species: 'CANINE',
        urgency: 'CRITICAL',
        ownerName: 'کامران امیری',
        phone: '09123456789',
        symptoms: 'مشکوک به پیچ‌خوردگی معده (GDV) و تنگی نفس حاد',
      }

      const triageResult = triagePatient(caseData)
      expect(triageResult.status).toBe('TRIAGE_PRIORITY_1')
      expect(triageResult.requiresOnCallSurgeon).toBe(true)
      expect(triageResult.directLine).toBe('+982122000000')
    })

    it('rejects invalid owner phone number during triage intake', () => {
      const invalidCase: EmergencyTriageInput = {
        patientName: 'لوسی',
        species: 'FELINE',
        urgency: 'ROUTINE',
        ownerName: 'مریم',
        phone: '123456', // Invalid phone
        symptoms: 'چکاپ سالانه',
      }

      expect(() => triagePatient(invalidCase)).toThrow('شماره تلفن وارد شده نامعتبر است.')
    })
  })

  // ─── Scenario 2: Bilingual Clinical Services & Currency Calculation ───
  describe('Scenario 2: Bilingual Clinical Services & Tomans Currency Calculation', () => {
    interface ServiceItem {
      slug: string
      nameFa: string
      nameEn: string
      priceFromTomans: number
      priceToTomans?: number
    }

    const servicesCatalog: ServiceItem[] = [
      {
        slug: 'vaccination',
        nameFa: 'واکسیناسیون سگ و گربه',
        nameEn: 'Dog & Cat Vaccination',
        priceFromTomans: 500_000,
        priceToTomans: 2_500_000,
      },
      {
        slug: 'dental-scaling',
        nameFa: 'جرم‌گیری اولتراسونیک دندان',
        nameEn: 'Ultrasonic Dental Scaling',
        priceFromTomans: 1_200_000,
        priceToTomans: 3_000_000,
      },
      {
        slug: 'orthopedic-surgery',
        nameFa: 'جراحی تخصصی ارتوپدی و شکستگی',
        nameEn: 'Specialized Orthopedic Surgery',
        priceFromTomans: 8_000_000,
        priceToTomans: 25_000_000,
      },
    ]

    it('formats pricing accurately in Persian and English locales', () => {
      const vaccine = servicesCatalog[0]

      // Format in Persian (Farsi Tomans)
      const faFrom = vaccine.priceFromTomans.toLocaleString('fa-IR')
      const faTo = vaccine.priceToTomans?.toLocaleString('fa-IR')

      // Format in English
      const enFrom = vaccine.priceFromTomans.toLocaleString('en-US')
      const enTo = vaccine.priceToTomans?.toLocaleString('en-US')

      expect(enFrom).toBe('500,000')
      expect(enTo).toBe('2,500,000')
      expect(faFrom).not.toBe(enFrom) // Persian uses Eastern Arabic numerals (۵۰۰٬۰۰۰)
      expect(faTo).toBeDefined()
    })

    it('calculates bundle estimation for multi-service clinic visit', () => {
      // Patient requires vaccination + dental scaling
      const selected = [servicesCatalog[0], servicesCatalog[1]]
      const minTotal = selected.reduce((sum, s) => sum + s.priceFromTomans, 0)
      const maxTotal = selected.reduce((sum, s) => sum + (s.priceToTomans || s.priceFromTomans), 0)

      expect(minTotal).toBe(1_700_000)
      expect(maxTotal).toBe(5_500_000)
    })
  })

  // ─── Scenario 3: Super Admin vs Clinic Admin Access Control ────
  describe('Scenario 3: Super Admin vs Clinic Admin RBAC & Access Control', () => {
    interface SystemUser {
      id: string
      email: string
      role: 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR'
      passwordHash: string
    }

    const superAdmin: SystemUser = {
      id: 'usr_super_1',
      email: 'superadmin@petboss.com',
      role: 'SUPER_ADMIN',
      passwordHash: hashPassword('SuperAdmin@PetBoss2026!'),
    }

    const clinicAdmin: SystemUser = {
      id: 'usr_admin_2',
      email: 'admin@petboss.com',
      role: 'ADMIN',
      passwordHash: hashPassword('Admin@PetBoss2026!'),
    }

    function canManageUsers(user: SystemUser): boolean {
      return hasRoleAccess(user.role, 'SUPER_ADMIN')
    }

    function canEditClinicalServices(user: SystemUser): boolean {
      return hasRoleAccess(user.role, 'ADMIN')
    }

    it('confirms Super Admin has exclusive user management authorization', () => {
      expect(canManageUsers(superAdmin)).toBe(true)
      expect(canManageUsers(clinicAdmin)).toBe(false)
    })

    it('confirms both Super Admin and Clinic Admin can manage clinical services', () => {
      expect(canEditClinicalServices(superAdmin)).toBe(true)
      expect(canEditClinicalServices(clinicAdmin)).toBe(true)
    })

    it('verifies password authentication for both administrative tiers', () => {
      expect(verifyPassword('SuperAdmin@PetBoss2026!', superAdmin.passwordHash)).toBe(true)
      expect(verifyPassword('Admin@PetBoss2026!', clinicAdmin.passwordHash)).toBe(true)

      // Test incorrect password
      expect(verifyPassword('WrongPass', superAdmin.passwordHash)).toBe(false)
    })
  })

  // ─── Scenario 4: Pet Grooming & Boutique Store Inventory ─────────
  describe('Scenario 4: Pet Grooming & Boutique Store Inventory', () => {
    interface ShopProduct {
      sku: string
      nameFa: string
      nameEn: string
      category: 'FOOD' | 'HYGIENE' | 'ACCESSORIES'
      inStock: boolean
      priceTomans: number
    }

    const boutiqueProducts: ShopProduct[] = [
      {
        sku: 'RC-MINI-ADULT',
        nameFa: 'غذای خشک سگ رویال کنین مینی ادالت',
        nameEn: 'Royal Canin Mini Adult Dog Food 2kg',
        category: 'FOOD',
        inStock: true,
        priceTomans: 1_850_000,
      },
      {
        sku: 'BIO-SHAMPOO-OAT',
        nameFa: 'شامپو ارگانیک ضدحساسیت جو دوسر',
        nameEn: 'Organic Hypoallergenic Oat Dog Shampoo 500ml',
        category: 'HYGIENE',
        inStock: true,
        priceTomans: 450_000,
      },
      {
        sku: 'LUX-LEATHER-COLLAR',
        nameFa: 'قلاده چرم دست‌دوز اشرافی پت‌باس',
        nameEn: 'Pet Boss Handcrafted Luxury Leather Collar',
        category: 'ACCESSORIES',
        inStock: false,
        priceTomans: 890_000,
      },
    ]

    it('filters active in-stock products for public pet shop catalog', () => {
      const availableItems = boutiqueProducts.filter((p) => p.inStock)
      expect(availableItems.length).toBe(2)
      expect(availableItems.map((p) => p.sku)).toEqual(['RC-MINI-ADULT', 'BIO-SHAMPOO-OAT'])
    })

    it('verifies all inventory SKUs are non-empty and formatted', () => {
      for (const item of boutiqueProducts) {
        expect(item.sku).toMatch(/^[A-Z0-9-]+$/)
        expect(item.priceTomans).toBeGreaterThan(0)
      }
    })
  })
})
