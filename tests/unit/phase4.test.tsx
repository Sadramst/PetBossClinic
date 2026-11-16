import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ArticleBody, articleHeadings, parseArticle, readingMinutes } from '@/lib/blog/render'
import { parseEnamadSnippet, parseStoredEnamad } from '@/lib/seo/settings'

describe('article renderer', () => {
  const src = `مقدمه با **متن پررنگ** و [لینک داخلی](/shop/cat-dry-food).

## بخش اول
- مورد یک
- مورد دو

1. گام اول
2. گام دوم

> نکته مهم

## بخش دوم
[لینک بد](javascript:alert(1)) <script>alert(1)</script>`

  it('parses headings, lists, quotes and paragraphs', () => {
    expect(parseArticle(src).map((b) => b.type)).toEqual(['p', 'h2', 'ul', 'ol', 'quote', 'h2', 'p'])
    expect(articleHeadings(src)).toEqual([
      { id: 'section-1', text: 'بخش اول' },
      { id: 'section-2', text: 'بخش دوم' },
    ])
  })

  it('never renders raw HTML or javascript: links', () => {
    const { container } = render(<ArticleBody source={src} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toContain('javascript:')
    expect(container.querySelector('a[href="/shop/cat-dry-food"]')?.textContent).toBe('لینک داخلی')
    expect(container.querySelector('strong')?.textContent).toBe('متن پررنگ')
    expect(container.querySelector('h2#section-2')).not.toBeNull()
    // The <script> text is shown as text, not executed markup
    expect(container.textContent).toContain('<script>')
  })

  it('estimates reading time', () => {
    expect(readingMinutes('کلمه '.repeat(1000))).toBe(5)
    expect(readingMinutes('')).toBe(1)
  })
})

describe('eNamad', () => {
  it('extracts id and code from the snippet eNamad provides', () => {
    const snippet =
      "<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=123456&amp;Code=AbCdEf123456'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=123456&amp;Code=AbCdEf123456' alt='' style='cursor:pointer' code='AbCdEf123456'></a>"
    expect(parseEnamadSnippet(snippet)).toEqual({ id: '123456', code: 'AbCdEf123456' })
    expect(parseEnamadSnippet('<script>evil()</script>')).toBeNull()
  })

  it('validates the stored form', () => {
    expect(parseStoredEnamad('123456|AbCdEf123456')).toEqual({ id: '123456', code: 'AbCdEf123456' })
    expect(parseStoredEnamad('12|x"onerror=')).toBeNull()
    expect(parseStoredEnamad(null)).toBeNull()
  })
})
