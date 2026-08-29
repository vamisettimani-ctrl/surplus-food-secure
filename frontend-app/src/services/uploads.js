import api from './api';
import axios from 'axios';

export const uploadService = {
  getPresignedUrl: (purpose, mimeType) =>
    api.post('/uploads/presign', { purpose, mime_type: mimeType }),

  uploadFile: async (file, purpose) => {
    let mimeType = file.type;
    if (!mimeType && file.name) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'pdf') {
        mimeType = 'application/pdf';
      } else if (ext === 'png') {
        mimeType = 'image/png';
      } else if (ext === 'jpg' || ext === 'jpeg') {
        mimeType = 'image/jpeg';
      } else {
        mimeType = 'application/octet-stream';
      }
    }
    const { data } = await api.post('/uploads/presign', { purpose, mime_type: mimeType });
    await axios.put(data.upload_url, file, {
      headers: { 'Content-Type': mimeType },
    });
    return data.file_url;
  },
};
