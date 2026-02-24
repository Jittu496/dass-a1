import { Navigate } from "react-router-dom";

export default function RoleRoute({ allow = [], children }) {
  const role = localStorage.getItem("role");
  if (!role) return <Navigate to="/" replace />;
  if (!allow.includes(role)) return <Navigate to="/dashboard" replace />;
  return children;
}
