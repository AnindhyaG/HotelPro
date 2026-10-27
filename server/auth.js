const jwt = require('jsonwebtoken');
const { User } = require('./models');
const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const protect = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(id).select('-password');
    if (!req.user) throw new Error();
    next();
  } catch { res.status(401).json({ message: 'Please log in to continue.' }); }
};
const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'You do not have access to this action.' });
module.exports = { sign, protect, allow };
