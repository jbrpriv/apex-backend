const Account = require('./models/Account');
const User = require('./models/User');

const seedAdmin = async () => {
  try {
    const existing = await User.findOne({});
    if (!existing) {
      const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase().trim();
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      await User.create({ username: adminUsername, password: adminPassword });
      console.log(`Admin user created → username: "${adminUsername}"`);
    } else {
      console.log('Admin user already exists, skipping...');
    }
  } catch (err) {
    if (err.code === 11000) {
      console.log('Admin already exists (duplicate key), skipping...');
    } else {
      throw err;
    }
  }
};

const seedData = [
  { accountStatus: 'Unbanned', accountEmail: 'jerryinmyroom222333@outlook.com', accountPassword: 'Respawn112211221122', additionalAccountPassword: '-', accountRecovery: 'jerryinmyroom222333@atomicmail.io', accountLevel: 14, salesStatus: 'Unsold' },
  { accountStatus: 'Banned', accountEmail: 'Apexrfr23@outlook.com', accountPassword: 'Geforce7001', additionalAccountPassword: '-', accountRecovery: 'apexrfr23@atomicmail.io', accountLevel: 14, salesStatus: 'Unsold' },
  { accountStatus: 'New', accountEmail: 'tashbottle7001@outlook.com', accountPassword: 'Zotac7001', additionalAccountPassword: '-', accountRecovery: '-', accountLevel: 12, salesStatus: 'Unsold' },
  { accountStatus: 'New', accountEmail: 'spidermana1122@outlook.com', accountPassword: 'Zotac7001', additionalAccountPassword: '-', accountRecovery: '-', accountLevel: 11, salesStatus: 'Unsold' },
  { accountStatus: 'Unbanned', accountEmail: 'gokuraj222333@outlook.com', accountPassword: 'Zotac7001', additionalAccountPassword: '-', accountRecovery: '-', accountLevel: 17, salesStatus: 'Unsold' },
  { accountStatus: 'Banned', accountEmail: 'Zotac7001@outlook.com', accountPassword: 'Geforce7001', additionalAccountPassword: '-', accountRecovery: '-', accountLevel: 18, salesStatus: 'Unsold' },
  { accountStatus: 'Banned', accountEmail: 'babyyoda123@atomicmail.io', accountPassword: 'Geforce7001', additionalAccountPassword: '-', accountRecovery: '-', accountLevel: 14, salesStatus: 'Unsold' }
];

const seed = async () => {
  try {
    const count = await Account.countDocuments();
    if (count === 0) {
      await Account.insertMany(seedData);
      console.log('Database seeded with Apex Legends accounts');
    } else {
      console.log('Accounts already seeded, skipping...');
    }
  } catch (err) {
    console.error('Account seed error:', err.message);
  }
};

const runSeeders = async () => {
  try {
    console.log('Starting seedAdmin...');
    await seedAdmin();
    console.log('Starting seed accounts...');
    await seed();
    console.log('Seeders done');
  } catch (err) {
    console.error('Seeder error:', err.message);
  }
};

module.exports = runSeeders;