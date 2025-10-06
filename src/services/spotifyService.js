const BASE_URL = 'https://api.spotify.com/v1'; // Correct Spotify API Base URL
// --- Helper for paginated requests ---

/**
Fetches all items from a paginated Spotify API endpoint.
@param {string} token - The Spotify access token.
@param {string} url - The initial URL of the paginated resource.
@returns {Promise<Array>} A promise that resolves to an array containing all items from all pages.
@throws {Error} If any API request fails.

*/

const fetchPaginated = async (token, url) => {

// Check if token is provided

if (!token) throw new Error("Token is required for paginated fetch.");

let items = [];

let nextUrl = url;

try {

while (nextUrl) {

console.debug(`Workspaceing paginated data from: ${nextUrl}`); // Debug log

// Make the fetch request with the Authorization header

const res = await fetch(nextUrl, {

headers: { Authorization: `Bearer ${token}` },

});

// Check if the response was successful

if (!res.ok) {

let errorData = {};

try {

// Try to parse error details from Spotify's JSON response

errorData = await res.json();

} catch (e) {

// Ignore if response is not JSON

console.warn("Could not parse error response as JSON during pagination.");

}

console.error(`Spotify API Error during pagination (${nextUrl}):`, res.status, errorData);

// Throw a detailed error

throw new Error(`API request failed (${res.status}): ${errorData.error?.message || res.statusText || 'Unknown error'}`);

}

// Parse the successful JSON response

const data = await res.json();

// Concatenate items from the current page

items = items.concat(data.items || []);

// Get the URL for the next page, if it exists

nextUrl = data.next;

}

console.debug(`Paginated fetch complete. Total items: ${items.length}`); // Debug log

return items; // Return all collected items

} catch (error) {

console.error("Error during paginated fetch processing:", error);

throw error; // Re-throw the error for the caller to handle

}

};
// --- Service Functions ---
/**

Fetches the profile information for the current user.
@param {string} token - The Spotify access token.
@returns {Promise} User profile object.
@throws {Error} If token is missing or API request fails.

*/

export const fetchUser = async (token) => {

if (!token) throw new Error("Token is required for fetchUser.");

const url = `${BASE_URL}/me`;

try {

const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

if (!res.ok) {

let errorData = {}; try { errorData = await res.json(); } catch (e) {}

console.error(`Spotify API Error (${url}):`, errorData);

throw new Error(`Failed to fetch user profile (${res.status}): ${errorData.error?.message || res.statusText}`);

}

return await res.json();

} catch (error) {

console.error("Network/fetch error in fetchUser:", error);

// Avoid re-wrapping the specific error thrown above

if (error.message.startsWith("Failed to fetch user profile")) throw error;

throw new Error(`Network error fetching user profile: ${error.message}`);

}

};
/**

Fetches all playlists for the current user.
@param {string} token - The Spotify access token.
@returns {Promise<Array>} Array of playlist objects.
@throws {Error} If token is missing or API request fails.

*/

export const fetchPlaylists = async (token) => {

if (!token) throw new Error("Token is required for fetchPlaylists.");

// Start fetching with a limit (e.g., 50 playlists per page)

const initialUrl = `${BASE_URL}/me/playlists?limit=50`;

// Use the helper function to handle pagination automatically

return fetchPaginated(token, initialUrl);

};
/**

Fetches all tracks for a specific playlist.
@param {string} token - The Spotify access token.
@param {string} playlistId - The ID of the playlist.
@returns {Promise<Array>} Array of playlist track objects.
@throws {Error} If token/playlistId is missing or API request fails.

*/

export const fetchPlaylistTracks = async (token, playlistId) => {

if (!token) throw new Error("Token is required for fetchPlaylistTracks.");

if (!playlistId) throw new Error("Playlist ID must be provided to fetch tracks.");

// Request specific fields to minimize data, including 'uri' needed for removal

const fields = 'items(track(id,uri,name,artists(name),album(name),duration_ms)),next';

// Fetch up to 100 tracks per page

const initialUrl = `${BASE_URL}/playlists/${playlistId}/tracks?limit=100&fields=${encodeURIComponent(fields)}`;

// Use the helper function to handle pagination

return fetchPaginated(token, initialUrl);

};
/**

Creates a new playlist for the specified user.
@param {string} token - The Spotify access token.
@param {string} userId - The user's Spotify ID.
@param {string} name - The name for the new playlist.
@param {string} [description=''] - Optional description.
@returns {Promise} The newly created playlist object.
@throws {Error} If required args are missing or API request fails.

*/

export const createPlaylist = async (token, userId, name, description = '') => {

if (!token) throw new Error("Token is required for createPlaylist.");

if (!userId || !name) throw new Error("User ID and Playlist Name are required.");

const url = `${BASE_URL}/users/${userId}/playlists`;

try {

const res = await fetch(url, {

method: 'POST',

headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },

// Create a private, non-collaborative playlist

body: JSON.stringify({ name, description, public: false, collaborative: false }),

});

if (!res.ok) {

let errorData = {}; try { errorData = await res.json(); } catch (e) {}

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

Adds tracks to a specified playlist using track IDs. Handles chunking.
@param {string} token - The Spotify access token.
@param {string} playlistId - The ID of the playlist.
@param {Array} trackIds - Array of Spotify Track IDs.
@returns {Promise<{snapshot_id: string|null}>} Object containing the snapshot ID.
@throws {Error} If required args are missing or API request fails.

*/

export const addTracksToPlaylist = async (token, playlistId, trackIds) => {

if (!token) throw new Error("Token is required for addTracksToPlaylist.");

if (!playlistId) throw new Error("Playlist ID is required.");

if (!Array.isArray(trackIds) || trackIds.length === 0) {

console.warn("No track IDs provided to addTracksToPlaylist.");

return { snapshot_id: null }; // Not an error, just nothing to do

}

// Convert IDs to the required Spotify URI format

const uris = trackIds.map(id => `spotify:track:${id}`);

const url = `${BASE_URL}/playlists/${playlistId}/tracks`;

const chunkSize = 100; // Spotify API limit for adding tracks

let snapshotId = null;

try {

// Process tracks in chunks

for (let i = 0; i < uris.length; i += chunkSize) {

const chunk = uris.slice(i, i + chunkSize);

const res = await fetch(url, {

method: 'POST',

headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },

body: JSON.stringify({ uris: chunk }),

});

if (!res.ok) {

let errorData = {}; try { errorData = await res.json(); } catch (e) {}

const chunkIndex = i / chunkSize;

console.error(`Spotify API Error adding tracks (chunk ${chunkIndex}):`, errorData);

throw new Error(`Failed to add tracks (chunk ${chunkIndex}, status ${res.status}): ${errorData.error?.message || res.statusText}`);

}

const data = await res.json();

snapshotId = data.snapshot_id; // Store the latest snapshot ID

}

return { snapshot_id: snapshotId }; // Return the final snapshot ID

} catch (error) {

console.error("Error during addTracksToPlaylist loop:", error);

if (error.message.startsWith("Failed to add tracks")) throw error;

throw new Error(`Network error adding tracks: ${error.message}`);

}

};
/**

Removes specified tracks (all occurrences) from a playlist using track URIs. Handles chunking.
@param {string} token - The Spotify access token.
@param {string} playlistId - The ID of the playlist.
@param {Array<{uri: string}>} tracksToRemove - Array of objects containing track URIs.
@returns {Promise<{snapshot_id: string|null}>} Object containing the snapshot ID.
@throws {Error} If required args are missing or API request fails.

*/

export const removeTracksFromPlaylist = async (token, playlistId, tracksToRemove) => {

if (!token) throw new Error("Token is required for removeTracksFromPlaylist.");

if (!playlistId) throw new Error("Playlist ID is required.");

if (!Array.isArray(tracksToRemove) || tracksToRemove.length === 0) {

console.warn("No tracks specified for removal.");

return { snapshot_id: null };

}

const url = `${BASE_URL}/playlists/${playlistId}/tracks`;

const chunkSize = 100; // Spotify API limit for removing tracks

let snapshotId = null;

try {

// Process tracks in chunks

for (let i = 0; i < tracksToRemove.length; i += chunkSize) {

const chunk = tracksToRemove.slice(i, i + chunkSize);

const res = await fetch(url, {

method: 'DELETE',

headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },

// API expects payload format: { tracks: [{uri: "..."}, ...] }

body: JSON.stringify({ tracks: chunk }),

});

if (!res.ok) {

let errorData = {}; try { errorData = await res.json(); } catch (e) {}

const chunkIndex = i / chunkSize;

console.error(`Spotify API Error removing tracks (chunk ${chunkIndex}):`, errorData);

throw new Error(`Failed to remove tracks (chunk ${chunkIndex}, status ${res.status}): ${errorData.error?.message || res.statusText}`);

}

const data = await res.json();

snapshotId = data.snapshot_id; // Store the latest snapshot ID

}

return { snapshot_id: snapshotId }; // Return the final snapshot ID

} catch (error) {

console.error("Error during removeTracksFromPlaylist loop:", error);

if (error.message.startsWith("Failed to remove tracks")) throw error;

throw new Error(`Network error removing tracks: ${error.message}`);

}

};
/**

Gets the user ID for the current user.
@param {string} token - The Spotify access token.
@returns {Promise} The user's Spotify ID.
@throws {Error} If token is missing or fetching user profile fails.

*/

export const getUserId = async (token) => {

const user = await fetchUser(token); // Reuses fetchUser

if (!user?.id) {

console.error("User profile data fetched but missing ID:", user);

throw new Error("Could not retrieve User ID from user profile data.");

}

return user.id;

};
export const getCurrentUserId = async (token) => {

const res = await fetch('https://api.spotify.com/v1/me', {

headers: { Authorization: `Bearer ${token}` },

});

if (!res.ok) throw new Error("Failed to get current Spotify user ID.");

const data = await res.json();

return data.id;

};
/**

Searches for a track on Spotify using ONLY the title.
@param {string} token - Spotify access token.
@param {object} metadata - Object containing { title }. Other fields ignored.
@param {number} [limit=1] - Max number of results to return (default 1).
@returns {Promise<object|null>} The first matching track object, or null if no match.
@throws {Error} If required args are missing or API request fails.

*/

export const searchSpotifyTrack = async (token, metadata, limit = 1) => {

if (!token) throw new Error("Token is required for search.");

if (!metadata?.title) throw new Error("Track title is required for search.");
const { title } = metadata;

// Construct query using only track field filter, removing internal quotes

const query = `track:"${title.replace(/"/g, '')}"`;

const type = 'track'; // Search only for tracks
// Build URL parameters

const params = new URLSearchParams({ q: query, type: type, limit: limit });

const url = `${BASE_URL}/search?${params.toString()}`;

console.log(`Searching Spotify (Title Only): ${query}`);
try {

const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

if (!response.ok) {

let errorData = {}; try { errorData = await response.json(); } catch (e) {}

console.error(`Spotify Search API Error (${url}):`, errorData);

throw new Error(`Search request failed (${response.status}): ${errorData.error?.message || response.statusText}`);

}

const data = await response.json();

// Check if the response structure is as expected and items exist

if (data.tracks?.items?.length > 0) {

console.log(`Found track: ${data.tracks.items[0].name} by ${data.tracks.items[0].artists.map(a=>a.name).join(', ')}`);

return data.tracks.items[0]; // Return the first (most relevant) match

} else {

console.log(`No track found for title query: ${query}`);

return null; // Indicate no match found

}

} catch (error) {

console.error("Network/fetch error during Spotify search:", error);

if (error.message.startsWith("Search request failed")) throw error;

throw new Error(`Network error during search: ${error.message}`);

}

};

/**

Fetches the user's available Spotify devices.
@param {string} token - The Spotify access token.
@returns {Promise<Array>} A promise that resolves to an array of device objects.
@throws {Error} If the API request fails.
*/

export const fetchAvailableDevices = async (token) => {

if (!token) throw new Error("Token is required for fetchAvailableDevices.");

const url = `${BASE_URL}/me/player/devices`; // Standard endpoint for devices

console.debug(`Workspaceing available devices from: ${url}`);

try {

const res = await fetch(url, {

headers: { Authorization: `Bearer ${token}` },

});

if (!res.ok) {

let errorData = {};

try { errorData = await res.json(); } catch (e) { /* ignore */ }

console.error(`Spotify API Error fetching devices (${url}):`, res.status, errorData);

throw new Error(`Failed to fetch available devices (${res.status}): ${errorData.error?.message || res.statusText || 'Unknown error'}`);

}

const data = await res.json();

return data.devices || []; // Ensure it returns an array

} catch (error) {

console.error("Error during fetchAvailableDevices processing:", error);

throw error;

}

};

/**

Starts or resumes playback on a specified Spotify device.
@param {string} token - The Spotify access token.
@param {string} deviceId - The ID of the device to play on.
@param {string} playlistUri - The Spotify URI of the playlist to play (e.g., "spotify:playlist:...")
@returns {Promise} A promise that resolves when playback is successfully initiated.
@throws {Error} If the API request fails.

*/

export const startPlaybackOnDevice = async (token, deviceId, playlistUri) => {

if (!token) throw new Error("Token is required for startPlaybackOnDevice.");

if (!deviceId) throw new Error("Device ID is required to start playback.");

if (!playlistUri) throw new Error("Playlist URI is required to start playback.");
const url = `${BASE_URL}/me/player/play?device_id=${deviceId}`;

console.debug(`Attempting to start playback on device ${deviceId} with URI ${playlistUri} via PUT to ${url}`);
try {

const res = await fetch(url, {

method: 'PUT',

headers: {

Authorization: `Bearer ${token}`,

'Content-Type': 'application/json',

},

body: JSON.stringify({

context_uri: playlistUri,

}),

});
 // Spotify API returns 204 No Content on successful playback command
 if (res.status === 204) {
     console.log(`Playback successfully started on device ${deviceId} for ${playlistUri}`);
     return; // Success
 }
 
 // For other non-ok statuses, try to parse error
 if (!res.ok) {
     let errorData = {};
     try { errorData = await res.json(); } catch (e) { /* ignore if no json body */ }
     console.error(`Spotify API Error starting playback (${url}):`, res.status, errorData);
     throw new Error(`Failed to start playback (${res.status}): ${errorData.error?.message || res.statusText || 'Player command failed'}`);
 }
 // If it's OK but not 204, it's unexpected but not necessarily an error by fetch's definition
 // However, for this specific endpoint, 204 is the primary success indicator.
 // Other 2xx statuses might indicate an issue or a different response than expected.
 console.warn(`Playback command to ${url} returned status ${res.status}, expected 204.`);
} catch (error) {

console.error("Error during startPlaybackOnDevice processing:", error);

// Avoid re-wrapping the specific error thrown above

if (error.message.startsWith("Failed to start playback")) throw error;

throw new Error(`Network error during playback attempt: ${error.message}`);

}

};