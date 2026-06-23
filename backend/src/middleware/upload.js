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

function multerErrResponse(err) {
  if (err.code === 'LIMIT_FILE_SIZE') return 'File too large. Maximum size is 5MB.';
  return err.message || 'Invalid file.';
}

// Wraps a multer single-field handler with a magic-byte verification step so
// clients cannot bypass the MIME check by spoofing Content-Type headers.
function withMagicBytes(multerHandler) {
  return (req, res, next) => {
    multerHandler(req, res, async (err) => {
      if (err) return res.status(400).json({ error: multerErrResponse(err) });
      if (!req.file) return next();

      try {
        const detected = await fileTypeFromFile(req.file.path);
        if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
          fs.unlink(req.file.path, (e) => { if (e) console.warn('upload cleanup failed:', e.message); });
          return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' });
        }
      } catch {
        fs.unlink(req.file.path, (e) => { if (e) console.warn('upload cleanup failed:', e.message); });
        return res.status(400).json({ error: 'Could not verify file type.' });
      }
      next();
    });
  };
}

// Wraps a multer multi-field handler with magic-byte verification
const cleanupFiles = (files) => {
  for (const f of files) {
    fs.unlink(f.path, (e) => { if (e) console.warn('upload cleanup failed:', e.message); });
  }
};

function withMagicBytesArray(multerHandler) {
  return (req, res, next) => {
    multerHandler(req, res, async (err) => {
      if (err) return res.status(400).json({ error: multerErrResponse(err) });
      if (!req.files?.length) return next();

      try {
        for (const file of req.files) {
          const detected = await fileTypeFromFile(file.path);
          if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
            cleanupFiles(req.files);
            return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' });
          }
        }
      } catch {
        cleanupFiles(req.files);
        return res.status(400).json({ error: 'Could not verify file types.' });
      }
      next();
    });
  };
}

const upload = {
  single: (field) => withMagicBytes(multerUpload.single(field)),
  array: (field, maxCount) => withMagicBytesArray(multerUpload.array(field, maxCount)),
};

module.exports = upload;
