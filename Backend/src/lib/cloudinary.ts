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

/**
 * Upload an in-memory file buffer into the asset's folder.
 *
 * Two paths, chosen by MIME type:
 *  - **Images (PNG/JPEG)** upload as `resource_type: 'image'` with an incoming
 *    transformation, so Cloudinary stores a **compressed, size-capped** version
 *    (`quality: auto:good`, max 2000px) — the stored asset is the optimised one.
 *  - **PDFs** upload as `resource_type: 'raw'` so the file is kept byte-for-byte
 *    and delivered with its real `.pdf` extension. Uploading a PDF as an image
 *    makes Cloudinary mislabel the format (it comes back as `.ai`, since
 *    Illustrator files are PDF-based).
 *
 * `filename_override` gives the buffered stream — which otherwise has no name —
 * the original filename, so the correct extension survives into the URL.
 */
export function uploadAssetDocument(
  buffer: Buffer,
  assetId: string,
  filename: string,
  mime: string,
): Promise<UploadApiResponse> {
  ensureConfigured();
  const isPdf = mime === 'application/pdf';
  const options = {
    folder: `assets/${assetId}`,
    use_filename: true,
    unique_filename: true,
    filename_override: filename,
    ...(isPdf
      ? { resource_type: 'raw' as const }
      : {
          resource_type: 'image' as const,
          // Incoming transformation: the compressed result is what gets stored.
          transformation: [{ width: 2000, height: 2000, crop: 'limit', quality: 'auto:good' }],
        }),
  };
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => (error || !result ? reject(error ?? new Error('Empty upload result')) : resolve(result)),
    );
    stream.end(buffer);
  });
}
