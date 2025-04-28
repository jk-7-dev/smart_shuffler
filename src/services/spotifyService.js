// src/services/spotifyService.js (Frontend Version)

/**
 * The base URL for the Spotify Web API.
 */
// Correct Spotify API Base URL
const BASE_URL = 'https://api.spotify.com/v1';

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
                let errorData = {};
                try { errorData = await res.json(); } catch (e) {}
                console.error(`Spotify API Error during pagination (${nextUrl}):`, res.status, errorData);
                throw new Error(`API request failed (${res.status}): ${errorData.error?.message || res.statusText || 'Unknown error'}`);
            }
            const data = await res.json();
            items = items.concat(data.items || []);
            nextUrl = data.next;
        }
        return items;
    } catch (error) {
        console.error("Error during paginated fetch processing:", error);
        throw error;
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
    if (!token) throw new Error("Token is required for fetchUser."); // Added token check
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
    if (!token) throw new Error("Token is required for fetchPlaylists."); // Added token check
    const initialUrl = `${BASE_URL}/me/playlists?limit=50`;
    return fetchPaginated(token, initialUrl);
};

/**
 * Fetches all tracks for a specific playlist.
 * @param {string} token - The Spotify access token.
 * @param {string} playlistId - The ID of the playlist.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of playlist track objects.
 * @throws {Error} If the API request fails during pagination.
 */
export const fetchPlaylistTracks = async (token, playlistId) => {
    if (!token) throw new Error("Token is required for fetchPlaylistTracks."); // Added token check
    if (!playlistId) throw new Error("Playlist ID must be provided to fetch tracks.");
    // Added track URI to the fields needed for removal logic
    const fields = 'items(track(id,uri,name,artists(name),album(name),duration_ms)),next';
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
     if (!token) throw new Error("Token is required for createPlaylist."); // Added token check
     if (!userId || !name) throw new Error("User ID and Playlist Name must be provided to create a playlist.");
     const url = `${BASE_URL}/users/${userId}/playlists`;
     try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
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
 * @returns {Promise<{snapshot_id: string|null}>} A promise resolving to an object containing the snapshot ID.
 * @throws {Error} If any chunk request fails.
 */
export const addTracksToPlaylist = async (token, playlistId, trackIds) => {
    if (!token) throw new Error("Token is required for addTracksToPlaylist."); // Added token check
    if (!playlistId) throw new Error("Playlist ID must be provided to add tracks.");
    if (!Array.isArray(trackIds) || trackIds.length === 0) {
        console.warn("No track IDs provided to addTracksToPlaylist.");
        return { snapshot_id: null };
    }
    const uris = trackIds.map(id => `spotify:track:${id}`);
    const url = `${BASE_URL}/playlists/${playlistId}/tracks`;
    const chunkSize = 100;
    let snapshotId = null;
    try {
        for (let i = 0; i < uris.length; i += chunkSize) {
            const chunk = uris.slice(i, i + chunkSize);
            const res = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ uris: chunk }),
            });
            if (!res.ok) {
                let errorData = {};
                try { errorData = await res.json(); } catch (e) {}
                const chunkIndex = i / chunkSize;
                console.error(`Spotify API Error adding tracks (${url} - chunk ${chunkIndex}):`, errorData);
                throw new Error(`Failed to add tracks (chunk ${chunkIndex}, status ${res.status}): ${errorData.error?.message || res.statusText}`);
            }
            const data = await res.json();
            snapshotId = data.snapshot_id;
        }
        return { snapshot_id: snapshotId };
    } catch (error) {
        console.error("Error during addTracksToPlaylist loop:", error);
        if (error.message.startsWith("Failed to add tracks")) throw error;
        throw new Error(`Network error adding tracks to playlist: ${error.message}`);
    }
};

/**
 * Removes specified tracks (all occurrences) from a specific playlist.
 * @param {string} token - The Spotify access token.
 * @param {string} playlistId - The ID of the playlist to modify.
 * @param {Array<{uri: string}>} tracksToRemove - An array of objects, each containing the 'uri' of the track to remove.
 * @returns {Promise<{snapshot_id: string|null}>} A promise resolving to an object containing the final snapshot ID.
 * @throws {Error} If the API request fails.
 */
export const removeTracksFromPlaylist = async (token, playlistId, tracksToRemove) => {
    if (!token) throw new Error("Token is required for removeTracksFromPlaylist."); // Added token check
    if (!playlistId) throw new Error("Playlist ID must be provided to remove tracks.");
    if (!Array.isArray(tracksToRemove) || tracksToRemove.length === 0) {
        console.warn("No tracks specified for removal.");
        return { snapshot_id: null };
    }
    const url = `${BASE_URL}/playlists/${playlistId}/tracks`;
    const chunkSize = 100;
    let snapshotId = null;
    try {
        for (let i = 0; i < tracksToRemove.length; i += chunkSize) {
            const chunk = tracksToRemove.slice(i, i + chunkSize);
            const res = await fetch(url, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ tracks: chunk }),
            });
            if (!res.ok) {
                let errorData = {};
                try { errorData = await res.json(); } catch (e) {}
                const chunkIndex = i / chunkSize;
                console.error(`Spotify API Error removing tracks (${url} - chunk ${chunkIndex}):`, errorData);
                throw new Error(`Failed to remove tracks (chunk ${chunkIndex}, status ${res.status}): ${errorData.error?.message || res.statusText}`);
            }
            const data = await res.json();
            snapshotId = data.snapshot_id;
        }
        return { snapshot_id: snapshotId };
    } catch (error) {
        console.error("Error during removeTracksFromPlaylist loop:", error);
        if (error.message.startsWith("Failed to remove tracks")) throw error;
        throw new Error(`Network error removing tracks from playlist: ${error.message}`);
    }
};

/**
 * Convenience function to get only the user ID for the current user.
 * @param {string} token - The Spotify access token.
 * @returns {Promise<string>} A promise that resolves to the user's Spotify ID.
 * @throws {Error} If fetching the user profile fails or ID is missing.
 */
export const getUserId = async (token) => {
    // Reuses fetchUser and extracts the ID
    const user = await fetchUser(token); // Pass token
    if (!user?.id) {
        console.error("User profile data fetched successfully but missing ID:", user);
        throw new Error("Could not retrieve User ID from user profile data.");
    }
    return user.id;
};

/**
 * Searches for a track on Spotify using metadata.
 * Prioritizes finding an exact match using field filters.
 * @param {string} token - Spotify access token.
 * @param {object} metadata - Object containing { title, artist, album }. Artist/Album are optional.
 * @param {number} [limit=1] - Max number of results to return (default 1).
 * @returns {Promise<object|null>} The first matching track object from Spotify API, or null if no match found.
 * @throws {Error} If the API request fails.
 */
export const searchSpotifyTrack = async (token, metadata, limit = 1) => {
    if (!token) throw new Error("Authentication token is required for search.");
    if (!metadata || !metadata.title) throw new Error("Track title is required for search.");

    const { title, artist, album } = metadata;
    let queryParts = [];
    if (title) queryParts.push(`track:"${title.replace(/"/g, '')}"`);
    if (artist) queryParts.push(`artist:"${artist.replace(/"/g, '')}"`);
    if (album) queryParts.push(`album:"${album.replace(/"/g, '')}"`);

    const query = queryParts.join(' ');
    const type = 'track';

    const params = new URLSearchParams({ q: query, type: type, limit: limit });
    const url = `${BASE_URL}/search?${params.toString()}`;
    console.log(`Searching Spotify: ${query}`);

    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
            let errorData = {};
            try { errorData = await response.json(); } catch (e) {}
            console.error(`Spotify Search API Error (${url}):`, errorData);
            throw new Error(`Search request failed (${response.status}): ${errorData.error?.message || response.statusText}`);
        }
        const data = await response.json();
        if (data.tracks && data.tracks.items && data.tracks.items.length > 0) {
            console.log(`Found track: ${data.tracks.items[0].name} by ${data.tracks.items[0].artists.map(a=>a.name).join(', ')}`);
            return data.tracks.items[0]; // Return first match
        } else {
            console.log(`No track found for query: ${query}`);
            return null;
        }
    } catch (error) {
        console.error("Network/fetch error during Spotify search:", error);
        if (error.message.startsWith("Search request failed")) throw error;
        throw new Error(`Network error during search: ${error.message}`);
    }
};
