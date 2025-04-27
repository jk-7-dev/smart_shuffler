// src/services/auth.js

/**
 * Gets the Spotify access token.
 * Tries to retrieve it from the URL hash (after redirect from Spotify).
 * If found, saves it to localStorage and clears the hash.
 * If not in hash, tries to retrieve it from localStorage.
 *
 * @returns {string | null} The access token or null if not found.
 */
export const getToken = () => {
    const hash = window.location.hash;
    let token = localStorage.getItem('spotify_access_token'); // Use a specific key
  
    if (!token && hash) {
      // Try to parse token from URL hash
      const params = new URLSearchParams(hash.substring(1)); // Use URLSearchParams for easier parsing
      const accessToken = params.get('access_token');
  
      if (accessToken) {
          token = accessToken;
          const expiresIn = params.get('expires_in');
          const expiryTime = new Date().getTime() + expiresIn * 1000;
  
          localStorage.setItem('spotify_access_token', token);
          localStorage.setItem('spotify_token_expiry_time', expiryTime);
  
          window.location.hash = ''; // Clear the hash from the URL
      }
    }
  
    // Check if the stored token is expired
    const expiryTime = localStorage.getItem('spotify_token_expiry_time');
    if (token && expiryTime && new Date().getTime() > expiryTime) {
      console.warn("Spotify token expired.");
      logout(); // Clear expired token
      return null; // Return null as token is expired
    }
  
  
    return token;
  };
  
  /**
   * Removes the Spotify access token and its expiry time from localStorage.
   */
  export const logout = () => {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expiry_time');
    // Optionally reload the page to reset the app state completely
    // window.location.reload();
  };