const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

// Use SQLite for development (no installation needed)
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.NODE_ENV === 'production' ? '/app/database.sqlite' : './database.sqlite',
  logging: console.log
});

// User Model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  hooks: {
    beforeCreate: async (user) => {
      user.password = await bcrypt.hash(user.password, 12);
    }
  },
  timestamps: true
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

// Booking Model
const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
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

// Define Relationships
User.hasMany(ParkingSpace, { foreignKey: 'ownerId' });
ParkingSpace.belongsTo(User, { foreignKey: 'ownerId' });

User.hasMany(Booking, { foreignKey: 'userId' });
Booking.belongsTo(User, { foreignKey: 'userId' });

ParkingSpace.hasMany(Booking, { foreignKey: 'parkingSpaceId' });
Booking.belongsTo(ParkingSpace, { foreignKey: 'parkingSpaceId' });

// Define the current booking relationship
ParkingSpace.belongsTo(Booking, { 
  as: 'CurrentBooking',
  foreignKey: 'currentBookingId',
  constraints: false
});

Booking.hasOne(ParkingSpace, { 
  as: 'OccupiedSpace',
  foreignKey: 'currentBookingId',
  constraints: false
});

// Add hook to update parking space availability when booking is created
Booking.addHook('afterCreate', async (booking, options) => {
  if (booking.status === 'active') {
    await ParkingSpace.update(
      { 
        isAvailable: false,
        currentBookingId: booking.id 
      },
      { where: { id: booking.parkingSpaceId } }
    );
  }
});

// Add hook to update parking space availability when booking is completed/cancelled
Booking.addHook('afterUpdate', async (booking, options) => {
  if (booking.status === 'completed' || booking.status === 'cancelled') {
    await ParkingSpace.update(
      { 
        isAvailable: true,
        currentBookingId: null 
      },
      { where: { id: booking.parkingSpaceId } }
    );
  }
});

module.exports = {
  sequelize,
  User,
  ParkingSpace,
  Booking
};