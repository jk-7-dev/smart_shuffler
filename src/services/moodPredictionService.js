// src/services/moodPredictionService.js
import axios from 'axios';

// Define the base URL for your mood prediction backend
const MOOD_PREDICTION_API_URL = 'http://127.0.0.1:5001'; // Adjust if needed

/**
 * Sends a webcam screenshot (base64) to the mood prediction backend.
 * @param {string} base64Screenshot - The base64 encoded image string (e.g., from webcamRef.current.getScreenshot()).
 * @returns {Promise<string>} A promise that resolves with the predicted mood string (e.g., "Happy").
 * @throws {Error} Throws an error if the API call fails or doesn't return a valid mood.
 */
export const predictMoodFromScreenshot = async (base64Screenshot) => {
    if (!base64Screenshot) {
        throw new Error("Screenshot data is missing.");
    }

    console.log("Sending image to mood prediction API...");
    try {
        const response = await axios.post(`${MOOD_PREDICTION_API_URL}/predict-face-mood`, {
            image: base64Screenshot, // Send base64 image string
        }, { timeout: 15000 }); // Add a timeout (e.g., 15 seconds)

        const predictedMoodResult = response?.data?.mood; // Use optional chaining

        if (!predictedMoodResult || typeof predictedMoodResult !== 'string') {
            console.error("Invalid mood prediction response:", response.data);
            throw new Error("Mood prediction API did not return a valid mood string.");
        }

        // Optional: Capitalize mood here if the service should always return it capitalized
        const capitalizedMood = predictedMoodResult.charAt(0).toUpperCase() + predictedMoodResult.slice(1).toLowerCase();
        console.log(`Mood prediction service received mood: ${capitalizedMood}`);

        return capitalizedMood; // Return the processed mood string

    } catch (error) {
        console.error("Error calling mood prediction API:", error.response?.data || error.message);
        // Re-throw a more specific error or the original error
        // This allows the calling component's error handler to catch it
        throw new Error(`Failed to predict mood from image: ${error.response?.data?.error || error.message}`);
    }
};

// You could add other related service functions here if needed