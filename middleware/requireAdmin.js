// middleware/requireAdmin.js
module.exports = function requireAdmin(req, res, next) {
  // Add your existing authentication middleware before this check.
  // req.user must be populated by verified server-side authentication.
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  next();
};