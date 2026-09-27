import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  if (!pathSegments || pathSegments.length === 0) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const fullPath = pathSegments.join('/');
  const fileName = pathSegments[pathSegments.length - 1];

  // 1. Try local filesystem (for local dev or if local volume mounted)
  try {
    const localFilePath = path.join(process.cwd(), 'public', 'uploads', ...pathSegments);
    if (fs.existsSync(localFilePath)) {
      const fileBuffer = await fs.promises.readFile(localFilePath);
      const ext = path.extname(localFilePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.gif': 'image/gif',
      };
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  } catch {
    // Fall through to database lookup
  }

  // 2. Lookup in PostgreSQL database by URL or key
  try {
    const media = await db.media.findFirst({
      where: {
        OR: [
          { url: { contains: fileName } },
          { key: { contains: fileName.replace(/\.[^/.]+$/, '') } },
        ],
      },
    });

    if (media && media.url && media.url.startsWith('data:')) {
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
    }
  } catch (err) {
    console.error('Error serving upload from DB:', err);
  }

  // 3. Graceful fallback: If it was a logo request, serve default logo instead of 404
  if (fullPath.toLowerCase().includes('logo')) {
    try {
      const defaultLogoPath = path.join(process.cwd(), 'public', 'images', 'logo.png');
      if (fs.existsSync(defaultLogoPath)) {
        const buffer = await fs.promises.readFile(defaultLogoPath);
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    } catch {}
  }

  return new NextResponse('Not Found', { status: 404 });
}
