const express = require('express');
const { ParkingSpace, User, Booking } = require('../models');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Create parking space
router.post('/', async (req, res) => {
  try {
    const { address, latitude, longitude, description, pricePerHour } = req.body;
    
    // Get user ID from the authenticated token
    const ownerId = req.user.userId;

    console.log('Creating parking space for user:', ownerId);
    console.log('Parking space data:', { address, latitude, longitude, description, pricePerHour });

    const parkingSpace = await ParkingSpace.create({
      address,
      latitude,
      longitude,
      description,
      pricePerHour,
      ownerId
    });

    console.log('Parking space created:', parkingSpace.toJSON());

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
router.get('/my-spaces', async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('Fetching parking spaces for user:', userId);

    const parkingSpaces = await ParkingSpace.findAll({
      where: { ownerId: userId },
      include: [
        {
          model: User,
          attributes: ['name', 'email']
        },
        {
          model: Booking,
          attributes: ['id', 'totalCost', 'status']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    console.log('Found parking spaces:', parkingSpaces.length);

    // Calculate earnings for each space
    const spacesWithEarnings = parkingSpaces.map(space => {
      const completedBookings = space.Bookings?.filter(booking => booking.status === 'completed') || [];
      const totalEarnings = completedBookings.reduce((sum, booking) => sum + booking.totalCost, 0);
      
      return {
        ...space.toJSON(),
        totalEarnings: parseFloat(totalEarnings.toFixed(2))
      };
    });

    res.json({
      parkingSpaces: spacesWithEarnings
    });
  } catch (error) {
    console.error('Error fetching parking spaces:', error);
    res.status(500).json({ message: 'Error fetching parking spaces', error: error.message });
  }
});

// Get all available parking spaces (for other users)
router.get('/', async (req, res) => {
  try {
    console.log('Fetching available parking spaces for all users');

    const parkingSpaces = await ParkingSpace.findAll({
      where: {
        isAvailable: true
      },
      include: [{
        model: User,
        attributes: ['name', 'email']
      }]
    });

    console.log('Available parking spaces:', parkingSpaces.length);

    res.json({
      parkingSpaces
    });
  } catch (error) {
    console.error('Error fetching available parking spaces:', error);
    res.status(500).json({ message: 'Error fetching parking spaces', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { address, description, pricePerHour } = req.body;
    const userId = req.user.userId;

    console.log('Updating parking space:', id, 'for user:', userId);
    console.log('Update data:', { address, description, pricePerHour });

    const parkingSpace = await ParkingSpace.findOne({
      where: { id, ownerId: userId }
    });

    if (!parkingSpace) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    // Update the parking space
    await parkingSpace.update({
      address,
      description,
      pricePerHour: parseFloat(pricePerHour)
    });

    console.log('Parking space updated successfully:', parkingSpace.toJSON());

    res.json({
      message: 'Parking space updated successfully',
      parkingSpace
    });
  } catch (error) {
    console.error('Error updating parking space:', error);
    res.status(500).json({ message: 'Error updating parking space', error: error.message });
  }
});

// Delete parking space
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    console.log('Deleting parking space:', id, 'for user:', userId);

    // Find the parking space and verify ownership
    const parkingSpace = await ParkingSpace.findOne({
      where: { 
        id, 
        ownerId: userId 
      }
    });

    if (!parkingSpace) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    // Check if there are any active bookings for this space
    const activeBooking = await Booking.findOne({
      where: {
        parkingSpaceId: id,
        status: 'active'
      }
    });

    if (activeBooking) {
      return res.status(400).json({ 
        message: 'Cannot delete parking space with active bookings. Please wait until all bookings are completed.' 
      });
    }

    // Delete the parking space
    await parkingSpace.destroy();

    console.log('Parking space deleted successfully');

    res.json({
      message: 'Parking space deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting parking space:', error);
    res.status(500).json({ message: 'Error deleting parking space', error: error.message });
  }
});

module.exports = router;