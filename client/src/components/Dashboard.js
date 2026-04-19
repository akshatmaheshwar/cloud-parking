import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';
import './Dashboard.css';

const Dashboard = ({ user, activeBooking, onRefreshBookings, onNavigateToParking }) => {
  const [stats, setStats] = useState({
    totalSpaces: 0,
    activeBookings: 0,
    totalEarnings: 0,
    completedBookings: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [localActiveBooking, setLocalActiveBooking] = useState(activeBooking);

  useEffect(() => {
    setLocalActiveBooking(activeBooking);
  }, [activeBooking]);

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localActiveBooking]);

  useEffect(() => {
    let interval;
    if (localActiveBooking) {
      interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [localActiveBooking]);

  const formatDuration = (startTime, endTime = new Date()) => {
    const durationMs = new Date(endTime) - new Date(startTime);
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} hrs`;
  };

  const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString();
  };

  const calculateSimpleDuration = (startTime, endTime = new Date()) => {
    const durationMs = new Date(endTime) - new Date(startTime);
    const durationHours = durationMs / (1000 * 60 * 60);
    
    if (durationHours < 1) {
      const minutes = Math.floor(durationHours * 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${durationHours.toFixed(1)} hour${durationHours !== 1 ? 's' : ''}`;
    }
  };

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch user's parking spaces
      const spacesResponse = await fetch(API_ENDPOINTS.PARKING.MY_SPACES, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Fetch user's bookings
      const bookingsResponse = await fetch(API_ENDPOINTS.BOOKING.MY_BOOKINGS, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Fetch bookings for user's parking spaces (earnings)
      const earningsResponse = await fetch(API_ENDPOINTS.BOOKING.MY_PARKING_BOOKINGS, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const spacesData = await spacesResponse.json();
      const bookingsData = await bookingsResponse.json();
      const earningsData = await earningsResponse.json();

      const userSpaces = spacesData.parkingSpaces || [];

      const completedEarnings = earningsData.bookings
        ?.filter(booking => booking.status === 'completed')
        .reduce((total, booking) => total + booking.totalCost, 0) || 0;

      setStats({
        totalSpaces: userSpaces.length,
        activeBookings: localActiveBooking ? 1 : 0,
        totalEarnings: completedEarnings,
        completedBookings: bookingsData.bookings?.filter(b => b.status === 'completed').length || 0
      });

      const bookingsWithDuration = bookingsData.bookings?.map(booking => ({
        ...booking,
        duration: calculateSimpleDuration(booking.clockInTime, booking.clockOutTime || new Date()),
        formattedDuration: formatDuration(booking.clockInTime, booking.clockOutTime || new Date())
      })) || [];

      setRecentBookings(bookingsWithDuration.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectClockOut = async () => {
    if (!localActiveBooking) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.BOOKING.CLOCK_OUT(localActiveBooking.id), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✅ Clock out successful! Total cost: $${data.booking.totalCost}`);
        setLocalActiveBooking(null);
        onRefreshBookings();
        fetchDashboardData();
      } else {
        alert(`❌ Clock out failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Error clocking out:', error);
      alert('❌ Network error during clock out');
    }
  };

  const calculateCurrentCost = () => {
    if (!localActiveBooking) return 0;
    const durationMs = currentTime - new Date(localActiveBooking.clockInTime);
    const durationHours = durationMs / (1000 * 60 * 60);
    return (durationHours * localActiveBooking.ParkingSpace?.pricePerHour || 0).toFixed(2);
  };

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <h2>Welcome back, {user.name}!</h2>
      
      {localActiveBooking && (
        <div className="active-booking-alert">
          <h3>🚗 You have an active parking session</h3>
          <div className="booking-details">
            <p><strong>Location:</strong> {localActiveBooking.ParkingSpace?.address}</p>
            <p><strong>Started:</strong> {formatDateTime(localActiveBooking.clockInTime)}</p>
            <p><strong>Current Duration:</strong> 
              <span className="live-duration">
                {formatDuration(localActiveBooking.clockInTime, currentTime)}
              </span>
            </p>
            <p><strong>Current Cost:</strong> 
              <span className="live-cost">${calculateCurrentCost()}</span>
            </p>
          </div>
          <div className="clock-out-container">
            <button 
              onClick={handleDirectClockOut}
              className="clock-out-btn centered"
            >
              🕐 Clock Out Now
            </button>
          </div>
        </div>
      )}
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>My Parking Spaces</h3>
          <div className="stat-number">{stats.totalSpaces}</div>
        </div>
        
        <div className="stat-card">
          <h3>Active Bookings</h3>
          <div className="stat-number">{stats.activeBookings}</div>
        </div>
        
        <div className="stat-card">
          <h3>Total Earnings</h3>
          <div className="stat-number">${stats.totalEarnings.toFixed(2)}</div>
        </div>
        
        <div className="stat-card">
          <h3>Completed Bookings</h3>
          <div className="stat-number">{stats.completedBookings}</div>
        </div>
      </div>

      <div className="recent-bookings">
        <h3>Recent Bookings</h3>
        {recentBookings.length === 0 ? (
          <p>No recent bookings</p>
        ) : (
          <div className="bookings-list">
            {recentBookings.map(booking => (
              <div key={booking.id} className="booking-item">
                <div className="booking-info">
                  <strong>{booking.ParkingSpace?.address}</strong>
                  <div className="booking-timeline">
                    <span>From: {formatDateTime(booking.clockInTime)}</span>
                    <span>To: {booking.clockOutTime ? formatDateTime(booking.clockOutTime) : 'Active'}</span>
                    <span>Duration: {booking.formattedDuration}</span>
                  </div>
                  <span className={`status ${booking.status}`}>
                    Status: {booking.status}
                  </span>
                  {booking.totalCost > 0 && (
                    <span className="cost">Cost: ${booking.totalCost}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;