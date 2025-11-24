// src/components/Spotify.jsx
import React, { useEffect, useState, useCallback } from 'react';

// Services
import {
    fetchPlaylists, fetchPlaylistTracks, createPlaylist, addTracksToPlaylist,
    getUserId, removeTracksFromPlaylist,
    fetchAvailableDevices, // <-- NEW
    startPlaybackOnDevice  // <-- NEW
} from '../services/spotifyService';
import { sendPlaylistToShuffle } from '../services/shuffleService';
import { predictMoodFromScreenshot } from '../services/moodPredictionService';

// Utils
import { exportTracksToCsv } from '../utils/csvUtils';
// Components
import PlaylistItem from './PlaylistItem';
import TrackListView from './TrackListView';
// Styles
import './Spotify.css';

function Spotify({ token, onLogout, key: refreshKey }) {
    // --- State ---
    const [playlists, setPlaylists] = useState([]);
    const [currentUserId, setCurrentUserId] = useState(null);

    // --- UI State ---
    const [activePlaylistIdForMenu, setActivePlaylistIdForMenu] = useState(null);
    const [viewingTracksFor, setViewingTracksFor] = useState(null); // { playlistId, playlistName, items, isLoading, error }

    // --- Loading States ---
    const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
    const [loadingPlaylistIdForAction, setLoadingPlaylistIdForAction] = useState(null);
    const [isShuffling, setIsShuffling] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);
    const [playingPlaylistId, setPlayingPlaylistId] = useState(null); // <-- NEW: Tracks which playlist is being targeted for play


    // --- Centralized Error Handling ---
    const handleApiError = useCallback((error, logoutCallback) => {
        console.error("API Error in Spotify Component:", error);
        // Clear all loading states on error
        setIsLoadingPlaylists(false);
        setLoadingPlaylistIdForAction(null);
        setPlayingPlaylistId(null); // <-- NEW
        setIsShuffling(false);
        setIsExporting(false);
        setIsRemovingDuplicates(false);
        setViewingTracksFor(prev => prev ? { ...prev, isLoading: false, error: true } : null);

        const message = String(error?.response?.data?.error || error?.message || '').toLowerCase();
        const status = error?.response?.status;

        // Player specific error messages (e.g., from Spotify API when no active device)
        if (message.includes("player command failed") || message.includes("restricted")) {
            alert(`Playback Error: ${error.message}. Ensure Spotify is active on a device or check account permissions.`);
            return; // Don't logout for player errors unless it's an auth issue
        }

        if (status === 401 || status === 403 || message.includes('token') || message.includes('unauthorized') || message.includes('invalid access token')) {
            if (localStorage.getItem('spotify_access_token')) {
                alert(`Authentication error: ${error.message}. Session may have expired. Logging out.`);
                // Use the passed callback, ensure it's callable
                if (typeof logoutCallback === 'function') {
                    logoutCallback();
                } else {
                    console.warn("onLogout callback not available or not a function in handleApiError.");
                    // Fallback or simply log out if needed, but ideally logoutCallback is passed reliably
                    if (typeof onLogout === 'function') onLogout(); // Try using prop directly if logoutCallback is missing
                }
            }
        } else {
            if (!message.startsWith('failed to predict mood')) { // Avoid duplicate alerts for mood prediction
                 alert(`An error occurred: ${error.message}`);
            }
        }
    }, [onLogout]); // Added onLogout dependency

    // --- Fetch Playlists Handler ---
    const handleFetchPlaylists = useCallback(async (currentToken = token) => {
        if (!currentToken || isLoadingPlaylists || !currentUserId) {
            console.log("Skipping fetch playlists:", { hasToken: !!currentToken, isLoading: isLoadingPlaylists, hasUserId: !!currentUserId });
            return;
        }
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
    }, [token, isLoadingPlaylists, currentUserId, handleApiError, onLogout]);

    // --- Effect Hook ---
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
            setPlayingPlaylistId(null); // Reset playing state on logout
        }
    }, [token, onLogout, currentUserId, handleFetchPlaylists, handleApiError]);


    // --- Play Playlist Handler ---
    const handlePlayPlaylistRequest = useCallback(async (playlistId, playlistName, playlistUri) => {
        if (!token || playingPlaylistId) return; // Prevent multiple play requests

        setPlayingPlaylistId(playlistId);
        setActivePlaylistIdForMenu(null); // Close menu
        console.log(`Attempting to play playlist: ${playlistName} (URI: ${playlistUri})`);
        alert(`Attempting to play "${playlistName}"...`); // Simple feedback

        try {
            const devices = await fetchAvailableDevices(token);
            if (!devices || devices.length === 0) {
                alert("No Spotify devices found. Please open Spotify on one of your devices and try again.");
                setPlayingPlaylistId(null);
                return;
            }

            // Prioritize an active device, otherwise pick the first available one.
            let targetDevice = devices.find(d => d.is_active);
            if (!targetDevice) {
                targetDevice = devices[0]; // Fallback to the first device if none are explicitly active
                console.log(`No explicitly active device. Using first available: ${targetDevice.name}`);
            } else {
                console.log(`Found active device: ${targetDevice.name} (ID: ${targetDevice.id})`);
            }
            
            if (!targetDevice || !targetDevice.id) {
                alert("Could not identify a suitable device to play on.");
                setPlayingPlaylistId(null);
                return;
            }

            await startPlaybackOnDevice(token, targetDevice.id, playlistUri);
            alert(`Playback of "${playlistName}" started on ${targetDevice.name}.`);

        } catch (error) {
            // Specific error for when a device is found but playback is restricted (e.g. Premium required)
             if (error.message && (error.message.toLowerCase().includes("restricted") || error.message.toLowerCase().includes("premium"))) {
                alert(`Playback restricted: ${error.message}. This action might require a Spotify Premium account or the device might not support it.`);
            } else {
                handleApiError(error, onLogout); // Use central error handler
            }
        } finally {
            setPlayingPlaylistId(null);
        }
    }, [token, playingPlaylistId, handleApiError, onLogout]);

    // --- Other Handlers ---

    const handleCloseTracks = useCallback(() => {
        setViewingTracksFor(null);
    }, []);

    const handleViewTracksRequest = useCallback(async (playlistId, playlistName) => {
        if (!token || viewingTracksFor?.isLoading || loadingPlaylistIdForAction === playlistId) return;

        if (viewingTracksFor?.playlistId === playlistId && !viewingTracksFor?.isLoading) {
            handleCloseTracks();
            return;
        }

        console.log(`Requesting tracks for playlist: ${playlistName} (${playlistId})`);
        setViewingTracksFor({ playlistId, playlistName, items: null, isLoading: true, error: false });
        setActivePlaylistIdForMenu(null);

        try {
            const items = await fetchPlaylistTracks(token, playlistId);
            setViewingTracksFor(currentState =>
                currentState?.playlistId === playlistId
                    ? { playlistId, playlistName, items: items, isLoading: false, error: false }
                    : currentState
            );
        } catch (error) {
            console.error(`[Spotify.jsx] fetchPlaylistTracks FAILED for ${playlistId}:`, error);
            handleApiError(error, onLogout);
        }
    }, [token, viewingTracksFor, loadingPlaylistIdForAction, handleApiError, onLogout, handleCloseTracks]);


    const handleShufflePlaylist = useCallback(async (playlistId, playlistName, moodOrImageData) => {
        if (!token || !currentUserId || !playlistId || !playlistName) {
            console.warn("Shuffle cancelled: Missing required parameters.");
            alert("Cannot shuffle playlist - required playlist information missing.");
            return;
        }
        if (loadingPlaylistIdForAction || isShuffling || playingPlaylistId) return; // Added playingPlaylistId check

        setIsShuffling(true);
        setLoadingPlaylistIdForAction(playlistId);
        setActivePlaylistIdForMenu(null);
        setViewingTracksFor(null);

        let predictedMood = '';
        let predictionError = null;

        try {
            // Step 1: Determine Mood
            if (typeof moodOrImageData === 'string' && moodOrImageData.startsWith('data:image')) {
                console.log("Received image data, attempting prediction...");
                try {
                    predictedMood = await predictMoodFromScreenshot(moodOrImageData);
                    console.log(`Prediction successful: ${predictedMood}`);
                } catch (predError) {
                    console.error("Mood prediction failed:", predError);
                    predictionError = predError;
                }
            } else if (typeof moodOrImageData === 'string') {
                predictedMood = moodOrImageData;
                console.log(`Using pre-selected mood: ${predictedMood}`);
            } else {
                throw new Error("No mood or image data provided for shuffle.");
            }

            if (predictionError) throw predictionError;

            // Step 2: Validate Mood
            const validMoods = ['Angry', 'Calm', 'Excited', 'Happy', 'Sad'];
            const capitalizedMood = predictedMood.charAt(0).toUpperCase() + predictedMood.slice(1).toLowerCase();
            if (!validMoods.includes(capitalizedMood)) {
                throw new Error(`Invalid mood determined or provided: ${predictedMood}`);
            }
            console.log(`Proceeding to shuffle playlist: ${playlistName} (${playlistId}) with mood: ${capitalizedMood}`);

            // Step 3: Fetch Tracks
            const trackItems = await fetchPlaylistTracks(token, playlistId);
            if (!trackItems || trackItems.length === 0) throw new Error("Playlist is empty, cannot shuffle.");
            const trackIds = trackItems.map(item => item?.track?.id).filter(id => typeof id === 'string' && id.trim() !== '');
            if (trackIds.length === 0) throw new Error("No valid track IDs found in playlist.");

            // Step 4: Call Shuffle Service
            const moodToSend = capitalizedMood.toLowerCase();
            const moodSplitTracks = await sendPlaylistToShuffle(trackIds, moodToSend);
            if (moodSplitTracks.error) throw new Error(`Shuffle service error: ${moodSplitTracks.error}`);
            if (!moodSplitTracks?.mood_predictions) throw new Error("Shuffle service returned an invalid response format.");

            // Step 5: Process Shuffle Response
            const moodTracks = moodSplitTracks.mood_predictions[capitalizedMood];
            if (!moodTracks || !Array.isArray(moodTracks)) throw new Error(`No tracks classified for mood: ${capitalizedMood}.`);
            if (moodTracks.length === 0) {
                alert(`No tracks matched mood "${capitalizedMood}" in playlist "${playlistName}". No new playlist created.`);
                return; // Exit gracefully
            }

            // Step 6: Create Playlist
            const shuffledPlaylistName = `${playlistName} - ${capitalizedMood} Mood`;
            const newPlaylist = await createPlaylist(token, currentUserId, shuffledPlaylistName, `Shuffled "${playlistName}" based on mood: ${capitalizedMood}`);
            if (!newPlaylist?.id) throw new Error("Failed to create the new shuffled playlist on Spotify.");

            // Step 7: Add Tracks
            const trackIdsOnly = moodTracks.map(track => track.track_id).filter(Boolean);
            if (trackIdsOnly.length === 0) throw new Error("Could not extract track IDs from shuffle service response.");
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
    }, [token, currentUserId, loadingPlaylistIdForAction, isShuffling, playingPlaylistId, handleApiError, onLogout, handleFetchPlaylists]);


    const handleExportPlaylist = useCallback(async (playlistId, playlistName) => {
        if (!token || loadingPlaylistIdForAction || isExporting || playingPlaylistId) return; // Added playingPlaylistId check
        setIsExporting(true);
        setLoadingPlaylistIdForAction(playlistId);
        setActivePlaylistIdForMenu(null);
        setViewingTracksFor(null);
        console.log(`Exporting playlist: ${playlistName} (${playlistId})`);
        try {
            const trackItems = await fetchPlaylistTracks(token, playlistId);
            if (!trackItems || trackItems.length === 0) {
                alert("Cannot export an empty playlist.");
                setIsExporting(false); setLoadingPlaylistIdForAction(null); return;
            }
            console.log(`Workspaceed ${trackItems.length} tracks for export.`);
            exportTracksToCsv(trackItems, playlistName);
        } catch (error) {
            handleApiError(error, onLogout);
        } finally {
            setIsExporting(false); setLoadingPlaylistIdForAction(null);
        }
    }, [token, loadingPlaylistIdForAction, isExporting, playingPlaylistId, handleApiError, onLogout]);


    const handleRemoveDuplicates = useCallback(async (playlistId, playlistName) => {
        if (!token || loadingPlaylistIdForAction || isRemovingDuplicates || playingPlaylistId) return; // Added playingPlaylistId check
        const confirmation = window.confirm(`Are you sure you want to remove duplicate tracks from "${playlistName}"?`);
        if (!confirmation) return;

        setIsRemovingDuplicates(true);
        setLoadingPlaylistIdForAction(playlistId);
        setActivePlaylistIdForMenu(null);
        setViewingTracksFor(null);
        console.log(`Checking for duplicates in: ${playlistName} (${playlistId})`);
        try {
            const trackItems = await fetchPlaylistTracks(token, playlistId);
            if (!trackItems || trackItems.length === 0) {
                alert("Playlist is empty.");
                setIsRemovingDuplicates(false); setLoadingPlaylistIdForAction(null); return;
            }
            const seenTrackIds = new Set();
            const duplicatesToRemove = [];
            trackItems.forEach(item => {
                if (item?.track?.id && item?.track?.uri) {
                    if (seenTrackIds.has(item.track.id)) duplicatesToRemove.push({ uri: item.track.uri });
                    else seenTrackIds.add(item.track.id);
                }
            });

            if (duplicatesToRemove.length === 0) {
                alert("No duplicate tracks found.");
            } else {
                console.log(`Found ${duplicatesToRemove.length} duplicate occurrences. Removing...`);
                const result = await removeTracksFromPlaylist(token, playlistId, duplicatesToRemove);
                if (result?.snapshot_id) {
                    alert(`${duplicatesToRemove.length} duplicate track occurrence(s) removed!`);
                    await handleFetchPlaylists(token);
                } else throw new Error("Duplicate removal confirmation missing.");
            }
        } catch (error) {
            handleApiError(error, onLogout);
        } finally {
            setIsRemovingDuplicates(false); setLoadingPlaylistIdForAction(null);
        }
    }, [token, loadingPlaylistIdForAction, isRemovingDuplicates, playingPlaylistId, handleApiError, onLogout, handleFetchPlaylists]);


    // --- Render Logic ---

    if (!token) return <div>Please log in.</div>;
    if (!currentUserId && (isLoadingPlaylists || !playlists.length)) return <div className="loading-message">Loading user data and playlists...</div>;

    const isAnyActionRunning = !!loadingPlaylistIdForAction || !!playingPlaylistId; // Modified to include playingPlaylistId


    return (
        <>
            {/* Main Layout: Playlists and Track View */}
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
                                const isPlayingThis = playingPlaylistId === playlist.id; // <-- NEW

                                return (
                                    <PlaylistItem
                                        key={playlist.id}
                                        playlist={playlist}
                                        isMenuActive={activePlaylistIdForMenu === playlist.id}
                                        setActiveMenu={() => setActivePlaylistIdForMenu(playlist.id)}
                                        clearActiveMenu={() => setActivePlaylistIdForMenu(null)}
                                        isTrackViewActive={isViewingThis}
                                        onViewTracks={() => handleViewTracksRequest(playlist.id, playlist.name)}
                                        
                                        // --- MODIFIED/NEW PROPS for Playback ---
                                        onPlayRequest={() => handlePlayPlaylistRequest(playlist.id, playlist.name, playlist.uri || `spotify:playlist:${playlist.id}`)}
                                        isPlayingThis={isPlayingThis}
                                        
                                        onShuffle={(moodOrData) => handleShufflePlaylist(playlist.id, playlist.name, moodOrData)}
                                        onExport={() => handleExportPlaylist(playlist.id, playlist.name)}
                                        onClean={() => handleRemoveDuplicates(playlist.id, playlist.name)}
                                        
                                        isLoadingTracks={isViewingThis && viewingTracksFor.isLoading}
                                        isShufflingThis={isShufflingThis}
                                        isExportingThis={isExportingThis}
                                        isCleaningThis={isCleaningThis}
                                        isAnyActionRunning={isAnyActionRunning || isPlayingThis} // Ensure actions are disabled if this specific playlist is playing
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