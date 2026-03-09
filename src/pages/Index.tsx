import { Navigate } from "react-router-dom";

// This file is deprecated - routing is now handled directly in App.tsx
// Keeping it only for backward compatibility redirects
const Index = () => {
  return <Navigate to="/home" replace />;
};

export default Index;
