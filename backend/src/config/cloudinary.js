const cloudinary = require('cloudinary').v2;

// Configured only when all three credentials are present. When absent (e.g. local
// dev), uploads fall back to local disk so the app still works without Cloudinary.
const isConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const FOLDER = process.env.CLOUDINARY_FOLDER || 'ecommerce';

// Uploads a local temp file to Cloudinary and returns its permanent secure URL.
async function uploadToCloudinary(filePath) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: FOLDER,
    resource_type: 'image',
  });
  return result.secure_url;
}

module.exports = { cloudinary, isConfigured, uploadToCloudinary };
