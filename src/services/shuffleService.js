// src/services/shuffleService.js

// Configuration: Move URL to a constant (Ideally use environment variables)
const SHUFFLE_API_ENDPOINT = 'http://localhost:5000/shuffle';

/**
 * Sends an array of track objects to the backend shuffle service.
 * @param {Array<object>} tracks - An array of track objects (e.g., [{ id, name }, ...]).
 * @returns {Promise<Array<object>>} A promise that resolves to the shuffled array of track objects from the backend.
 * @throws {Error} If input is invalid, the fetch fails, or the API returns an error status.
 */
export const sendPlaylistToShuffle = async (tracks) => {
    // --- Added: Input Validation ---
    if (!Array.isArray(tracks) || tracks.length === 0) {
        console.error("sendPlaylistToShuffle: Invalid input. 'tracks' must be a non-empty array.");
        // Throw an error or return an empty array/null depending on desired behaviour
        throw new Error("Invalid input: Tracks must be provided as a non-empty array.");
        // Alternatively: return [];
    }

    // Ensure your backend expects the format: { "tracks": [...] }
    const body = JSON.stringify({ tracks });

    try {
        // --- Changed: Use constant for URL ---
        const response = await fetch(SHUFFLE_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
        });

        if (!response.ok) {
            // Error handling for non-successful HTTP status remains good
            const errorText = await response.text(); // Get more error details
            console.error(`Shuffle API Error Response (${response.status}):`, errorText);
            throw new Error(`Shuffle API request failed with status ${response.status}: ${errorText}`);
        }

        // Assuming the backend returns the shuffled array directly in the body
        return await response.json(); // Returns shuffled array: e.g., [{ id, name }]

    } catch (error) {
        // Catch network errors or errors from the 'throw' statements above
        // --- Changed: Refined network error message ---
        // Log the original error for debugging network issues specifically
        console.error("Network or fetch error calling shuffle service:", error);

        // Check if it's one of the errors we threw deliberately, otherwise assume network issue
        if (error.message.startsWith("Shuffle API request failed") || error.message.startsWith("Invalid input")) {
             throw error; // Re-throw the specific error we already created
        } else {
            // Assume it's a network/fetch level error
            throw new Error(`Shuffle Service Network Error: Failed to connect or communicate. ${error.message}`);
        }
    }
};