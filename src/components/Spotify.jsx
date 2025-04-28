// src/components/Spotify.jsx
import React, { useEffect, useState } from 'react';
// Import backend-proxied services
import {
    fetchPlaylists,
    fetchPlaylistTracks,
    createPlaylist,
    addTracksToPlaylist,
    getUserId, // Still useful for getting the ID via backend
    removeTracksFromPlaylist, // Ensure this is imported
    checkAuthStatus // Import checkAuthStatus
} from '../services/spotifyService';
// Import shuffle service (calls separate backend or integrated one)
import { sendPlaylistToShuffle } from '../services/shuffleService';
// Import Utils
import { parseCsvFile, exportTracksToCsv } from '../utils/csvUtils';
import './App.css'; // Ensure styles are appropriate

// Base URL for backend login links (needed for connect buttons)
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
const googleLoginUrl = `${BACKEND_URL}/auth/google/login`;
const amazonLoginUrl = `${BACKEND_URL}/auth/amazon/login`;
// Add URLs for Deezer, Tidal, etc.

// Receive ONLY onLogout function as props
function Spotify({ onLogout }) {
  // --- State ---
  const [playlists, setPlaylists] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [csvPlaylistName, setCsvPlaylistName] = useState('');
  const [csvTracks, setCsvTracks] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null); // Store user ID fetched from backend
  // State to track connected services
  const [connectedServices, setConnectedServices] = useState({
      spotify: true, // Assume Spotify is connected if this component renders
      google: false,
      amazon: false,
      // Add other services
  });

  // --- Loading States ---
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [isCreatingCsvPlaylist, setIsCreatingCsvPlaylist] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);
  // Tracks which playlist item is busy
  const [loadingPlaylistId, setLoadingPlaylistId] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true); // Loading for initial status check

  // --- Effect Hook ---
  // Runs once when the component mounts
  useEffect(() => {
    setIsLoadingStatus(true);
    // Fetch user ID and check all service statuses on mount
    Promise.all([
      getUserId(), // Get Spotify User ID via backend
      checkAuthStatus() // Get connection status for all services
    ])
    .then(([userId, status]) => {
        console.log("Spotify Component Mounted with User ID:", userId);
        console.log("Connected services status:", status);
        setCurrentUserId(userId); // Store the user ID
        setConnectedServices(status || { spotify: true }); // Update connected status
        // Fetch initial playlists now
        handleFetchPlaylists();
    })
    .catch(err => {
        console.error("Failed initial data fetch on mount:", err);
        handleApiError(err, onLogout); // Use centralized handler
    })
    .finally(() => {
        setIsLoadingStatus(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLogout]); // Include handleFetchPlaylists if you want it re-runnable, but likely only on mount

  // --- Centralized Error Handling ---
  const handleApiError = (error, logoutCallback) => {
      console.error("API Error:", error); // Log the full error
      const message = String(error?.message || '').toLowerCase();
      // Check for common auth-related errors
      if (message.includes('401') || message.includes('403') || message.includes('token') || message.includes('unauthorized') || message.includes('authenticated')) {
          alert(`Authentication error: ${error.message}. Session may have expired. Logging out.`);
          logoutCallback(); // Trigger logout in App.jsx
      } else {
          // For non-auth errors, just show the message
          alert(`An error occurred: ${error.message}`);
      }
  };

  // --- Handlers ---

  const handleFetchPlaylists = async () => {
    if (isLoadingPlaylists) return;
    setIsLoadingPlaylists(true);
    setLoadingPlaylistId(null);
    try {
        const items = await fetchPlaylists();
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
    if (isItemLoading) return;
    setIsLoadingTracks(true);
    setLoadingPlaylistId(playlistId);
    try {
        const items = await fetchPlaylistTracks(playlistId);
        setTracks(items);
    } catch (error) {
        handleApiError(error, onLogout);
    } finally {
        setIsLoadingTracks(false);
        setLoadingPlaylistId(null);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName || !currentUserId || isCreatingPlaylist) {
        if(!currentUserId) console.error("Cannot create playlist, User ID not available.");
        return;
    }
    setIsCreatingPlaylist(true);
    try {
        await createPlaylist(newPlaylistName, 'New playlist created via Smart Shuffler');
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
            if (ids.length === 0) { alert('No valid track IDs found.'); }
            else { alert(`${ids.length} track IDs loaded.`); }
            setCsvTracks(ids);
        }
        if (inputElement) { inputElement.value = ''; } // Clear file input
    });
  };


  const handleCreatePlaylistFromCsv = async () => {
    if (!csvPlaylistName || csvTracks.length === 0 || !currentUserId || isCreatingCsvPlaylist) return;
    setIsCreatingCsvPlaylist(true);
    try {
        const playlist = await createPlaylist(csvPlaylistName, 'Created from CSV upload');
        if (!playlist?.id) throw new Error("Playlist creation failed or returned invalid data.");
        await addTracksToPlaylist(playlist.id, csvTracks);
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
    const isItemLoading = loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates);
    if (isItemLoading || !currentUserId) return;
    setIsShuffling(true);
    setLoadingPlaylistId(playlistId);
    let userAlerted = false;
    try {
        const trackItems = await fetchPlaylistTracks(playlistId);
        if (!trackItems || trackItems.length === 0) { alert("Playlist has no tracks to shuffle."); userAlerted = true; throw new Error("Empty playlist");}
        const tracksToSend = trackItems.map(item => item.track).filter(track => track?.id);
        if (tracksToSend.length === 0) { alert("No valid track data found."); userAlerted = true; throw new Error("No valid tracks");}

        const shuffledTracks = await sendPlaylistToShuffle(tracksToSend);
        if (!shuffledTracks || shuffledTracks.length === 0) throw new Error("Shuffling service returned no tracks.");
        const shuffledIds = shuffledTracks.map(track => track.id).filter(id => id);
        if (shuffledIds.length === 0) throw new Error("Shuffled data missing IDs.");

        const shuffledPlaylistName = `${playlistName} - Shuffled`;
        const newPlaylist = await createPlaylist(shuffledPlaylistName, 'Smart Shuffled version');
        if (!newPlaylist?.id) throw new Error("Failed to create the shuffled playlist container.");

        await addTracksToPlaylist(newPlaylist.id, shuffledIds);
        alert('Shuffled playlist created!');
        userAlerted = true;
        await handleFetchPlaylists();

    } catch (error) {
        if (!userAlerted) { handleApiError(error, onLogout); }
        else { console.error('Shuffle error after initial check:', error); }
    } finally {
        setIsShuffling(false);
        setLoadingPlaylistId(null);
    }
  };

  const handleExportPlaylist = async (playlistId, playlistName) => {
    const isItemLoading = loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates);
    if (isItemLoading) return;
    setIsExporting(true);
    setLoadingPlaylistId(playlistId);
    try {
        const trackItems = await fetchPlaylistTracks(playlistId);
        if (!trackItems || trackItems.length === 0) {
            alert("Playlist is empty. Nothing to export.");
            return;
        }
        exportTracksToCsv(trackItems, playlistName);
    } catch (error) {
        handleApiError(error, onLogout);
    } finally {
        setIsExporting(false);
        setLoadingPlaylistId(null);
    }
  };

  const handleRemoveDuplicates = async (playlistId, playlistName) => {
      const isItemLoading = loadingPlaylistId === playlistId && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates);
      if (isItemLoading) return;

      const confirmation = window.confirm(`Remove duplicate tracks (based on Spotify ID) from "${playlistName}"? This cannot be undone.`);
      if (!confirmation) return;

      setIsRemovingDuplicates(true);
      setLoadingPlaylistId(playlistId);
      let duplicatesFoundCount = 0;

      try {
          const trackItems = await fetchPlaylistTracks(playlistId);
          if (!trackItems || trackItems.length === 0) {
              alert("Playlist is empty."); return;
          }

          const seenTrackIds = new Set();
          const duplicatesToRemove = []; // { uri: string }[]
          trackItems.forEach(item => {
              if (item?.track?.id && item?.track?.uri) {
                  if (seenTrackIds.has(item.track.id)) {
                      duplicatesToRemove.push({ uri: item.track.uri });
                  } else {
                      seenTrackIds.add(item.track.id);
                  }
              }
          });

          duplicatesFoundCount = duplicatesToRemove.length;
          if (duplicatesFoundCount === 0) {
              alert("No duplicate tracks found."); return;
          }

          const result = await removeTracksFromPlaylist(playlistId, duplicatesToRemove);

          if (result?.snapshot_id) {
                alert(`${duplicatesFoundCount} duplicate track occurrence(s) removed!`);
                await handleFetchPlaylists();
                 if (tracks.length > 0 && loadingPlaylistId === playlistId) { setTracks([]); }
          } else {
                alert("Duplicates identified, but removal may have failed. Please check playlist.");
          }

      } catch (error) {
            handleApiError(error, onLogout);
      } finally {
            setIsRemovingDuplicates(false);
            setLoadingPlaylistId(null);
      }
  };


  // --- Render Logic ---
  if (isLoadingStatus) {
      return <div>Loading user data...</div>; // Initial loading state
  }

  return (
    <div className="main-app-layout"> {/* Add a class for layout */}
      {/* Sidebar (Example Structure) */}
      <div className="sidebar">
          <h2>Smart Shuffler</h2>
          <nav><ul><li>Playlists</li><li>Transfer</li><li>Sync</li></ul></nav>
          <hr />
          <div className="connect-services">
              <h3>Connected Services</h3>
              <ul>
                  {connectedServices.spotify && <li>Spotify ✅</li>}
                  {connectedServices.google && <li>Google (YouTube) ✅</li>}
                  {connectedServices.amazon && <li>Amazon Music ✅</li>}
              </ul>
              <h4>Connect More</h4>
              {!connectedServices.google && (<a href={googleLoginUrl} className="connect-button google">Connect Google</a>)}
              {!connectedServices.amazon && (<a href={amazonLoginUrl} className="connect-button amazon">Connect Amazon</a>)}
          </div>
          <hr />
          <button onClick={onLogout} className="logout-button">Logout</button>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
          <h1>Spotify Playlists</h1> {/* Title for the main view */}

          {/* Fetch Playlists Button */}
          <button onClick={handleFetchPlaylists} disabled={isLoadingPlaylists}>
            {isLoadingPlaylists ? 'Loading...' : 'Refresh Playlists'}
          </button>

          {/* Playlist List */}
          {isLoadingPlaylists && <p>Loading playlists...</p>}
          {!isLoadingPlaylists && playlists.length === 0 && <p>No playlists found or not loaded yet.</p>}
          {!isLoadingPlaylists && playlists.length > 0 && (
            <ul className="playlist-list"> {/* Add class for styling */}
              {playlists.map((playlist) => {
                  const isItemLoading = loadingPlaylistId === playlist.id && (isLoadingTracks || isShuffling || isExporting || isRemovingDuplicates);
                  return (
                    <li key={playlist.id}>
                      <span>{playlist.name} ({playlist.tracks?.total ?? 0} tracks)</span>
                      <div className="playlist-actions"> {/* Container for buttons */}
                        <button onClick={() => handleFetchTracks(playlist.id)} disabled={isItemLoading} title="View tracks in this playlist">
                          {(isLoadingTracks && loadingPlaylistId === playlist.id) ? '...' : 'View'}
                        </button>
                        <button onClick={() => handleShufflePlaylist(playlist.id, playlist.name)} disabled={isItemLoading} title="Create a new shuffled version">
                          {(isShuffling && loadingPlaylistId === playlist.id) ? '...' : 'Shuffle'}
                        </button>
                        <button onClick={() => handleExportPlaylist(playlist.id, playlist.name)} disabled={isItemLoading} title="Export playlist tracks to CSV">
                          {(isExporting && loadingPlaylistId === playlist.id) ? '...' : 'Export'}
                        </button>
                        <button onClick={() => handleRemoveDuplicates(playlist.id, playlist.name)} disabled={isItemLoading} title="Remove duplicate tracks (by ID)">
                          {(isRemovingDuplicates && loadingPlaylistId === playlist.id) ? '...' : 'Clean'}
                        </button>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}

          {/* Display Tracks Section */}
          {isLoadingTracks && loadingPlaylistId && <p>Loading tracks...</p>}
          {!isLoadingTracks && tracks.length > 0 && (
                <div className="track-details"> {/* Add class */}
                    <h2>Tracks in Selected Playlist</h2>
                    <ul>
                        {/* --- CORRECTED TRACK RENDERING --- */}
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
                        {/* --- END CORRECTION --- */}
                    </ul>
                </div>
            )}

          {/* Create Playlist Sections */}
          <div className="create-playlist-forms"> {/* Add class */}
              <div>
                  <h2>Create New Playlist</h2>
                  <input type="text" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} placeholder="Enter new playlist name" disabled={isCreatingPlaylist || !currentUserId}/>
                  <button onClick={handleCreatePlaylist} disabled={!newPlaylistName || isCreatingPlaylist || !currentUserId}>{isCreatingPlaylist ? 'Creating...' : 'Create Playlist'}</button>
              </div>
              <div>
                  <h2>Create Playlist from CSV</h2>
                  <input type="text" value={csvPlaylistName} onChange={(e) => setCsvPlaylistName(e.target.value)} placeholder="Enter name for CSV playlist" disabled={isCreatingCsvPlaylist || !currentUserId}/>
                  <input type="file" accept=".csv" onChange={handleCsvUpload} disabled={isCreatingCsvPlaylist || !currentUserId} key={csvPlaylistName + csvTracks.length} />
                  <button onClick={handleCreatePlaylistFromCsv} disabled={!csvPlaylistName || csvTracks.length === 0 || isCreatingCsvPlaylist || !currentUserId}> {isCreatingCsvPlaylist ? 'Creating...' : `Create from CSV (${csvTracks.length})`} </button>
              </div>
          </div>
      </div>
    </div>
  );
}

export default Spotify;
