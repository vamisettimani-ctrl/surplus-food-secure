import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listingsService } from '../services/listings';
import { LISTING_STATUS } from '../config/constants';

export default function MyListingsPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const params = filter ? { status: filter } : {};
    listingsService.getMine(params)
      .then((res) => setListings(res.data || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [filter]);

  const handleCancel = async (id) => {
    const reason = prompt('Please provide a reason for cancellation:');
    if (!reason) return;
    try {
      await listingsService.cancel(id, reason);
      setListings((prev) => prev.map((l) => l.id === id ? { ...l, status: 'CANCELLED' } : l));
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to cancel listing.');
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case LISTING_STATUS.LISTED: return 'chip-blue';
      case LISTING_STATUS.MATCHED_PENDING_NGO_ACCEPT: return 'chip-amber';
      case LISTING_STATUS.NGO_ACCEPTED: return 'chip-teal';
      case LISTING_STATUS.DELIVERY_ASSIGNED: return 'chip-purple';
      case LISTING_STATUS.PICKED_UP: return 'chip-indigo';
      case LISTING_STATUS.DELIVERED: return 'chip-green';
      default: return 'chip-gray';
    }
  };

  if (loading) return <div className="loading">Loading listings...</div>;

  return (
    <div className="stitch-dashboard">
      <div className="dashboard-banner">
        <div className="banner-text">
          <span className="banner-eyebrow">Dispatch Records</span>
          <h1>My Food Rescue Listings</h1>
          <p>Complete lifecycle history of all declared surplus meals and real-time delivery status tracking.</p>
        </div>
        <div className="banner-actions">
          <Link to="/dashboard/listings/new" style={{ padding: '10px 16px', background: '#15803d', color: '#ffffff', borderRadius: '6px', fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}>
            Create Listing
          </Link>
        </div>
      </div>

      <div className="stitch-section-card">
        <div className="section-card-header">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilter('')}
              style={{
                padding: '6px 14px',
                borderRadius: '4px',
                border: !filter ? '1px solid #15803d' : '1px solid #cbd5e1',
                background: !filter ? '#15803d' : '#ffffff',
                color: !filter ? '#ffffff' : '#475569',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              All
            </button>
            {Object.values(LISTING_STATUS).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: filter === s ? '1px solid #15803d' : '1px solid #cbd5e1',
                  background: filter === s ? '#15803d' : '#ffffff',
                  color: filter === s ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="stitch-table-wrapper">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Food Description</th>
                <th>Quantity</th>
                <th>Perishability</th>
                <th>Best Before</th>
                <th>Assigned Destination</th>
                <th>Dispatch Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    No listings match the selected filter.
                  </td>
                </tr>
              ) : (
                listings.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="item-title">{item.food_type}</div>
                      <div className="item-id">ID: {item.id} · Created {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td>
                      <span className="qty-highlight">{item.quantity_meals} meals</span>
                    </td>
                    <td>
                      <span className="perish-tag">
                        {item.perishability === 'HIGHLY_PERISHABLE' ? 'Urgent (<6 hrs)' : 'Moderate'}
                      </span>
                    </td>
                    <td>{new Date(item.best_before_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <span className="entity-name">{item.matched_ngo_name || 'Searching AI Pool...'}</span>
                      {item.assigned_partner_name && (
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Rider: {item.assigned_partner_name}</div>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${getStatusBadgeClass(item.status)}`}>
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      {!['DELIVERED', 'EXPIRED', 'CANCELLED'].includes(item.status) && (
                        <button
                          type="button"
                          onClick={() => handleCancel(item.id)}
                          style={{
                            padding: '6px 12px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: '#dc2626',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                            transition: 'all 0.15s',
                          }}
                          onMouseOver={(e) => { e.target.style.background = '#fee2e2'; }}
                          onMouseOut={(e) => { e.target.style.background = '#ffffff'; }}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
