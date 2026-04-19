import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';
import AddParkingSpace from './AddParkingSpace';

const ParkingManager = ({ user }) => {
  const [parkingSpaces, setParkingSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSpace, setEditingSpace] = useState(null);
  const [spaceBookings, setSpaceBookings] = useState({});
  const [expandedSpaces, setExpandedSpaces] = useState({});
  const [deletingSpace, setDeletingSpace] = useState(null);

  useEffect(() => {
    if (!showAddForm && !editingSpace) {
      fetchMyParkingSpaces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddForm, editingSpace]);

  const fetchMyParkingSpaces = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch parking spaces from parking service
      const spacesResponse = await fetch(API_ENDPOINTS.PARKING.MY_SPACES, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (spacesResponse.ok) {
        const spacesData = await spacesResponse.json();
        const spaces = spacesData.parkingSpaces || [];
        
        console.log('✅ Fetched parking spaces:', spaces);
        
        // Fetch ALL bookings for user's parking spaces from booking service
        const bookingsResponse = await fetch(API_ENDPOINTS.BOOKING.MY_PARKING_BOOKINGS, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (bookingsResponse.ok) {
          const bookingsData = await bookingsResponse.json();
          const allBookings = bookingsData.bookings || [];
          
          console.log('✅ Fetched all parking bookings:', allBookings);
          
          // Calculate earnings for each space
          const spacesWithEarnings = spaces.map(space => {
            // Filter completed bookings for this specific space
            const completedBookings = allBookings.filter(
              booking => booking.parkingSpaceId === space.id && booking.status === 'completed'
            );
            
            // Calculate total earnings
            const totalEarnings = completedBookings.reduce((sum, booking) => {
              return sum + (parseFloat(booking.totalCost) || 0);
            }, 0);
            
            console.log(`💰 Space ${space.id} (${space.address}): ${completedBookings.length} completed bookings = $${totalEarnings.toFixed(2)}`);
            
            return {
              ...space,
              totalEarnings: parseFloat(totalEarnings.toFixed(2))
            };
          });
          
          setParkingSpaces(spacesWithEarnings);
          await fetchBookingsForSpaces(spacesWithEarnings);
        } else {
          console.error('❌ Failed to fetch bookings');
          setParkingSpaces(spaces);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching parking spaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingsForSpaces = async (spaces) => {
    try {
      const token = localStorage.getItem('token');
      const bookingsMap = {};
      
      for (const space of spaces) {
        const response = await fetch(API_ENDPOINTS.BOOKING.ALL_FOR_SPACE(space.id), {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          bookingsMap[space.id] = data.bookings || [];
        }
      }
      
      setSpaceBookings(bookingsMap);
    } catch (error) {
      console.error('Error fetching space bookings:', error);
    }
  };

  const handleDeleteSpace = async (spaceId) => {
    if (!window.confirm('Are you sure you want to delete this parking space? This action cannot be undone.')) {
      return;
    }

    setDeletingSpace(spaceId);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.PARKING.DELETE(spaceId), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        alert('✅ Parking space deleted successfully!');
        fetchMyParkingSpaces();
      } else {
        alert(`❌ ${data.message || 'Failed to delete parking space'}`);
      }
    } catch (error) {
      console.error('Error deleting parking space:', error);
      alert('❌ Error deleting parking space: ' + error.message);
    } finally {
      setDeletingSpace(null);
    }
  };

  const toggleExpandSpace = (spaceId) => {
    setExpandedSpaces(prev => ({
      ...prev,
      [spaceId]: !prev[spaceId]
    }));
  };

  const handleEditSpace = (space) => {
    setEditingSpace(space);
    setShowAddForm(false);
  };

  const handleUpdateSpace = async (updatedData) => {
    try {
      const token = localStorage.getItem('token');
      console.log('Updating space:', editingSpace.id, 'with data:', updatedData);
      
      const response = await fetch(API_ENDPOINTS.PARKING.UPDATE(editingSpace.id), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
      });

      const data = await response.json();
      console.log('Update response:', data);

      if (response.ok) {
        alert('✅ Parking space updated successfully!');
        setEditingSpace(null);
        fetchMyParkingSpaces();
      } else {
        alert(`❌ ${data.message || 'Failed to update parking space'}`);
      }
    } catch (error) {
      console.error('Error updating parking space:', error);
      alert('❌ Error updating parking space: ' + error.message);
    }
  };

  const handleParkingSpaceAdded = () => {
    setShowAddForm(false);
    fetchMyParkingSpaces();
  };

  const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString();
  };

  const calculateDuration = (startTime, endTime) => {
    if (!startTime) return 'N/A';
    const durationMs = new Date(endTime || new Date()) - new Date(startTime);
    const durationHours = durationMs / (1000 * 60 * 60);
    
    if (durationHours < 1) {
      const minutes = Math.floor(durationHours * 60);
      return `${minutes} minutes`;
    } else {
      return `${durationHours.toFixed(1)} hours`;
    }
  };

  if (loading && !showAddForm && !editingSpace) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading your parking spaces...</div>;
  }

  if (showAddForm) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Add New Parking Space</h2>
          <button 
            onClick={() => setShowAddForm(false)}
            style={{
              background: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Back to My Spaces
          </button>
        </div>
        <AddParkingSpace 
          user={user} 
          onParkingSpaceAdded={handleParkingSpaceAdded}
        />
      </div>
    );
  }

  if (editingSpace) {
    return (
      <EditParkingSpace 
        space={editingSpace}
        onUpdate={handleUpdateSpace}
        onCancel={() => setEditingSpace(null)}
      />
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ color: '#333', margin: 0 }}>My Parking Spaces</h2>
        <button 
          onClick={() => setShowAddForm(true)}
          style={{
            background: '#28a745',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          + Add New Parking Space
        </button>
      </div>

      <div>
        {parkingSpaces.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '4rem 2rem', 
            background: 'white', 
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ color: '#333', marginBottom: '1rem' }}>No Parking Spaces Listed Yet</h3>
            <p style={{ color: '#666', marginBottom: '2rem' }}>Start earning by listing your first parking space!</p>
            <button 
              onClick={() => setShowAddForm(true)}
              style={{
                background: '#007bff',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontWeight: 'bold'
              }}
            >
              List Your First Parking Space
            </button>
          </div>
        ) : (
          parkingSpaces.map(space => (
            <div key={space.id} style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              marginBottom: '1.5rem',
              borderLeft: '4px solid #007bff',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>{space.address}</h3>
                  <p style={{ color: '#666', margin: '0 0 1rem 0', lineHeight: '1.5' }}>
                    {space.description || 'No description provided'}
                  </p>
                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <span style={{ color: '#28a745', fontWeight: 'bold' }}>
                      💰 ${space.pricePerHour}/hour
                    </span>
                    <span style={{ 
                      color: space.isAvailable ? '#28a745' : '#dc3545', 
                      fontWeight: 'bold' 
                    }}>
                      {space.isAvailable ? '✅ Available' : '🚗 Occupied'}
                    </span>
                    <span style={{ 
                      color: '#ffc107', 
                      fontWeight: 'bold',
                      fontSize: '1.05rem'
                    }}>
                      💵 Total Earnings: ${typeof space.totalEarnings === 'number' ? space.totalEarnings.toFixed(2) : '0.00'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column', minWidth: '140px' }}>
                  <button 
                    onClick={() => handleEditSpace(space)}
                    style={{
                      background: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    onClick={() => toggleExpandSpace(space.id)}
                    style={{
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    {expandedSpaces[space.id] ? '📖 Hide Bookings' : '📖 Show Bookings'}
                  </button>
                  <button 
                    onClick={() => handleDeleteSpace(space.id)}
                    disabled={deletingSpace === space.id}
                    style={{
                      background: deletingSpace === space.id ? '#6c757d' : '#dc3545',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      cursor: deletingSpace === space.id ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    {deletingSpace === space.id ? '🗑️ Deleting...' : '🗑️ Delete'}
                  </button>
                </div>
              </div>

              {expandedSpaces[space.id] && (
                <div style={{
                  borderTop: '1px solid #e9ecef',
                  paddingTop: '1rem',
                  marginTop: '1rem'
                }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: '#333' }}>Booking History</h4>
                  {spaceBookings[space.id]?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {spaceBookings[space.id].map(booking => (
                        <div key={booking.id} style={{
                          padding: '1rem',
                          background: '#f8f9fa',
                          borderRadius: '4px',
                          border: '1px solid #e9ecef'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                              <strong>User:</strong> {booking.User?.name || 'Unknown'}<br/>
                              <strong>From:</strong> {formatDateTime(booking.clockInTime)}<br/>
                              <strong>To:</strong> {booking.clockOutTime ? formatDateTime(booking.clockOutTime) : 'Active'}<br/>
                              <strong>Duration:</strong> {calculateDuration(booking.clockInTime, booking.clockOutTime)}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ 
                                color: booking.status === 'active' ? '#28a745' : 
                                       booking.status === 'completed' ? '#6c757d' : '#dc3545',
                                fontWeight: 'bold'
                              }}>
                                {booking.status.toUpperCase()}
                              </span><br/>
                              {booking.totalCost > 0 && (
                                <span style={{ color: '#ffc107', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                  💵 ${booking.totalCost.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#666', textAlign: 'center', padding: '1rem' }}>
                      No bookings yet for this space
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const EditParkingSpace = ({ space, onUpdate, onCancel }) => {
  const [formData, setFormData] = useState({
    address: space.address,
    description: space.description || '',
    pricePerHour: space.pricePerHour
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onUpdate(formData);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Edit Parking Space</h2>
        <button onClick={onCancel} style={{
          background: '#6c757d',
          color: 'white',
          border: 'none',
          padding: '0.75rem 1.5rem',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          ← Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>
            Address *
          </label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe your parking space..."
            rows="4"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem',
              boxSizing: 'border-box',
              resize: 'vertical',
              minHeight: '100px'
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>
            Price Per Hour ($) *
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            name="pricePerHour"
            value={formData.pricePerHour}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{
            width: '100%',
            padding: '1rem',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Updating...' : '💾 Update Parking Space'}
        </button>
      </form>
    </div>
  );
};

export default ParkingManager;