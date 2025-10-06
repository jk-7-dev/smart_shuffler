// src/components/LoginPage.jsx
import React from 'react';
import './LoginPage.css'; // Styles updated for dark theme & background

// Constants remain the same
const CLIENT_ID = '1d71d19478764af89e8836b6b5240bd3';
const REDIRECT_URI = 'http://localhost:8888/callback'; // Ensure this matches Spotify Dev dashboard
// Ensure AUTH_ENDPOINT points to the correct Spotify Accounts service URL
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize'; // Note: This URL seems like a placeholder. For actual Spotify auth, it should be 'https://accounts.spotify.com/authorize'
const RESPONSE_TYPE = 'token';

// --- MODIFIED SCOPES ---
const SCOPES = [
  'playlist-read-private', 'playlist-read-collaborative',
  'playlist-modify-private', 'playlist-modify-public',
  'user-read-private', // Needed for user ID
  'user-modify-playback-state', // Required to control playback
  'user-read-playback-state',   // Required to see current playback state & devices
  'streaming'                   // Required if you were to play music *within* your app (Spotify SDK)
                                // For controlling external devices, it might not be strictly necessary
                                // but often included when dealing with playback. Let's keep it for now.
].join('%20'); // Use %20 for spaces in URL

const spotifyAuthUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=${RESPONSE_TYPE}&scope=${SCOPES}&show_dialog=true`; // Added show_dialog


function LoginPage() {
  return (
    // Added wrapper div for centering
    <div className="login-page-wrapper">
        <div className="login-container">
          <h1>Welcome to Mellify📻</h1>
          <p>Log in with Spotify to manage and migrate your playlists.</p>
          <a href={spotifyAuthUrl} className="login-button">
            Login with Spotify
          </a>
        </div>
    </div>
  );
}

export default LoginPage;