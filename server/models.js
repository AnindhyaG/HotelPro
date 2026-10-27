const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: String,
  password: { type: String, required: true },
  role: { type: String, enum: ['guest', 'staff', 'admin'], default: 'guest' },
}, { timestamps: true }));
const Room = model('Room', new Schema({
  number: { type: String, required: true, unique: true },
  type: { type: String, enum: ['Single', 'Double', 'Deluxe', 'Suite'], required: true },
  pricePerNight: { type: Number, required: true, min: 0 },
  capacity: { type: Number, default: 2 },
  amenities: [String],
  description: String,
  active: { type: Boolean, default: true },
}));
const Booking = model('Booking', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  guests: { type: Number, default: 1 },
  nights: Number,
  total: Number,
  status: { type: String, enum: ['confirmed', 'checked-in', 'checked-out', 'cancelled'], default: 'confirmed' },
  payment: { status: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' }, transactionId: String, paidAt: Date },
}, { timestamps: true }));
module.exports = { User, Room, Booking };
