// src/components/LoginPage.jsx
import React from 'react';
import './LoginPage.css'; // Styles updated for dark theme

// Constants remain the same
const CLIENT_ID = '1d71d19478764af89e8836b6b5240bd3';
const REDIRECT_URI = 'https://smart-shuffler.vercel.app/callback'; // Ensure this matches Spotify Dev dashboard
// Ensure AUTH_ENDPOINT points to the correct Spotify Accounts service URL
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const RESPONSE_TYPE = 'token';
const SCOPES = [
  'playlist-read-private', 'playlist-read-collaborative',
  'playlist-modify-private', 'playlist-modify-public',
  'user-read-private' // Added scope often needed for user ID
].join('%20'); // Use %20 for spaces in URL

const spotifyAuthUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=${RESPONSE_TYPE}&scope=${SCOPES}&show_dialog=true`; // Added show_dialog


function LoginPage() {
  return (
    // Added wrapper div for centering
    <div className="login-page-wrapper">
        <div className="login-container">
          <h1>Welcome to Smart Shuffler</h1>
          <p>Log in with Spotify to manage and migrate your playlists.</p>
          <a href={spotifyAuthUrl} className="login-button">
            Login with Spotify
          </a>
        </div>
    </div>
  );
}

export default LoginPage;
