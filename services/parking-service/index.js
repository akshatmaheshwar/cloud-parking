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
  storage: './parking-database.sqlite',
  logging: false
});

// ParkingSpace Model
const ParkingSpace = sequelize.define('ParkingSpace', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  latitude: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  longitude: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  pricePerHour: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  ownerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  currentBookingId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  timestamps: true
});

// Auth Middleware - verify with auth service
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

// Helper function to get user info
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
  res.json({ status: 'Parking Service is running', service: 'parking' });
});

// Create parking space
app.post('/', authMiddleware, async (req, res) => {
  try {
    const { address, latitude, longitude, description, pricePerHour } = req.body;
    const ownerId = req.user.userId;

    const parkingSpace = await ParkingSpace.create({
      address,
      latitude,
      longitude,
      description,
      pricePerHour,
      ownerId
    });

    res.status(201).json({
      message: 'Parking space created successfully',
      parkingSpace
    });
  } catch (error) {
    console.error('Error creating parking space:', error);
    res.status(500).json({ message: 'Error creating parking space', error: error.message });
  }
});

// Get parking spaces owned by current user
app.get('/my-spaces', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const parkingSpaces = await ParkingSpace.findAll({
      where: { ownerId: userId },
      order: [['createdAt', 'DESC']]
    });

    // Get user info for each space
    const spacesWithUser = await Promise.all(parkingSpaces.map(async (space) => {
      const user = await getUserInfo(space.ownerId);
      return {
        ...space.toJSON(),
        User: user
      };
    }));

    res.json({ parkingSpaces: spacesWithUser });
  } catch (error) {
    console.error('Error fetching parking spaces:', error);
    res.status(500).json({ message: 'Error fetching parking spaces', error: error.message });
  }
});

// Get all available parking spaces
app.get('/', authMiddleware, async (req, res) => {
  try {
    const parkingSpaces = await ParkingSpace.findAll({
      where: { isAvailable: true }
    });

    // Get user info for each space
    const spacesWithUser = await Promise.all(parkingSpaces.map(async (space) => {
      const user = await getUserInfo(space.ownerId);
      return {
        ...space.toJSON(),
        User: user
      };
    }));

    res.json({ parkingSpaces: spacesWithUser });
  } catch (error) {
    console.error('Error fetching available parking spaces:', error);
    res.status(500).json({ message: 'Error fetching parking spaces', error: error.message });
  }
});

// Get parking space by ID
app.get('/:id', async (req, res) => {
  try {
    const parkingSpace = await ParkingSpace.findByPk(req.params.id);
    
    if (!parkingSpace) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    const user = await getUserInfo(parkingSpace.ownerId);
    res.json({
      ...parkingSpace.toJSON(),
      User: user
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching parking space', error: error.message });
  }
});

// Update parking space
app.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { address, description, pricePerHour } = req.body;
    const userId = req.user.userId;

    const parkingSpace = await ParkingSpace.findOne({
      where: { id, ownerId: userId }
    });

    if (!parkingSpace) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    await parkingSpace.update({
      address,
      description,
      pricePerHour: parseFloat(pricePerHour)
    });

    res.json({
      message: 'Parking space updated successfully',
      parkingSpace
    });
  } catch (error) {
    console.error('Error updating parking space:', error);
    res.status(500).json({ message: 'Error updating parking space', error: error.message });
  }
});

// Update parking space availability (called by booking service)
app.patch('/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable, currentBookingId } = req.body;

    const parkingSpace = await ParkingSpace.findByPk(id);
    if (!parkingSpace) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    await parkingSpace.update({
      isAvailable,
      currentBookingId: currentBookingId || null
    });

    res.json({
      message: 'Parking space availability updated',
      parkingSpace
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ message: 'Error updating availability', error: error.message });
  }
});

// Delete parking space
app.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const parkingSpace = await ParkingSpace.findOne({
      where: { id, ownerId: userId }
    });

    if (!parkingSpace) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    // Check if there are active bookings (call booking service)
    try {
      const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://booking-service:5003';
      const response = await axios.get(`${bookingServiceUrl}/parking-space/${id}/active-check`);
      
      if (response.data.hasActiveBooking) {
        return res.status(400).json({ 
          message: 'Cannot delete parking space with active bookings' 
        });
      }
    } catch (error) {
      console.error('Error checking active bookings:', error.message);
    }

    await parkingSpace.destroy();

    res.json({ message: 'Parking space deleted successfully' });
  } catch (error) {
    console.error('Error deleting parking space:', error);
    res.status(500).json({ message: 'Error deleting parking space', error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 5002;

sequelize.sync({ force: false })
  .then(() => {
    console.log('Parking Service: Database connected');
    app.listen(PORT, () => {
      console.log(`Parking Service running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Parking Service: Database connection failed:', err);
  });