const SHUFFLE_API_ENDPOINT = 'http://localhost:5000/shuffle';

/**
 * Sends an array of Spotify track IDs to the backend shuffle service.
 * @param {Array<string>} trackIds - An array of Spotify track IDs (e.g., ['id1', 'id2', ...]).
 * @param {string} [mood] - Optional mood to shuffle by.
 * @returns {Promise<object>} A promise that resolves to the shuffled tracks grouped by mood.
 */
export const sendPlaylistToShuffle = async (trackIds, mood) => {
  if (!Array.isArray(trackIds) || trackIds.length === 0) {
    throw new Error("Invalid input: trackIds must be provided as a non-empty array.");
  }

  const bodyData = { track_ids: trackIds };
  if (mood) {
    // Ensure mood matches the backend's expected format
    const validMoods = ['Angry', 'Calm', 'Excited', 'Happy', 'Sad'];
    const formattedMood = validMoods.find((m) => m.toLowerCase() === mood.toLowerCase());
    if (!formattedMood) {
      throw new Error(`Invalid mood: ${mood}. Available moods: ${validMoods.join(', ')}`);
    }
    bodyData.mood = formattedMood;
  }

  try {
    const response = await fetch(SHUFFLE_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shuffle API request failed with status ${response.status}: ${errorText}`);
    }

    const jsonResponse = await response.json();
    console.log("Shuffle API response:", jsonResponse);
    return jsonResponse;
  } catch (error) {
    console.error("Error calling shuffle service:", error);
    throw error;
  }
};
