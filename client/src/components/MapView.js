import React, { useState, useEffect, useRef } from 'react';
import { API_ENDPOINTS } from '../config/api';
import './MapView.css';

const MapView = ({ user, activeBooking: activeBookingProp, onActiveBookingChange, onRefreshBookings }) => {
  const [parkingSpaces, setParkingSpaces] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [spaceActiveBooking, setSpaceActiveBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [localActiveBooking, setLocalActiveBooking] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const searchInputRef = useRef(null);
  const searchMarkerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Use local state if it exists, otherwise use prop
  const [activeBooking, setActiveBooking] = useState(activeBookingProp || null);

  // Sync local state with prop
  useEffect(() => {
    console.log('🔄 MapView: Active booking prop changed', activeBookingProp);
    fetchParkingSpaces();
    if (activeBookingProp && activeBookingProp.id !== activeBooking?.id) {
      setActiveBooking(activeBookingProp);
    }
    if (!activeBookingProp && activeBooking) {
      setActiveBooking(null);
    }
    // If the active booking changed and we have a selected space, refresh its active booking status
    if (selectedSpace) {
      checkActiveBookingForSpace(selectedSpace.id);
    }
  }, [activeBookingProp, selectedSpace]);

    useEffect(() => {
      fetchParkingSpaces();
    }, []);

  useEffect(() => {
    if (parkingSpaces.length > 0 && !mapLoaded) {
      loadGoogleMaps();
    } else if (mapLoaded && parkingSpaces.length > 0) {
      addMarkersToMap(parkingSpaces);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parkingSpaces, mapLoaded]);

  useEffect(() => {
    if (selectedSpace) {
      checkActiveBookingForSpace(selectedSpace.id);
    }
  }, [selectedSpace]);

  useEffect(() => {
    let interval;
    if (activeBooking) {
      console.log('Active booking detected:', activeBooking);
      interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    } else {
      console.log('No active booking');
    }
    return () => clearInterval(interval);
  }, [activeBooking]);

  // Remove autocomplete initialization - we'll use Nominatim instead
  useEffect(() => {
    // No autocomplete needed - we'll use manual search with Nominatim
  }, [mapLoaded]);

  // Debounced search for location suggestions
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Don't search if input is too short
    if (value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Set new timeout for search
    searchTimeoutRef.current = setTimeout(() => {
      searchLocationSuggestions(value);
    }, 500); // Wait 500ms after user stops typing
  };

  const searchLocationSuggestions = async (query) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=au,ie`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        setSuggestions(data);
        setShowSuggestions(true);
      } else {
        // Show "no results" message
        setSuggestions([{ noResults: true }]);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const selectSuggestion = (suggestion) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    
    setSearchQuery(suggestion.display_name);
    
    if (mapInstanceRef.current) {
      // Clear previous search marker if exists
      if (searchMarkerRef.current) {
        searchMarkerRef.current.setMap(null);
      }

      // CRITICAL: Center and zoom to the searched location
      mapInstanceRef.current.setCenter({ lat, lng });
      mapInstanceRef.current.setZoom(14);
      
      // Add temporary marker for searched location
      const searchMarker = new window.google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current,
        icon: {
          url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
          scaledSize: new window.google.maps.Size(40, 40)
        },
        title: 'Searched Location',
        animation: window.google.maps.Animation.DROP
      });
      
      searchMarkerRef.current = searchMarker;
      
      // Remove the search marker after 8 seconds
      setTimeout(() => {
        if (searchMarkerRef.current) {
          searchMarkerRef.current.setMap(null);
          searchMarkerRef.current = null;
        }
      }, 8000);
    }

    setSuggestions([]);
    setShowSuggestions(false);
  };

  const searchLocation = async () => {
    const address = searchQuery.trim();
    if (!address) {
      alert('Please enter a location to search');
      return;
    }

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const firstResult = data[0];
        const lat = parseFloat(firstResult.lat);
        const lng = parseFloat(firstResult.lon);
        
        if (mapInstanceRef.current) {
          // Clear previous search marker if exists
          if (searchMarkerRef.current) {
            searchMarkerRef.current.setMap(null);
          }

          // CRITICAL: Center and zoom to the searched location
          mapInstanceRef.current.setCenter({ lat, lng });
          mapInstanceRef.current.setZoom(17);
          
          // Add temporary marker for searched location
          const searchMarker = new window.google.maps.Marker({
            position: { lat, lng },
            map: mapInstanceRef.current,
            icon: {
              url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
              scaledSize: new window.google.maps.Size(40, 40)
            },
            title: 'Searched Location',
            animation: window.google.maps.Animation.DROP
          });
          
          searchMarkerRef.current = searchMarker;
          
          // Remove the search marker after 8 seconds
          setTimeout(() => {
            if (searchMarkerRef.current) {
              searchMarkerRef.current.setMap(null);
              searchMarkerRef.current = null;
            }
          }, 8000);
        }
      } else {
        alert('Location not found. Please try a different search term.');
      }
    } catch (error) {
      console.error('Error searching location:', error);
      alert('Error searching for location. Please try again.');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    searchLocation();
  };

  const loadGoogleMaps = () => {
    if (window.google && mapInstanceRef.current) {
      addMarkersToMap(parkingSpaces);
      setLoading(false);
      return;
    }

    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyA_6jxC90Yy_pId70gLoOhU2Uf0oj3kkMk&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        console.error('Failed to load Google Maps script');
        setLoading(false);
      };
      document.head.appendChild(script);
      
      script.onload = () => {
        console.log('Google Maps script loaded');
        initMap();
      };
    } else {
      initMap();
    }
  };

  const initMap = () => {
    if (!window.google || !mapRef.current) {
      console.error('Google Maps not available or map container not found');
      setLoading(false);
      return;
    }

    const defaultLocation = { lat: -27.4698, lng: 153.0251 };
    
    try {
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }

      const mapInstance = new window.google.maps.Map(mapRef.current, {
        zoom: 13,
        center: defaultLocation,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }]
          }
        ]
      });

      mapInstanceRef.current = mapInstance;
      setMapLoaded(true);
      addMarkersToMap(parkingSpaces);
      setLoading(false);
    } catch (error) {
      console.error('Error initializing map:', error);
      setLoading(false);
    }
  };

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

  const calculateCurrentCost = () => {
    if (!activeBooking) return 0;
    const durationMs = currentTime - new Date(activeBooking.clockInTime);
    const durationHours = durationMs / (1000 * 60 * 60);
    return (durationHours * activeBooking.ParkingSpace?.pricePerHour || 0).toFixed(2);
  };

  const fetchParkingSpaces = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.PARKING.ALL, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      // Use functional update to ensure state change
      setParkingSpaces(prev => data.parkingSpaces || []);
      
      // Re-add markers if map is loaded
      if (mapLoaded && window.google) {
        setTimeout(() => {
          addMarkersToMap(data.parkingSpaces || []);
        }, 100);
      }
    } catch (error) {
      console.error('Error fetching parking spaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkActiveBookingForSpace = async (parkingSpaceId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.BOOKING.ACTIVE_FOR_SPACE(parkingSpaceId), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success && data.booking) {
        setSpaceActiveBooking(data.booking);
      } else {
        setSpaceActiveBooking(null);
      }
    } catch (error) {
      console.error('Error checking active booking:', error);
      setSpaceActiveBooking(null);
    }
  };

  const handleClockIn = async (parkingSpaceId) => {
    if (!user) {
      alert('Please log in to book a parking space');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.BOOKING.CLOCK_IN(parkingSpaceId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log('✅ Clock in successful, updating UI...');
        
        // Update local state immediately
        setLocalActiveBooking(data.booking);
        setSpaceActiveBooking(data.booking);
        setSelectedSpace(null);
        // Force refresh parking spaces to update availability
        setActiveBooking(data.booking); 
        await fetchParkingSpaces();
        
        // Notify parent component and wait for it to complete
        if (onActiveBookingChange) {
          await onActiveBookingChange(data.booking);
        }
        
        // Refresh bookings in parent
        if (onRefreshBookings) {
          await onRefreshBookings();
        }
        
        console.log('✅ All updates complete');
        alert('✅ Successfully clocked in! Enjoy your parking.');
      } else {
        alert(`❌ ${data.message + response|| 'Failed to clock in. Please try again.'}`);
      }
    } catch (error) {
      console.error('Error clocking in:', error);
      alert('❌ Network error occurred while clocking in. Please check your connection and try again.');
    }
  };

  const handleClockOut = async () => {
    if (!activeBooking) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.BOOKING.CLOCK_OUT(activeBooking.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log('✅ Clock out successful, updating UI...');
        
        // Save details for alert
        const duration = formatDuration(activeBooking.clockInTime, data.booking.clockOutTime);
        const cost = data.booking.totalCost;
        
        // Clear ALL relevant states immediately
        setLocalActiveBooking(null);
        setSpaceActiveBooking(null);
        setSelectedSpace(null);
        setActiveBooking(null);
        
        // Force refresh parking spaces to update availability
        await fetchParkingSpaces();
        
        // Notify parent component and wait for it to complete
        if (onActiveBookingChange) {
          await onActiveBookingChange(null);
        }
        
        // Refresh bookings in parent
        if (onRefreshBookings) {
          await onRefreshBookings();
        }
        
        console.log('✅ All updates complete');
        alert(`✅ Clock out successful!\n\nDuration: ${duration}\nTotal Cost: $${cost}`);
      } else {
        alert(`❌ ${data.message || 'Failed to clock out. Please try again.'}`);
      }
    } catch (error) {
      console.error('Error clocking out:', error);
      alert('❌ Network error occurred while clocking out. Please check your connection and try again.');
    }
  };

  const handleSpaceClick = (space) => {

    if (mapInstanceRef.current && window.google) {
      const lat = parseFloat(space.latitude);
      const lng = parseFloat(space.longitude);
      mapInstanceRef.current.panTo({ lat, lng });
      mapInstanceRef.current.setZoom(17);

      // Highlight the marker briefly
      const marker = markersRef.current.find(
        (m) =>
          m.getPosition().lat().toFixed(6) === lat.toFixed(6) &&
          m.getPosition().lng().toFixed(6) === lng.toFixed(6)
      );
      if (marker) {
        marker.setAnimation(window.google.maps.Animation.BOUNCE);
        setTimeout(() => marker.setAnimation(null), 1400);
      }
    }
  };

  const handleSpaceButtonClick = (space) => {
    setSelectedSpace(space);
    checkActiveBookingForSpace(space.id);

    if (mapInstanceRef.current && window.google) {
      const lat = parseFloat(space.latitude);
      const lng = parseFloat(space.longitude);
      mapInstanceRef.current.panTo({ lat, lng });
      mapInstanceRef.current.setZoom(17);

      // Highlight the marker briefly
      const marker = markersRef.current.find(
        (m) =>
          m.getPosition().lat().toFixed(6) === lat.toFixed(6) &&
          m.getPosition().lng().toFixed(6) === lng.toFixed(6)
      );
      if (marker) {
        marker.setAnimation(window.google.maps.Animation.BOUNCE);
        setTimeout(() => marker.setAnimation(null), 1400);
      }
    }
  };


  const addMarkersToMap = (spaces) => {
    if (!mapInstanceRef.current || !window.google) {
      console.error('Map instance or Google not available');
      return;
    }

    markersRef.current.forEach(marker => {
      marker.setMap(null);
      window.google.maps.event.clearInstanceListeners(marker);
    });
    markersRef.current = [];

    spaces.forEach(space => {
      try {
        const marker = new window.google.maps.Marker({
          position: { lat: space.latitude, lng: space.longitude },
          map: mapInstanceRef.current,
          title: space.address,
          icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new window.google.maps.Size(32, 32)
          },
          animation: window.google.maps.Animation.DROP
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div class="map-info-window">
              <h4>${space.address}</h4>
              <p><strong>Price:</strong> $${space.pricePerHour}/hour</p>
              <p><strong>Description:</strong> ${space.description || 'No description'}</p>
              <p><em>Click to book this space</em></p>
            </div>
          `,
          maxWidth: 250
        });

        marker.addListener('mouseover', () => {
          infoWindow.open(mapInstanceRef.current, marker);
        });

        marker.addListener('mouseout', () => {
          infoWindow.close();
        });

        marker.addListener('click', () => {
          infoWindow.close();
          setSelectedSpace(space);
          checkActiveBookingForSpace(space.id);
        });

        markersRef.current.push(marker);
      } catch (error) {
        console.error('Error creating marker:', error);
      }
    });
  };

  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => {
        marker.setMap(null);
        if (window.google) {
          window.google.maps.event.clearInstanceListeners(marker);
        }
      });
      markersRef.current = [];
      
      // Clean up search marker
      if (searchMarkerRef.current) {
        searchMarkerRef.current.setMap(null);
      }
    };
  }, []);

  if (loading && !mapLoaded) {
    return (
      <div className="map-loading">
        <div>Loading map and parking spaces...</div>
        <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '1rem' }}>
          If this takes too long, check your Google Maps API key
        </div>
      </div>
    );
  }

  return (
    <div className="map-view">
      <div className="map-container">
        <div 
          ref={mapRef} 
          className="google-map"
          style={{ 
            height: '100%', 
            width: '100%',
            minHeight: '400px'
          }}
        ></div>

        {/* Search Box with Nominatim Autocomplete */}
        <div className="search-box-container">
          <form onSubmit={handleSearchSubmit} className="search-form">
            <div className="autocomplete-wrapper">
              <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder="Search for a location... (e.g., Brisbane CBD, Queen St)"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay to allow click on suggestion
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {suggestions.map((suggestion, index) => {
                    // Handle "no results" case
                    if (suggestion.noResults) {
                      return (
                        <div
                          key="no-results"
                          className="no-results-message"
                        >
                          No results found in Australia or Ireland
                        </div>
                      );
                    }
                    
                    // Handle normal suggestions
                    return (
                      <div
                        key={index}
                        className="suggestion-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectSuggestion(suggestion);
                        }}
                      >
                        {suggestion.display_name}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </form>
          <div className="search-tip">
            💡 Type at least 3 characters to see location suggestions
          </div>
        </div>
        
        {activeBooking && (
          <div className="mapview-active-booking-alert">
            <h3>🚗 You have an active parking session</h3>
            <div className="mapview-booking-details">
              <p><strong>Location:</strong> {activeBooking.ParkingSpace?.address}</p>
              <p><strong>Started:</strong> {formatDateTime(activeBooking.clockInTime)}</p>
              <p><strong>Current Duration:</strong> 
                <span className="mapview-live-duration">
                  {formatDuration(activeBooking.clockInTime, currentTime)}
                </span>
              </p>
              <p><strong>Current Cost:</strong> 
                <span className="live-cost">${calculateCurrentCost()}</span>
              </p>
            </div>
            <div className="clock-out-container">
              <button 
                onClick={handleClockOut}
                className="clock-out-btn centered"
              >
                🕐 Clock Out Now
              </button>
            </div>
          </div>
        )}

        <div className="parking-spaces-list">
          <div className="parking-list-header">
            <h3>🅿️ Available Parking Spaces</h3>
            <span className="space-count">{parkingSpaces.length} spaces</span>
          </div>
          {parkingSpaces.map(space => (
            <div key={space.id} className="parking-space-card" onClick={() => handleSpaceClick(space)}>
              <div className="space-info">
                <h3>{space.address}</h3>
                <p>{space.description || 'No description available'}</p>
                <div className="space-details">
                  <span><strong>Price:</strong> ${space.pricePerHour}/hour</span>
                  <span><strong>Owner:</strong> {space.User?.name}</span>
                  <span className="availability available">✅ Available</span>
                </div>
              </div>
              
              <button 
                className="clock-in-btn"
                onClick={() => handleSpaceButtonClick(space)}
              >
                View Details
              </button>
            </div>
          ))}

          {parkingSpaces.length === 0 && (
            <div className="no-spaces">
              <p>No parking spaces available at the moment. All spaces are occupied.</p>
            </div>
          )}
        </div>

        {selectedSpace && (
          <div className="space-details-modal">
            <div className="modal-content">
              <button 
                className="close-modal"
                onClick={() => {
                  setSelectedSpace(null);
                  setSpaceActiveBooking(null);
                }}
              >
                ×
              </button>
              
              <h3>{selectedSpace.address}</h3>
              <p className="space-description">
                {selectedSpace.description || 'No description available'}
              </p>
              
              <div className="space-info">
                <div className="info-item">
                  <strong>Price:</strong> ${selectedSpace.pricePerHour}/hour
                </div>
                <div className="info-item">
                  <strong>Owner:</strong> {selectedSpace.User?.name}
                </div>
              </div>

              {spaceActiveBooking ? (
                <div className="active-booking-section">
                  <div className="booking-status active">
                    <h4>🚗 Your Active Parking Session</h4>
                    <div className="booking-details">
                      <p><strong>Started:</strong> {formatDateTime(spaceActiveBooking.clockInTime)}</p>
                      <p><strong>Current Duration:</strong> {formatDuration(spaceActiveBooking.clockInTime, currentTime)}</p>
                      <p><strong>Estimated Cost:</strong> ${calculateCurrentCost()}</p>
                    </div>
                    <button 
                      className="clock-out-btn primary"
                      onClick={handleClockOut}
                    >
                      🕐 Clock Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="booking-section">
                  <div className="availability-message">
                    <p>✅ This parking space is available for booking</p>
                  </div>
                  <button 
                    className="clock-in-btn large"
                    onClick={() => handleClockIn(selectedSpace.id)}
                  >
                    🚗 Clock In Now
                  </button>
                  <p className="booking-note">
                    You'll be able to clock out from this page only. Other users won't see this space while you're parked here.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapView;