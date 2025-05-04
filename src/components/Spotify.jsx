// src/components/Spotify.jsx
import React, { useEffect, useState, useCallback } from 'react';
// Services
import {
    fetchPlaylists, fetchPlaylistTracks, createPlaylist, addTracksToPlaylist,
    getUserId, removeTracksFromPlaylist /* Removed searchSpotifyTrack (moved) */
} from '../services/spotifyService';
import { sendPlaylistToShuffle } from '../services/shuffleService';
// Utils
import { exportTracksToCsv /* Removed parseCsv utils */ } from '../utils/csvUtils';
// Components
import PlaylistItem from './PlaylistItem'; // Needs update
import TrackListView from './TrackListView'; // Import the new component
// Styles
import './Spotify.css'; // Create or update this CSS file

function Spotify({ token, onLogout }) {
    // --- State ---
    const [playlists, setPlaylists] = useState([]);
    const [currentUserId, setCurrentUserId] = useState(null);
    // Removed CSV/New Playlist state (moved to CreatePlaylistPage)

    // --- UI State ---
    const [activePlaylistIdForMenu, setActivePlaylistIdForMenu] = useState(null); // ID of the playlist whose ACTION dropdown is open
    // NEW: State for the separate track view panel
    const [viewingTracksFor, setViewingTracksFor] = useState(null); // { playlistId: string, playlistName: string, items: [], isLoading: boolean }

    // --- Loading States ---
    const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
    // isLoadingTracks is now part of viewingTracksFor state
    const [loadingPlaylistIdForAction, setLoadingPlaylistIdForAction] = useState(null); // Tracks which playlist an ACTION (shuffle, export, clean) is running on
    // Removed isCreating... states (moved)
    const [isShuffling, setIsShuffling] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);

    // --- Centralized Error Handling (Assume passed or imported) ---
    const handleApiError = useCallback((error, logoutCallback) => {
        console.error("API Error:", error);
        // Clear loading states relevant to this page
        setIsLoadingPlaylists(false);
        setLoadingPlaylistIdForAction(null);
        setIsShuffling(false);
        setIsExporting(false);
        setIsRemovingDuplicates(false);
        // Clear track view state on error
        setViewingTracksFor(prev => prev ? { ...prev, isLoading: false, error: true } : null); // Keep potentially loaded tracks but indicate error? Or clear entirely: setViewingTracksFor(null);


        const message = String(error?.message || '').toLowerCase();
         if (message.includes('401') || message.includes('403') || message.includes('token') || message.includes('unauthorized') || message.includes('failed to fetch user profile')) {
            alert(`Authentication error: ${error.message}. Session may have expired. Logging out.`);
            if (typeof logoutCallback === 'function') {
                logoutCallback();
             } else {
                console.warn("onLogout callback not available for API error handling.");
             }
         } else {
             alert(`An error occurred: ${error.message}`);
         }
    }, []); // Added useCallback

    // --- Effect Hook ---
    useEffect(() => {
        if (token) {
            console.log("Token found, fetching User ID...");
            getUserId(token)
                .then(id => {
                    console.log("Spotify Component Mounted with User ID:", id);
                    setCurrentUserId(id);
                    handleFetchPlaylists(token); // Fetch initial playlists
                })
                .catch(err => {
                    console.error("Failed to fetch user info on mount:", err);
                    handleApiError(err, onLogout);
                });
        } else {
            console.log("No token available on mount.");
            setCurrentUserId(null);
            setPlaylists([]);
            setViewingTracksFor(null); // Clear tracks view
            setActivePlaylistIdForMenu(null); // Clear active item menu
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, onLogout, handleApiError]); // Added handleApiError to deps


    // --- Handlers ---

    const handleFetchPlaylists = useCallback(async (currentToken = token) => {
        if (!currentToken || isLoadingPlaylists) return;
        setIsLoadingPlaylists(true);
        setActivePlaylistIdForMenu(null); // Close any open action menu
        setViewingTracksFor(null); // Close track view
        setLoadingPlaylistIdForAction(null); // Clear action state
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
    }, [token, isLoadingPlaylists, handleApiError, onLogout]); // Added useCallback and deps

    const handleViewTracksRequest = async (playlistId, playlistName) => {
        if (!token || viewingTracksFor?.isLoading || loadingPlaylistIdForAction === playlistId) return;
    
        // If clicking the same playlist again while tracks are shown, close it
        if (viewingTracksFor?.playlistId === playlistId && !viewingTracksFor?.isLoading) {
            handleCloseTracks();
            return;
        }
    
        console.log(`Requesting tracks for playlist: ${playlistName} (${playlistId})`);
        setViewingTracksFor({ playlistId, playlistName, items: null, isLoading: true });
        setActivePlaylistIdForMenu(null); // Close action menu when viewing tracks
    
        const currentRequestId = playlistId; // Save the current playlistId for this request
    
        try {
            const items = await fetchPlaylistTracks(token, playlistId);
    
            // Ensure the response corresponds to the current request
            if (currentRequestId === playlistId) {
                setViewingTracksFor({ playlistId, playlistName, items: items, isLoading: false });
                console.log(`Tracks fetched for ${playlistName}:`, items.length);
            } else {
                console.log("Track fetch completed, but user navigated away.");
            }
        } catch (error) {
            handleApiError(error, onLogout);
            setViewingTracksFor(null); // Close the panel on error
        }
    };
    // Close the separate track view panel
    const handleCloseTracks = () => {
        setViewingTracksFor(null);
    };

    // --- Other Action Handlers (Shuffle, Export, Clean) ---
    // These remain largely the same, but ensure they close the track view panel
    // and the action menu upon starting.

    const handleShufflePlaylist = async (playlistId, playlistName, mood) => {
        if (!token || !currentUserId || loadingPlaylistIdForAction || isShuffling) return;
        const validMoods = ['Angry', 'Calm', 'Excited', 'Happy', 'Sad'];
        if (!mood || !validMoods.includes(mood)) {
             alert("Invalid mood selected for shuffle.");
             return;
        }

        setIsShuffling(true);
        setLoadingPlaylistIdForAction(playlistId);
        setActivePlaylistIdForMenu(null); // Close action menu
        setViewingTracksFor(null); // Close track view

        try {
            const trackItems = await fetchPlaylistTracks(token, playlistId);
            if (!trackItems || trackItems.length === 0) throw new Error("Playlist is empty, cannot shuffle.");
            const trackIds = trackItems.map(item => item?.track?.id).filter(id => typeof id === 'string' && id.trim() !== '');
            if (trackIds.length === 0) throw new Error("No valid track IDs found in playlist.");

            console.log(`Sending ${trackIds.length} tracks to shuffle with mood: ${mood}`);
            const moodToSend = mood.toLowerCase(); // Assuming backend needs lowercase
            const moodSplitTracks = await sendPlaylistToShuffle(trackIds, moodToSend);
            console.log('Shuffle API response:', moodSplitTracks);

            if (moodSplitTracks.error) throw new Error(`Shuffle service error: ${moodSplitTracks.error}`);
            if (!moodSplitTracks?.mood_predictions) throw new Error("Shuffle service returned an invalid response.");

            const moodTracks = moodSplitTracks.mood_predictions[mood]; // Use Capitalized mood for lookup
            if (!moodTracks || moodTracks.length === 0) {
                console.warn(`Mood "${mood}" not found in response keys. Available:`, Object.keys(moodSplitTracks.mood_predictions));
                throw new Error(`No tracks were classified for the mood: ${mood}.`);
             }

            const shuffledPlaylistName = `${playlistName} - ${mood} Mood`;
            console.log(`Creating shuffled playlist: ${shuffledPlaylistName}`);
            const newPlaylist = await createPlaylist(token, currentUserId, shuffledPlaylistName, `Shuffled playlist based on mood: ${mood}`);
            if (!newPlaylist?.id) throw new Error("Failed to create shuffled playlist.");

            console.log(`Adding ${moodTracks.length} tracks to shuffled playlist: ${newPlaylist.id}`);
            const trackIdsOnly = moodTracks.map(track => track.track_id); // Adjust if format differs
            await addTracksToPlaylist(token, newPlaylist.id, trackIdsOnly);

            alert(`Mood-based playlist "${shuffledPlaylistName}" created successfully!`);
            await handleFetchPlaylists(token); // Refresh list
        } catch (error) {
            console.error('Shuffle error:', error);
            handleApiError(error, onLogout);
        } finally {
            setIsShuffling(false);
            setLoadingPlaylistIdForAction(null);
        }
    };

    const handleExportPlaylist = async (playlistId, playlistName) => {
        if (!token || loadingPlaylistIdForAction || isExporting) return;
        setIsExporting(true);
        setLoadingPlaylistIdForAction(playlistId);
        setActivePlaylistIdForMenu(null); // Close action menu
        setViewingTracksFor(null); // Close track view

        console.log(`Exporting playlist: ${playlistName} (${playlistId})`);
        try {
            const trackItems = await fetchPlaylistTracks(token, playlistId);
            if (!trackItems || trackItems.length === 0) {
                 alert("Cannot export an empty playlist.");
                 setIsExporting(false); // Reset loading state early
                 setLoadingPlaylistIdForAction(null);
                 return; // Important: return here
            }
            console.log(`Workspaceed ${trackItems.length} tracks for export.`);
            exportTracksToCsv(trackItems, playlistName); // Util handles download
            // No alert needed here as the browser handles the download prompt
        } catch (error) {
            handleApiError(error, onLogout);
        } finally {
            // Ensure these are reset even if export util throws or early return happens
            setIsExporting(false);
            setLoadingPlaylistIdForAction(null);
        }
    };

    const handleRemoveDuplicates = async (playlistId, playlistName) => {
         if (!token || loadingPlaylistIdForAction || isRemovingDuplicates) return;
         const confirmation = window.confirm(`Are you sure you want to remove duplicate tracks (based on Spotify ID) from "${playlistName}"? This action cannot be undone.`);
         if (!confirmation) return;

        setIsRemovingDuplicates(true);
        setLoadingPlaylistIdForAction(playlistId);
        setActivePlaylistIdForMenu(null); // Close action menu
        setViewingTracksFor(null); // Close track view

        let duplicatesFoundCount = 0;
        console.log(`Checking for duplicates in: ${playlistName} (${playlistId})`);
        try {
            const trackItems = await fetchPlaylistTracks(token, playlistId);
            if (!trackItems || trackItems.length === 0) {
                 alert("Playlist is empty, no duplicates to remove.");
                 setIsRemovingDuplicates(false); // Reset state
                 setLoadingPlaylistIdForAction(null);
                 return; // Important: return
            }

            const seenTrackIds = new Set();
            const duplicatesToRemove = []; // Stores { uri: string }
            trackItems.forEach(item => {
                if (item?.track?.id && item?.track?.uri) {
                    if (seenTrackIds.has(item.track.id)) {
                        duplicatesToRemove.push({ uri: item.track.uri });
                        console.log(`Marked duplicate: ${item.track.name} (ID: ${item.track.id})`);
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
                    await handleFetchPlaylists(token); // Refresh list
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
    };

    // --- Render Logic ---

    if (!token) {
        // This should ideally be handled by routing in App.jsx redirecting to LoginPage
        return <div>Please log in.</div>;
    }
    if (!currentUserId && !isLoadingPlaylists) {
        return <div className="loading-message">Loading user data...</div>;
    }

    return (
         // New structure: Playlist list on one side, Track view on the other
        <div className="spotify-page-layout">
            <div className="playlist-list-section">
                <div className="playlist-header">
                    <h2>Your Playlists</h2>
                    <button onClick={() => handleFetchPlaylists()} disabled={isLoadingPlaylists}>
                        {isLoadingPlaylists ? 'Loading...' : 'Refresh'}
                    </button>
                 </div>

                {isLoadingPlaylists && <p className="loading-message">Loading playlists...</p>}

                {!isLoadingPlaylists && playlists.length === 0 && (
                    <p className="empty-message">No playlists found. Try refreshing or create one.</p>
                )}

                {!isLoadingPlaylists && playlists.length > 0 && (
                    <ul className="playlist-list">
                        {playlists.map((playlist) => {
                            const isActionBusyOnThis = loadingPlaylistIdForAction === playlist.id;
                            const isShufflingThis = isActionBusyOnThis && isShuffling;
                            const isExportingThis = isActionBusyOnThis && isExporting;
                            const isCleaningThis = isActionBusyOnThis && isRemovingDuplicates;
                            // Check if this playlist's tracks are currently being viewed or loading
                            const isViewingThis = viewingTracksFor?.playlistId === playlist.id;

                            return (
                                <PlaylistItem
                                    key={playlist.id}
                                    playlist={playlist}
                                    // Controls the action dropdown menu state
                                    isMenuActive={activePlaylistIdForMenu === playlist.id}
                                    setActiveMenu={() => setActivePlaylistIdForMenu(playlist.id)}
                                    clearActiveMenu={() => setActivePlaylistIdForMenu(null)}
                                     // NEW: Indicate if tracks for this item are showing in the panel
                                    isTrackViewActive={isViewingThis}
                                    // Action handlers passed down
                                    onViewTracks={() => handleViewTracksRequest(playlist.id, playlist.name)}
                                    onShuffle={(mood) => handleShufflePlaylist(playlist.id, playlist.name, mood)}
                                    onExport={() => handleExportPlaylist(playlist.id, playlist.name)}
                                    onClean={() => handleRemoveDuplicates(playlist.id, playlist.name)}
                                    // Loading states for actions specific to this item
                                    isLoadingTracks={isViewingThis && viewingTracksFor.isLoading} // Loading state specifically for tracks view
                                    isShufflingThis={isShufflingThis}
                                    isExportingThis={isExportingThis}
                                    isCleaningThis={isCleaningThis}
                                    // Global busy state to disable opening menu/viewing tracks if *any* action is running
                                    isAnyActionRunning={!!loadingPlaylistIdForAction}
                                />
                            );
                        })}
                    </ul>
                )}
            </div> {/* End playlist-list-section */}

             {/* Separate Track List View Panel */}
             {/* Render TrackListView only if viewingTracksFor has data */}
            <div className="track-view-section">
                {viewingTracksFor ? (
                    <TrackListView
                        playlistName={viewingTracksFor.playlistName}
                        tracks={viewingTracksFor.items}
                        isLoading={viewingTracksFor.isLoading}
                        onClose={handleCloseTracks}
                    />
                ) : (
                    <div className="track-view-placeholder">
                        <p>Select a playlist and click "View Tracks" to see its content here.</p>
                    </div>
                )}
            </div> {/* End track-view-section */}

         </div> // End spotify-page-layout
    );
}

export default Spotify;