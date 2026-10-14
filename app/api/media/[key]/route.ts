import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_SITE_PICTURES } from '@/lib/media';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  try {
    const media = await db.media.findFirst({
      where: {
        OR: [
          { key },
          { id: key },
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
              'ETag': `"${media.key}"`,
            },
          });
        }
      } else if (media.url.startsWith('/')) {
        // Read file from public directory
        const localPath = path.join(process.cwd(), 'public', media.url.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          const buffer = await fs.promises.readFile(localPath);
          const ext = path.extname(localPath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
          };
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': mimeTypes[ext] || 'image/jpeg',
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
      }
    }
  } catch (err) {
    console.error('Error fetching media by key:', err);
  }

  // Fallback to default asset
  // @ts-expect-error key lookup
  const defaultPath = DEFAULT_SITE_PICTURES[key] || '/images/logo.png';
  const localDefault = path.join(process.cwd(), 'public', defaultPath.replace(/^\//, ''));
  if (fs.existsSync(localDefault)) {
    const buffer = await fs.promises.readFile(localDefault);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  return new NextResponse('Media Not Found', { status: 404 });
}
