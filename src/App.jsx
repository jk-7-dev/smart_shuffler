// src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Spotify from './components/Spotify'; // Main app component after login
import LoginPage from './components/LoginPage';
// Import the check function from the service (can be any service file now)
import { checkAuthStatus } from './services/spotifyService'; // Or a dedicated authService.js
import './index.css';

function App() {
  // Tracks if the primary Spotify authentication is active
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("App useEffect: Checking primary (Spotify) auth status with backend...");
    checkAuthStatus() // Calls /api/auth/status on backend
      .then(status => {
        // Check specifically if Spotify session is active
        if (status?.spotify) {
          console.log("Auth status check: User IS authenticated with Spotify.");
          setIsAuthenticated(true);
        } else {
          console.log("Auth status check: User is NOT authenticated with Spotify.");
          setIsAuthenticated(false);
        }
      })
      .catch(error => {
        console.error("Auth status check failed:", error);
        setIsAuthenticated(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleLogout = () => {
    console.log("handleLogout called: Clearing frontend auth state.");
    setIsAuthenticated(false);
    // --- TODO: Call backend logout endpoint ---
    // This backend endpoint should clear ALL service tokens from the session
    // fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'}/auth/logout`, {
    //   method: 'POST',
    //   credentials: 'include'
    // }).catch(err => console.error("Backend logout failed:", err));
  };

  if (loading) {
    return <div>Loading Application...</div>;
  }

  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          {/* Login Route - Only shows if not authenticated via Spotify */}
          <Route
            path="/login"
            element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />}
          />
          {/* Callback Route - Generic redirect catcher */}
          <Route path="/callback" element={<Navigate to="/" replace />} />
          {/* Protected Home Route - Requires Spotify authentication */}
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Spotify onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          {/* Catch-all */}
          <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
