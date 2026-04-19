const { sequelize } = require('../models');

const resetDatabase = async () => {
  try {
    await sequelize.sync({ force: true });
    console.log('Database reset successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  }
};

resetDatabase();