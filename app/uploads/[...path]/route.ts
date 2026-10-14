import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path || [];
  const relativeSubpath = pathSegments.join('/');
  const fullUrlPath = `/uploads/${relativeSubpath}`;
  const filename = pathSegments[pathSegments.length - 1] || '';
  const keyCandidate = filename.replace(/\.[^/.]+$/, '');

  try {
    // 1. Check local filesystem if present (e.g. dev or static build)
    const localPath = path.join(process.cwd(), 'public', 'uploads', ...pathSegments);
    if (fs.existsSync(localPath)) {
      const buffer = await fs.promises.readFile(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
      };
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeTypes[ext] || 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // 2. Search db.media for matching url or key
    const media = await db.media.findFirst({
      where: {
        OR: [
          { url: fullUrlPath },
          { url: { contains: filename } },
          { key: keyCandidate },
          { key: { contains: keyCandidate } },
        ],
      },
    });

    if (media && media.url) {
      if (media.url.startsWith('data:')) {
        const match = media.url.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const buffer = Buffer.from(match[2], 'base64');
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': mimeType,
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      } else if (media.url.startsWith('/images/')) {
        const imgPath = path.join(process.cwd(), 'public', media.url.replace(/^\//, ''));
        if (fs.existsSync(imgPath)) {
          const buffer = await fs.promises.readFile(imgPath);
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      }
    }

    // 3. If referenced by a ProductImage, find the product category and serve category fallback
    const productImage = await db.productImage.findFirst({
      where: { imageId: fullUrlPath },
      include: {
        product: {
          include: { category: true },
        },
      },
    });

    if (productImage?.product?.category?.imageId) {
      const catImgPath = path.join(
        process.cwd(),
        'public',
        productImage.product.category.imageId.replace(/^\//, '')
      );
      if (fs.existsSync(catImgPath)) {
        const buffer = await fs.promises.readFile(catImgPath);
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }
  } catch (err) {
    console.error('Error serving upload fallback:', err);
  }

  // 4. Default fallback: brand logo
  const defaultPath = path.join(process.cwd(), 'public', 'images', 'logo.png');
  if (fs.existsSync(defaultPath)) {
    const buffer = await fs.promises.readFile(defaultPath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  return new NextResponse('Not Found', { status: 404 });
}
