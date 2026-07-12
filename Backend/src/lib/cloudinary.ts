/**
 * Cloudinary integration — the only file that talks to Cloudinary.
 * Images are uploaded into a per-user folder: users/<userId>.
 */
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { config } from '../config.js';

let configured = false;
function ensureConfigured(): void {
  const { cloudName, apiKey, apiSecret } = config.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw Object.assign(new Error('Cloudinary is not configured'), { code: 'CLOUDINARY_UNCONFIGURED' });
  }
  if (!configured) {
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    configured = true;
  }
}

export const isCloudinaryConfigured = (): boolean =>
  Boolean(config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret);

/** Upload an in-memory image buffer into the user's folder. */
export function uploadImageBuffer(buffer: Buffer, userId: string): Promise<UploadApiResponse> {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `users/${userId}`, resource_type: 'image' },
      (error, result) => (error || !result ? reject(error ?? new Error('Empty upload result')) : resolve(result)),
    );
    stream.end(buffer);
  });
}

/** Delivery URL with f_auto (best format for the browser) + q_auto (smart compression). */
export function optimizedUrl(publicId: string): string {
  ensureConfigured();
  return cloudinary.url(publicId, { fetch_format: 'auto', quality: 'auto', secure: true });
}
