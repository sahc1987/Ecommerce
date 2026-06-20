const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const { v4 } = require('uuid');
const { fileTypeFromFile } = require('file-type');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, v4() + ext);
  },
});

// Fast first gate: rejects obviously non-image MIME types declared by the client
// before any bytes are written to disk. Magic-byte check below is the authoritative gate.
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'), false);
  }
};

const multerUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Wraps a multer single-field handler with a magic-byte verification step so
// clients cannot bypass the MIME check by spoofing Content-Type headers.
function withMagicBytes(multerHandler) {
  return (req, res, next) => {
    multerHandler(req, res, async (err) => {
      if (err) return next(err);
      if (!req.file) return next();

      try {
        const detected = await fileTypeFromFile(req.file.path);
        if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
          fs.unlink(req.file.path, () => {});
          return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' });
        }
      } catch {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'Could not verify file type.' });
      }
      next();
    });
  };
}

const upload = {
  single: (field) => withMagicBytes(multerUpload.single(field)),
};

module.exports = upload;
