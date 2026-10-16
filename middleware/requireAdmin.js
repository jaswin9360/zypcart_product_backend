
export default function requireAdmin(req, res, next) {
  if (!req.user || String(req.user.role).toLowerCase() !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  next();
}
