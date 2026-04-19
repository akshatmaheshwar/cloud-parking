const express = require('express');
const { Booking, ParkingSpace, User } = require('../models');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Clock in - Functionality 4
router.post('/:parkingSpaceId/clock-in', async (req, res) => {
  try {
    const { parkingSpaceId } = req.params;
    const userId = req.user.userId;

    // Check if parking space exists and is available
    const parkingSpace = await ParkingSpace.findByPk(parkingSpaceId);
    if (!parkingSpace) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    if (!parkingSpace.isAvailable) {
      return res.status(400).json({ 
        message: 'This parking space is currently occupied' 
      });
    }

    // Check if user already has an active booking anywhere
    const activeBooking = await Booking.findOne({
      where: {
        userId,
        status: 'active'
      },
      include: [{
        model: ParkingSpace,
        attributes: ['address']
      }]
    });

    if (activeBooking) {
      return res.status(400).json({ 
        message: `You already have an active booking at ${activeBooking.ParkingSpace.address}. Please clock out first.` 
      });
    }

    // Create new booking
    const booking = await Booking.create({
      userId,
      parkingSpaceId,
      clockInTime: new Date(),
      status: 'active'
    });

    // The hook will automatically update the parking space availability and currentBookingId

    res.status(201).json({
      message: 'Clock in successful',
      booking: {
        ...booking.toJSON(),
        ParkingSpace: parkingSpace
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error clocking in', error: error.message });
  }
});

// Clock out - Functionality 5
router.post('/:bookingId/clock-out', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.userId;

    // Find the booking
    const booking = await Booking.findOne({
      where: {
        id: bookingId,
        userId,
        status: 'active'
      },
      include: [{
        model: ParkingSpace,
        attributes: ['pricePerHour', 'address', 'currentBookingId']
      }]
    });

    if (!booking) {
      return res.status(404).json({ message: 'Active booking not found' });
    }

    // Calculate cost
    const clockOutTime = new Date();
    const durationHours = (clockOutTime - booking.clockInTime) / (1000 * 60 * 60);
    const totalCost = durationHours * booking.ParkingSpace.pricePerHour;

    // Update booking
    await booking.update({
      clockOutTime,
      totalCost: parseFloat(totalCost.toFixed(2)),
      status: 'completed'
    });

    // The hook will automatically update the parking space availability and currentBookingId

    res.json({
      message: 'Clock out successful',
      booking: {
        ...booking.toJSON(),
        durationHours: parseFloat(durationHours.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(2))
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error clocking out', error: error.message });
  }
});

// Get current user's active booking for a specific parking space
router.get('/parking-space/:parkingSpaceId/active', async (req, res) => {
  try {
    const { parkingSpaceId } = req.params;
    const userId = req.user.userId;

    const activeBooking = await Booking.findOne({
      where: {
        userId,
        parkingSpaceId,
        status: 'active'
      },
      include: [{
        model: ParkingSpace,
        attributes: ['address', 'pricePerHour', 'currentBookingId']
      }]
    });

    if (activeBooking) {
      // Calculate current duration
      const currentTime = new Date();
      const durationHours = (currentTime - activeBooking.clockInTime) / (1000 * 60 * 60);
      
      res.json({
        hasActiveBooking: true,
        booking: {
          ...activeBooking.toJSON(),
          currentDuration: parseFloat(durationHours.toFixed(2))
        }
      });
    } else {
      res.json({
        hasActiveBooking: false
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error checking active booking', error: error.message });
  }
});

// Get user's bookings
router.get('/my-bookings', async (req, res) => {
  try {
    const userId = req.user.userId;

    const bookings = await Booking.findAll({
      where: { userId },
      include: [{
        model: ParkingSpace,
        include: [{
          model: User,
          attributes: ['name']
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings', error: error.message });
  }
});

// Get all bookings for parking spaces owned by user
router.get('/my-parking-bookings', async (req, res) => {
  try {
    const userId = req.user.userId;

    const bookings = await Booking.findAll({
      include: [{
        model: ParkingSpace,
        where: { ownerId: userId },
        include: [{
          model: User,
          attributes: ['name']
        }]
      }, {
        model: User,
        attributes: ['name', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching parking bookings', error: error.message });
  }
});

// Get all bookings for a specific parking space
router.get('/parking-space/:parkingSpaceId/all', async (req, res) => {
  try {
    const { parkingSpaceId } = req.params;
    const userId = req.user.userId;

    // Verify the user owns this parking space
    const parkingSpace = await ParkingSpace.findOne({
      where: { id: parkingSpaceId, ownerId: userId }
    });

    if (!parkingSpace) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    const bookings = await Booking.findAll({
      where: { parkingSpaceId },
      include: [{
        model: User,
        attributes: ['name', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      bookings
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings', error: error.message });
  }
});

// Update parking space
router.put('/:id', async (req, res) => {
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
      pricePerHour
    });

    res.json({
      message: 'Parking space updated successfully',
      parkingSpace
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating parking space', error: error.message });
  }
});

module.exports = router;