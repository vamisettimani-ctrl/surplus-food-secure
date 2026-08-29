import { useState, useEffect } from 'react';
import { listingsService } from '../services/listings';

export default function BrowseBoardPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listingsService.getBoard()
      .then((res) => setListings(res.data || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, []);

  const handleClaim = async (id) => {
    try {
      await listingsService.claim(id);
      setListings((prev) => prev.filter((l) => l.id !== id));
      alert('Listing successfully claimed! Handover arranged.');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to claim listing.');
    }
  };

  if (loading) return <div className="loading">Loading board listings...</div>;

  return (
    <div className="stitch-dashboard">
      <div className="dashboard-banner">
        <div className="banner-text">
          <span className="banner-eyebrow">Open Intake Pool</span>
          <h1>Public Food Rescue Board</h1>
          <p>Unmatched or radius-widened food rescue listings available for voluntary manual claim by any verified NGO.</p>
        </div>
      </div>

      <div className="stitch-section-card">
        <div className="section-card-header">
          <div>
            <h2>Available Listings on Open Board</h2>
            <p>First-come first-served claim with instant confirmation</p>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {listings.length === 0 ? (
            <div className="empty-inbox">
              <div className="empty-title">No unassigned listings on the public board</div>
              <p>All active listings have already been auto-matched to nearby shelters.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {listings.map((l) => (
                <div
                  key={l.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '4px' }}>
                        {l.donor_name || 'Restaurant'}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>
                        {l.distance_km != null ? `${l.distance_km.toFixed(1)} km away` : 'Nearby'}
                      </span>
                    </div>

                    <h3 style={{ margin: '0 0 10px', fontSize: '16px', color: '#0f172a', fontWeight: 700 }}>
                      {l.food_type}
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#334155', marginBottom: '18px' }}>
                      <div><span style={{ color: '#64748b' }}>Quantity:</span> <strong>{l.quantity_meals} meals</strong></div>
                      <div><span style={{ color: '#64748b' }}>Best Before:</span> {new Date(l.best_before_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div><span style={{ color: '#64748b' }}>Location:</span> {l.address || `${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}`}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleClaim(l.id)}
                    style={{
                      width: '100%',
                      padding: '11px',
                      background: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    Claim This Surplus Food
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
