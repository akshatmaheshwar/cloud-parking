const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './booking-database.sqlite',
  logging: false
});

// Booking Model
const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  parkingSpaceId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  clockInTime: {
    type: DataTypes.DATE
  },
  clockOutTime: {
    type: DataTypes.DATE
  },
  totalCost: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'cancelled'),
    defaultValue: 'active'
  }
}, {
  timestamps: true
});

// Auth Middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:5001';
    const response = await axios.post(`${authServiceUrl}/verify`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });

    req.user = { userId: response.data.user.id };
    next();
  } catch (error) {
    console.error('Auth verification failed:', error.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Helper: Get parking space info
const getParkingSpace = async (parkingSpaceId) => {
  try {
    const parkingServiceUrl = process.env.PARKING_SERVICE_URL || 'http://parking-service:5002';
    const response = await axios.get(`${parkingServiceUrl}/${parkingSpaceId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching parking space:', error.message);
    return null;
  }
};

// Helper: Update parking space availability
const updateParkingAvailability = async (parkingSpaceId, isAvailable, currentBookingId = null) => {
  try {
    const parkingServiceUrl = process.env.PARKING_SERVICE_URL || 'http://parking-service:5002';
    await axios.patch(`${parkingServiceUrl}/${parkingSpaceId}/availability`, {
      isAvailable,
      currentBookingId
    });
  } catch (error) {
    console.error('Error updating parking availability:', error.message);
  }
};

// Helper: Get user info
const getUserInfo = async (userId) => {
  try {
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:5001';
    const response = await axios.get(`${authServiceUrl}/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user info:', error.message);
    return null;
  }
};

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'Booking Service is running', service: 'booking' });
});

// Clock in
app.post('/:parkingSpaceId/clock-in', authMiddleware, async (req, res) => {
  try {
    const { parkingSpaceId } = req.params;
    const userId = req.user.userId;

    // Get parking space info
    const parkingSpace = await getParkingSpace(parkingSpaceId);
    if (!parkingSpace) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    if (!parkingSpace.isAvailable) {
      return res.status(400).json({ 
        message: 'This parking space is currently occupied' 
      });
    }

    // Check if user already has an active booking
    const activeBooking = await Booking.findOne({
      where: {
        userId,
        status: 'active'
      }
    });

    if (activeBooking) {
      const activeSpace = await getParkingSpace(activeBooking.parkingSpaceId);
      return res.status(400).json({ 
        message: `You already have an active booking at ${activeSpace?.address || 'another location'}. Please clock out first.` 
      });
    }

    // Create new booking
    const booking = await Booking.create({
      userId,
      parkingSpaceId,
      clockInTime: new Date(),
      status: 'active'
    });

    // Update parking space availability
    await updateParkingAvailability(parkingSpaceId, false, booking.id);

    res.status(201).json({
      message: 'Clock in successful',
      booking: {
        ...booking.toJSON(),
        ParkingSpace: parkingSpace
      }
    });
  } catch (error) {
    console.error('Error clocking in:', error);
    res.status(500).json({ message: 'Error clocking in', error: error.message });
  }
});

// Clock out
app.post('/:bookingId/clock-out', authMiddleware, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.userId;

    const booking = await Booking.findOne({
      where: {
        id: bookingId,
        userId,
        status: 'active'
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Active booking not found' });
    }

    const parkingSpace = await getParkingSpace(booking.parkingSpaceId);
    if (!parkingSpace) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    // Calculate cost
    const clockOutTime = new Date();
    const durationHours = (clockOutTime - new Date(booking.clockInTime)) / (1000 * 60 * 60);
    const totalCost = durationHours * parkingSpace.pricePerHour;

    // Update booking
    await booking.update({
      clockOutTime,
      totalCost: parseFloat(totalCost.toFixed(2)),
      status: 'completed'
    });

    // Update parking space availability
    await updateParkingAvailability(booking.parkingSpaceId, true, null);

    res.json({
      message: 'Clock out successful',
      booking: {
        ...booking.toJSON(),
        ParkingSpace: parkingSpace,
        durationHours: parseFloat(durationHours.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Error clocking out:', error);
    res.status(500).json({ message: 'Error clocking out', error: error.message });
  }
});

// Get user's bookings
app.get('/my-bookings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const bookings = await Booking.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });

    // Enrich bookings with parking space info
    const enrichedBookings = await Promise.all(bookings.map(async (booking) => {
      const parkingSpace = await getParkingSpace(booking.parkingSpaceId);
      return {
        ...booking.toJSON(),
        ParkingSpace: parkingSpace
      };
    }));

    res.json({ bookings: enrichedBookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Error fetching bookings', error: error.message });
  }
});

// Get active booking for a specific parking space
app.get('/parking-space/:parkingSpaceId/active', authMiddleware, async (req, res) => {
  try {
    const { parkingSpaceId } = req.params;
    const userId = req.user.userId;

    const activeBooking = await Booking.findOne({
      where: {
        userId,
        parkingSpaceId,
        status: 'active'
      }
    });

    if (activeBooking) {
      const parkingSpace = await getParkingSpace(parkingSpaceId);
      const currentTime = new Date();
      const durationHours = (currentTime - new Date(activeBooking.clockInTime)) / (1000 * 60 * 60);
      
      res.json({
        hasActiveBooking: true,
        booking: {
          ...activeBooking.toJSON(),
          ParkingSpace: parkingSpace,
          currentDuration: parseFloat(durationHours.toFixed(2))
        }
      });
    } else {
      res.json({ hasActiveBooking: false });
    }
  } catch (error) {
    console.error('Error checking active booking:', error);
    res.status(500).json({ message: 'Error checking active booking', error: error.message });
  }
});

// Check if parking space has active bookings (for deletion check)
app.get('/parking-space/:parkingSpaceId/active-check', async (req, res) => {
  try {
    const { parkingSpaceId } = req.params;

    const activeBooking = await Booking.findOne({
      where: {
        parkingSpaceId,
        status: 'active'
      }
    });

    res.json({ hasActiveBooking: !!activeBooking });
  } catch (error) {
    res.status(500).json({ message: 'Error checking bookings', error: error.message });
  }
});

// Get all bookings for a specific parking space
app.get('/parking-space/:parkingSpaceId/all', authMiddleware, async (req, res) => {
  try {
    const { parkingSpaceId } = req.params;

    const bookings = await Booking.findAll({
      where: { parkingSpaceId },
      order: [['createdAt', 'DESC']]
    });

    // Enrich with user info
    const enrichedBookings = await Promise.all(bookings.map(async (booking) => {
      const user = await getUserInfo(booking.userId);
      return {
        ...booking.toJSON(),
        User: user
      };
    }));

    res.json({ bookings: enrichedBookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Error fetching bookings', error: error.message });
  }
});

// Get all bookings for parking spaces owned by user
app.get('/my-parking-bookings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's parking spaces
    const parkingServiceUrl = process.env.PARKING_SERVICE_URL || 'http://parking-service:5002';
    const token = req.header('Authorization');
    const spacesResponse = await axios.get(`${parkingServiceUrl}/my-spaces`, {
      headers: { Authorization: token }
    });

    const userSpaces = spacesResponse.data.parkingSpaces || [];
    const spaceIds = userSpaces.map(space => space.id);

    // Get all bookings for these spaces
    const bookings = await Booking.findAll({
      where: {
        parkingSpaceId: spaceIds
      },
      order: [['createdAt', 'DESC']]
    });

    // Enrich with user and parking space info
    const enrichedBookings = await Promise.all(bookings.map(async (booking) => {
      const user = await getUserInfo(booking.userId);
      const parkingSpace = await getParkingSpace(booking.parkingSpaceId);
      return {
        ...booking.toJSON(),
        User: user,
        ParkingSpace: parkingSpace
      };
    }));

    res.json({ bookings: enrichedBookings });
  } catch (error) {
    console.error('Error fetching parking bookings:', error);
    res.status(500).json({ message: 'Error fetching parking bookings', error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 5003;

sequelize.sync({ force: false })
  .then(() => {
    console.log('Booking Service: Database connected');
    app.listen(PORT, () => {
      console.log(`Booking Service running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Booking Service: Database connection failed:', err);
  });