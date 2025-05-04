// src/components/Spotify.jsx
import React, { useEffect, useState } from 'react';
// Import services (assuming paths are correct)
import {
    fetchPlaylists, fetchPlaylistTracks, createPlaylist, addTracksToPlaylist,
    getUserId, removeTracksFromPlaylist, searchSpotifyTrack
} from '../services/spotifyService';
// Import shuffle service
import { sendPlaylistToShuffle } from '../services/shuffleService';
// Import utils
import { parseCsvFile, exportTracksToCsv, parseMetadataCsv } from '../utils/csvUtils';
// Import the new component
import PlaylistItem from './PlaylistItem'; // Adjust path if needed
// Styling is handled by Layout.css and potentially App.css

function Spotify({ token, onLogout }) {
    // --- State ---
    const [playlists, setPlaylists] = useState([]);
    // Removed tracks state, replaced by currentTracks
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [currentUserId, setCurrentUserId] = useState(null);
    const [csvIdPlaylistName, setCsvIdPlaylistName] = useState('');
    const [csvIdTracks, setCsvIdTracks] = useState([]);
    const [csvMetaPlaylistName, setCsvMetaPlaylistName] = useState('');
    const [csvMetadata, setCsvMetadata] = useState([]);

    // --- UI State ---
    const [activePlaylistId, setActivePlaylistId] = useState(null); // ID of the playlist whose dropdown/tracks are open
    const [currentTracks, setCurrentTracks] = useState(null); // { playlistId: string, items: [] } holds tracks for the *active* playlist

    // --- Loading States ---
    const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
    const [isLoadingTracks, setIsLoadingTracks] = useState(false); // Now tracks loading for the *active* playlist
    const [loadingPlaylistIdForAction, setLoadingPlaylistIdForAction] = useState(null); // Tracks which playlist an action (shuffle, export, clean) is running on
    const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
    const [isCreatingCsvIdPlaylist, setIsCreatingCsvIdPlaylist] = useState(false);
    const [isCreatingCsvMetaPlaylist, setIsCreatingCsvMetaPlaylist] = useState(false);
    const [isSearchingTracks, setIsSearchingTracks] = useState(false); // For metadata search
    const [isShuffling, setIsShuffling] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);
    // Removed loadingPlaylistId, replaced by combination of activePlaylistId, isLoadingTracks, and loadingPlaylistIdForAction

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
                    handleApiError(err, onLogout); // Use centralized handler
                });
        } else {
            console.log("No token available on mount.");
            setCurrentUserId(null);
            setPlaylists([]);
            // setTracks([]); // Removed
            setCurrentTracks(null); // Clear tracks view
            setActivePlaylistId(null); // Clear active item
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]); // Removed onLogout from deps assuming it's stable or handled by context

    // --- Centralized Error Handling ---
    const handleApiError = (error, logoutCallback) => {
        console.error("API Error:", error);
        // Clear loading states on error
        setIsLoadingPlaylists(false);
        setIsLoadingTracks(false);
        setIsCreatingPlaylist(false);
        setIsCreatingCsvIdPlaylist(false);
        setIsCreatingCsvMetaPlaylist(false);
        setIsSearchingTracks(false);
        setIsShuffling(false);
        setIsExporting(false);
        setIsRemovingDuplicates(false);
        setLoadingPlaylistIdForAction(null);
        // Potentially clear active state depending on error
        // setActivePlaylistId(null);
        // setCurrentTracks(null);

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
    };

    // --- Handlers ---

    const handleFetchPlaylists = async (currentToken = token) => {
        if (!currentToken || isLoadingPlaylists) return;
        setIsLoadingPlaylists(true);
        setActivePlaylistId(null); // Close any open item
        setCurrentTracks(null); // Clear tracks view
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
    };

    // Renamed: This now handles the *request* to view tracks for the active playlist
    const handleViewTracksRequest = async (playlistId) => {
        if (!token || isLoadingTracks || loadingPlaylistIdForAction) return; // Prevent if already loading tracks or another action is busy

        // Check if we are already viewing tracks for this playlist
        if (currentTracks?.playlistId === playlistId) {
             // Optionally, close the tracks view if clicked again? Or do nothing.
             // handleCloseTracks(); // Example: close if clicked again
             return;
        }

        setIsLoadingTracks(true);
        // setActivePlaylistId(playlistId); // Set by PlaylistItem click handler already
        setCurrentTracks(null); // Clear previous tracks immediately
        console.log(`Requesting tracks for playlist: ${playlistId}`);

        try {
            const items = await fetchPlaylistTracks(token, playlistId);
            // Ensure the playlist is still the active one before setting tracks
            // (user might have clicked elsewhere quickly)
            // Note: In this flow, setActivePlaylistId(playlistId) happens on item click *before* this runs
             setCurrentTracks({ playlistId: playlistId, items: items });
             console.log(`Tracks fetched for ${playlistId}:`, items.length);

        } catch (error) {
            handleApiError(error, onLogout);
            setCurrentTracks(null); // Clear tracks on error
            // Optionally close the active item on error?
            // setActivePlaylistId(null);
        } finally {
            setIsLoadingTracks(false);
        }
    };

    // Close the currently viewed tracks
    const handleCloseTracks = () => {
        setCurrentTracks(null);
        setActivePlaylistId(null); // Close the item entirely
    };


    const handleCreatePlaylist = async () => {
        if (!newPlaylistName || !token || !currentUserId || isCreatingPlaylist) return;
        setIsCreatingPlaylist(true);
        console.log(`Creating playlist: ${newPlaylistName}`);
        try {
            await createPlaylist(token, currentUserId, newPlaylistName, 'New playlist created by Smart Shuffler');
            alert('Playlist created!');
            setNewPlaylistName('');
            await handleFetchPlaylists(token);
        } catch(error) {
            handleApiError(error, onLogout);
        } finally {
            setIsCreatingPlaylist(false);
        }
    };

    // --- CSV ID Based --- (Handlers remain largely the same internally)
    const handleCsvIdUpload = (event) => {
        const file = event.target.files[0];
        const inputElement = event.target;
        if (!file) return;
        console.log("Parsing ID CSV file...");
        parseCsvFile(file, (ids, error) => {
            if (error) {
                alert(`Error parsing ID CSV: ${error}`);
                setCsvIdTracks([]);
            } else {
                if (ids.length === 0) {
                    alert('No track IDs found in the CSV.');
                } else {
                    alert(`${ids.length} track IDs loaded from CSV.`);
                }
                setCsvIdTracks(ids);
                console.log("ID CSV parsed:", ids.length);
            }
            if (inputElement) inputElement.value = '';
        });
    };

    const handleCreatePlaylistFromCsvId = async () => {
        if (!csvIdPlaylistName || csvIdTracks.length === 0 || !token || !currentUserId || isCreatingCsvIdPlaylist) return;
        setIsCreatingCsvIdPlaylist(true);
        console.log(`Creating playlist "${csvIdPlaylistName}" from ${csvIdTracks.length} IDs...`);
        try {
            const playlist = await createPlaylist(token, currentUserId, csvIdPlaylistName, 'Created from ID CSV using Smart Shuffler');
            if (!playlist?.id) throw new Error("Playlist creation failed (no ID returned).");
            console.log(`Playlist ${playlist.id} created, adding tracks...`);
            await addTracksToPlaylist(token, playlist.id, csvIdTracks);
            alert('Playlist created successfully from ID CSV!');
            setCsvIdTracks([]);
            setCsvIdPlaylistName('');
            await handleFetchPlaylists(token);
        } catch (error) {
            handleApiError(error, onLogout);
        } finally {
            setIsCreatingCsvIdPlaylist(false);
        }
    };

    // --- CSV Metadata Based (Title Only) --- (Handlers remain largely the same internally)
    const handleCsvMetadataUpload = (event) => {
        const file = event.target.files[0];
        const inputElement = event.target;
        if (!file) return;
        console.log("Parsing Metadata CSV file...");
        parseMetadataCsv(file, (metadataArray, error) => {
            if (error) {
                alert(`Error parsing metadata CSV: ${error}`);
                setCsvMetadata([]);
            } else {
                if (metadataArray.length === 0) {
                    alert('No valid track titles found in CSV.');
                } else {
                    alert(`${metadataArray.length} track titles loaded from CSV.`);
                }
                setCsvMetadata(metadataArray);
                console.log("Metadata CSV parsed:", metadataArray.length);
            }
            if (inputElement) inputElement.value = '';
        });
    };

    const handleCreatePlaylistFromMetadata = async () => {
        if (!csvMetaPlaylistName || csvMetadata.length === 0 || !token || !currentUserId || isCreatingCsvMetaPlaylist) return;

        setIsCreatingCsvMetaPlaylist(true);
        setIsSearchingTracks(true);
        let foundTrackIds = [];
        let notFoundTitles = [];
        let searchErrors = 0;
        let newPlaylistId = null;

        try {
            console.log(`Creating playlist: ${csvMetaPlaylistName}`);
            const playlist = await createPlaylist(token, currentUserId, csvMetaPlaylistName, 'Created from Metadata CSV (Title Search)');
            if (!playlist?.id) throw new Error("Playlist creation failed (no ID returned).");
            newPlaylistId = playlist.id;
            console.log(`Playlist ${newPlaylistId} created, now searching tracks...`);

            console.log(`Starting title search for ${csvMetadata.length} tracks...`);
            for (const metadata of csvMetadata) {
                const searchMeta = { title: metadata.title };
                try {
                    const foundTrack = await searchSpotifyTrack(token, searchMeta, 1);
                    if (foundTrack?.id) {
                        foundTrackIds.push(foundTrack.id);
                    } else {
                        notFoundTitles.push(metadata.title);
                        console.log(`No match for: "${metadata.title}"`);
                    }
                } catch (searchError) {
                    console.error(`Error searching for track "${metadata.title}":`, searchError);
                    searchErrors++;
                    notFoundTitles.push(`${metadata.title} (Search Error)`);
                }
            }
            console.log(`Search complete. Found ${foundTrackIds.length}. Missed ${notFoundTitles.length}. Errors: ${searchErrors}.`);
            setIsSearchingTracks(false);

            if (foundTrackIds.length > 0) {
                console.log(`Adding ${foundTrackIds.length} tracks to playlist ${newPlaylistId}...`);
                await addTracksToPlaylist(token, newPlaylistId, foundTrackIds);
                console.log("Tracks added.");
            } else {
                console.log("No tracks found via title search to add.");
            }

            let summaryMessage = `Playlist "${csvMetaPlaylistName}" created. Found and added ${foundTrackIds.length} / ${csvMetadata.length} tracks using title search.`;
            const missedCount = notFoundTitles.filter(t => !t.includes('(Search Error)')).length;
            if (missedCount > 0) {
                summaryMessage += `\nCould not find matches for ${missedCount} titles.`;
                console.log("Titles not found:", notFoundTitles.filter(t => !t.includes('(Search Error)')).join('; '));
            }
            if (searchErrors > 0) {
                summaryMessage += `\nEncountered ${searchErrors} errors during search. Check console logs.`;
                console.log("Titles with search errors:", notFoundTitles.filter(t => t.includes('(Search Error)')).join('; '));
            }
            alert(summaryMessage);

            setCsvMetadata([]);
            setCsvMetaPlaylistName('');
            await handleFetchPlaylists(token);

        } catch (error) {
            handleApiError(error, onLogout);
            setIsSearchingTracks(false);
        } finally {
            setIsCreatingCsvMetaPlaylist(false);
        }
    };

    // Updated Shuffle Handler: Accepts mood
    const handleShufflePlaylist = async (playlistId, playlistName, mood) => {
        // Check if another action is already running on *any* playlist
        if (!token || !currentUserId || loadingPlaylistIdForAction || isShuffling) return;

        // Validate mood just in case
        const validMoods = ['Angry', 'Calm', 'Excited', 'Happy', 'Sad'];
        if (!mood || !validMoods.includes(mood)) {
             alert("Invalid mood selected for shuffle.");
             return;
        }
        // No need to format mood here, assuming backend expects capitalized e.g. "Happy"

        setIsShuffling(true);
        setLoadingPlaylistIdForAction(playlistId); // Mark this playlist as busy for an action
        setActivePlaylistId(null); // Close dropdown/details view
        setCurrentTracks(null);

        try {
            // Fetch fresh tracks just before shuffling
            const trackItems = await fetchPlaylistTracks(token, playlistId);
            if (!trackItems || trackItems.length === 0) throw new Error("Playlist is empty, cannot shuffle.");

            const trackIds = trackItems
                .map(item => item?.track?.id)
                .filter(id => typeof id === 'string' && id.trim() !== '');

            if (trackIds.length === 0) throw new Error("No valid track IDs found in playlist.");

            console.log(`Sending ${trackIds.length} tracks to shuffle with mood: ${mood}`);
            // Pass the selected mood directly to the service (adjust case if needed by backend)
            // Assuming backend expects lowercase mood from original code, convert here:
            const moodToSend = mood.toLowerCase();
            const moodSplitTracks = await sendPlaylistToShuffle(trackIds, moodToSend);
            console.log('Shuffle API response:', moodSplitTracks);

            if (moodSplitTracks.error) {
                throw new Error(`Shuffle service error: ${moodSplitTracks.error}`);
            }
            if (!moodSplitTracks || typeof moodSplitTracks !== 'object' || !moodSplitTracks.mood_predictions) {
                throw new Error("Shuffle service returned an invalid response.");
            }

            // Access the tracks for the requested mood (using the Capitalized version for keys)
            const moodTracks = moodSplitTracks.mood_predictions[mood];

            if (!moodTracks || moodTracks.length === 0) {
                 console.warn(`Mood "${mood}" not found in response keys. Available:`, Object.keys(moodSplitTracks.mood_predictions));
                throw new Error(`No tracks were classified for the mood: ${mood}.`);
            }

            const shuffledPlaylistName = `${playlistName} - ${mood} Mood`;
            console.log(`Creating shuffled playlist: ${shuffledPlaylistName}`);

            const newPlaylist = await createPlaylist(token, currentUserId, shuffledPlaylistName, `Shuffled playlist based on mood: ${mood}`);
            if (!newPlaylist?.id) throw new Error("Failed to create shuffled playlist.");

            console.log(`Adding ${moodTracks.length} tracks to shuffled playlist: ${newPlaylist.id}`);
            const trackIdsOnly = moodTracks.map(track => track.track_id); // Assuming response format is { track_id: '...' }
            await addTracksToPlaylist(token, newPlaylist.id, trackIdsOnly);

            alert(`Mood-based playlist "${shuffledPlaylistName}" created successfully!`);
            await handleFetchPlaylists(token); // Refresh list
        } catch (error) {
            console.error('Shuffle error:', error);
            handleApiError(error, onLogout); // Use centralized handler
        } finally {
            setIsShuffling(false);
            setLoadingPlaylistIdForAction(null); // Clear busy state
        }
    };

    const handleExportPlaylist = async (playlistId, playlistName) => {
        if (!token || loadingPlaylistIdForAction || isExporting) return;

        setIsExporting(true);
        setLoadingPlaylistIdForAction(playlistId);
        setActivePlaylistId(null); // Close dropdown/details view
        setCurrentTracks(null);
        console.log(`Exporting playlist: ${playlistName} (${playlistId})`);
        try {
            const trackItems = await fetchPlaylistTracks(token, playlistId);
            if (!trackItems || trackItems.length === 0) {
                alert("Cannot export an empty playlist.");
                return;
            }
            console.log(`Workspaceed ${trackItems.length} tracks for export.`);
            exportTracksToCsv(trackItems, playlistName); // Util handles download
        } catch (error) {
            handleApiError(error, onLogout);
        } finally {
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
        setActivePlaylistId(null); // Close dropdown/details view
        setCurrentTracks(null);
        let duplicatesFoundCount = 0;
        console.log(`Checking for duplicates in: ${playlistName} (${playlistId})`);

        try {
            const trackItems = await fetchPlaylistTracks(token, playlistId);
            if (!trackItems || trackItems.length === 0) {
                alert("Playlist is empty, no duplicates to remove.");
                return;
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
                    // No need to clear tracks explicitly as it's done when closing active item
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

    // Show login prompt or nothing if no token
    if (!token) {
         // You might want a dedicated Login component/message here instead of null
        return (
             <div>
                 <h1>Spotify Playlist Manager</h1>
                 <p>Please log in to manage your playlists.</p>
                 {/* Button or link to initiate login flow */}
            </div>
        );
    }

    // Show loading if token exists but user ID hasn't been fetched yet
    if (!currentUserId && !isLoadingPlaylists) {
        return <div>Loading user data...</div>;
    }

    // Logged In View
    return (
        <>
            <h1>My Spotify Playlists</h1>

            {/* Playlist Section - Only rendered when logged in */}
            <div> {/* Styled as card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2>Your Playlists</h2>
                    <button onClick={() => handleFetchPlaylists()} disabled={isLoadingPlaylists}>
                        {isLoadingPlaylists ? 'Loading...' : 'Refresh'}
                    </button>
                </div>

                {isLoadingPlaylists && <p>Loading playlists...</p>}

                {!isLoadingPlaylists && playlists.length === 0 && (
                    <p>No playlists found. Try refreshing or create one below.</p>
                )}

                {!isLoadingPlaylists && playlists.length > 0 && (
                    <ul className="playlist-list">
                        {playlists.map((playlist) => {
                            // Determine loading state for *this specific item's actions*
                             const isActionBusyOnThis = loadingPlaylistIdForAction === playlist.id;
                             const isShufflingThis = isActionBusyOnThis && isShuffling;
                             const isExportingThis = isActionBusyOnThis && isExporting;
                             const isCleaningThis = isActionBusyOnThis && isRemovingDuplicates;
                             // Tracks loading is handled separately via isLoadingTracks and activePlaylistId check

                            return (
                                <PlaylistItem
                                    key={playlist.id}
                                    playlist={playlist}
                                    isActive={activePlaylistId === playlist.id}
                                    setActive={() => setActivePlaylistId(playlist.id)}
                                    clearActive={() => setActivePlaylistId(null)}
                                    onViewTracks={() => handleViewTracksRequest(playlist.id)}
                                    onShuffle={(mood) => handleShufflePlaylist(playlist.id, playlist.name, mood)}
                                    onExport={() => handleExportPlaylist(playlist.id, playlist.name)}
                                    onClean={() => handleRemoveDuplicates(playlist.id, playlist.name)}
                                    onCloseTracks={handleCloseTracks}
                                    // Pass tracks only if this is the active item and tracks are loaded for it
                                    tracksData={activePlaylistId === playlist.id ? currentTracks : null}
                                    isLoadingTracks={activePlaylistId === playlist.id && isLoadingTracks}
                                    isShufflingThis={isShufflingThis}
                                    isExportingThis={isExportingThis}
                                    isCleaningThis={isCleaningThis}
                                />
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* Removed the separate global "Display Tracks Section" */}

            {/* --- Other Actions (Create Playlist, CSV Uploads) --- */}
            {/* These can remain outside the conditional rendering if needed, */}
            {/* but disable buttons if !currentUserId */}

            {/* Create New Playlist Section */}
            <div className="action-card"> {/* Example class for styling */}
                <h2>Create New Playlist</h2>
                <input type="text" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} placeholder="Enter new playlist name" disabled={isCreatingPlaylist || !currentUserId}/>
                <button onClick={handleCreatePlaylist} disabled={!newPlaylistName.trim() || isCreatingPlaylist || !currentUserId}>{isCreatingPlaylist ? 'Creating...' : 'Create Playlist'}</button>
            </div>

            {/* Create Playlist from CSV (ID Based) */}
             <div className="action-card">
                <h2>Create Playlist from ID CSV</h2>
                 <input type="text" value={csvIdPlaylistName} onChange={(e) => setCsvIdPlaylistName(e.target.value)} placeholder="Enter name for ID CSV playlist" disabled={isCreatingCsvIdPlaylist || !currentUserId}/>
                 <input type="file" accept=".csv" onChange={handleCsvIdUpload} disabled={isCreatingCsvIdPlaylist || !currentUserId} key={"csvIdFile"+csvIdTracks.length} />
                 <button onClick={handleCreatePlaylistFromCsvId} disabled={!csvIdPlaylistName.trim() || csvIdTracks.length === 0 || isCreatingCsvIdPlaylist || !currentUserId}> {isCreatingCsvIdPlaylist ? 'Creating...' : `Create from ID CSV (${csvIdTracks.length})`} </button>
             </div>

             {/* Create Playlist from CSV (Metadata Based - Title Only) */}
             <div className="action-card">
                <h2>Create Playlist from Metadata CSV (Title Search)</h2>
                <p style={{fontSize: '0.9em', color: '#666'}}>Requires a CSV with a column for song titles (e.g., 'song_title', 'title').</p>
                 <input
                    type="text"
                    value={csvMetaPlaylistName}
                    onChange={(e) => setCsvMetaPlaylistName(e.target.value)}
                    placeholder="Enter name for Metadata playlist"
                    disabled={isCreatingCsvMetaPlaylist || !currentUserId}
                 />
                 <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvMetadataUpload}
                    disabled={isCreatingCsvMetaPlaylist || !currentUserId}
                    key={"csvMetaFile"+csvMetadata.length}
                 />
                 <button
                    onClick={handleCreatePlaylistFromMetadata}
                    disabled={!csvMetaPlaylistName.trim() || csvMetadata.length === 0 || isCreatingCsvMetaPlaylist || !currentUserId}
                 >
                    {isCreatingCsvMetaPlaylist ? (isSearchingTracks ? 'Searching...' : 'Creating...') : `Create from Metadata (${csvMetadata.length})`}
                 </button>
             </div>
        </>
    );
}

export default Spotify;