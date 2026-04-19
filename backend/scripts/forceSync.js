const { sequelize } = require('../models');

const forceSync = async () => {
  try {
    // This will drop and recreate all tables
    await sequelize.sync({ force: true });
    console.log('Database synchronized successfully with current models');
    process.exit(0);
  } catch (error) {
    console.error('Error synchronizing database:', error);
    process.exit(1);
  }
};

forceSync();