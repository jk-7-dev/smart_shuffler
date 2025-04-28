// src/services/spotifyService.js

/**
 * The base URL for your backend server (BFF).
 * Use environment variables for flexibility (e.g., process.env.REACT_APP_BACKEND_URL).
 */
const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

/**
 * Helper function to handle fetch requests to the backend API proxy.
 * Includes credentials to send session cookies.
 * Parses JSON response and handles basic HTTP errors.
 * @param {string} endpoint - The backend API endpoint path (e.g., '/api/spotify/playlists').
 * @param {object} [options={}] - Optional fetch options (method, headers, body).
 * @returns {Promise<any>} A promise that resolves to the JSON response data from the backend.
 * @throws {Error} If the fetch fails or the backend returns an error status.
 */
const fetchFromBackend = async (endpoint, options = {}) => {
    const url = `${BACKEND_API_BASE_URL}${endpoint}`;
    console.log(`Calling backend: ${options.method || 'GET'} ${url}`);

    const fetchOptions = {
        credentials: 'include', // Send cookies
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
        },
        ...options,
    };

    try {
        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            let errorData = { message: `HTTP error! Status: ${response.status}` };
            try {
                errorData = await response.json();
            } catch (e) {
                 console.warn("Could not parse error response as JSON.");
            }
            // Use error message from backend if available
            throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
        }

        if (response.status === 204) { // No Content
            return null;
        }
        return await response.json(); // Parse success response

    } catch (error) {
        console.error(`Error fetching from backend endpoint ${endpoint}:`, error);
        throw error; // Re-throw
    }
};


// --- Service Functions (Updated to use Backend Proxy) ---

/**
 * Fetches the current user's profile information from the backend proxy.
 * Used to check authentication status and get basic info.
 * @returns {Promise<object>} User profile data (e.g., { display_name, id, email }).
 * @throws {Error} If the backend request fails (e.g., user not logged in - likely 401).
 */
export const fetchCurrentUser = async () => {
    // Calls the backend endpoint that uses the session token
    return fetchFromBackend('/api/spotify/me');
};

/**
 * Fetches the user's playlists from the backend proxy.
 * @returns {Promise<Array<object>>} Array of playlist objects.
 * @throws {Error} If the backend request fails.
 */
export const fetchPlaylists = async () => {
    // Backend handles pagination and auth
    return fetchFromBackend('/api/spotify/playlists');
};

/**
 * Fetches tracks for a specific playlist from the backend proxy.
 * @param {string} playlistId - The ID of the playlist.
 * @returns {Promise<Array<object>>} Array of playlist track objects.
 * @throws {Error} If the backend request fails.
 */
export const fetchPlaylistTracks = async (playlistId) => {
    if (!playlistId) throw new Error("Playlist ID must be provided.");
    // Backend handles pagination, auth, and field selection
    return fetchFromBackend(`/api/spotify/playlists/${playlistId}/tracks`);
};

/**
 * Creates a new playlist via the backend proxy.
 * @param {string} name - The name for the new playlist.
 * @param {string} [description=''] - Optional description.
 * @returns {Promise<object>} The newly created playlist object.
 * @throws {Error} If the backend request fails.
 */
export const createPlaylist = async (name, description = '') => {
    if (!name) throw new Error("Playlist Name must be provided.");
    // Backend gets userId from session
    return fetchFromBackend('/api/spotify/playlists', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
    });
};

/**
 * Adds tracks to a playlist via the backend proxy.
 * @param {string} playlistId - The ID of the playlist.
 * @param {Array<string>} trackIds - Array of Spotify Track IDs.
 * @returns {Promise<object>} Response from the backend (e.g., { snapshot_id }).
 * @throws {Error} If the backend request fails.
 */
export const addTracksToPlaylist = async (playlistId, trackIds) => {
    if (!playlistId) throw new Error("Playlist ID must be provided.");
    if (!Array.isArray(trackIds) || trackIds.length === 0) {
        console.warn("No track IDs provided to add.");
        return { snapshot_id: null };
    }
    // Backend converts IDs to URIs and handles chunking
    return fetchFromBackend(`/api/spotify/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ trackIds: trackIds }),
    });
};

/**
 * Removes tracks from a playlist via the backend proxy.
 * @param {string} playlistId - The ID of the playlist.
 * @param {Array<{uri: string}>} tracksToRemove - Array of objects containing track URIs.
 * @returns {Promise<object>} Response from the backend (e.g., { snapshot_id }).
 * @throws {Error} If the backend request fails.
 */
export const removeTracksFromPlaylist = async (playlistId, tracksToRemove) => {
     if (!playlistId) throw new Error("Playlist ID must be provided.");
    if (!Array.isArray(tracksToRemove) || tracksToRemove.length === 0) {
        console.warn("No tracks specified for removal.");
        return { snapshot_id: null };
    }
    // Backend handles chunking
    return fetchFromBackend(`/api/spotify/playlists/${playlistId}/tracks`, {
        method: 'DELETE',
        body: JSON.stringify({ tracks: tracksToRemove }),
    });
};

/**
 * Convenience function to get only the user ID for the current user via backend.
 * @returns {Promise<string>} The user's Spotify ID.
 * @throws {Error} If fetching the user profile fails or ID is missing.
 */
export const getUserId = async () => {
    // Reuses fetchCurrentUser and extracts the ID
    const user = await fetchCurrentUser(); // Calls backend /api/spotify/me
    if (!user?.id) {
        throw new Error("Could not retrieve User ID from backend.");
    }
    return user.id;
};

// --- Check Authentication Status ---
/**
 * Checks the overall authentication status with the backend.
 * @returns {Promise<object>} Object indicating login status for services (e.g., { spotify: true }).
 */
export const checkAuthStatus = async () => {
    return fetchFromBackend('/api/auth/status');
};