const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const parkingSpaceRoutes = require('./routes/parkingSpaces');
const bookingRoutes = require('./routes/bookings'); // Add this line

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/parkingspaces', parkingSpaceRoutes);
app.use('/api/bookings', bookingRoutes); // Add this line

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Cloud Parking API is running!' });
});

// Database connection and server start
const PORT = process.env.PORT || 5000;

sequelize.sync({ force: false })
  .then(() => {
    console.log('Database connected successfully');
    console.log('SQLite database file: database.sqlite');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Database connection failed:', err);
  });