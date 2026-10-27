require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Room, Booking } = require('./models');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.deleteMany(), Room.deleteMany(), Booking.deleteMany()]);
  await User.create([
    { name: 'Admin', email: 'admin@hotelpro.com', role: 'admin', password: await bcrypt.hash('admin123', 10) },
    { name: 'Front Desk', email: 'staff@hotelpro.com', role: 'staff', password: await bcrypt.hash('staff123', 10) },
    { name: 'Demo Guest', email: 'guest@hotelpro.com', role: 'guest', password: await bcrypt.hash('guest123', 10) },
  ]);
  const t = [['Single', 1800, 1, ['Wi-Fi', 'AC', 'Desk']], ['Double', 2800, 2, ['Wi-Fi', 'AC', 'TV']], ['Deluxe', 4200, 3, ['Wi-Fi', 'AC', 'Balcony', 'Minibar']], ['Suite', 7500, 4, ['Wi-Fi', 'AC', 'Lounge', 'Bathtub', 'Breakfast']]];
  await Room.create(t.flatMap(([type, p, c, a], i) => [1, 2, 3].map((n) => ({ number: `${i + 1}0${n}`, type, pricePerNight: p, capacity: c, amenities: a, description: `${type} room on floor ${i + 1}.` }))));
  console.log('Seeded. Logins: admin@hotelpro.com / admin123, staff@hotelpro.com / staff123, guest@hotelpro.com / guest123');
  process.exit(0);
})();
