/**
 * Cloudinary integration — used for asset document/photo uploads (Screen 4).
 * Files land in a per-asset folder: assets/<assetId>.
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

/** Upload an in-memory file buffer into the asset's folder. */
export function uploadAssetDocument(buffer: Buffer, assetId: string): Promise<UploadApiResponse> {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `assets/${assetId}`, resource_type: 'auto' },
      (error, result) => (error || !result ? reject(error ?? new Error('Empty upload result')) : resolve(result)),
    );
    stream.end(buffer);
  });
}
