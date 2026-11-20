require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const TEST_EMAILS = [
  'claimant1@seu.edu.bd',
  'claimant2@seu.edu.bd',
  'founder.test@seu.edu.bd'
];

const run = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGO_URI / MONGODB_URI missing in .env');
      process.exit(1);
    }

    await mongoose.connect(uri);

    for (const email of TEST_EMAILS) {
      const user = await User.findOne({ email });
      if (!user) {
        console.log(`Not found: ${email}`);
        continue;
      }

      // Check how login compares password: if pre('save') hashes plain text,
      // assigning 'Mdrana12' and saving will hash it once.
      // If login compares directly with bcrypt.hashSync, we can verify right here.
      user.password = 'Mdrana12';
      await user.save();

      const afterSave = await User.findById(user._id).select('+password');
      const matchesBcrypt = await bcrypt.compare('Mdrana12', afterSave.password || '');

      if (!matchesBcrypt) {
        await User.updateOne(
          { _id: user._id },
          { $set: { password: await bcrypt.hash('Mdrana12', 10) } }
        );
      }

      console.log(`Password synced for ${email} -> Mdrana12`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Reset error:', err.message);
    process.exit(1);
  }
};

run();