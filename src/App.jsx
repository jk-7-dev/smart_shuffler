// src/App.jsx
import React, { useState, useEffect } from 'react';
// Import BrowserRouter etc. FIRST if not already
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Spotify from './components/Spotify'; // Main app component
import LoginPage from './components/LoginPage'; // Login page component
import { getToken, logout as performLogout } from './services/auth'; // Auth functions
import './index.css'; // Global styles

function App() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for token on initial load OR after redirect (checks hash)
    const fetchedToken = getToken();
    setToken(fetchedToken);
    setLoading(false); // Finished checking token
    // Keep this log for debugging the token flow
    console.log("Token fetched in App:", fetchedToken ? 'Found and set' : 'Not Found');
  }, []); // Run only once on mount (or path change if dependencies were added)

  const handleLogout = () => {
    performLogout(); // Clears token from localStorage
    setToken(null); // Clears token state in App
    // Navigate('/') might be needed if logout happens outside Spotify component context
    // but here, the route protection handles the redirect automatically.
    console.log("Logout performed, token cleared.");
  };

  // Show loading indicator while checking initial token
  if (loading) {
    // Consider replacing with a styled spinner component for better UX
    return <div>Loading Application...</div>;
  }

  return (
    <BrowserRouter>
      <div className="App"> {/* Optional: Keep a general App container */}
        <Routes>
          {/* Login Route */}
          <Route
            path="/login"
            element={
              !token ? (
                <LoginPage />
              ) : (
                // If logged in, redirect /login to /
                <Navigate to="/" replace />
              )
            }
          />

          {/* === Added Callback Route === */}
          {/* Handles the redirect back from Spotify after login */}
          <Route
            path="/callback"
            element={
              // Immediately navigate to home. The useEffect hook in this App
              // component will have already run because of the page load at /callback,
              // processed the token from the hash, and updated the state.
              // This navigation cleans the URL and triggers the protected home route check.
              <Navigate to="/" replace />
            }
          />

          {/* Protected Home/Main App Route */}
          <Route
            path="/"
            element={
              token ? (
                // Render main app, passing token and logout handler
                <Spotify token={token} onLogout={handleLogout} />
              ) : (
                // If not logged in, redirect / to /login
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Catch-all Route */}
          {/* Redirects any unmatched path to login or home based on token status */}
          <Route
            path="*"
            element={<Navigate to={token ? "/" : "/login"} replace />}
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;