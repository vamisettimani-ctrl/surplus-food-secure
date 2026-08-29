/**
 * Uploads Routes
 */
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { success, badRequest } from '../utils/envelope.js';
import { newId } from '../store/index.js';

const router = Router();

router.post('/uploads/presign', authenticate, (req, res) => {
  const { purpose, mime_type } = req.body;
  
  const validPurposes = ['LISTING_PHOTO', 'VERIFICATION_DOC', 'LIVENESS_SELFIE', 'DELIVERY_PROOF'];
  if (!validPurposes.includes(purpose)) {
    return badRequest(res, 'Invalid purpose');
  }
  
  let normalizedMimeType = mime_type;
  if (mime_type === 'application/octet-stream') {
    normalizedMimeType = 'image/png'; // Default to png fallback
  }

  if (!normalizedMimeType || (!normalizedMimeType.startsWith('image/') && normalizedMimeType !== 'application/pdf')) {
    return badRequest(res, 'Invalid mime_type');
  }
  
  const ext = normalizedMimeType === 'application/pdf' ? 'pdf' : normalizedMimeType.split('/')[1] || 'bin';
  const filename = `${newId()}.${ext}`;
  const port = process.env.PORT || 5000;
  
  const upload_url = `http://localhost:${port}/uploads/${filename}`;
  
  return success(res, {
    upload_url,
    file_url: upload_url
  });
});

export default router;
