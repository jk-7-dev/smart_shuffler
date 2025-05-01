import React from 'react';
import './LoginPage.css';

const CLIENT_ID = '1d71d19478764af89e8836b6b5240bd3';
const REDIRECT_URI = 'http://localhost:8888/callback';
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const RESPONSE_TYPE = 'token';
const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-private',
  'playlist-modify-public',
].join('%20');

const spotifyAuthUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
  REDIRECT_URI
)}&response_type=${RESPONSE_TYPE}&scope=${SCOPES}`;

function LoginPage() {
  return (
    <div className="login-container">
      <h1>Welcome to Smart Shuffler</h1>
      <p>Log in with Spotify to migrate your playlists.</p>
      <a href={spotifyAuthUrl} className="login-button">
        Login with Spotify
      </a>
    </div>
  );
}

export default LoginPage;