import React, { useState, useEffect } from 'react';
import './App.css';
import Login from './components/Login';
import Signup from './components/Signup';
import { API_ENDPOINTS } from './config/api';
import Dashboard from './components/Dashboard';
import MapView from './components/MapView';
import ParkingManager from './components/ParkingManager';

function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [activeBooking, setActiveBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
      setCurrentView('dashboard');
      fetchActiveBooking(token);
    } else {
      setLoading(false);
    }
  }, []);

  // Add this useEffect to refetch active booking when view changes to dashboard
  useEffect(() => {
    if (currentView === 'dashboard' && user) {
      fetchActiveBooking();
    }
  }, [currentView, user, refreshTrigger]);

  const fetchActiveBooking = async (token = null) => {
    try {
      const authToken = token || localStorage.getItem('token');
      if (!authToken) return;

      console.log('🔄 Fetching active booking...');
      const response = await fetch(API_ENDPOINTS.BOOKING.MY_BOOKINGS, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const active = data.bookings?.find(booking => booking.status === 'active');
        console.log('✅ Fetched active booking:', active);
        setActiveBooking(active);
      }
    } catch (error) {
      console.error('❌ Error fetching active booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setCurrentView('dashboard');
    fetchActiveBooking(token);
  };

  const handleLogout = () => {
    setUser(null);
    setActiveBooking(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentView('login');
  };

  // Function to update active booking (to be passed to children)
  const updateActiveBooking = async (booking) => {
    console.log('📝 Updating active booking in App.js:', booking);
    setActiveBooking(booking);
    // Force immediate refetch to ensure sync
    await fetchActiveBooking();
  };

  // Function to force refresh active booking - IMPROVED VERSION
const refreshActiveBooking = async () => {
  console.log('🔄 Force refreshing active booking...');
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const response = await fetch(API_ENDPOINTS.BOOKING.MY_BOOKINGS, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const active = data.bookings?.find(booking => booking.status === 'active');
      console.log('✅ Refreshed active booking:', active);
      setActiveBooking(active);
    }
  } catch (error) {
    console.error('❌ Error refreshing active booking:', error);
  }
  setRefreshTrigger(prev => prev + 1);
};

  if (loading) {
    return <div className="app-loading">Loading...</div>;
  }

  return (
    <div className="App">
      <header className="app-header">
        <h1>PARKING - A LOT</h1>
        {user && (
          <div className="user-info">
            <span>Welcome, {user.name}</span>
            {activeBooking && (
              <span className="active-booking-indicator">
                🚗 Active Booking
              </span>
            )}
            <button onClick={handleLogout}>Logout</button>
          </div>
        )}
      </header>

      <main>
        {!user ? (
          <>
            {currentView === 'login' ? (
              <Login onLogin={handleLogin} onSwitchToSignup={() => setCurrentView('signup')} />
            ) : (
              <Signup onSignup={handleLogin} onSwitchToLogin={() => setCurrentView('login')} />
            )}
          </>
        ) : (
          <>
            <nav className="app-nav">
              <button 
                onClick={() => setCurrentView('dashboard')}
                className={currentView === 'dashboard' ? 'active' : ''}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setCurrentView('map')}
                className={currentView === 'map' ? 'active' : ''}
              >
                Find Parking
              </button>
              <button 
                onClick={() => setCurrentView('my-parking')}
                className={currentView === 'my-parking' ? 'active' : ''}
              >
                My Parking Spaces
              </button>
            </nav>

            {currentView === 'dashboard' && (
              <Dashboard 
                user={user} 
                activeBooking={activeBooking}
                onRefreshBookings={refreshActiveBooking}
                onNavigateToParking={() => setCurrentView('map')}
              />
            )}
            {currentView === 'map' && (
              <MapView 
                user={user} 
                activeBooking={activeBooking}
                onActiveBookingChange={updateActiveBooking}
                onRefreshBookings={refreshActiveBooking}
              />
            )}
            {currentView === 'my-parking' && (
              <ParkingManager user={user} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;