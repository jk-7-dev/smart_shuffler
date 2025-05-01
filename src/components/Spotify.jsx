// src/components/Spotify.jsx (Frontend Version)
import React, { useEffect, useState } from 'react';
// Import services (ensure all needed functions are imported)
import {
    fetchPlaylists,
    fetchPlaylistTracks,
    createPlaylist,
    addTracksToPlaylist,
    getUserId,
    removeTracksFromPlaylist,
    searchSpotifyTrack // <-- Search function for metadata lookup
} from '../services/spotifyService'; // Assuming this is the frontend version service file
// Import shuffle service
import { sendPlaylistToShuffle } from '../services/shuffleService';
// Import utils (ensure both parsers and exporter are included)
import { parseCsvFile, exportTracksToCsv, parseMetadataCsv } from '../utils/csvUtils';
import './App.css'; // Ensure styles exist
import ServicesPage from './ServicesPage';

// Receive token and onLogout function as props (Frontend Auth Flow)
function Spotify({ token, onLogout }) {
  // --- State ---
  const [playlists, setPlaylists] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null); // Store user ID

  // CSV (ID based) State
  const [csvIdPlaylistName, setCsvIdPlaylistName] = useState('');
  const [csvIdTracks, setCsvIdTracks] = useState([]);

  // CSV (Metadata based) State
  const [csvMetaPlaylistName, setCsvMetaPlaylistName] = useState('');
  // Stores {title: string}[] after parsing, based on previous update to parseMetadataCsv
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
  // Tracks which playlist item is busy
  const [loadingPlaylistId, setLoadingPlaylistId] = useState(null);

  // --- Effect Hook ---
  // Fetch User ID and initial playlists when token becomes available
  useEffect(() => {
    if (token) {
        console.log("Token found, fetching User ID...");
        getUserId(token) // Fetch user ID using the token
            .then(id => {
                console.log("Spotify Component Mounted with User ID:", id);
                setCurrentUserId(id); // Store the user ID
                // Fetch initial playlists now
                handleFetchPlaylists(token); // Pass token explicitly
            })
            .catch(err => {
                console.error("Failed to fetch user info on mount:", err);
                handleApiError(err, onLogout); // Use centralized handlerf
            });
    } else {
        console.log("No token available on mount.");
        // Clear state if token is removed
        setCurrentUserId(null);
        setPlaylists([]);
        setTracks([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, onLogout]); // Rerun if token changes

  // --- Centralized Error Handling ---
  const handleApiError = (error, logoutCallback) => {
      console.error("API Error:", error); // Log the full error
      const message = String(error?.message || '').toLowerCase();
      // Check for common auth-related errors
      if (message.includes('401') || message.includes('403') || message.includes('token') || message.includes('unauthorized') || message.includes('failed to fetch user profile')) {
          alert(`Authentication error: ${error.message}. Session may have expired. Logging out.`);
          if (typeof logoutCallback === 'function') {
              logoutCallback();
          }
      } else {
          // For non-auth errors, just show the message
          alert(`An error occurred: ${error.message}`);
      }
  };

  // --- Handlers (Pass token explicitly where needed) ---

  const handleFetchPlaylists = async (currentToken = token) => {
    if (!currentToken || isLoadingPlaylists) return;
    setIsLoadingPlaylists(true);
    setLoadingPlaylistId(null);
    try {
        const items = await fetchPlaylists(currentToken);
        setPlaylists(items);
        setTracks([]); // Clear tracks view
    } catch (error) {
        handleApiError(error, onLogout);
    } finally {
        setIsLoadingPlaylists(false);
    }
  };

  const handleFetchTracks = async (playlistId) => {
    const isItemLoading = loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates);
    if (!token || isItemLoading) return;
    setIsLoadingTracks(true); setLoadingPlaylistId(playlistId);
    try {
        const items = await fetchPlaylistTracks(token, playlistId);
        setTracks(items);
    } catch (error) {
        handleApiError(error, onLogout);
    } finally {
        setIsLoadingTracks(false); setLoadingPlaylistId(null);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName || !token || !currentUserId || isCreatingPlaylist) return;
    setIsCreatingPlaylist(true);
    try {
        await createPlaylist(token, currentUserId, newPlaylistName, 'New playlist');
        alert('Playlist created!'); setNewPlaylistName('');
        await handleFetchPlaylists(token);
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
    parseCsvFile(file, (ids, error) => {
        if (error) { alert(`Error parsing ID CSV: ${error}`); setCsvIdTracks([]); }
        else {
            if (ids.length === 0) { alert('No track IDs found.'); }
            else { alert(`${ids.length} track IDs loaded.`); }
            setCsvIdTracks(ids);
        }
        if (inputElement) { inputElement.value = ''; }
    });
  };

  const handleCreatePlaylistFromCsvId = async () => {
    if (!csvIdPlaylistName || csvIdTracks.length === 0 || !token || !currentUserId || isCreatingCsvIdPlaylist) return;
    setIsCreatingCsvIdPlaylist(true);
    try {
        const playlist = await createPlaylist(token, currentUserId, csvIdPlaylistName, 'Created from ID CSV');
        if (!playlist?.id) throw new Error("Playlist creation failed.");
        await addTracksToPlaylist(token, playlist.id, csvIdTracks);
        alert('Playlist created from ID CSV!');
        setCsvIdTracks([]); setCsvIdPlaylistName('');
        await handleFetchPlaylists(token);
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
    // Use the parser that extracts only the title (or primarily title)
    parseMetadataCsv(file, (metadataArray, error) => {
        if (error) {
            alert(`Error parsing metadata CSV: ${error}`);
            setCsvMetadata([]);
        } else {
            if (metadataArray.length === 0) { alert('No valid track titles found in CSV.'); }
            else { alert(`${metadataArray.length} track titles loaded from CSV.`); }
            // metadataArray should now be [{title: "..."}, {title: "..."}]
            setCsvMetadata(metadataArray);
        }
        if (inputElement) { inputElement.value = ''; }
    });
  };

  const handleCreatePlaylistFromMetadata = async () => {
    if (!csvMetaPlaylistName || csvMetadata.length === 0 || !token || !currentUserId || isCreatingCsvMetaPlaylist) return;

    setIsCreatingCsvMetaPlaylist(true);
    setIsSearchingTracks(true);
    let foundTrackIds = [];
    let notFoundTitles = []; // Store just the titles that weren't found
    let searchErrors = 0;

    try {
        // 1. Create empty playlist
        console.log(`Creating playlist: ${csvMetaPlaylistName}`);
        const playlist = await createPlaylist(token, currentUserId, csvMetaPlaylistName, 'Created from Metadata CSV (Title Search)');
        if (!playlist?.id) throw new Error("Playlist creation failed.");
        const newPlaylistId = playlist.id;

        // 2. Search for each track using ONLY title
        console.log(`Starting title search for ${csvMetadata.length} tracks...`);
        for (const metadata of csvMetadata) { // metadata is { title: string }
            // Ensure we only pass the title object as expected by the updated search function
            const searchMeta = { title: metadata.title };
            try {
                // Pass the metadata object (search function now only uses title)
                const foundTrack = await searchSpotifyTrack(token, searchMeta, 1);
                if (foundTrack?.id) {
                    foundTrackIds.push(foundTrack.id);
                } else {
                    notFoundTitles.push(metadata.title); // Keep track of missed titles
                }
            } catch (searchError) {
                console.error(`Error searching for track "${metadata.title}":`, searchError);
                searchErrors++;
                notFoundTitles.push(`${metadata.title} (Search Error)`); // Mark errors
            }
        }
        console.log(`Search complete. Found ${foundTrackIds.length}. Missed ${notFoundTitles.length}. Errors: ${searchErrors}.`);
        setIsSearchingTracks(false);

        // 3. Add found tracks
        if (foundTrackIds.length > 0) {
            console.log(`Adding ${foundTrackIds.length} tracks to playlist ${newPlaylistId}...`);
            await addTracksToPlaylist(token, newPlaylistId, foundTrackIds);
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
    } finally {
        setIsCreatingCsvMetaPlaylist(false);
    }
  };


  // --- Other Handlers ---
  const handleShufflePlaylist = async (playlistId, playlistName) => {
    const isItemLoading = loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates);
    if (!token || !currentUserId || isItemLoading) return;
    setIsShuffling(true); setLoadingPlaylistId(playlistId);
    let userAlerted = false;
    try {
        const trackItems = await fetchPlaylistTracks(token, playlistId);
        if (!trackItems || trackItems.length === 0) { alert("Empty playlist."); userAlerted = true; throw new Error("Empty playlist");}
        const tracksToSend = trackItems.map(item => item.track).filter(track => track?.id);
        if (tracksToSend.length === 0) { alert("No valid tracks."); userAlerted = true; throw new Error("No valid tracks");}
        const shuffledTracks = await sendPlaylistToShuffle(tracksToSend);
        if (!shuffledTracks || shuffledTracks.length === 0) throw new Error("Shuffle service empty.");
        const shuffledIds = shuffledTracks.map(track => track.id).filter(id => id);
        if (shuffledIds.length === 0) throw new Error("Shuffled data missing IDs.");
        const shuffledPlaylistName = `${playlistName} - Shuffled`;
        const newPlaylist = await createPlaylist(token, currentUserId, shuffledPlaylistName, 'Smart Shuffled version');
        if (!newPlaylist?.id) throw new Error("Failed to create container.");
        await addTracksToPlaylist(token, newPlaylist.id, shuffledIds);
        alert('Shuffled playlist created!'); userAlerted = true;
        await handleFetchPlaylists(token);
    } catch (error) {
        if (!userAlerted) { handleApiError(error, onLogout); }
        else { console.error('Shuffle error after initial check:', error); }
    } finally { setIsShuffling(false); setLoadingPlaylistId(null); }
  };

  const handleExportPlaylist = async (playlistId, playlistName) => {
    const isItemLoading = loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates);
    if (!token || isItemLoading) return;
    setIsExporting(true); setLoadingPlaylistId(playlistId);
    try {
        const trackItems = await fetchPlaylistTracks(token, playlistId);
        if (!trackItems || trackItems.length === 0) { alert("Playlist empty."); return; }
        exportTracksToCsv(trackItems, playlistName);
    } catch (error) { handleApiError(error, onLogout); }
    finally { setIsExporting(false); setLoadingPlaylistId(null); }
  };

  const handleRemoveDuplicates = async (playlistId, playlistName) => {
      const isItemLoading = loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates);
      if (!token || isItemLoading) return;
      const confirmation = window.confirm(`Remove duplicate tracks from "${playlistName}"?`);
      if (!confirmation) return;
      setIsRemovingDuplicates(true); setLoadingPlaylistId(playlistId);
      let duplicatesFoundCount = 0;
      try {
          const trackItems = await fetchPlaylistTracks(token, playlistId);
          if (!trackItems || trackItems.length === 0) { alert("Playlist empty."); return; }
          const seenTrackIds = new Set(); const duplicatesToRemove = [];
          trackItems.forEach(item => {
              if (item?.track?.id && item?.track?.uri) {
                  if (seenTrackIds.has(item.track.id)) { duplicatesToRemove.push({ uri: item.track.uri }); }
                  else { seenTrackIds.add(item.track.id); }
              }
          });
          duplicatesFoundCount = duplicatesToRemove.length;
          if (duplicatesFoundCount === 0) { alert("No duplicates found."); return; }
          const result = await removeTracksFromPlaylist(token, playlistId, duplicatesToRemove);
          if (result?.snapshot_id) {
                alert(`${duplicatesFoundCount} duplicate(s) removed!`);
                await handleFetchPlaylists(token);
                 if (tracks.length > 0 && loadingPlaylistId === playlistId) { setTracks([]); }
          } else { alert("Removal may have failed."); }
      } catch (error) { handleApiError(error, onLogout); }
      finally { setIsRemovingDuplicates(false); setLoadingPlaylistId(null); }
  };


  // --- Render Logic ---
  if (!token) {
      return <div>Authenticating...</div>; // Should be redirected by App.jsx if no token
  }
  if (!currentUserId && !isLoadingPlaylists) {
      // Show loading before initial fetch completes
      return <div>Loading user data and playlists...</div>;
  }

  return (
    // Using a simplified layout for now
    <div>
      <ServicesPage onLogout={onLogout} />
      <h1>Smart Shuffler</h1>

      {/* Google OAuth 2.0 Testing Notice */}
      <p style={{ color: 'red', fontSize: '0.9em' }}></p>
      <div>
        <button onClick={() => handleFetchPlaylists()} disabled={isLoadingPlaylists}>
            {isLoadingPlaylists ? 'Loading...' : 'Fetch My Playlists'}
        </button>
        {isLoadingPlaylists && <p>Loading playlists...</p>}
        {!isLoadingPlaylists && playlists.length === 0 && <p>No playlists found. Try creating one!</p>}
        {!isLoadingPlaylists && playlists.length > 0 && (
            <ul className="playlist-list">
                {playlists.map((playlist) => {
                    const isItemLoading = loadingPlaylistId === playlist.id && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates);
                    return (
                        <li key={playlist.id}>
                            <span>{playlist.name} ({playlist.tracks?.total ?? 0} tracks)</span>
                            <div className="playlist-actions">
                                <button onClick={() => handleFetchTracks(playlist.id)} disabled={isItemLoading}>{(isLoadingTracks && loadingPlaylistId === playlist.id) ? '...' : 'View'}</button>
                                <button onClick={() => handleShufflePlaylist(playlist.id, playlist.name)} disabled={isItemLoading}>{(isShuffling && loadingPlaylistId === playlist.id) ? '...' : 'Shuffle'}</button>
                                <button onClick={() => handleExportPlaylist(playlist.id, playlist.name)} disabled={isItemLoading}>{(isExporting && loadingPlaylistId === playlist.id) ? '...' : 'Export'}</button>
                                <button onClick={() => handleRemoveDuplicates(playlist.id, playlist.name)} disabled={isItemLoading}>{(isRemovingDuplicates && loadingPlaylistId === playlist.id) ? '...' : 'Clean'}</button>
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
            <div className="track-details">
                <h2>Tracks in Selected Playlist</h2>
                <ul>
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
        <input type="text" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} placeholder="Enter new playlist name" disabled={isCreatingPlaylist || !currentUserId}/>
        <button onClick={handleCreatePlaylist} disabled={!newPlaylistName || isCreatingPlaylist || !currentUserId}>{isCreatingPlaylist ? 'Creating...' : 'Create Playlist'}</button>
      </div>

      {/* Create Playlist from CSV (ID Based) */}
      <div>
        <h2>Create Playlist from ID CSV</h2>
         <input type="text" value={csvIdPlaylistName} onChange={(e) => setCsvIdPlaylistName(e.target.value)} placeholder="Enter name for ID CSV playlist" disabled={isCreatingCsvIdPlaylist || !currentUserId}/>
         <input type="file" accept=".csv" onChange={handleCsvIdUpload} disabled={isCreatingCsvIdPlaylist || !currentUserId} key={"csvIdFile"+csvIdTracks.length} />
         <button onClick={handleCreatePlaylistFromCsvId} disabled={!csvIdPlaylistName || csvIdTracks.length === 0 || isCreatingCsvIdPlaylist || !currentUserId}> {isCreatingCsvIdPlaylist ? 'Creating...' : `Create from ID CSV (${csvIdTracks.length})`} </button>
      </div>

      {/* Create Playlist from CSV (Metadata Based - Title Only) */}
      <div>
        <h2>Create Playlist from Metadata CSV (Title Search)</h2>
        {/* Updated description */}
        <p style={{fontSize: '0.9em', color: '#555'}}>Requires a column for song titles (e.g., 'song_title', 'title'). Other columns ignored.</p>
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
            onChange={handleCsvMetadataUpload} // Uses updated parser
            disabled={isCreatingCsvMetaPlaylist || !currentUserId}
            key={"csvMetaFile"+csvMetadata.length}
         />
         <button
            onClick={handleCreatePlaylistFromMetadata} // Uses updated handler
            disabled={!csvMetaPlaylistName || csvMetadata.length === 0 || isCreatingCsvMetaPlaylist || !currentUserId}
         >
            {isCreatingCsvMetaPlaylist ? (isSearchingTracks ? 'Searching...' : 'Adding...') : `Create from Metadata (${csvMetadata.length})`}
         </button>
      </div>

    </div>
  );
}

export default Spotify;
