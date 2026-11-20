/** A refusal the admin should read: the message is final Persian copy, the code is for tests and branching. */
export class CrmError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'CrmError'
    this.code = code
  }
}

export const isCrmError = (e: unknown): e is CrmError => e instanceof CrmError

export const MSG = {
  notFound: 'مورد پیدا نشد؛ شاید پیش‌تر حذف شده است.',
  stale: 'این مورد هم‌زمان توسط شخص دیگری تغییر کرد. صفحه را تازه کنید و دوباره تلاش کنید.',
  denied: 'دسترسی غیرمجاز؛ این کار نیاز به نقش بالاتری دارد.',
  busy: 'تعداد درخواست‌ها زیاد است؛ کمی صبر کنید و دوباره تلاش کنید.',
  generic: 'خطایی رخ داد. دوباره تلاش کنید.',
  badInput: 'اطلاعات واردشده معتبر نیست.',
} as const
