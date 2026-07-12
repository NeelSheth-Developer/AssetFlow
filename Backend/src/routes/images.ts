import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { query } from '../db/neon.js';
import { requireAuth } from '../middleware/auth.js';
import { isCloudinaryConfigured, uploadImageBuffer, optimizedUrl } from '../lib/cloudinary.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

interface ImageRow {
  id: string;
  public_id: string;
  url: string;
  format: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  created_at: string;
}

export const imagesRouter = Router();

const response = (res: Response, status: number, success: boolean, message: string, data?: object) =>
  res.status(status).json({ success, message, ...(data && { data }), timestamp: new Date().toISOString() });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
});

// Runs multer and turns its errors (size limit, wrong type) into clean JSON.
function parseImageUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('image')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return response(res, 413, false, `Image must be at most ${MAX_FILE_SIZE / 1024 / 1024} MB`);
    }
    if (error) {
      return response(res, 400, false, error instanceof Error ? error.message : 'Invalid upload');
    }
    next();
  });
}

// POST /api/images/upload — multipart/form-data with an "image" field.
// Uploads to Cloudinary folder users/<userId> and stores the URL in Neon.
imagesRouter.post('/upload', requireAuth, parseImageUpload, async (req, res, next) => {
  try {
    if (!req.file) return response(res, 400, false, 'An "image" file field is required');
    if (!isCloudinaryConfigured()) {
      return response(res, 503, false, 'Cloudinary is not configured on the server (set CLOUDINARY_* env vars)');
    }

    const userId = req.user!.id;
    const uploaded = await uploadImageBuffer(req.file.buffer, userId);

    const saved = await query<ImageRow>(
      `INSERT INTO images (user_id, public_id, url, format, width, height, bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, public_id, url, format, width, height, bytes, created_at`,
      [userId, uploaded.public_id, uploaded.secure_url, uploaded.format, uploaded.width, uploaded.height, uploaded.bytes],
    );
    const image = saved.rows[0];

    req.log.info(
      { userId, publicId: image.public_id, bytes: image.bytes, folder: `users/${userId}` },
      'Image uploaded',
    );
    return response(res, 201, true, 'Image uploaded successfully', {
      image: { ...image, optimized_url: optimizedUrl(image.public_id) },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/images — the logged-in user's images, newest first.
imagesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await query<ImageRow>(
      `SELECT id, public_id, url, format, width, height, bytes, created_at
       FROM images WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user!.id],
    );
    const withOptimized = isCloudinaryConfigured();
    return response(res, 200, true, 'Images fetched', {
      images: result.rows.map((row) => ({
        ...row,
        optimized_url: withOptimized ? optimizedUrl(row.public_id) : row.url,
      })),
    });
  } catch (error) {
    next(error);
  }
});
