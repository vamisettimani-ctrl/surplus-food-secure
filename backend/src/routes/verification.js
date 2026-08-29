import express from 'express';
import { users, verificationDocs, ngoProfiles, restaurantProfiles, deliveryPartnerProfiles, newId, findAll } from '../store/index.js';
import { success, badRequest, conflict, notFound, serverError } from '../utils/envelope.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { logAudit } from '../services/audit.js';

const router = express.Router();

router.post('/verification/submit', authenticate, async (req, res) => {
  try {
    const user = users.get(req.user.id);
    if (!user) return notFound(res, 'User not found');

    const {
      doc_type, license_no, file_url,
      reg_no, org_name, address_place_id, service_radius_km, daily_capacity, operating_hours,
      vehicle_type, id_file_url, selfie_file_url
    } = req.body;

    const identifier = license_no || reg_no;
    
    if (identifier) {
      const docs = findAll(verificationDocs);
      const duplicate = docs.find(d => d.license_no === identifier || d.reg_no === identifier);
      if (duplicate) {
        return conflict(res, 'Duplicate license/registration number');
      }
    }

    const docId = newId();
    const docUrl = file_url || id_file_url;
    const doc = {
      id: docId,
      user_id: user.id,
      doc_type,
      file_url: docUrl,
      license_no,
      reg_no,
      status: 'PENDING',
      reviewed_by: null,
      review_reason: null,
      submitted_at: new Date().toISOString(),
      reviewed_at: null
    };
    
    verificationDocs.set(docId, doc);

    if (user.role === 'RESTAURANT' || user.role === 'INDIVIDUAL_DONOR') {
      restaurantProfiles.set(user.id, {
        user_id: user.id,
        business_name: '',
        license_no,
        address: '',
        lat: 0,
        lng: 0,
        verified_doc_url: file_url
      });
    } else if (user.role === 'NGO') {
      ngoProfiles.set(user.id, {
        user_id: user.id,
        org_name,
        reg_no,
        address: address_place_id || '',
        lat: 0,
        lng: 0,
        service_radius_km: service_radius_km || 10,
        daily_capacity: daily_capacity || 100,
        auto_match_enabled: false,
        operating_hours_open: operating_hours?.open || '08:00',
        operating_hours_close: operating_hours?.close || '21:00',
        claimed_today: 0
      });
    } else if (user.role === 'DELIVERY_PARTNER') {
      deliveryPartnerProfiles.set(user.id, {
        user_id: user.id,
        id_doc_url: id_file_url,
        selfie_url: selfie_file_url,
        vehicle_type: vehicle_type || 'BIKE',
        status: 'OFFLINE',
        current_lat: 0,
        current_lng: 0
      });
    }

    user.verification_status = 'PENDING';
    users.set(user.id, user);

    logAudit(user.id, 'VERIFICATION_SUBMITTED', 'VerificationDocument', docId, { doc_id: docId });

    return success(res, {
      verification_id: docId,
      status: 'PENDING'
    });
  } catch (error) {
    return serverError(res, error.message);
  }
});

router.get('/verification/me', authenticate, async (req, res) => {
  try {
    const userDocs = findAll(verificationDocs).filter(d => d.user_id === req.user.id);
    if (userDocs.length === 0) {
      return success(res, null);
    }
    
    const latestDoc = userDocs.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0];
    
    return success(res, {
      verification_id: latestDoc.id,
      status: latestDoc.status,
      doc_type: latestDoc.doc_type,
      submitted_at: latestDoc.submitted_at,
      review_reason: latestDoc.review_reason
    });
  } catch (error) {
    return serverError(res, error.message);
  }
});

router.post('/verification/:id/review', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, reason } = req.body;
    
    const doc = verificationDocs.get(id);
    if (!doc) return notFound(res, 'Verification document not found');

    if ((decision === 'REJECTED' || decision === 'RESUBMIT_REQUIRED') && !reason) {
      return badRequest(res, 'Reason required for rejection or resubmission');
    }
    
    const validDecisions = ['APPROVED', 'REJECTED', 'RESUBMIT_REQUIRED'];
    if (!validDecisions.includes(decision)) {
      return badRequest(res, 'Invalid decision');
    }

    doc.status = decision;
    doc.reviewed_by = req.user.id;
    doc.review_reason = reason || null;
    doc.reviewed_at = new Date().toISOString();
    verificationDocs.set(id, doc);

    const user = users.get(doc.user_id);
    if (user) {
      user.verification_status = decision;
      users.set(user.id, user);

      if (decision === 'APPROVED' && user.role === 'DELIVERY_PARTNER') {
        const dpProfile = deliveryPartnerProfiles.get(user.id);
        if (dpProfile) {
          dpProfile.status = 'ONLINE';
          deliveryPartnerProfiles.set(user.id, dpProfile);
        }
      }
    }

    logAudit(req.user.id, 'VERIFICATION_REVIEWED', 'VerificationDocument', id, { decision });

    return success(res, {
      verification_id: id,
      status: decision
    });
  } catch (error) {
    return serverError(res, error.message);
  }
});

router.get('/admin/verification/queue', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { status } = req.query;
    let docs = findAll(verificationDocs);
    if (status) {
      docs = docs.filter(d => d.status === status);
    }
    
    const identifierCounts = {};
    findAll(verificationDocs).forEach(d => {
      const id = d.license_no || d.reg_no;
      if (id) {
        identifierCounts[id] = (identifierCounts[id] || 0) + 1;
      }
    });

    const enrichedDocs = docs.map(d => {
      const u = users.get(d.user_id);
      const id = d.license_no || d.reg_no;
      return {
        ...d,
        verification_id: d.id,
        email: u ? u.email : null,
        role: u ? u.role : null,
        flagged_duplicate: id ? identifierCounts[id] > 1 : false
      };
    });

    return success(res, enrichedDocs);
  } catch (error) {
    return serverError(res, error.message);
  }
});

export default router;
