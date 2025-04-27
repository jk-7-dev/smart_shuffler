// src/services/spotifyService.js

/**
 * The base URL for the Spotify Web API.
 * IMPORTANT: Replace placeholder URLs if necessary. Use environment variables for production.
 */
const BASE_URL = 'https://api.spotify.com/v1'; // Use actual Spotify API base URL: https://api.spotify.com/v1

// --- Helper for paginated requests ---
/**
 * Fetches all items from a paginated Spotify API endpoint.
 * @param {string} token - The Spotify access token.
 * @param {string} url - The initial URL of the paginated resource.
 * @returns {Promise<Array<object>>} A promise that resolves to an array containing all items from all pages.
 * @throws {Error} If any API request fails.
 */
const fetchPaginated = async (token, url) => {
    let items = [];
    let nextUrl = url;
    try {
        while (nextUrl) {
            const res = await fetch(nextUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                // Attempt to parse error details from Spotify
                let errorData = {};
                try {
                    errorData = await res.json();
                } catch (e) {
                    // Ignore if response is not JSON
                }
                console.error(`Spotify API Error during pagination (${nextUrl}):`, res.status, errorData);
                throw new Error(`API request failed (${res.status}): ${errorData.error?.message || res.statusText || 'Unknown error'}`);
            }
            const data = await res.json();
            items = items.concat(data.items || []);
            nextUrl = data.next; // Get URL for the next page, or null if none
        }
        return items;
    } catch (error) {
        // Log the error originating from the loop or initial throw
        console.error("Error during paginated fetch processing:", error);
        throw error; // Re-throw the caught error
    }
};

// --- Service Functions ---

/**
 * Fetches the profile information for the current user.
 * @param {string} token - The Spotify access token.
 * @returns {Promise<object>} A promise that resolves to the user profile object.
 * @throws {Error} If the API request fails.
 */
export const fetchUser = async (token) => {
    const url = `${BASE_URL}/me`;
    try {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
             let errorData = {};
             try { errorData = await res.json(); } catch (e) {}
             console.error(`Spotify API Error (${url}):`, errorData);
             throw new Error(`Failed to fetch user profile (${res.status}): ${errorData.error?.message || res.statusText}`);
        }
        return await res.json();
    } catch (error) {
        console.error("Network/fetch error in fetchUser:", error);
        // Don't re-wrap if it's already the error we threw
        if (error.message.startsWith("Failed to fetch user profile")) throw error;
        throw new Error(`Network error fetching user profile: ${error.message}`);
    }
};

/**
 * Fetches all playlists for the current user.
 * @param {string} token - The Spotify access token.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of playlist objects.
 * @throws {Error} If the API request fails during pagination.
 */
export const fetchPlaylists = async (token) => {
    // Fetches up to 50 playlists per request page
    const initialUrl = `${BASE_URL}/me/playlists?limit=50`;
    return fetchPaginated(token, initialUrl);
};

/**
 * Fetches all tracks for a specific playlist.
 * @param {string} token - The Spotify access token.
 * @param {string} playlistId - The ID of the playlist.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of playlist track objects (containing track details).
 * @throws {Error} If the API request fails during pagination.
 */
export const fetchPlaylistTracks = async (token, playlistId) => {
    if (!playlistId) throw new Error("Playlist ID must be provided to fetch tracks.");
    // Specify fields to minimize data transfer, fetches up to 100 tracks per page
    const fields = 'items(track(id,name,artists(name),album(name),duration_ms)),next';
    const initialUrl = `${BASE_URL}/playlists/${playlistId}/tracks?limit=100&fields=${encodeURIComponent(fields)}`;
    return fetchPaginated(token, initialUrl);
};

/**
 * Creates a new playlist for the specified user.
 * @param {string} token - The Spotify access token.
 * @param {string} userId - The user's Spotify ID.
 * @param {string} name - The name for the new playlist.
 * @param {string} [description=''] - Optional description for the playlist.
 * @returns {Promise<object>} A promise that resolves to the newly created playlist object.
 * @throws {Error} If the API request fails.
 */
export const createPlaylist = async (token, userId, name, description = '') => {
     if (!userId || !name) throw new Error("User ID and Playlist Name must be provided to create a playlist.");
     const url = `${BASE_URL}/users/${userId}/playlists`;
     try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            // Creates a private, non-collaborative playlist by default
            body: JSON.stringify({ name, description, public: false, collaborative: false }),
        });

        if (!res.ok) {
            let errorData = {};
            try { errorData = await res.json(); } catch (e) {}
            console.error(`Spotify API Error (${url}):`, errorData);
            throw new Error(`Failed to create playlist (${res.status}): ${errorData.error?.message || res.statusText}`);
        }
        return await res.json();
     } catch (error) {
        console.error("Network/fetch error in createPlaylist:", error);
        if (error.message.startsWith("Failed to create playlist")) throw error;
        throw new Error(`Network error creating playlist: ${error.message}`);
     }
};

/**
 * Adds tracks to a specified playlist. Handles chunking for large track lists.
 * @param {string} token - The Spotify access token.
 * @param {string} playlistId - The ID of the playlist to add tracks to.
 * @param {Array<string>} trackIds - An array of Spotify Track IDs (not URIs).
 * @returns {Promise<{snapshot_id: string|null}>} A promise resolving to an object containing the snapshot ID of the playlist after the last successful add operation, or null if no tracks were added.
 * @throws {Error} If any chunk request fails.
 */
export const addTracksToPlaylist = async (token, playlistId, trackIds) => {
    if (!playlistId) throw new Error("Playlist ID must be provided to add tracks.");
    if (!Array.isArray(trackIds) || trackIds.length === 0) {
        console.warn("No track IDs provided to addTracksToPlaylist.");
        return { snapshot_id: null }; // Indicate no tracks added, not an error
    }

    // Convert IDs to Spotify URIs
    const uris = trackIds.map(id => `spotify:track:${id}`);
    const url = `${BASE_URL}/playlists/${playlistId}/tracks`;
    const chunkSize = 100; // Spotify API limit per request
    let snapshotId = null; // To store the latest snapshot ID

    try {
        for (let i = 0; i < uris.length; i += chunkSize) {
            const chunk = uris.slice(i, i + chunkSize);
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uris: chunk }),
            });

            if (!res.ok) {
                let errorData = {};
                try { errorData = await res.json(); } catch (e) {}
                const chunkIndex = i / chunkSize;
                console.error(`Spotify API Error adding tracks (${url} - chunk ${chunkIndex}):`, errorData);
                // Note: If one chunk fails, previous chunks were already added.
                // Consider if rollback logic is needed (complex). Usually, just report the error.
                throw new Error(`Failed to add tracks (chunk ${chunkIndex}, status ${res.status}): ${errorData.error?.message || res.statusText}`);
            }
            // Store the snapshot_id from the last successful request
            const data = await res.json();
            snapshotId = data.snapshot_id;
        }
        // Return the final snapshot ID after all chunks succeeded
        return { snapshot_id: snapshotId };
    } catch (error) {
        console.error("Error during addTracksToPlaylist loop:", error);
        // Don't re-wrap if it's already the error we threw
        if (error.message.startsWith("Failed to add tracks")) throw error;
        throw new Error(`Network error adding tracks to playlist: ${error.message}`);
    }
};

/**
 * Convenience function to get only the user ID for the current user.
 * @param {string} token - The Spotify access token.
 * @returns {Promise<string>} A promise that resolves to the user's Spotify ID.
 * @throws {Error} If fetching the user profile fails.
 */
export const getUserId = async (token) => {
    // Reuses fetchUser and extracts the ID
    const user = await fetchUser(token);
    if (!user?.id) {
        throw new Error("Could not retrieve User ID from user profile data.");
    }
    return user.id;
}