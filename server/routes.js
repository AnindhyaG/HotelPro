const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, Room, Booking } = require('./models');
const { sign, protect, allow } = require('./auth');
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(e.status || 500).json({ message: e.message || 'Something went wrong.' }));
const fail = (status, message) => Object.assign(new Error(message), { status });
const clean = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });

// ---- Auth ----
router.post('/auth/register', wrap(async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password || password.length < 6) throw fail(400, 'Enter a name, email and a password of at least 6 characters.');
  if (await User.findOne({ email: email.toLowerCase() })) throw fail(409, 'An account with this email already exists.');
  const user = await User.create({ name, email, phone, password: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: sign(user), user: clean(user) });
}));
router.post('/auth/login', wrap(async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) throw fail(401, 'Email or password is incorrect.');
  res.json({ token: sign(user), user: clean(user) });
}));
router.get('/auth/me', protect, (req, res) => res.json({ user: clean(req.user) }));

// ---- Rooms ----
const busyRoomIds = (checkIn, checkOut) =>
  Booking.find({ status: { $in: ['confirmed', 'checked-in'] }, checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } }).distinct('room');
router.get('/rooms', wrap(async (req, res) => {
  const { checkIn, checkOut, guests, type } = req.query;
  const q = { active: true };
  if (type) q.type = type;
  if (guests) q.capacity = { $gte: +guests };
  if (checkIn && checkOut) q._id = { $nin: await busyRoomIds(new Date(checkIn), new Date(checkOut)) };
  res.json(await Room.find(q).sort('pricePerNight'));
}));
router.post('/rooms', protect, allow('admin'), wrap(async (req, res) => res.status(201).json(await Room.create(req.body))));
router.put('/rooms/:id', protect, allow('admin'), wrap(async (req, res) => res.json(await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }))));
router.delete('/rooms/:id', protect, allow('admin'), wrap(async (req, res) => { await Room.findByIdAndUpdate(req.params.id, { active: false }); res.json({ ok: true }); }));

// ---- Bookings ----
router.post('/bookings', protect, wrap(async (req, res) => {
  const { roomId, guests = 1 } = req.body;
  const checkIn = new Date(req.body.checkIn), checkOut = new Date(req.body.checkOut);
  const nights = Math.round((checkOut - checkIn) / 864e5);
  if (isNaN(nights) || nights < 1) throw fail(400, 'Check-out must be at least one day after check-in.');
  if (checkIn < new Date(new Date().toDateString())) throw fail(400, 'Check-in cannot be in the past.');
  const room = await Room.findOne({ _id: roomId, active: true });
  if (!room) throw fail(404, 'Room not found.');
  if (guests > room.capacity) throw fail(400, `This room sleeps up to ${room.capacity} guests.`);
  if ((await busyRoomIds(checkIn, checkOut)).some((id) => id.equals(room._id))) throw fail(409, 'This room was just booked for those dates. Choose other dates or another room.');
  const booking = await Booking.create({ user: req.user._id, room: room._id, checkIn, checkOut, guests, nights, total: nights * room.pricePerNight });
  res.status(201).json(booking);
}));
router.get('/bookings/mine', protect, wrap(async (req, res) =>
  res.json(await Booking.find({ user: req.user._id }).populate('room').sort('-createdAt'))));
router.get('/bookings', protect, allow('admin', 'staff'), wrap(async (req, res) =>
  res.json(await Booking.find().populate('room').populate('user', 'name email phone').sort('-createdAt'))));
router.post('/bookings/:id/pay', protect, wrap(async (req, res) => {
  const b = await Booking.findById(req.params.id);
  if (!b || (!b.user.equals(req.user._id) && req.user.role === 'guest')) throw fail(404, 'Booking not found.');
  if (b.status === 'cancelled') throw fail(400, 'Cancelled bookings cannot be paid.');
  if (b.payment.status === 'paid') throw fail(400, 'This booking is already paid.');
  // DEMO PAYMENT: replace this block with a Stripe/Razorpay charge and verify its webhook.
  b.payment = { status: 'paid', transactionId: 'TXN-' + crypto.randomBytes(5).toString('hex').toUpperCase(), paidAt: new Date() };
  await b.save();
  res.json(b);
}));
router.patch('/bookings/:id/status', protect, wrap(async (req, res) => {
  const b = await Booking.findById(req.params.id);
  if (!b) throw fail(404, 'Booking not found.');
  const { status } = req.body;
  const isStaff = ['admin', 'staff'].includes(req.user.role);
  if (status === 'cancelled') {
    if (!isStaff && !b.user.equals(req.user._id)) throw fail(403, 'Not allowed.');
    if (['checked-in', 'checked-out'].includes(b.status)) throw fail(400, 'This stay has already started.');
    if (b.payment.status === 'paid') b.payment.status = 'refunded';
  } else if (['checked-in', 'checked-out'].includes(status)) {
    if (!isStaff) throw fail(403, 'Only staff can check guests in or out.');
  } else throw fail(400, 'Unknown status.');
  b.status = status;
  await b.save();
  res.json(b);
}));

// ---- Admin ----
router.get('/admin/stats', protect, allow('admin', 'staff'), wrap(async (req, res) => {
  const today = new Date(new Date().toDateString()), tomorrow = new Date(+today + 864e5);
  const [rooms, guests, bookings, occupied, arrivals, departures, revenue] = await Promise.all([
    Room.countDocuments({ active: true }), User.countDocuments({ role: 'guest' }), Booking.countDocuments(),
    Booking.countDocuments({ status: { $in: ['confirmed', 'checked-in'] }, checkIn: { $lt: tomorrow }, checkOut: { $gt: today } }),
    Booking.countDocuments({ status: 'confirmed', checkIn: { $gte: today, $lt: tomorrow } }),
    Booking.countDocuments({ status: 'checked-in', checkOut: { $gte: today, $lt: tomorrow } }),
    Booking.aggregate([{ $match: { 'payment.status': 'paid' } }, { $group: { _id: null, sum: { $sum: '$total' } } }]),
  ]);
  res.json({ rooms, guests, bookings, occupied, occupancy: rooms ? Math.round((occupied / rooms) * 100) : 0, arrivals, departures, revenue: revenue[0]?.sum || 0 });
}));
router.get('/admin/guests', protect, allow('admin', 'staff'), wrap(async (req, res) => res.json(await User.find({ role: 'guest' }).select('-password').sort('-createdAt'))));
module.exports = router;
