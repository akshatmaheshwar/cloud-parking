import React, { useState, useRef, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';
import './AddParkingSpace.css';

const AddParkingSpace = ({ user, onParkingSpaceAdded }) => {
  const [formData, setFormData] = useState({
    address: '',
    latitude: '',
    longitude: '',
    description: '',
    pricePerHour: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const addressInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Load Google Maps immediately on component mount
  useEffect(() => {
    if (!mapLoaded) {
      loadGoogleMaps();
    }
  }, [mapLoaded]);

  const loadGoogleMaps = () => {
    if (window.google) {
      initMap();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('Google Maps loaded for AddParkingSpace');
      initMap();
    };
    
    script.onerror = () => {
      console.error('Failed to load Google Maps');
      setError('Failed to load Google Maps. Please try again.');
    };
    
    document.head.appendChild(script);
  };

  const initMap = () => {
    if (!window.google || !mapRef.current) {
      console.error('Google Maps not available or map container not found');
      return;
    }

    try {
      // Default location (Brisbane)
      const defaultLocation = { 
        lat: formData.latitude ? parseFloat(formData.latitude) : -27.4698, 
        lng: formData.longitude ? parseFloat(formData.longitude) : 153.0251 
      };

      const mapInstance = new window.google.maps.Map(mapRef.current, {
        zoom: 15,
        center: defaultLocation,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true
      });

      mapInstanceRef.current = mapInstance;

      // Add click listener to map
      mapInstance.addListener('click', (event) => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        
        setFormData(prev => ({
          ...prev,
          latitude: lat.toString(),
          longitude: lng.toString()
        }));
        
        updateMarker(lat, lng);
        reverseGeocode(lat, lng);
      });

      // Add initial marker if coordinates exist
      if (formData.latitude && formData.longitude) {
        updateMarker(parseFloat(formData.latitude), parseFloat(formData.longitude));
      }

      setMapLoaded(true);
    } catch (error) {
      console.error('Error initializing map:', error);
      setError('Error initializing map: ' + error.message);
    }
  };

  // Debounced search for address suggestions
  const handleAddressChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, address: value }));

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchAddressSuggestions(value);
    }, 500);
  };

  const searchAddressSuggestions = async (query) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=au`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        setSuggestions(data);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const selectSuggestion = (suggestion) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    
    setFormData(prev => ({
      ...prev,
      address: suggestion.display_name,
      latitude: lat.toString(),
      longitude: lng.toString()
    }));

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat, lng });
      mapInstanceRef.current.setZoom(17);
      updateMarker(lat, lng);
    }

    setSuggestions([]);
    setShowSuggestions(false);
  };

  const updateMarker = (lat, lng) => {
    if (!mapInstanceRef.current || !window.google) return;

    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    const marker = new window.google.maps.Marker({
      position: { lat, lng },
      map: mapInstanceRef.current,
      draggable: true,
      icon: {
        url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
        scaledSize: new window.google.maps.Size(40, 40)
      },
      title: 'Your Parking Space Location'
    });

    marker.addListener('dragend', (event) => {
      const newLat = event.latLng.lat();
      const newLng = event.latLng.lng();
      
      setFormData(prev => ({
        ...prev,
        latitude: newLat.toString(),
        longitude: newLng.toString()
      }));
      
      reverseGeocode(newLat, newLng);
    });

    markerRef.current = marker;
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        setFormData(prev => ({
          ...prev,
          address: data.display_name
        }));
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        setFormData(prev => ({
          ...prev,
          latitude: lat.toString(),
          longitude: lng.toString()
        }));
        
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter({ lat, lng });
          mapInstanceRef.current.setZoom(17);
          updateMarker(lat, lng);
        }
        
        reverseGeocode(lat, lng);
        setLoading(false);
        setError('');
      },
      (error) => {
        setError('Unable to retrieve your location: ' + error.message);
        setLoading(false);
      }
    );
  };

  const handleAddressSearch = () => {
    if (!formData.address.trim()) {
      setError('Please enter an address to search');
      return;
    }

    setLoading(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.address)}&limit=1&countrycodes=au`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);

          setFormData(prev => ({
            ...prev,
            latitude: lat.toString(),
            longitude: lng.toString()
          }));
          
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter({ lat, lng });
            mapInstanceRef.current.setZoom(17);
            updateMarker(lat, lng);
          }
          
          setError('');
        } else {
          setError('Address not found. Please try a different address or enter coordinates manually.');
        }
      })
      .catch(error => {
        setError('Error searching for address: ' + error.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!formData.address || !formData.latitude || !formData.longitude || !formData.pricePerHour) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (parseFloat(formData.pricePerHour) <= 0) {
      setError('Price per hour must be greater than 0');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.PARKING.CREATE, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address: formData.address,
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          description: formData.description,
          pricePerHour: parseFloat(formData.pricePerHour)
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Parking space listed successfully!');
        setFormData({
          address: '',
          latitude: '',
          longitude: '',
          description: '',
          pricePerHour: ''
        });
        
        if (markerRef.current) {
          markerRef.current.setMap(null);
          markerRef.current = null;
        }
        
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter({ lat: -27.4698, lng: 153.0251 });
          mapInstanceRef.current.setZoom(15);
        }
        
        if (onParkingSpaceAdded) {
          onParkingSpaceAdded();
        }
      } else {
        setError(data.message || 'Failed to list parking space');
      }
    } catch (error) {
      console.error('Error creating parking space:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-parking-space">
      <h2>List Your Parking Space</h2>
      <p className="subtitle">Earn money by renting out your parking space</p>

      <form onSubmit={handleSubmit} className="parking-form">
        <div className="form-group">
          <label>Address *</label>
          <div className="address-search">
            <div className="autocomplete-wrapper">
              <input
                ref={addressInputRef}
                type="text"
                name="address"
                value={formData.address}
                onChange={handleAddressChange}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder="Start typing an address..."
                required
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {suggestions.map((suggestion, index) => (
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
                  ))}
                </div>
              )}
            </div>
            <button 
              type="button" 
              onClick={handleAddressSearch}
              className="search-btn"
              disabled={loading}
            >
              {loading ? 'Searching...' : '🔍 Search'}
            </button>
          </div>
          <small>💡 Type at least 3 characters to see address suggestions</small>
        </div>

        <button 
          type="button" 
          onClick={handleGetCurrentLocation}
          className="location-btn"
          disabled={loading}
        >
          📍 Use My Current Location
        </button>

        <div className="map-container-wrapper">
          <div 
            ref={mapRef} 
            className="parking-map"
            style={{ 
              height: '400px', 
              width: '100%',
              marginBottom: '1rem',
              borderRadius: '8px',
              border: '2px solid #ddd'
            }}
          ></div>
          <div className="map-instructions">
            <p>📍 <strong>Click on the map</strong> to set your parking location</p>
            <p>🖱️ <strong>Drag the green marker</strong> to adjust the position</p>
          </div>
        </div>

        <div className="coordinates-group">
          <div className="form-group">
            <label>Latitude *</label>
            <input
              type="number"
              step="any"
              name="latitude"
              value={formData.latitude}
              onChange={handleChange}
              placeholder="e.g., -27.4698"
              required
            />
          </div>

          <div className="form-group">
            <label>Longitude *</label>
            <input
              type="number"
              step="any"
              name="longitude"
              value={formData.longitude}
              onChange={handleChange}
              placeholder="e.g., 153.0251"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe your parking space (e.g., 'Secure underground parking', 'Driveway parking', '24/7 access', etc.)"
            rows="4"
          />
        </div>

        <div className="form-group">
          <label>Price Per Hour ($) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            name="pricePerHour"
            value={formData.pricePerHour}
            onChange={handleChange}
            placeholder="e.g., 5.00"
            required
          />
          <small>Recommended: $2-$10 per hour depending on location</small>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <button 
          type="submit" 
          className="submit-btn"
          disabled={loading}
        >
          {loading ? 'Listing Parking Space...' : '🚗 List My Parking Space'}
        </button>
      </form>

      <div className="tips">
        <h4>💡 Tips for Listing:</h4>
        <ul>
          <li><strong>Use autocomplete:</strong> Start typing your address to see suggestions</li>
          <li><strong>Use current location:</strong> Click "Use My Current Location" for quick setup</li>
          <li><strong>Click on map:</strong> You can click directly on the map to set location</li>
          <li>Be specific about the location and access instructions</li>
          <li>Include any security features (CCTV, gates, etc.)</li>
          <li>Set a competitive price based on your area</li>
        </ul>
      </div>
    </div>
  );
};

export default AddParkingSpace;
