// src/services/playlistService.js

const API_BASE = 'https://api.spotify.com/v1'; // Use actual Spotify API endpoint

/**
 * Fetches the current user's playlists.
 * @param {string} token - Spotify access token.
 * @returns {Promise<Array>} A promise that resolves to an array of playlist items.
 * @throws {Error} If the fetch request fails or returns an error status.
 */
export const fetchPlaylists = async (token) => {
  const limit = 50; // Fetch up to 50 playlists at a time
  let playlists = [];
  let url = `${API_BASE}/me/playlists?limit=${limit}`;

  try {
    while (url) {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Spotify API Error (fetchPlaylists):", errorData);
            throw new Error(`Failed to fetch playlists: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        playlists = playlists.concat(data.items || []);
        url = data.next; // Get URL for the next page, or null if no more pages
    }
    return playlists;
  } catch (error) {
      console.error("Network or parsing error in fetchPlaylists:", error);
      // Re-throw the error to be caught by the calling component
      throw error;
  }
};

/**
 * Creates a new playlist for the user.
 * @param {string} token - Spotify access token.
 * @param {string} userId - The user's Spotify ID.
 * @param {string} name - The name for the new playlist.
 * @param {string} description - The description for the new playlist.
 * @returns {Promise<Object|null>} A promise that resolves to the created playlist object or null on failure.
 * @throws {Error} If the fetch request fails or returns an error status.
 */
export const createPlaylist = async (token, userId, name, description) => {
  try {
    const response = await fetch(`${API_BASE}/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          name,
          description,
          public: false, // Defaulting to private
          collaborative: false // Defaulting to non-collaborative
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Spotify API Error (createPlaylist):", errorData);
        throw new Error(`Failed to create playlist: ${errorData.error?.message || response.statusText}`);
    }
    return await response.json();
  } catch(error) {
      console.error("Network or parsing error in createPlaylist:", error);
      throw error; // Re-throw
  }
};