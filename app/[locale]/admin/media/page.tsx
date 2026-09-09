import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guard'
import { getSitePictures } from '@/lib/media'
import { MediaManager } from '@/components/admin/media-manager'

export const dynamic = 'force-dynamic'

export default async function AdminMediaPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  await requireAdmin('VIEWER', locale)
  const isEn = locale === 'en'

  const currentPictures = await getSitePictures()

  // Fetch all media items ordered by newest first
  const mediaLibrary = await db.media.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      key: true,
      url: true,
      size: true,
      mime: true,
      altFa: true,
      createdAt: true,
    },
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
          <span>🖼️</span>
          <span>{isEn ? 'Media & Picture Management' : 'مدیریت رسانه‌ها و تصاویر کلینیک'}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isEn
            ? 'Manage, upload, and modify all website pictures, official signboards, and logos in real-time.'
            : 'مشاهده، آپلود و ویرایش بلادرنگ تمامی تصاویر وب‌سایت، تابلوی رسمی و نشان تجاری پت‌باس.'}
        </p>
      </div>

      <MediaManager
        currentPictures={currentPictures}
        mediaLibrary={mediaLibrary}
        isEn={isEn}
      />
    </div>
  )
}
