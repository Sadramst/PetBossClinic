import { describe, it, expect } from 'vitest'
import { detectBrand, expandSearchQuery } from '@/lib/shop/brands'
import { parseShopFilters, filtersToQuery, isFilteredView, buildProductWhere } from '@/lib/shop/filters'

describe('brands', () => {
  it('detects brand from the leading words of a product name', () => {
    expect(detectBrand('royal canin kitten 2 kg')?.slug).toBe('royal-canin')
    expect(detectBrand('GiGwi ball toy')?.slug).toBe('gigwi')
    expect(detectBrand('dr.clauders cat paste')?.slug).toBe('dr-clauders')
    expect(detectBrand('قلاده چرم')).toBeNull()
    // "boss" must be a whole leading word, not "bossy"
    expect(detectBrand('bossy toy')).toBeNull()
  })

  it('expands Persian brand names and generic words', () => {
    expect(expandSearchQuery('غذای رویال کنین گربه')).toEqual([['royal canin', 'رویال کنین'], ['غذای'], ['cat', 'گربه']])
    expect(expandSearchQuery('josera')).toEqual([['josera']])
    expect(expandSearchQuery('  ')).toEqual([])
  })
})

describe('shop filters', () => {
  it('parses and sanitises query params', () => {
    const f = parseShopFilters({ q: ' رويال ', pet: 'cat', stock: '1', min: '۱۰۰', max: 'abc', sort: 'evil', page: '3' })
    expect(f.q).toBe('رویال') // Arabic Yeh normalised
    expect(f.pet).toBe('cat')
    expect(f.inStock).toBe(true)
    expect(f.max).toBeNull()
    expect(f.sort).toBe('popular')
    expect(f.page).toBe(3)
  })

  it('round-trips to a query string without defaults', () => {
    const f = parseShopFilters({ pet: 'dog', sort: 'price-asc' })
    expect(filtersToQuery(f)).toBe('?pet=dog&sort=price-asc')
    expect(filtersToQuery(f, 2)).toBe('?pet=dog&sort=price-asc&page=2')
    expect(filtersToQuery(parseShopFilters({}))).toBe('')
    expect(isFilteredView(parseShopFilters({ page: '2' }))).toBe(false)
    expect(isFilteredView(f)).toBe(true)
  })

  it('builds an AND query with one OR-group per search term', () => {
    const where = buildProductWhere(parseShopFilters({ q: 'josera cat', stock: '1' }))
    const and = where.AND as unknown[]
    // base + scope + 2 search groups + stock
    expect(and).toHaveLength(5)
  })
})
