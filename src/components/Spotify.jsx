// src/components/Spotify.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Webcam from "react-webcam";
// Removed axios import from here unless needed elsewhere in Spotify.jsx
// import axios from "axios";

// Services
import {
    fetchPlaylists, fetchPlaylistTracks, createPlaylist, addTracksToPlaylist,
    getUserId, removeTracksFromPlaylist
} from '../services/spotifyService';
import { sendPlaylistToShuffle } from '../services/shuffleService';
import { predictMoodFromScreenshot } from '../services/moodPredictionService'; // <-- Import the new service function

// Utils
import { exportTracksToCsv } from '../utils/csvUtils';
// Components
import PlaylistItem from './PlaylistItem';
import TrackListView from './TrackListView';
// Styles
import './Spotify.css';

// THE REST OF THE COMPONENT REMAINS LARGELY THE SAME UNTIL 'captureMoodFromFace'

function Spotify({ token, onLogout, key: refreshKey }) {
    // --- State --- (Keep existing state)
    const [playlists, setPlaylists] = useState([]);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [activePlaylistIdForMenu, setActivePlaylistIdForMenu] = useState(null);
    const [viewingTracksFor, setViewingTracksFor] = useState(null);
    const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
    const [loadingPlaylistIdForAction, setLoadingPlaylistIdForAction] = useState(null);
    const [isShuffling, setIsShuffling] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);
    const [isPredictingMood, setIsPredictingMood] = useState(false); // Keep loading state here
    const [showWebcam, setShowWebcam] = useState(false);          // Keep UI state here
    const [predictedMood, setPredictedMood] = useState("");       // Keep UI state here
    const webcamRef = useRef(null);                             // Keep ref here

    // --- handleApiError, useEffect, handleFetchPlaylists, etc. (Keep existing functions) ---
    // ... (Assume handleApiError, useEffect, handleFetchPlaylists, handleViewTracksRequest, handleCloseTracks, handleShufflePlaylist, handleExportPlaylist, handleRemoveDuplicates are defined as before) ...

     const handleApiError = useCallback((error, logoutCallback) => {
         // ... (Implementation as before) ...
         console.error("API Error in Spotify Component:", error);
         // Clear all loading states on error
         setIsLoadingPlaylists(false);
         setLoadingPlaylistIdForAction(null);
         setIsShuffling(false);
         setIsExporting(false);
         setIsRemovingDuplicates(false);
         setIsPredictingMood(false); // Reset prediction loading state
         setShowWebcam(false); // Hide webcam on error too
         setViewingTracksFor(prev => prev ? { ...prev, isLoading: false, error: true } : null);

         const message = String(error?.response?.data?.error || error?.message || '').toLowerCase();
         const status = error?.response?.status;

         if (status === 401 || status === 403 || message.includes('token') || message.includes('unauthorized') || message.includes('invalid access token')) {
              if (localStorage.getItem('spotify_access_token')) {
                  alert(`Authentication error: ${error.message}. Session may have expired. Logging out.`);
                 if (typeof logoutCallback === 'function') {
                     logoutCallback();
                 } else {
                     console.warn("onLogout callback not available for API error handling.");
                 }
             }
         } else {
             alert(`An error occurred: ${error.message}`);
         }
     }, [/* dependencies like onLogout */]);

     useEffect(() => {
         if (token && !currentUserId) {
             console.log("Spotify.jsx: Token found, fetching User ID...");
             getUserId(token)
                 .then(id => {
                     console.log("Spotify.jsx: User ID fetched:", id);
                     setCurrentUserId(id);
                     handleFetchPlaylists(token);
                 })
                 .catch(err => {
                     console.error("Spotify.jsx: Failed to fetch user info on mount:", err);
                     handleApiError(err, onLogout);
                 });
         } else if (!token) {
             console.log("Spotify.jsx: No token available on mount.");
             setCurrentUserId(null);
             setPlaylists([]);
             setViewingTracksFor(null);
             setActivePlaylistIdForMenu(null);
         }
     // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [token, onLogout, currentUserId /* Consider adding handleFetchPlaylists if needed */]);

     const handleFetchPlaylists = useCallback(async (currentToken = token) => {
         if (!currentToken || isLoadingPlaylists || !currentUserId) {
             console.log("Skipping fetch playlists:", { hasToken: !!currentToken, isLoading: isLoadingPlaylists, hasUserId: !!currentUserId });
             return;
         };
         setIsLoadingPlaylists(true);
         setActivePlaylistIdForMenu(null);
         setViewingTracksFor(null);
         setLoadingPlaylistIdForAction(null);
         console.log("Fetching playlists...");
         try {
             const items = await fetchPlaylists(currentToken);
             setPlaylists(items);
             console.log("Playlists fetched:", items.length);
         } catch (error) {
             handleApiError(error, onLogout);
         } finally {
             setIsLoadingPlaylists(false);
         }
     }, [token, isLoadingPlaylists, handleApiError, onLogout, currentUserId]);


     const handleViewTracksRequest = useCallback(async (playlistId, playlistName) => {
         if (!token || viewingTracksFor?.isLoading || loadingPlaylistIdForAction === playlistId) return;

         if (viewingTracksFor?.playlistId === playlistId && !viewingTracksFor?.isLoading) {
             handleCloseTracks();
             return;
         }

         console.log(`Requesting tracks for playlist: ${playlistName} (${playlistId})`);
         setViewingTracksFor({ playlistId, playlistName, items: null, isLoading: true });
         setActivePlaylistIdForMenu(null);

         try {
             const items = await fetchPlaylistTracks(token, playlistId);
             console.log(`[Spotify.jsx] fetchPlaylistTracks SUCCESS for ${playlistId}. Items received:`, items?.length);

             setViewingTracksFor(currentState => {
                 if (currentState?.playlistId === playlistId) {
                     console.log(`[Spotify.jsx] Updating state for ${playlistId} with items and isLoading: false`);
                     return { playlistId, playlistName, items: items, isLoading: false };
                 } else {
                     console.log(`[Spotify.jsx] Track fetch completed for ${playlistId}, but view changed. Current state:`, currentState);
                     return currentState;
                 }
             });
         } catch (error) {
             console.error(`[Spotify.jsx] fetchPlaylistTracks FAILED for ${playlistId}:`, error);
             handleApiError(error, onLogout);
             setViewingTracksFor(currentState => {
                  if (currentState?.playlistId === playlistId) {
                     return { ...currentState, isLoading: false, error: true };
                  }
                  return currentState;
             });
         }
     }, [token, viewingTracksFor, loadingPlaylistIdForAction, handleApiError, onLogout]);


     const handleCloseTracks = useCallback(() => {
         setViewingTracksFor(null);
     }, []);


     const handleShufflePlaylist = useCallback(async (playlistId, playlistName, mood) => {
         if (!token || !currentUserId || !playlistId || !playlistName || !mood) {
              console.warn("Shuffle cancelled: Missing required parameters.", { hasToken:!!token, currentUserId, playlistId, playlistName, mood });
              alert("Cannot shuffle playlist - required information missing.");
              return;
         }
         if (loadingPlaylistIdForAction || isShuffling) return;

         const validMoods = ['Angry', 'Calm', 'Excited', 'Happy', 'Sad'];
         const capitalizedMood = mood.charAt(0).toUpperCase() + mood.slice(1).toLowerCase();

         if (!validMoods.includes(capitalizedMood)) {
             alert(`Invalid mood selected for shuffle: ${mood}`);
             return;
         }

         console.log(`Attempting to shuffle playlist: ${playlistName} (${playlistId}) with mood: ${capitalizedMood}`);
         setIsShuffling(true);
         setLoadingPlaylistIdForAction(playlistId);
         setActivePlaylistIdForMenu(null);
         setViewingTracksFor(null);

         try {
             console.log(`Workspaceing tracks for playlist ${playlistId} before shuffling...`);
             const trackItems = await fetchPlaylistTracks(token, playlistId);
             if (!trackItems || trackItems.length === 0) throw new Error("Playlist is empty, cannot shuffle.");

             const trackIds = trackItems.map(item => item?.track?.id).filter(id => typeof id === 'string' && id.trim() !== '');
             if (trackIds.length === 0) throw new Error("No valid track IDs found in playlist.");
             console.log(`Found ${trackIds.length} tracks. Sending to shuffle service...`);

             const moodToSend = capitalizedMood.toLowerCase(); // Assuming backend needs lowercase
             const moodSplitTracks = await sendPlaylistToShuffle(trackIds, moodToSend);
             console.log('Shuffle service response:', moodSplitTracks);

             if (moodSplitTracks.error) throw new Error(`Shuffle service error: ${moodSplitTracks.error}`);
             if (!moodSplitTracks?.mood_predictions) throw new Error("Shuffle service returned an invalid response format.");

             const moodTracks = moodSplitTracks.mood_predictions[capitalizedMood];

             if (!moodTracks || !Array.isArray(moodTracks)) {
                 console.warn(`Mood "${capitalizedMood}" key not found or invalid in response. Available keys:`, Object.keys(moodSplitTracks.mood_predictions));
                 throw new Error(`No tracks were classified or returned for the mood: ${capitalizedMood}.`);
              }
              if (moodTracks.length === 0) {
                 alert(`No tracks matched the mood "${capitalizedMood}" in playlist "${playlistName}". No new playlist created.`);
                 return; // Exit gracefully
             }

             const shuffledPlaylistName = `${playlistName} - ${capitalizedMood} Mood`;
             console.log(`Creating shuffled playlist: "${shuffledPlaylistName}"`);
             const newPlaylist = await createPlaylist(token, currentUserId, shuffledPlaylistName, `Shuffled "${playlistName}" based on mood: ${capitalizedMood}`);
             if (!newPlaylist?.id) throw new Error("Failed to create the new shuffled playlist on Spotify.");

             console.log(`Adding ${moodTracks.length} tracks to new playlist: ${newPlaylist.id}`);
             const trackIdsOnly = moodTracks.map(track => track.track_id).filter(Boolean);
              if (trackIdsOnly.length === 0) {
                 console.warn("Mood tracks received from backend, but failed to extract valid track IDs.");
                 throw new Error("Could not extract track IDs from shuffle service response.");
              }
             await addTracksToPlaylist(token, newPlaylist.id, trackIdsOnly);

             alert(`Mood-based playlist "${shuffledPlaylistName}" created successfully with ${trackIdsOnly.length} tracks!`);
             await handleFetchPlaylists(token);

         } catch (error) {
             console.error(`Shuffle failed for playlist ${playlistId}:`, error);
             handleApiError(error, onLogout);
         } finally {
             setIsShuffling(false);
             setLoadingPlaylistIdForAction(null);
         }
     }, [token, currentUserId, loadingPlaylistIdForAction, isShuffling, handleApiError, onLogout, handleFetchPlaylists]); // Added handleFetchPlaylists


     const handleExportPlaylist = useCallback(async (playlistId, playlistName) => {
         if (!token || loadingPlaylistIdForAction || isExporting) return;
         setIsExporting(true);
         setLoadingPlaylistIdForAction(playlistId);
         setActivePlaylistIdForMenu(null);
         setViewingTracksFor(null);

         console.log(`Exporting playlist: ${playlistName} (${playlistId})`);
         try {
             const trackItems = await fetchPlaylistTracks(token, playlistId);
             if (!trackItems || trackItems.length === 0) {
                 alert("Cannot export an empty playlist.");
                 setIsExporting(false);
                 setLoadingPlaylistIdForAction(null);
                 return;
             }
             console.log(`Workspaceed ${trackItems.length} tracks for export.`);
             exportTracksToCsv(trackItems, playlistName);
         } catch (error) {
             handleApiError(error, onLogout);
         } finally {
             setIsExporting(false);
             setLoadingPlaylistIdForAction(null);
         }
     }, [token, loadingPlaylistIdForAction, isExporting, handleApiError, onLogout]);


     const handleRemoveDuplicates = useCallback(async (playlistId, playlistName) => {
         if (!token || loadingPlaylistIdForAction || isRemovingDuplicates) return;
         const confirmation = window.confirm(`Are you sure you want to remove duplicate tracks (based on Spotify ID) from "${playlistName}"? This action cannot be undone.`);
         if (!confirmation) return;

         setIsRemovingDuplicates(true);
         setLoadingPlaylistIdForAction(playlistId);
         setActivePlaylistIdForMenu(null);
         setViewingTracksFor(null);

         let duplicatesFoundCount = 0;
         console.log(`Checking for duplicates in: ${playlistName} (${playlistId})`);
         try {
             const trackItems = await fetchPlaylistTracks(token, playlistId);
             if (!trackItems || trackItems.length === 0) {
                 alert("Playlist is empty, no duplicates to remove.");
                 setIsRemovingDuplicates(false);
                 setLoadingPlaylistIdForAction(null);
                 return;
             }

             const seenTrackIds = new Set();
             const duplicatesToRemove = [];
             trackItems.forEach(item => {
                 if (item?.track?.id && item?.track?.uri) {
                     if (seenTrackIds.has(item.track.id)) {
                         duplicatesToRemove.push({ uri: item.track.uri });
                     } else {
                         seenTrackIds.add(item.track.id);
                     }
                 } else {
                     console.warn("Skipping item with missing track data during duplicate check:", item);
                 }
             });
             duplicatesFoundCount = duplicatesToRemove.length;

             if (duplicatesFoundCount === 0) {
                 alert("No duplicate tracks found in this playlist.");
             } else {
                 console.log(`Found ${duplicatesFoundCount} duplicate occurrences. Removing...`);
                 const result = await removeTracksFromPlaylist(token, playlistId, duplicatesToRemove);
                 if (result?.snapshot_id) {
                     alert(`${duplicatesFoundCount} duplicate track occurrence(s) removed successfully!`);
                     await handleFetchPlaylists(token);
                 } else {
                     throw new Error("Duplicate removal API call completed, but confirmation (snapshot_id) was missing.");
                 }
             }
         } catch (error) {
             handleApiError(error, onLogout);
         } finally {
             setIsRemovingDuplicates(false);
             setLoadingPlaylistIdForAction(null);
         }
     }, [token, loadingPlaylistIdForAction, isRemovingDuplicates, handleApiError, onLogout, handleFetchPlaylists]); // Added handleFetchPlaylists


    // --- MODIFIED Webcam Mood Capture Function ---
    const captureMoodFromFace = useCallback(async () => {
        if (!webcamRef.current) {
            console.error("Webcam ref not available.");
            alert("Webcam not ready. Please wait and try again.");
            return;
        }
        const screenshot = webcamRef.current.getScreenshot();

        if (!screenshot) {
            alert("Failed to capture image from webcam.");
            return;
        }

        // Determine target playlist (same logic as before)
        let targetPlaylistId = null;
        let targetPlaylistName = null;
        if (viewingTracksFor?.playlistId && viewingTracksFor?.playlistName) {
            targetPlaylistId = viewingTracksFor.playlistId;
            targetPlaylistName = viewingTracksFor.playlistName;
            console.log(`Targeting currently viewed playlist: ${targetPlaylistName}`);
        } else if (playlists && playlists.length > 0) {
            targetPlaylistId = playlists[0].id;
            targetPlaylistName = playlists[0].name;
            console.log(`No playlist actively viewed. Targeting first playlist: ${targetPlaylistName}`);
        } else {
            alert("No playlists available to shuffle. Please load or create a playlist first.");
            setShowWebcam(false);
            return;
        }

        setIsPredictingMood(true); // Set loading state
        setPredictedMood("");

        try {
            // *** Call the service function ***
            const moodResult = await predictMoodFromScreenshot(screenshot);
            // Service already capitalized the mood and handled API errors

            console.log(`Mood received from service: ${moodResult}`);
            setPredictedMood(moodResult); // Display predicted mood
            setShowWebcam(false);      // Hide webcam

            // *** Trigger Shuffle using the mood from the service ***
            await handleShufflePlaylist(targetPlaylistId, targetPlaylistName, moodResult);
            // Success alert is handled within handleShufflePlaylist

        } catch (error) {
            // Errors from predictMoodFromScreenshot service are caught here
            console.error("Error during mood prediction service call or subsequent shuffle:", error);
            handleApiError(error, onLogout); // Use centralized handler
            alert(`Mood prediction or shuffle failed: ${error.message}`); // Show specific error from service/shuffle
        } finally {
            setIsPredictingMood(false); // Clear loading state
        }
    // Update dependencies for useCallback
    }, [webcamRef, viewingTracksFor, playlists, handleShufflePlaylist, handleApiError, onLogout]);

    // --- Render Logic --- (Remains the same as the previous integrated version)

    if (!token) return <div>Please log in.</div>;
    if (!currentUserId && isLoadingPlaylists) return <div className="loading-message">Loading user data and playlists...</div>;
    if (!currentUserId && !isLoadingPlaylists) return <div className="loading-message">Loading user data...</div>;

    const isAnyActionRunning = !!loadingPlaylistIdForAction || isPredictingMood;

    return (
        <>
            {/* --- Webcam Section --- */}
            <div className="action-card webcam-section">
                <h2>Mood Detection</h2>
                <button
                    onClick={() => setShowWebcam(prev => !prev)}
                    disabled={isAnyActionRunning}
                    style={{ marginRight: '10px' }}
                >
                    {showWebcam ? "Close Webcam" : "Predict Mood from Face"}
                </button>

                {showWebcam && (
                    <div className="webcam-container">
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            width={320}
                            height={240}
                            videoConstraints={{
                                width: 320,
                                height: 240,
                                facingMode: "user",
                            }}
                        />
                        <button
                            onClick={captureMoodFromFace}
                            disabled={isAnyActionRunning || !webcamRef.current}
                            className="capture-button"
                        >
                            {isPredictingMood ? 'Processing...' : 'Capture & Shuffle'}
                        </button>
                    </div>
                )}

                {predictedMood && !showWebcam && (
                    <p className="predicted-mood-display">
                        Last Predicted Mood: <strong>{predictedMood}</strong> (Used for last face-based shuffle)
                    </p>
                )}
                {isPredictingMood && (
                    <p className="loading-message">Predicting mood and shuffling...</p>
                )}
            </div>

            {/* --- Main Layout: Playlists and Track View --- */}
            <div className="spotify-page-layout">
                <div className="playlist-list-section">
                    {/* Header */}
                    <div className="playlist-header">
                        <h2>Your Playlists</h2>
                        <button onClick={() => handleFetchPlaylists()} disabled={isLoadingPlaylists || isAnyActionRunning}>
                            {isLoadingPlaylists ? 'Loading...' : 'Refresh'}
                        </button>
                    </div>
                    {/* Loading / Empty State */}
                    {isLoadingPlaylists && !playlists.length && <p className="loading-message">Loading playlists...</p>}
                    {!isLoadingPlaylists && playlists.length === 0 && (
                        <p className="empty-message">No playlists found. Try refreshing or create one.</p>
                    )}
                    {/* Playlist List */}
                    {!isLoadingPlaylists && playlists.length > 0 && (
                        <ul className="playlist-list">
                            {playlists.map((playlist) => {
                                const isActionBusyOnThis = loadingPlaylistIdForAction === playlist.id;
                                const isShufflingThis = isActionBusyOnThis && isShuffling;
                                const isExportingThis = isActionBusyOnThis && isExporting;
                                const isCleaningThis = isActionBusyOnThis && isRemovingDuplicates;
                                const isViewingThis = viewingTracksFor?.playlistId === playlist.id;

                                return (
                                    <PlaylistItem
                                        key={playlist.id}
                                        playlist={playlist}
                                        isMenuActive={activePlaylistIdForMenu === playlist.id}
                                        setActiveMenu={() => setActivePlaylistIdForMenu(playlist.id)}
                                        clearActiveMenu={() => setActivePlaylistIdForMenu(null)}
                                        isTrackViewActive={isViewingThis}
                                        onViewTracks={() => handleViewTracksRequest(playlist.id, playlist.name)}
                                        onShuffle={(mood) => handleShufflePlaylist(playlist.id, playlist.name, mood)}
                                        onExport={() => handleExportPlaylist(playlist.id, playlist.name)}
                                        onClean={() => handleRemoveDuplicates(playlist.id, playlist.name)}
                                        isLoadingTracks={isViewingThis && viewingTracksFor.isLoading}
                                        isShufflingThis={isShufflingThis}
                                        isExportingThis={isExportingThis}
                                        isCleaningThis={isCleaningThis}
                                        isAnyActionRunning={isAnyActionRunning}
                                    />
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Track View Panel */}
                <div className="track-view-section">
                    {viewingTracksFor ? (
                        <TrackListView
                            playlistName={viewingTracksFor.playlistName}
                            tracks={viewingTracksFor.items}
                            isLoading={viewingTracksFor.isLoading}
                            onClose={handleCloseTracks}
                            hasError={viewingTracksFor.error}
                        />
                    ) : (
                        <div className="track-view-placeholder">
                            <p>Select a playlist and click "View Tracks" to see its content here.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default Spotify;