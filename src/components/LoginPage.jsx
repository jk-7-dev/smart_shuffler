// src/components/LoginPage.jsx
import React from 'react';
import './LoginPage.css'; // Make sure this CSS file exists and is styled

// Base URL of your backend server
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Construct the login initiation URL for Spotify on your backend
const spotifyLoginUrl = `${BACKEND_URL}/auth/spotify/login`;

function LoginPage() {
  return (
    <div className="login-container">
      <h1>Welcome to Smart Shuffler</h1>
      <p>Please log in with your Spotify account to get started.</p>
      {/* Link points ONLY to your backend's Spotify login route */}
      <a href={spotifyLoginUrl} className="login-button spotify">
        Login with Spotify
      </a>
       <p style={{marginTop: '20px', fontSize: '0.9em', color: '#666'}}>
           You can connect other services after logging in.
       </p>
    </div>
  );
}

export default LoginPage;
