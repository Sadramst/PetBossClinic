'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSessionWithRole } from '@/lib/auth'
import { logAdminChange } from '@/lib/audit'
import { normalizeFa, slugifyFa } from '@/lib/text/persian'
import { readingMinutes } from '@/lib/blog/render'
import { postPath } from '@/lib/blog/posts'

export interface PostActionState {
  error?: string
  ok?: boolean
  id?: string
}

const UNAUTHORIZED = { error: 'دسترسی غیرمجاز.' }

function revalidateBlog(slug?: string) {
  try {
    revalidatePath('/blog')
    if (slug) revalidatePath(postPath(slug))
    revalidatePath('/admin/posts')
    revalidatePath('/sitemap.xml')
  } catch {
    /* best effort */
  }
}

async function categoryIdFor(name: string): Promise<string> {
  const nameFa = normalizeFa(name).slice(0, 60) || 'عمومی'
  const slugFa = slugifyFa(nameFa) || 'general'
  const existing = await db.postCategory.findFirst({ where: { OR: [{ slugFa }, { nameFa }] } })
  if (existing) return existing.id
  return (await db.postCategory.create({ data: { nameFa, slugFa } })).id
}

export async function savePostAction(formData: FormData): Promise<PostActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return UNAUTHORIZED

  const get = (k: string) => normalizeFa(formData.get(k)?.toString() ?? '')
  const id = formData.get('id')?.toString() || null
  const titleFa = get('titleFa').slice(0, 160)
  const contentFa = (formData.get('contentFa')?.toString() ?? '').replace(/\r\n/g, '\n').slice(0, 60000)
  if (titleFa.length < 5) return { error: 'عنوان مقاله را وارد کنید.' }
  if (contentFa.trim().length < 200) return { error: 'متن مقاله خیلی کوتاه است (حداقل ۲۰۰ نویسه).' }

  const slugFa = slugifyFa(get('slugFa') || titleFa).slice(0, 120)
  const clash = await db.post.findFirst({ where: { slugFa, ...(id && { id: { not: id } }) }, select: { id: true } })
  if (clash) return { error: 'نشانی (slug) تکراری است؛ آن را تغییر دهید.' }

  const imageId = (formData.get('imageId')?.toString() ?? '').trim()
  if (imageId && !imageId.startsWith('/') && !/^https:\/\//.test(imageId)) return { error: 'آدرس تصویر باید با / یا https شروع شود.' }

  const publish = formData.get('publish') === 'on'
  const before = id ? await db.post.findUnique({ where: { id } }) : null
  if (id && !before) return { error: 'مقاله پیدا نشد.' }

  const data = {
    titleFa,
    slugFa,
    contentFa,
    excerptFa: get('excerptFa').slice(0, 400) || null,
    metaTitleFa: get('metaTitleFa').slice(0, 70) || null,
    metaDescriptionFa: get('metaDescriptionFa').slice(0, 170) || null,
    focusKeyword: get('focusKeyword').slice(0, 60) || null,
    imageId: imageId || null,
    readingTime: readingMinutes(contentFa),
    categoryId: await categoryIdFor(get('category')),
    // Keep the original publish date when re-saving a published post.
    publishedAt: publish ? (before?.publishedAt ?? new Date()) : null,
    isActive: true,
  }

  const saved = id ? await db.post.update({ where: { id }, data }) : await db.post.create({ data })
  await logAdminChange({
    action: id ? 'UPDATE' : 'CREATE',
    entity: 'POST',
    entityId: saved.id,
    after: { titleFa, slugFa, published: publish },
  })
  revalidateBlog(saved.slugFa)
  if (before && before.slugFa !== saved.slugFa) revalidateBlog(before.slugFa)
  return { ok: true, id: saved.id }
}

export async function deletePostAction(id: string): Promise<PostActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return UNAUTHORIZED
  const post = await db.post.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
  await logAdminChange({ action: 'DELETE', entity: 'POST', entityId: id, before: { titleFa: post.titleFa } })
  revalidateBlog(post.slugFa)
  return { ok: true }
}
