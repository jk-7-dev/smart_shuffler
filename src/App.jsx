// Example App.jsx using React Router
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import Spotify from './components/Spotify';
import ServicesPage from './components/ServicesPage';
import Callback from './components/Callback';
import Layout from './components/Layout'; // Import the Layout

function App() {
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Check for token on initial load
    const storedToken = localStorage.getItem('spotify_access_token');
    if (storedToken) {
      setToken(storedToken);
    }
    // Optional: Add listener for storage events if token can change in other tabs
  }, []);

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('amazon_access_token'); // Clear other tokens too
    localStorage.removeItem('youtube_access_token');
    // Navigate to login page after logout
    // This might require passing navigate function or using a different approach
    window.location.href = '/login'; // Simple redirect
  };

  return (
    <Router>
      <Routes>
        {/* Public Route: Login */}
        <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/" />} />

        {/* Public Route: Callback */}
        <Route path="/callback" element={<Callback />} />

        {/* Protected Routes wrapped by Layout */}
        <Route
          path="/"
          element={token ? <Layout onLogout={handleLogout} /> : <Navigate to="/login" />}
        >
           {/* Default route within Layout */}
          <Route index element={<Spotify token={token} onLogout={handleLogout}/>} />
           {/* Connect Services route within Layout */}
          <Route path="connect" element={<ServicesPage />} />
          {/* Add other protected routes here that should use the sidebar */}
        </Route>

        {/* Fallback for unmatched routes */}
        <Route path="*" element={<Navigate to={token ? "/" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;