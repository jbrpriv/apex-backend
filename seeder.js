const Account = require('./models/Account');
const User = require('./models/User');

const seedAdmin = async () => {
  const count = await User.countDocuments();
  if (count === 0) {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    await User.create({ username: adminUsername, password: adminPassword });
    console.log(`Admin user created → username: "${adminUsername}"`);
  }
};

const seedData = [
  { accountStatus: 'Banned', accountEmail: 'babyyoda123@atomicmail.io', accountPassword: 'Geforce7001', additionalAccountPassword: '-', accountRecovery: '-', accountLevel: 14, salesStatus: 'Unsold' }
];

const seed = async () => {
  const count = await Account.countDocuments();
  if (count === 0) {
    await Account.insertMany(seedData);
    console.log('Database seeded with Apex Legends accounts');
  }
};

const runSeeders = async () => {
  try {
    console.log('Starting seedAdmin...');
    await seedAdmin();
    console.log('seedAdmin done, starting seed...');
    await seed();
    console.log('Seeders done');
  } catch (err) {
    console.error('Seeder error:', err.message);
  }
};

module.exports = runSeeders;