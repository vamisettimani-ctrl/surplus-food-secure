import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { verificationService } from '../services/verification';
import { uploadService } from '../services/uploads';
import { ROLES, VEHICLE_TYPES } from '../config/constants';

export default function VerificationSubmitPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    license_no: '',
    reg_no: '',
    org_name: '',
    address_place_id: '',
    service_radius_km: '5',
    daily_capacity: '100',
    open_time: '08:00',
    close_time: '21:00',
    vehicle_type: VEHICLE_TYPES.BIKE,
    file: null,
    selfie: null,
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setForm((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const role = user?.role;
      let payload = {};

      if (role === ROLES.RESTAURANT || role === ROLES.INDIVIDUAL_DONOR) {
        const fileUrl = await uploadService.uploadFile(form.file, 'VERIFICATION_DOC');
        payload = { doc_type: 'FSSAI_LICENSE', license_no: form.license_no, file_url: fileUrl };
      } else if (role === ROLES.NGO) {
        const fileUrl = await uploadService.uploadFile(form.file, 'VERIFICATION_DOC');
        payload = {
          doc_type: 'NGO_REGISTRATION',
          reg_no: form.reg_no,
          org_name: form.org_name,
          address_place_id: form.address_place_id,
          service_radius_km: parseInt(form.service_radius_km),
          daily_capacity: parseInt(form.daily_capacity),
          operating_hours: { open: form.open_time, close: form.close_time },
          file_url: fileUrl,
        };
      } else if (role === ROLES.DELIVERY_PARTNER) {
        const idFileUrl = await uploadService.uploadFile(form.file, 'VERIFICATION_DOC');
        const selfieUrl = await uploadService.uploadFile(form.selfie, 'LIVENESS_SELFIE');
        payload = { doc_type: 'GOVT_ID', vehicle_type: form.vehicle_type, id_file_url: idFileUrl, selfie_file_url: selfieUrl };
      }

      await verificationService.submit(payload);
      updateUser({ verification_status: 'PENDING' });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Submission failed. Please check your document inputs.');
    } finally {
      setLoading(false);
    }
  };

  const role = user?.role;

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Submit Verification Documents</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
            Identity and license verification is required before you can list, claim, or deliver surplus food.
          </p>
        </div>
        <button 
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
          style={{ padding: '8px 14px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', color: '#475569', fontWeight: 600, cursor: 'pointer', flexShrink: 0, marginLeft: '12px' }}
        >
          Sign Out
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', fontSize: '13px', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {(role === ROLES.RESTAURANT || role === ROLES.INDIVIDUAL_DONOR) && (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              FSSAI License / Business Registration Number *
              <input
                name="license_no"
                value={form.license_no}
                onChange={handleChange}
                placeholder="14-digit FSSAI or registration number"
                required
                style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Upload License Certificate Photo / PDF *
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleChange}
                required
                style={{ marginTop: '4px' }}
              />
            </label>
          </>
        )}

        {role === ROLES.NGO && (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              NGO / Trust Name *
              <input
                name="org_name"
                value={form.org_name}
                onChange={handleChange}
                required
                style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Registration Number (80G / 12A / Society) *
              <input
                name="reg_no"
                value={form.reg_no}
                onChange={handleChange}
                required
                style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Service Radius (km)
                <input
                  name="service_radius_km"
                  type="number"
                  value={form.service_radius_km}
                  onChange={handleChange}
                  style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Daily Capacity (meals)
                <input
                  name="daily_capacity"
                  type="number"
                  value={form.daily_capacity}
                  onChange={handleChange}
                  style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </label>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Registration Certificate File *
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleChange}
                required
                style={{ marginTop: '4px' }}
              />
            </label>
          </>
        )}

        {role === ROLES.DELIVERY_PARTNER && (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Vehicle Mode
              <select
                name="vehicle_type"
                value={form.vehicle_type}
                onChange={handleChange}
                style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="BIKE">Two Wheeler / Bike</option>
                <option value="ON_FOOT">On Foot (Walk)</option>
                <option value="CAR">Four Wheeler / Car</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Government Photo ID *
              <input
                name="file"
                type="file"
                accept="image/*"
                onChange={handleChange}
                required
                style={{ marginTop: '4px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Live Liveness Selfie *
              <input
                name="selfie"
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleChange}
                required
                style={{ marginTop: '4px' }}
              />
            </label>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px',
            background: '#15803d',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            marginTop: '8px'
          }}
        >
          {loading ? 'Submitting verification...' : 'Submit Verification'}
        </button>
      </form>
    </div>
  );
}
