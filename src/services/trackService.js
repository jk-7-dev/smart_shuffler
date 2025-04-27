// src/services/trackService.js

const API_BASE = 'https://api.spotify.com/v1'; // Use actual Spotify API endpoint

/**
 * Fetches tracks for a specific playlist.
 * @param {string} token - Spotify access token.
 * @param {string} playlistId - The ID of the playlist.
 * @returns {Promise<Array>} A promise that resolves to an array of playlist track items.
 * @throws {Error} If the fetch request fails or returns an error status.
 */
export const fetchTracks = async (token, playlistId) => {
    const limit = 100; // Max tracks per request
    let tracks = [];
    // Specify fields to reduce response size: items(track(id, name, artists(name), album(name)))
    let url = `${API_BASE}/playlists/${playlistId}/tracks?limit=${limit}&fields=items(track(id,name,artists(name),album(name),duration_ms)),next`;

    try {
        while(url) {
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Spotify API Error (fetchTracks):", errorData);
                throw new Error(`Failed to fetch tracks for playlist ${playlistId}: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            tracks = tracks.concat(data.items || []);
            url = data.next; // URL for next page or null
        }
        return tracks;
    } catch(error) {
        console.error("Network or parsing error in fetchTracks:", error);
        throw error; // Re-throw
    }
};

/**
 * Adds tracks to a specified playlist.
 * Note: Spotify API adds tracks to the end. Max 100 URIs per request.
 * @param {string} token - Spotify access token.
 * @param {string} playlistId - The ID of the playlist to add tracks to.
 * @param {Array<string>} uris - An array of Spotify Track URIs (e.g., ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh"]).
 * @returns {Promise<Response>} A promise that resolves to the raw fetch Response object. The caller should check response.ok.
 * @throws {Error} If the fetch request itself fails (network error). API errors are handled by checking response.ok in the caller.
 */
export const addTracksToPlaylist = async (token, playlistId, uris) => {
    if (!uris || uris.length === 0) {
        console.warn("No track URIs provided to addTracksToPlaylist.");
        // Return a mock successful response or handle as needed
        return new Response(JSON.stringify({ snapshot_id: "dummy_snapshot_id_no_tracks" }), { status: 201 });
    }
    if (uris.length > 100) {
        console.warn("Attempting to add more than 100 tracks at once. Please chunk requests.");
        // Optionally throw an error or just proceed, letting Spotify handle it (it might fail)
        // throw new Error("Cannot add more than 100 tracks per API call.");
    }

  try {
      // Note: We return the raw response object here so the caller can handle .ok and .json()
      return await fetch(`${API_BASE}/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris }), // Send the chunk of URIs
      });
  } catch (error) {
      console.error("Network error in addTracksToPlaylist:", error);
      throw error; // Re-throw network errors
  }
};

/**
 * Gets the current authenticated user's Spotify ID.
 * @param {string} token - Spotify access token.
 * @returns {Promise<string|null>} A promise that resolves to the user's ID or null on failure.
 * @throws {Error} If the fetch request fails or returns an error status.
 */
export const getUserId = async (token) => {
  try {
    const response = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Spotify API Error (getUserId):", errorData);
        throw new Error(`Failed to get user info: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
      console.error("Network or parsing error in getUserId:", error);
      throw error; // Re-throw
  }
};