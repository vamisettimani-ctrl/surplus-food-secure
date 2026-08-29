import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDemoData } from '../context/DemoDataContext';
import { listingsService } from '../services/listings';
import { PERISHABILITY, ROLES } from '../config/constants';
import './CreateListingPage.css';

export default function CreateListingPage() {
  const { user } = useAuth();
  const { createListing } = useDemoData();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const isDonor = user?.role === ROLES.INDIVIDUAL_DONOR;

  const [form, setForm] = useState({
    food_type: isDonor ? 'Home Cooked Chapati & Dal Tadka' : 'Fresh Cooked Veg Biryani & Raita Platters',
    quantity_meals: isDonor ? '15' : '50',
    perishability: PERISHABILITY.HIGHLY_PERISHABLE,
    best_before_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 16),
    pickup_start: new Date(Date.now() + 0.5 * 3600 * 1000).toISOString().slice(0, 16),
    pickup_end: new Date(Date.now() + 2.5 * 3600 * 1000).toISOString().slice(0, 16),
    lat: '28.613939',
    lng: '77.209021',
    safety_ack: true,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleGetLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((prev) => ({ ...prev, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })),
      () => alert('Using default location coordinates for simulation.')
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        donor_id: user?.user_id,
        donor_name: user?.org_name || user?.email?.split('@')[0],
        donor_role: user?.role,
        food_type: form.food_type,
        quantity_meals: parseInt(form.quantity_meals) || 10,
        perishability: form.perishability,
        best_before_at: new Date(form.best_before_at).toISOString(),
        pickup_window: {
          start: new Date(form.pickup_start).toISOString(),
          end: new Date(form.pickup_end).toISOString(),
        },
        lat: parseFloat(form.lat) || 28.6139,
        lng: parseFloat(form.lng) || 77.2090,
        address: user?.address || '80ft Road, Koramangala 4th Block, Bengaluru',
        safety_ack: form.safety_ack,
      };

      await listingsService.create(payload);
      navigate('/dashboard/listings');
    } catch (err) {
      const errMsg = err.response?.data?.error?.message;
      if (Array.isArray(errMsg)) {
        setError(errMsg.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
      } else if (typeof errMsg === 'object' && errMsg !== null) {
        setError(JSON.stringify(errMsg));
      } else {
        setError(errMsg || 'Failed to publish listing.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stitch-create-layout">
      {/* Form Column */}
      <div className="create-form-column">
        <div className="create-header">
          <span className="create-eyebrow">
            {isDonor ? 'Residential Food Donation' : 'Commercial Surplus Intake'}
          </span>
          <h1>{isDonor ? 'Donate Home-Cooked Food' : 'Declare Kitchen Surplus'}</h1>
          <p>Publish fresh surplus meals to trigger deterministic distance-first AI matching.</p>
        </div>

        {error && <div className="form-alert error">{error}</div>}

        <form onSubmit={handleSubmit} className="stitch-form-body">
          <div className="form-card">
            <div className="form-card-title">Food & Portion Details</div>

            <div className="form-field">
              <label>Food Item Description *</label>
              <input
                name="food_type"
                value={form.food_type}
                onChange={handleChange}
                placeholder="e.g. Cooked rice, dal, vegetable curry"
                required
              />
            </div>

            <div className="form-row-2">
              <div className="form-field">
                <label>Portions (Estimated Meals) *</label>
                <input
                  name="quantity_meals"
                  type="number"
                  min="1"
                  max={isDonor ? "50" : "500"}
                  value={form.quantity_meals}
                  onChange={handleChange}
                  required
                />
                {isDonor && <span style={{ fontSize: '11px', color: '#64748b' }}>Individual donors capped at 50 meals</span>}
              </div>

              <div className="form-field">
                <label>Perishability Classification *</label>
                <select name="perishability" value={form.perishability} onChange={handleChange}>
                  <option value="HIGHLY_PERISHABLE">Highly Perishable (Cooked food, &lt;6 hrs)</option>
                  <option value="MODERATE">Moderate (Baked goods, fresh produce)</option>
                  <option value="PACKAGED_SHELF_STABLE">Packaged / Shelf Stable</option>
                </select>
              </div>
            </div>

            <div className="form-field">
              <label>Best Before Date & Time *</label>
              <input
                name="best_before_at"
                type="datetime-local"
                value={form.best_before_at}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-card">
            <div className="form-card-title">Pickup Logistics & Coordinates</div>

            <div className="form-row-2">
              <div className="form-field">
                <label>Pickup Available From *</label>
                <input
                  name="pickup_start"
                  type="datetime-local"
                  value={form.pickup_start}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-field">
                <label>Pickup Closes At *</label>
                <input
                  name="pickup_end"
                  type="datetime-local"
                  value={form.pickup_end}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-row-location">
              <div className="form-field">
                <label>Latitude</label>
                <input name="lat" value={form.lat} onChange={handleChange} required />
              </div>
              <div className="form-field">
                <label>Longitude</label>
                <input name="lng" value={form.lng} onChange={handleChange} required />
              </div>
              <button type="button" className="location-btn" onClick={handleGetLocation}>
                GPS Coordinates
              </button>
            </div>
          </div>

          {isDonor && (
            <div className="form-card safety-card">
              <label className="safety-checkbox">
                <input
                  name="safety_ack"
                  type="checkbox"
                  checked={form.safety_ack}
                  onChange={handleChange}
                  required
                />
                <span>
                  <strong>Food Safety Guarantee:</strong> I verify that this food was prepared in a hygienic kitchen, kept properly covered/refrigerated, and is completely fit for human consumption.
                </span>
              </label>
            </div>
          )}

          <div className="form-submit-row">
            <button type="submit" className="stitch-btn-submit" disabled={loading}>
              {loading ? 'Enqueuing AI Dispatch...' : 'Publish & Dispatch via AI Matching'}
            </button>
          </div>
        </form>
      </div>

      {/* Live Preview Column */}
      <div className="create-preview-column">
        <div className="preview-sticky-card">
          <div className="preview-label">Live Matching Preview</div>

          <div className="preview-card-box">
            <div className="preview-card-header">
              <span className="preview-tag">Surplus Declaration</span>
              <span className="preview-status">Ready to Publish</span>
            </div>

            <h3 className="preview-title">{form.food_type || 'Untitled Listing'}</h3>

            <div className="preview-stats">
              <div className="preview-stat-item">
                <span className="p-label">Portions</span>
                <span className="p-val">{form.quantity_meals || 0} meals</span>
              </div>
              <div className="preview-stat-item">
                <span className="p-label">Perishability</span>
                <span className="p-val">
                  {form.perishability === 'HIGHLY_PERISHABLE' ? 'High Priority' : 'Standard'}
                </span>
              </div>
            </div>

            <div className="preview-ai-box">
              <div className="ai-box-title">AI Matching Engine Simulation</div>
              <div className="ai-box-text">
                On submission, this listing will trigger the deterministic eligibility filter across all verified NGOs within 7km, locking an offer for 10 minutes with zero race conditions.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
