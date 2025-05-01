// src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Spotify from './components/Spotify';
import LoginPage from './components/LoginPage';
import ServicesPage from './components/ServicesPage'; // Added ServicesPage import
import { getToken, logout as performLogout } from './services/auth';
import Callback from './components/Callback';

import './index.css';

function App() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchedToken = getToken();
    setToken(fetchedToken);
    setLoading(false);
    console.log("Token fetched in App:", fetchedToken ? 'Found and set' : 'Not Found');
  }, []);

  const handleLogout = () => {
    performLogout();
    setToken(null);
    console.log("Logout performed, token cleared.");
  };

  if (loading) {
    return <div>Loading Application...</div>;
  }

  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route
            path="/login"
            element={!token ? <LoginPage /> : <Navigate to="/services" replace />}
          />
          <Route
            path="/services"
            element={token ? <ServicesPage onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/callback"
            element={<Callback />}
          />
          <Route
            path="/"
            element={token ? <Spotify token={token} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="*"
            element={<Navigate to={token ? "/services" : "/login"} replace />}
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
