import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './VerificationPendingPage.css';

export default function VerificationPendingPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.name || user?.email || 'User';

  return (
    <div className="verification-pending-page">
      <div className="verification-pending-card">
        <div className="verification-pending-icon">
          <span>⏳</span>
        </div>
        <h2>Verification Pending</h2>
        <p className="verification-pending-text">
          Your account is currently being reviewed by our administrators. You will receive access once your submitted documents are verified.
        </p>
        <div className="verification-pending-footer">
          <span className="verification-pending-user">
            Logged in as: <strong>{displayName}</strong>
          </span>
          <button 
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="verification-pending-btn"
          >
            Sign Out / Switch Account
          </button>
        </div>
      </div>
    </div>
  );
}
