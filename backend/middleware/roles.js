export const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user?.role) return res.status(401).json({ msg: "Unauthorized" });
  if (!roles.includes(req.user.role)) return res.status(403).json({ msg: "Forbidden" });
  next();
};
