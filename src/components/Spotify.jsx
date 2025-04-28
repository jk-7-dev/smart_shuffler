// src/components/Spotify.jsx
import React, { useEffect, useState } from 'react';
// Import services - ensure removeTracksFromPlaylist is imported
import {
    fetchPlaylists,
    fetchPlaylistTracks,
    createPlaylist,
    addTracksToPlaylist,
    getUserId,
    removeTracksFromPlaylist // <-- Ensure this is imported
} from '../services/spotifyService';
import { sendPlaylistToShuffle } from '../services/shuffleService';
// Import utils
import { parseCsvFile, exportTracksToCsv } from '../utils/csvUtils';
import './App.css';

// Receive token and onLogout function as props
function Spotify({ token, onLogout }) {
  // --- State ---
  const [playlists, setPlaylists] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [csvPlaylistName, setCsvPlaylistName] = useState('');
  const [csvTracks, setCsvTracks] = useState([]);

  // --- Loading States ---
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [isCreatingCsvPlaylist, setIsCreatingCsvPlaylist] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // Added back state for removing duplicates
  const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);
  // Tracks which playlist item is busy
  const [loadingPlaylistId, setLoadingPlaylistId] = useState(null);

  // --- Effect Hook ---
  useEffect(() => {
    if (token) {
        getUserId(token)
            .then(id => console.log("Spotify Component Mounted with User ID:", id))
            .catch(err => {
                console.error("Failed to fetch user info on mount:", err);
                handleApiError(err, onLogout); // Use centralized handler
            });
        // handleFetchPlaylists(); // Optional: fetch playlists on load
    }
  }, [token, onLogout]); // Dependencies

  // --- Centralized Error Handling ---
  const handleApiError = (error, logoutCallback) => {
      console.error("API Error:", error); // Log the full error
      const message = String(error?.message || '').toLowerCase();
      // Check for common auth-related errors
      if (message.includes('401') || message.includes('403') || message.includes('token') || message.includes('unauthorized') || message.includes('failed to fetch user profile')) {
          alert(`Authentication error: ${error.message}. Logging out.`);
          logoutCallback(); // Use the passed logout function
      } else {
          // For non-auth errors, just show the message
          alert(`An error occurred: ${error.message}`);
      }
  };

  // --- Handlers ---

  const handleFetchPlaylists = async () => {
    if (!token || isLoadingPlaylists) return;
    setIsLoadingPlaylists(true);
    setLoadingPlaylistId(null);
    try {
        const items = await fetchPlaylists(token);
        setPlaylists(items);
        setTracks([]); // Clear tracks when fetching playlists
    } catch (error) {
        handleApiError(error, onLogout);
    } finally {
        setIsLoadingPlaylists(false);
    }
  };

  const handleFetchTracks = async (playlistId) => {
    // Prevent action if already processing this playlist
    if (!token || (loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates))) return;
    setIsLoadingTracks(true);
    setLoadingPlaylistId(playlistId);
    try {
        // Ensure fetchPlaylistTracks requests the 'uri' field
        const items = await fetchPlaylistTracks(token, playlistId);
        setTracks(items);
    } catch (error) {
        handleApiError(error, onLogout);
    } finally {
        setIsLoadingTracks(false);
        setLoadingPlaylistId(null);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName || !token || isCreatingPlaylist) return;
    setIsCreatingPlaylist(true);
    try {
        const userId = await getUserId(token);
        await createPlaylist(token, userId, newPlaylistName, 'New playlist created via Smart Shuffler');
        alert('Playlist created successfully!');
        setNewPlaylistName('');
        await handleFetchPlaylists(); // Refresh list
    } catch(error) {
        handleApiError(error, onLogout);
    } finally {
        setIsCreatingPlaylist(false);
    }
  };

  const handleCsvUpload = (event) => {
    const file = event.target.files[0];
    const inputElement = event.target;
    if (!file) return;
    parseCsvFile(file, (ids, error) => {
        if (error) {
            alert(`Error parsing CSV: ${error}`);
            setCsvTracks([]);
        } else {
            if (ids.length === 0) { alert('No valid track IDs found in the CSV file.'); }
            else { alert(`${ids.length} track IDs loaded from CSV.`); }
            setCsvTracks(ids);
        }
        if (inputElement) { inputElement.value = ''; } // Clear file input
    });
  };


  const handleCreatePlaylistFromCsv = async () => {
    if (!csvPlaylistName || csvTracks.length === 0 || !token || isCreatingCsvPlaylist) return;
    setIsCreatingCsvPlaylist(true);
    try {
        const userId = await getUserId(token);
        const playlist = await createPlaylist(token, userId, csvPlaylistName, 'Created from CSV upload');
        if (!playlist?.id) throw new Error("Playlist creation failed or returned invalid data.");
        await addTracksToPlaylist(token, playlist.id, csvTracks);
        alert('Playlist created from CSV successfully!');
        setCsvTracks([]);
        setCsvPlaylistName('');
        await handleFetchPlaylists();
    } catch (error) {
        handleApiError(error, onLogout);
    } finally {
        setIsCreatingCsvPlaylist(false);
    }
  };

  const handleShufflePlaylist = async (playlistId, playlistName) => {
     // Prevent action if already processing this playlist
    if (!token || (loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates))) return;
    setIsShuffling(true);
    setLoadingPlaylistId(playlistId);
    let userAlerted = false; // Flag to prevent double alerts
    try {
        const trackItems = await fetchPlaylistTracks(token, playlistId);
        if (!trackItems || trackItems.length === 0) { alert("Playlist has no tracks to shuffle."); userAlerted = true; throw new Error("Empty playlist");}
        const tracksToSend = trackItems.map(item => item.track).filter(track => track?.id);
        if (tracksToSend.length === 0) { alert("No valid track data found."); userAlerted = true; throw new Error("No valid tracks");}

        const shuffledTracks = await sendPlaylistToShuffle(tracksToSend);
        if (!shuffledTracks || shuffledTracks.length === 0) throw new Error("Shuffling service returned no tracks.");
        const shuffledIds = shuffledTracks.map(track => track.id).filter(id => id);
        if (shuffledIds.length === 0) throw new Error("Shuffled data from service is missing track IDs.");

        const userId = await getUserId(token);
        const shuffledPlaylistName = `${playlistName} - Shuffled`;
        const newPlaylist = await createPlaylist(token, userId, shuffledPlaylistName, 'Smart Shuffled version');
        if (!newPlaylist?.id) throw new Error("Failed to create the shuffled playlist container on Spotify.");

        await addTracksToPlaylist(token, newPlaylist.id, shuffledIds);
        alert('Shuffled playlist created!'); // Success alert
        userAlerted = true;
        await handleFetchPlaylists();

    } catch (error) {
        // Only alert if we haven't already shown one for empty/invalid tracks
        if (!userAlerted) {
             handleApiError(error, onLogout); // Use centralized handler for other errors
        } else {
            console.error('Shuffle error after initial check:', error); // Log internal errors
        }
    } finally {
        setIsShuffling(false);
        setLoadingPlaylistId(null);
    }
  };

  const handleExportPlaylist = async (playlistId, playlistName) => {
     // Prevent action if already processing this playlist
    if (!token || (loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates))) return;
    setIsExporting(true);
    setLoadingPlaylistId(playlistId);
    try {
        console.log(`Fetching tracks for playlist export: ${playlistId}`);
        const trackItems = await fetchPlaylistTracks(token, playlistId);
        console.log(`Fetched ${trackItems.length} tracks for export`);

        if (!trackItems || trackItems.length === 0) {
            alert("Playlist is empty. Nothing to export.");
            return; // Exit early
        }

        exportTracksToCsv(trackItems, playlistName); // Call the utility
        // Optional: Add a success notification if needed
        // alert(`Export started for "${playlistName}". Check your downloads.`);

    } catch (error) {
        handleApiError(error, onLogout);
    } finally {
        setIsExporting(false);
        setLoadingPlaylistId(null);
    }
  };

  // --- Added: Handler for Removing Duplicates ---
  const handleRemoveDuplicates = async (playlistId, playlistName) => {
      // Prevent action if already processing this playlist
      if (!token || (loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates))) return;

      // Confirm with the user
      const confirmation = window.confirm(`This will permanently remove duplicate tracks (based on Spotify ID) from your playlist "${playlistName}". This action cannot be undone. Are you sure?`);
      if (!confirmation) {
          return; // Stop if user cancels
      }

      setIsRemovingDuplicates(true);
      setLoadingPlaylistId(playlistId);
      let duplicatesFoundCount = 0;

      try {
          console.log(`Fetching tracks to find duplicates in playlist: ${playlistId}`);
          // Ensure fetchPlaylistTracks gets the URI field
          const trackItems = await fetchPlaylistTracks(token, playlistId);
          console.log(`Fetched ${trackItems.length} tracks`);

          if (!trackItems || trackItems.length === 0) {
              alert("Playlist is empty, no duplicates to remove.");
              return; // Exit early
          }

          const seenTrackIds = new Set();
          // Need to collect { uri: string } objects for the API call
          const duplicatesToRemove = [];

          trackItems.forEach(item => {
              // Check that track, id, and uri exist
              if (item?.track?.id && item?.track?.uri) {
                  const trackId = item.track.id;
                  const trackUri = item.track.uri;
                  if (seenTrackIds.has(trackId)) {
                      // This is a duplicate occurrence, add its URI object to the list
                      duplicatesToRemove.push({ uri: trackUri });
                  } else {
                      // First time seeing this track ID, add it to the set
                      seenTrackIds.add(trackId);
                  }
              } else {
                  console.warn("Skipping item with missing track data:", item);
              }
          });

          duplicatesFoundCount = duplicatesToRemove.length;
          console.log(`Found ${duplicatesFoundCount} duplicate track occurrence(s) to remove.`);

          if (duplicatesFoundCount === 0) {
              alert("No duplicate tracks found in this playlist.");
              return; // Exit early
          }

          // Call the service function to remove tracks
          const result = await removeTracksFromPlaylist(token, playlistId, duplicatesToRemove);

          if (result.snapshot_id) {
                alert(`${duplicatesFoundCount} duplicate track occurrence(s) removed successfully from "${playlistName}"!`);
                // Refresh playlists to update track counts
                await handleFetchPlaylists();
                // Clear the detailed track view if it was for the modified playlist
                 if (tracks.length > 0 && loadingPlaylistId === playlistId) {
                     setTracks([]);
                 }
          } else if (duplicatesFoundCount > 0) {
                // This might happen if the API call technically succeeded but returned no snapshot_id
                // or if the service function returned null because the input array was empty (shouldn't happen here)
                console.warn("Removal API call finished but no snapshot ID returned.");
                alert("Duplicates identified, but there might have been an issue during removal. Please check the playlist.");
          }
          // If duplicatesFoundCount was 0, we already alerted and returned.

      } catch (error) {
            handleApiError(error, onLogout); // Use centralized handler
      } finally {
            setIsRemovingDuplicates(false);
            setLoadingPlaylistId(null);
      }
  };


  // --- Render Logic ---
  return (
    <div>
      <button onClick={onLogout} style={{ position: 'absolute', top: '10px', right: '10px' }}>Logout</button>
      <h1>Smart Shuffler</h1>

      {/* Fetch Playlists Section */}
      <div>
        <button onClick={handleFetchPlaylists} disabled={isLoadingPlaylists}>
          {isLoadingPlaylists ? 'Loading...' : 'Fetch My Playlists'}
        </button>
        {isLoadingPlaylists && <p>Loading playlists...</p>}
        {!isLoadingPlaylists && playlists.length === 0 && <p>No playlists found. Try creating one!</p>}
        {!isLoadingPlaylists && playlists.length > 0 && (
          <ul>
            {playlists.map((playlist) => {
                // Determine if *any* action is loading for this specific playlist item
                const isItemLoading = loadingPlaylistId === playlist.id && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates);
                return (
                  <li key={playlist.id}>
                    <span>{playlist.name} ({playlist.tracks?.total ?? 0} tracks)</span>
                    <div>
                      {/* View Tracks Button */}
                      <button onClick={() => handleFetchTracks(playlist.id)} disabled={isItemLoading}>
                        {(isLoadingTracks && loadingPlaylistId === playlist.id) ? 'Loading...' : 'View Tracks'}
                      </button>
                      {/* Shuffle Button */}
                      <button onClick={() => handleShufflePlaylist(playlist.id, playlist.name)} disabled={isItemLoading}>
                        {(isShuffling && loadingPlaylistId === playlist.id) ? 'Shuffling...' : 'Shuffle'}
                      </button>
                      {/* Export Button */}
                      <button onClick={() => handleExportPlaylist(playlist.id, playlist.name)} disabled={isItemLoading}>
                        {(isExporting && loadingPlaylistId === playlist.id) ? 'Exporting...' : 'Export CSV'}
                      </button>
                      {/* Added back: Remove Duplicates Button */}
                       <button
                         onClick={() => handleRemoveDuplicates(playlist.id, playlist.name)}
                         disabled={isItemLoading}
                         title="Remove duplicate tracks based on Spotify ID"
                       >
                         {(isRemovingDuplicates && loadingPlaylistId === playlist.id) ? 'Cleaning...' : 'Remove Dups'}
                       </button>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </div>

      {/* Display Tracks Section */}
      {isLoadingTracks && loadingPlaylistId && <p>Loading tracks...</p>}
      {!isLoadingTracks && tracks.length > 0 && (
            <div>
                <h2>Tracks in Selected Playlist</h2>
                 <ul>
                    {/* Track list rendering */}
                    {tracks.map((item, index) => (
                        item.track ? (
                            <li key={item.track.id || index}>
                                <p><strong>Name:</strong> {item.track.name}</p>
                                <p><strong>Artist:</strong> {item.track.artists?.map(artist => artist.name).join(', ') || 'N/A'}</p>
                                <p><strong>Album:</strong> {item.track.album?.name || 'N/A'}</p>
                                <p><strong>Duration:</strong> {item.track.duration_ms ? `${Math.floor(item.track.duration_ms / 60000)}:${((item.track.duration_ms % 60000) / 1000).toFixed(0).padStart(2, '0')}` : 'N/A'}</p>
                            </li>
                        ) : <li key={`missing-${index}`}>Track data missing</li>
                    ))}
                 </ul>
            </div>
        )}

      {/* Create New Playlist Section */}
      <div>
        <h2>Create New Playlist</h2>
        <input type="text" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} placeholder="Enter new playlist name" disabled={isCreatingPlaylist}/>
        <button onClick={handleCreatePlaylist} disabled={!newPlaylistName || isCreatingPlaylist}>{isCreatingPlaylist ? 'Creating...' : 'Create Playlist'}</button>
      </div>

      {/* Create Playlist from CSV Section */}
      <div>
        <h2>Create Playlist from CSV</h2>
         <input type="text" value={csvPlaylistName} onChange={(e) => setCsvPlaylistName(e.target.value)} placeholder="Enter name for CSV playlist" disabled={isCreatingCsvPlaylist}/>
         <input type="file" accept=".csv" onChange={handleCsvUpload} disabled={isCreatingCsvPlaylist} key={csvPlaylistName + csvTracks.length} />
         <button onClick={handleCreatePlaylistFromCsv} disabled={!csvPlaylistName || csvTracks.length === 0 || isCreatingCsvPlaylist}> {isCreatingCsvPlaylist ? 'Creating...' : `Create Playlist from CSV (${csvTracks.length} tracks loaded)`} </button>
      </div>
    </div>
  );
}

export default Spotify;
