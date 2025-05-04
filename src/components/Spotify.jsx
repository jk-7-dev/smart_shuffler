// src/components/Spotify.jsx
import React, { useEffect, useState } from 'react';
// Import services
import {
    fetchPlaylists, fetchPlaylistTracks, createPlaylist, addTracksToPlaylist,
    getUserId, removeTracksFromPlaylist, searchSpotifyTrack
} from '../services/spotifyService';
// Import shuffle service
import { sendPlaylistToShuffle } from '../services/shuffleService';
// Import utils
import { parseCsvFile, exportTracksToCsv, parseMetadataCsv } from '../utils/csvUtils';
// Styling is handled by Layout.css and potentially App.css

function Spotify({ token, onLogout }) {
  // --- State ---
  const [playlists, setPlaylists] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [csvIdPlaylistName, setCsvIdPlaylistName] = useState('');
  const [csvIdTracks, setCsvIdTracks] = useState([]);
  const [csvMetaPlaylistName, setCsvMetaPlaylistName] = useState('');
  const [csvMetadata, setCsvMetadata] = useState([]);

  // --- Loading States ---
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [isCreatingCsvIdPlaylist, setIsCreatingCsvIdPlaylist] = useState(false);
  const [isCreatingCsvMetaPlaylist, setIsCreatingCsvMetaPlaylist] = useState(false);
  const [isSearchingTracks, setIsSearchingTracks] = useState(false); // For metadata search
  const [isShuffling, setIsShuffling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);
  const [loadingPlaylistId, setLoadingPlaylistId] = useState(null); // Tracks which playlist item is busy

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
        setTracks([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]); // Removed onLogout from deps assuming it's stable or handled by context

  // --- Centralized Error Handling ---
   const handleApiError = (error, logoutCallback) => {
     console.error("API Error:", error);
     const message = String(error?.message || '').toLowerCase();
     // Check for common auth-related errors
     if (message.includes('401') || message.includes('403') || message.includes('token') || message.includes('unauthorized') || message.includes('failed to fetch user profile')) {
         alert(`Authentication error: ${error.message}. Session may have expired. Logging out.`);
         // Use logoutCallback IF it's passed and valid
         if (typeof logoutCallback === 'function') {
             logoutCallback();
         } else {
             console.warn("onLogout callback not available for API error handling. Consider redirecting.");
             // window.location.href = '/login'; // Example redirect
         }
     } else {
         // For non-auth errors, just show the message
         alert(`An error occurred: ${error.message}`);
     }
   };

  // --- Handlers (Implementations Restored) ---

  const handleFetchPlaylists = async (currentToken = token) => {
    if (!currentToken || isLoadingPlaylists) return;
    setIsLoadingPlaylists(true);
    setLoadingPlaylistId(null); // Reset specific item loading
    setTracks([]); // Clear tracks view when fetching playlists
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

  const handleFetchTracks = async (playlistId) => {
    // Prevent concurrent actions on the same playlist item
    const isItemLoading = loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates);
    if (!token || isItemLoading) return;

    setIsLoadingTracks(true);
    setLoadingPlaylistId(playlistId); // Set which item is loading
    console.log(`Workspaceing tracks for playlist: ${playlistId}`);
    try {
        const items = await fetchPlaylistTracks(token, playlistId);
        setTracks(items);
        console.log(`Tracks fetched for ${playlistId}:`, items.length);
    } catch (error) {
        handleApiError(error, onLogout);
        setTracks([]); // Clear tracks on error
    } finally {
        setIsLoadingTracks(false);
        setLoadingPlaylistId(null); // Clear specific item loading
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName || !token || !currentUserId || isCreatingPlaylist) return;
    setIsCreatingPlaylist(true);
    console.log(`Creating playlist: ${newPlaylistName}`);
    try {
        await createPlaylist(token, currentUserId, newPlaylistName, 'New playlist created by Smart Shuffler');
        alert('Playlist created!');
        setNewPlaylistName(''); // Clear input
        await handleFetchPlaylists(token); // Refresh playlist list
    } catch(error) {
        handleApiError(error, onLogout);
    } finally {
        setIsCreatingPlaylist(false);
    }
  };

  // --- CSV ID Based ---
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
            setCsvIdTracks(ids); // Store the parsed IDs
            console.log("ID CSV parsed:", ids.length);
        }
        // Reset file input visually
        if (inputElement) {
            inputElement.value = '';
        }
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
        setCsvIdTracks([]); // Clear loaded IDs
        setCsvIdPlaylistName(''); // Clear input name
        await handleFetchPlaylists(token); // Refresh list
    } catch (error) {
        handleApiError(error, onLogout);
    } finally {
        setIsCreatingCsvIdPlaylist(false);
    }
  };

  // --- CSV Metadata Based (Title Only) ---
    const handleCsvMetadataUpload = (event) => {
    const file = event.target.files[0];
    const inputElement = event.target;
    if (!file) return;
    console.log("Parsing Metadata CSV file...");
    // Use the parser that extracts only the title (or primarily title)
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
             // metadataArray should now be [{title: "..."}, {title: "..."}]
             setCsvMetadata(metadataArray); // Store the parsed metadata
             console.log("Metadata CSV parsed:", metadataArray.length);
         }
         // Reset file input visually
        if (inputElement) {
             inputElement.value = '';
        }
    });
  };

  const handleCreatePlaylistFromMetadata = async () => {
    if (!csvMetaPlaylistName || csvMetadata.length === 0 || !token || !currentUserId || isCreatingCsvMetaPlaylist) return;

    setIsCreatingCsvMetaPlaylist(true); // Overall creation process
    setIsSearchingTracks(true); // Specifically track searching phase
    let foundTrackIds = [];
    let notFoundTitles = []; // Store just the titles that weren't found
    let searchErrors = 0;
    let newPlaylistId = null; // To store the ID if playlist is created

    try {
        // 1. Create empty playlist FIRST
        console.log(`Creating playlist: ${csvMetaPlaylistName}`);
        const playlist = await createPlaylist(token, currentUserId, csvMetaPlaylistName, 'Created from Metadata CSV (Title Search)');
        if (!playlist?.id) throw new Error("Playlist creation failed (no ID returned).");
        newPlaylistId = playlist.id; // Store the ID
        console.log(`Playlist ${newPlaylistId} created, now searching tracks...`);


        // 2. Search for each track using ONLY title
        console.log(`Starting title search for ${csvMetadata.length} tracks...`);
        for (const metadata of csvMetadata) { // metadata is { title: string }
            // Ensure we only pass the title object as expected by the updated search function
            const searchMeta = { title: metadata.title };
            try {
                // Pass the metadata object (search function now only uses title)
                // Limit to 1 result for hopefully better accuracy
                const foundTrack = await searchSpotifyTrack(token, searchMeta, 1);
                if (foundTrack?.id) {
                    foundTrackIds.push(foundTrack.id);
                } else {
                    notFoundTitles.push(metadata.title); // Keep track of missed titles
                    console.log(`No match for: "${metadata.title}"`);
                }
            } catch (searchError) {
                console.error(`Error searching for track "${metadata.title}":`, searchError);
                searchErrors++;
                notFoundTitles.push(`${metadata.title} (Search Error)`); // Mark errors
            }
        }
        console.log(`Search complete. Found ${foundTrackIds.length}. Missed ${notFoundTitles.length}. Errors: ${searchErrors}.`);
        setIsSearchingTracks(false); // Searching phase finished

        // 3. Add found tracks (if any)
        if (foundTrackIds.length > 0) {
            console.log(`Adding ${foundTrackIds.length} tracks to playlist ${newPlaylistId}...`);
            // Add in batches if necessary (Spotify limit is 100 per request)
             await addTracksToPlaylist(token, newPlaylistId, foundTrackIds); // Assuming service handles batching
             console.log("Tracks added.");
         } else {
            console.log("No tracks found via title search to add.");
        }

        // 4. Provide summary feedback
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

        // 5. Reset state and refresh playlists
        setCsvMetadata([]);
        setCsvMetaPlaylistName('');
        await handleFetchPlaylists(token);

    } catch (error) {
        handleApiError(error, onLogout);
        setIsSearchingTracks(false); // Ensure indicator stops on error
        // Consider deleting the playlist if it was created but the process failed significantly
        // if (newPlaylistId) { ... delete logic ... }
    } finally {
        setIsCreatingCsvMetaPlaylist(false); // Finish overall creation process
    }
  };

  const handleShufflePlaylist = async (playlistId, playlistName) => {
    const isItemLoading = loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates);
    if (!token || !currentUserId || isItemLoading) return;

    const userMood = window.prompt("Enter your mood (e.g., happy, sad, chill):")?.toLowerCase();
    if (!userMood) {
        alert("Mood input cancelled.");
        return;
    }

    // Capitalize the first letter of the mood to match the backend's format
    const formattedMood = userMood.charAt(0).toUpperCase() + userMood.slice(1);

    setIsShuffling(true);
    setLoadingPlaylistId(playlistId);

    try {
        const trackItems = await fetchPlaylistTracks(token, playlistId);
        if (!trackItems || trackItems.length === 0) throw new Error("Playlist is empty.");

        // Extract track IDs only
        const trackIds = trackItems
            .map(item => item?.track?.id)
            .filter(id => typeof id === 'string' && id.trim() !== '');

        console.log('Track IDs received:', trackIds);

        if (trackIds.length === 0) throw new Error("No valid track IDs found in playlist.");

        const moodSplitTracks = await sendPlaylistToShuffle(trackIds, userMood);
        console.log('Shuffle API response:', moodSplitTracks);
        console.log('Formatted Mood:', formattedMood);
        console.log('Available Moods:', Object.keys(moodSplitTracks?.mood_predictions || {}));


        if (moodSplitTracks.error) {
            console.error('Shuffle API error:', moodSplitTracks.error);
            alert(`Error: ${moodSplitTracks.error}`);
            return;
        }

        if (!moodSplitTracks || typeof moodSplitTracks !== 'object' || Object.keys(moodSplitTracks).length === 0) {
            throw new Error("Shuffle service returned no mood-split tracks or invalid response.");
        }

        // Access the tracks for the formatted mood
        const moodTracks = moodSplitTracks?.mood_predictions?.[formattedMood];

        if (!moodTracks || moodTracks.length === 0) {
            console.error(`Mood "${formattedMood}" not found in response. Available moods:`, Object.keys(moodSplitTracks));
            throw new Error(`No tracks found for mood: ${formattedMood}`);
        }

        // Create a new playlist for the shuffled tracks
        const shuffledPlaylistName = `${playlistName} - ${formattedMood} Mood`;
        console.log(`Creating shuffled playlist: ${shuffledPlaylistName}`);

        const newPlaylist = await createPlaylist(token, currentUserId, shuffledPlaylistName, `Shuffled playlist based on mood: ${formattedMood}`);
        if (!newPlaylist?.id) throw new Error("Failed to create shuffled playlist.");

        console.log(`Adding tracks to shuffled playlist: ${newPlaylist.id}`);
        const trackIdsOnly = moodTracks.map(track => track.track_id);
        await addTracksToPlaylist(token, newPlaylist.id, trackIdsOnly);


        alert(`Mood-based playlist "${shuffledPlaylistName}" created successfully!`);
        await handleFetchPlaylists(token);
    } catch (error) {
        console.error('Shuffle error:', error);
        handleApiError(error, onLogout);
    } finally {
        setIsShuffling(false);
        setLoadingPlaylistId(null);
    }
};

  const handleExportPlaylist = async (playlistId, playlistName) => {
    const isItemLoading = loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates);
    if (!token || isItemLoading) return;

    setIsExporting(true);
    setLoadingPlaylistId(playlistId);
    console.log(`Exporting playlist: ${playlistName} (${playlistId})`);
    try {
        const trackItems = await fetchPlaylistTracks(token, playlistId);
        if (!trackItems || trackItems.length === 0) {
             alert("Cannot export an empty playlist.");
             return; // Exit early
         }
        console.log(`Workspaceed ${trackItems.length} tracks for export.`);
         // exportTracksToCsv should handle the download prompt
         exportTracksToCsv(trackItems, playlistName); // Pass items (which include track object)
         // No alert needed here as the download itself is the confirmation
    } catch (error) {
        handleApiError(error, onLogout);
    } finally {
        setIsExporting(false);
        setLoadingPlaylistId(null);
    }
  };

  const handleRemoveDuplicates = async (playlistId, playlistName) => {
      const isItemLoading = loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates);
      if (!token || isItemLoading) return;

      // Confirm with the user
      const confirmation = window.confirm(`Are you sure you want to remove duplicate tracks (based on Spotify ID) from "${playlistName}"? This action cannot be undone.`);
      if (!confirmation) return;

      setIsRemovingDuplicates(true);
      setLoadingPlaylistId(playlistId);
      let duplicatesFoundCount = 0;
      console.log(`Checking for duplicates in: ${playlistName} (${playlistId})`);

      try {
          // 1. Fetch all tracks
          const trackItems = await fetchPlaylistTracks(token, playlistId); // Fetches all tracks, handles pagination if service does
           if (!trackItems || trackItems.length === 0) {
               alert("Playlist is empty, no duplicates to remove.");
               return;
           }

          // 2. Identify duplicates
          const seenTrackIds = new Set();
          const duplicatesToRemove = []; // Store { uri: string } for removal API

          trackItems.forEach(item => {
              // Ensure track and its ID/URI exist
              if (item?.track?.id && item?.track?.uri) {
                  if (seenTrackIds.has(item.track.id)) {
                      // This is a duplicate occurrence
                      duplicatesToRemove.push({ uri: item.track.uri }); // Add its URI to the removal list
                      console.log(`Marked duplicate: ${item.track.name} (ID: ${item.track.id})`);
                  } else {
                      // First time seeing this track ID
                      seenTrackIds.add(item.track.id);
                  }
              } else {
                  console.warn("Skipping item with missing track data during duplicate check:", item);
              }
          });

          duplicatesFoundCount = duplicatesToRemove.length;

          // 3. Remove duplicates if any were found
          if (duplicatesFoundCount === 0) {
              alert("No duplicate tracks found in this playlist.");
          } else {
              console.log(`Found ${duplicatesFoundCount} duplicate occurrences. Removing...`);
              // Spotify API removes tracks based on URI and position, but for duplicates, just URI is fine.
              // removeTracksFromPlaylist should handle batching if necessary.
              const result = await removeTracksFromPlaylist(token, playlistId, duplicatesToRemove);

              if (result?.snapshot_id) { // Check for snapshot_id as confirmation
                   alert(`${duplicatesFoundCount} duplicate track occurrence(s) removed successfully!`);
                   await handleFetchPlaylists(token); // Refresh playlist list to show updated counts
                   // If the currently viewed tracks were from this playlist, clear them
                   if (tracks.length > 0 && loadingPlaylistId === playlistId) {
                       setTracks([]); // Clear the detailed track view
                       console.log("Cleared detailed track view after duplicate removal.");
                   }
               } else {
                  // The API might not return snapshot_id on failure or if nothing was actually removed
                  throw new Error("Duplicate removal API call completed, but confirmation (snapshot_id) was missing. Please check the playlist.");
              }
          }
      } catch (error) {
          handleApiError(error, onLogout);
      } finally {
          setIsRemovingDuplicates(false);
          setLoadingPlaylistId(null);
      }
  };


  // --- Render Logic ---
   if (!currentUserId && !isLoadingPlaylists && token) {
       // Show loading only if logged in but user data isn't loaded yet
       return <div>Loading user data...</div>;
   }

  return (
    <> {/* Use Fragment */}
      <h1>My Spotify Playlists</h1>

      {/* Fetch Playlists Section */}
      <div> {/* Styled as card */}
        <h2>Your Playlists</h2>
        <button onClick={() => handleFetchPlaylists()} disabled={isLoadingPlaylists}>
            {isLoadingPlaylists ? 'Loading...' : 'Refresh Playlists'}
        </button>
        {isLoadingPlaylists && <p>Loading playlists...</p>}
        {!isLoadingPlaylists && playlists.length === 0 && <p>No playlists found or fetched yet. Try refreshing!</p>}
        {!isLoadingPlaylists && playlists.length > 0 && (
            <ul className="playlist-list">
                {playlists.map((playlist) => {
                    // Determine loading state for *this specific item*
                    const isItemLoading = loadingPlaylistId === playlist.id;
                    const isLoadingThisTrack = isItemLoading && isLoadingTracks;
                    const isShufflingThis = isItemLoading && isShuffling;
                    const isExportingThis = isItemLoading && isExporting;
                    const isCleaningThis = isItemLoading && isRemovingDuplicates;
                    // Disable all buttons for this item if any action is in progress for it
                    const disableActions = isItemLoading;

                    return (
                        <li key={playlist.id}>
                            <span>{playlist.name} ({playlist.tracks?.total ?? 0} tracks)</span>
                            <div className="playlist-actions">
                                <button onClick={() => handleFetchTracks(playlist.id)} disabled={disableActions}>{isLoadingThisTrack ? '...' : 'View'}</button>
                                <button className="shuffle-button" onClick={() => handleShufflePlaylist(playlist.id, playlist.name)} disabled={disableActions}>{isShufflingThis ? '...' : 'Shuffle'}</button>
                                <button onClick={() => handleExportPlaylist(playlist.id, playlist.name)} disabled={disableActions}>{isExportingThis ? '...' : 'Export'}</button>
                                <button onClick={() => handleRemoveDuplicates(playlist.id, playlist.name)} disabled={disableActions}>{isCleaningThis ? '...' : 'Clean'}</button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        )}
      </div>

      {/* Display Tracks Section - Appears when tracks are loaded */}
      {/* Check if tracks are loaded AND they belong to the currently loadingPlaylistId (or if no action is active) */}
      {isLoadingTracks && loadingPlaylistId && <p>Loading tracks...</p>}
      {!isLoadingTracks && tracks.length > 0 && (
          <div className="track-details"> {/* Styled as card */}
              {/* You might want to add the name of the playlist being viewed */}
              {/* Find playlist name: playlists.find(p => p.id === loadingPlaylistId)?.name */}
              <h2>Tracks in Selected Playlist</h2>
              <ul>
                  {tracks.map((item, index) => (
                      item?.track ? ( // Extra check for item and item.track
                          <li key={item.track.id ? `${item.track.id}-${index}` : `track-${index}`}> {/* More robust key */}
                              <p><strong>Name:</strong> {item.track.name || 'N/A'}</p>
                              <p><strong>Artist:</strong> {item.track.artists?.map(artist => artist.name).join(', ') || 'N/A'}</p>
                              <p><strong>Album:</strong> {item.track.album?.name || 'N/A'}</p>
                              <p><strong>Duration:</strong> {item.track.duration_ms ? `${Math.floor(item.track.duration_ms / 60000)}:${((item.track.duration_ms % 60000) / 1000).toFixed(0).padStart(2, '0')}` : 'N/A'}</p>
                               {/* Optional: Add Spotify URI or Link */}
                               {/* <p><small>ID: {item.track.id}</small></p> */}
                           </li>
                      ) : <li key={`missing-${index}`}>Track data missing or invalid</li>
                  ))}
              </ul>
          </div>
      )}

      {/* Create New Playlist Section */}
      <div> {/* Styled as card */}
        <h2>Create New Playlist</h2>
        <input type="text" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} placeholder="Enter new playlist name" disabled={isCreatingPlaylist || !currentUserId}/>
        <button onClick={handleCreatePlaylist} disabled={!newPlaylistName.trim() || isCreatingPlaylist || !currentUserId}>{isCreatingPlaylist ? 'Creating...' : 'Create Playlist'}</button>
      </div>

      {/* Create Playlist from CSV (ID Based) */}
      <div> {/* Styled as card */}
        <h2>Create Playlist from ID CSV</h2>
         <input type="text" value={csvIdPlaylistName} onChange={(e) => setCsvIdPlaylistName(e.target.value)} placeholder="Enter name for ID CSV playlist" disabled={isCreatingCsvIdPlaylist || !currentUserId}/>
         {/* Adding key prop based on length helps reset the input visually after upload */}
         <input type="file" accept=".csv" onChange={handleCsvIdUpload} disabled={isCreatingCsvIdPlaylist || !currentUserId} key={"csvIdFile"+csvIdTracks.length} />
         <button onClick={handleCreatePlaylistFromCsvId} disabled={!csvIdPlaylistName.trim() || csvIdTracks.length === 0 || isCreatingCsvIdPlaylist || !currentUserId}> {isCreatingCsvIdPlaylist ? 'Creating...' : `Create from ID CSV (${csvIdTracks.length})`} </button>
      </div>

      {/* Create Playlist from CSV (Metadata Based - Title Only) */}
      <div> {/* Styled as card */}
        <h2>Create Playlist from Metadata CSV (Title Search)</h2>
        <p style={{fontSize: '0.9em', color: '#aaa'}}>Requires a CSV with a column for song titles (e.g., 'song_title', 'title'). Other columns are ignored.</p>
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
           key={"csvMetaFile"+csvMetadata.length} // Reset input visually
         />
         <button
           onClick={handleCreatePlaylistFromMetadata}
           disabled={!csvMetaPlaylistName.trim() || csvMetadata.length === 0 || isCreatingCsvMetaPlaylist || !currentUserId}
         >
            {/* Show detailed status */}
           {isCreatingCsvMetaPlaylist ? (isSearchingTracks ? 'Searching Spotify...' : 'Adding Tracks...') : `Create from Metadata (${csvMetadata.length})`}
         </button>
      </div>
    </>
  );
}

export default Spotify;