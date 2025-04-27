// src/components/LoginPage.jsx
import React from 'react';
import './LoginPage.css';

// Define constants (ensure these match your Spotify App settings)
const CLIENT_ID = '1d71d19478764af89e8836b6b5240bd3';
const REDIRECT_URI = 'http://localhost:8888/callback'; // Using the corrected URI
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize'; // Use actual Spotify Accounts URL
const RESPONSE_TYPE = 'token';
// Scopes joined by '%20' as required by Spotify's scope parameter format
const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-private',
  'playlist-modify-public',
  'user-library-read',
  'user-library-modify',
  'user-read-private',
  'user-read-email',
].join('%20'); // Use space '%20'

// Construct the URL using the constants and encode components where necessary
const spotifyAuthUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=${RESPONSE_TYPE}&scope=${SCOPES}`;
// Note: Spotify expects the scope parameter value itself to be space-delimited (%20), not the whole scope string url-encoded again.

function LoginPage() {
  return (
    <div className="login-container">
      <h1>Welcome to Smart Shuffler</h1>
      <p>Please log in with your Spotify account to continue.</p>
      {/* Use the correctly constructed URL */}
      <a href={spotifyAuthUrl} className="login-button">
        Login with Spotify
      </a>
    </div>
  );
}

export default LoginPage;