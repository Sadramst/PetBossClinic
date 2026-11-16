import { describe, it, expect } from 'vitest'
import { normalizeFa, slugifyFa } from '@/lib/text/persian'

describe('normalizeFa', () => {
  it('converts Arabic Yeh/Kaf to Persian forms', () => {
    // "قلاده گردني چرم مدکاو" with Arabic Yeh
    expect(normalizeFa('قلاده گردني')).toBe(
      'قلاده گردنی'
    )
    expect(normalizeFa('ك')).toBe('ک')
  })

  it('collapses whitespace and keeps null', () => {
    expect(normalizeFa('babin  cat   adult ')).toBe('babin cat adult')
    expect(normalizeFa(null)).toBeNull()
  })
})

describe('slugifyFa', () => {
  it('builds clean slugs', () => {
    expect(slugifyFa('Babin Cat Adult 1.5 kg')).toBe('babin-cat-adult-15-kg')
    expect(slugifyFa('غذای‌ها')).toBe('غذای-ها')
    expect(slugifyFa('  --a  b--  ')).toBe('a-b')
  })
})
