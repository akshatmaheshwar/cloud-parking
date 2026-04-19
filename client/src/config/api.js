// API Configuration for Microservices
const API_CONFIG = {
  AUTH_SERVICE: process.env.REACT_APP_AUTH_SERVICE_URL || 'http://localhost:30001',
  PARKING_SERVICE: process.env.REACT_APP_PARKING_SERVICE_URL || 'http://localhost:30002',
  BOOKING_SERVICE: process.env.REACT_APP_BOOKING_SERVICE_URL || 'http://localhost:30003'
};

// API Endpoints - Use direct service URLs (no /auth, /parking prefixes)
export const API_ENDPOINTS = {
  // Auth Service
  AUTH: {
    LOGIN: `${API_CONFIG.AUTH_SERVICE}/login`,
    SIGNUP: `${API_CONFIG.AUTH_SERVICE}/signup`,
    VERIFY: `${API_CONFIG.AUTH_SERVICE}/verify`,
    USER: (id) => `${API_CONFIG.AUTH_SERVICE}/users/${id}`
  },
  
  // Parking Service
  PARKING: {
    ALL: `${API_CONFIG.PARKING_SERVICE}`,
    MY_SPACES: `${API_CONFIG.PARKING_SERVICE}/my-spaces`,
    BY_ID: (id) => `${API_CONFIG.PARKING_SERVICE}/${id}`,
    CREATE: `${API_CONFIG.PARKING_SERVICE}`,
    UPDATE: (id) => `${API_CONFIG.PARKING_SERVICE}/${id}`,
    DELETE: (id) => `${API_CONFIG.PARKING_SERVICE}/${id}`
  },
  
  // Booking Service
  BOOKING: {
    CLOCK_IN: (spaceId) => `${API_CONFIG.BOOKING_SERVICE}/${spaceId}/clock-in`,
    CLOCK_OUT: (bookingId) => `${API_CONFIG.BOOKING_SERVICE}/${bookingId}/clock-out`,
    MY_BOOKINGS: `${API_CONFIG.BOOKING_SERVICE}/my-bookings`,
    MY_PARKING_BOOKINGS: `${API_CONFIG.BOOKING_SERVICE}/my-parking-bookings`,
    ACTIVE_FOR_SPACE: (spaceId) => `${API_CONFIG.BOOKING_SERVICE}/parking-space/${spaceId}/active`,
    ALL_FOR_SPACE: (spaceId) => `${API_CONFIG.BOOKING_SERVICE}/parking-space/${spaceId}/all`
  }
};

console.log('🔧 API Configuration:', API_CONFIG);

export default API_CONFIG;