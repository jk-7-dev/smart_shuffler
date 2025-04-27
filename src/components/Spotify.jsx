// src/components/Spotify.jsx
import React, { useEffect, useState } from 'react';
// Removed unused fetchUser import
import {
    fetchPlaylists,
    fetchPlaylistTracks,
    createPlaylist,
    addTracksToPlaylist,
    getUserId
} from '../services/spotifyService';
import { sendPlaylistToShuffle } from '../services/shuffleService';
import { parseCsvFile } from '../utils/csvUtils';
import './App.css';

// Receive token and onLogout function as props
function Spotify({ token, onLogout }) {
  // State managed within this component
  const [playlists, setPlaylists] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [csvPlaylistName, setCsvPlaylistName] = useState('');
  const [csvTracks, setCsvTracks] = useState([]);
  // Removed unused userInfo/setUserInfo state

  // Loading States
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [isCreatingCsvPlaylist, setIsCreatingCsvPlaylist] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [loadingPlaylistId, setLoadingPlaylistId] = useState(null);

  // Effect Hook (removed setUserInfo usage)
  useEffect(() => {
    if (token) {
        getUserId(token)
            .then(id => console.log("Spotify Component Mounted with User ID:", id))
            .catch(err => {
                console.error("Failed to fetch user info on mount:", err);
                onLogout();
            });
        // handleFetchPlaylists(); // Still optional: fetch playlists on load
    }
  }, [token, onLogout]);

  // --- Handlers (with loading state updates) ---

  const handleFetchPlaylists = async () => {
    if (!token) return;
    setIsLoadingPlaylists(true);
    setLoadingPlaylistId(null);
    try {
        const items = await fetchPlaylists(token);
        setPlaylists(items);
        setTracks([]);
    } catch (error) {
        console.error("Failed to fetch playlists:", error);
        alert(`Failed to fetch playlists: ${error.message}. Session might be invalid.`);
        if (error.message.includes('401') || error.message.includes('token') || error.message.includes('ailed to fetch user profile')) { // Added check from getUserId failure
             onLogout();
        }
    } finally {
        setIsLoadingPlaylists(false);
    }
  };

  const handleFetchTracks = async (playlistId) => {
    if (!token) return;
    setIsLoadingTracks(true);
    setLoadingPlaylistId(playlistId);
    try {
        const items = await fetchPlaylistTracks(token, playlistId);
        setTracks(items);
    } catch (error) {
        console.error("Failed to fetch tracks:", error);
        alert(`Failed to fetch tracks: ${error.message}`);
         if (error.message.includes('401') || error.message.includes('token') || error.message.includes('ailed to fetch user profile')) {
             onLogout();
        }
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
        // Removed unused 'playlist' variable assignment:
        await createPlaylist(token, userId, newPlaylistName, 'New playlist created via Smart Shuffler');
        // If createPlaylist succeeds, continue:
        alert('Playlist created successfully!');
        setNewPlaylistName('');
        await handleFetchPlaylists(); // Refresh list
    } catch(error) {
        console.error("Failed to create playlist:", error);
        alert(`Failed to create playlist: ${error.message}`);
         if (error.message.includes('401') || error.message.includes('token') || error.message.includes('ailed to fetch user profile')) {
             onLogout();
        }
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
        if (inputElement) { inputElement.value = ''; }
    });
  };


  const handleCreatePlaylistFromCsv = async () => {
    if (!csvPlaylistName || csvTracks.length === 0 || !token || isCreatingCsvPlaylist) return;
    setIsCreatingCsvPlaylist(true);
    try {
        const userId = await getUserId(token);
        const playlist = await createPlaylist(token, userId, csvPlaylistName, 'Created from CSV upload');
        if (!playlist?.id) throw new Error("Playlist creation failed or returned invalid data."); // Added check
        await addTracksToPlaylist(token, playlist.id, csvTracks);
        alert('Playlist created from CSV successfully!');
        setCsvTracks([]);
        setCsvPlaylistName('');
        await handleFetchPlaylists();
    } catch (error) {
        console.error("Failed to create playlist from CSV:", error);
        alert(`Failed to create playlist from CSV: ${error.message}`);
        if (error.message.includes('401') || error.message.includes('token') || error.message.includes('ailed to fetch user profile')) {
             onLogout();
        }
    } finally {
        setIsCreatingCsvPlaylist(false);
    }
  };

  const handleShufflePlaylist = async (playlistId, playlistName) => {
    if (!token || isShuffling) return;
    setIsShuffling(true);
    setLoadingPlaylistId(playlistId);
    try {
        const trackItems = await fetchPlaylistTracks(token, playlistId);
        if (!trackItems || trackItems.length === 0) { alert("Playlist has no tracks to shuffle."); throw new Error("Empty playlist");} // Simplified check
        const tracksToSend = trackItems.map(item => item.track).filter(track => track?.id);
        if (tracksToSend.length === 0) { alert("No valid track data found."); throw new Error("No valid tracks");} // Simplified check

        const shuffledTracks = await sendPlaylistToShuffle(tracksToSend);
        if (!shuffledTracks || shuffledTracks.length === 0) throw new Error("Shuffling service returned no tracks.");
        const shuffledIds = shuffledTracks.map(track => track.id).filter(id => id);
        if (shuffledIds.length === 0) throw new Error("Shuffled data from service is missing track IDs.");

        const userId = await getUserId(token);
        const shuffledPlaylistName = `${playlistName} - Shuffled`;
        const newPlaylist = await createPlaylist(token, userId, shuffledPlaylistName, 'Smart Shuffled version');
         if (!newPlaylist?.id) throw new Error("Failed to create the shuffled playlist container on Spotify."); // Added check

        await addTracksToPlaylist(token, newPlaylist.id, shuffledIds);
        alert('Shuffled playlist created!');
        await handleFetchPlaylists();

    } catch (error) {
        // Avoid alerting for self-thrown errors used for flow control if alert was already shown
        if (error.message !== "Empty playlist" && error.message !== "No valid tracks") {
            console.error('Error during shuffle:', error);
            alert(`Shuffling failed: ${error.message}`);
        }
         if (error.message.includes('401') || error.message.includes('token') || error.message.includes('ailed to fetch user profile')) {
             onLogout();
        }
    } finally {
        setIsShuffling(false);
        setLoadingPlaylistId(null);
    }
  };

  // --- Render Logic (with loading state usage) ---
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
        {!isLoadingPlaylists && playlists.length > 0 && (
          <ul>
            {playlists.map((playlist) => (
              <li key={playlist.id}>
                <span>{playlist.name} ({playlist.tracks?.total ?? 0} tracks)</span>
                <div>
                  <button
                    onClick={() => handleFetchTracks(playlist.id)}
                    disabled={(isLoadingTracks || isShuffling) && loadingPlaylistId === playlist.id} // Disable if loading tracks OR shuffling this one
                  >
                    {(isLoadingTracks && loadingPlaylistId === playlist.id) ? 'Loading...' : 'View Tracks'}
                  </button>
                  <button
                    onClick={() => handleShufflePlaylist(playlist.id, playlist.name)}
                    disabled={(isShuffling || isLoadingTracks) && loadingPlaylistId === playlist.id} // Disable if shuffling OR loading tracks for this one
                  >
                    {(isShuffling && loadingPlaylistId === playlist.id) ? 'Shuffling...' : 'Shuffle'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {/* Add case for no playlists found after loading */}
        {!isLoadingPlaylists && playlists.length === 0 && <p>No playlists found. Try creating one!</p>}
      </div>

      {/* Display Tracks Section */}
      {isLoadingTracks && loadingPlaylistId && <p>Loading tracks...</p>}
      {!isLoadingTracks && tracks.length > 0 && (
            <div>
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
        <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="Enter new playlist name"
            disabled={isCreatingPlaylist}
        />
        <button onClick={handleCreatePlaylist} disabled={!newPlaylistName || isCreatingPlaylist}>
            {isCreatingPlaylist ? 'Creating...' : 'Create Playlist'}
        </button>
      </div>

      {/* Create Playlist from CSV Section */}
      <div>
        <h2>Create Playlist from CSV</h2>
        <input
            type="text"
            value={csvPlaylistName}
            onChange={(e) => setCsvPlaylistName(e.target.value)}
            placeholder="Enter name for CSV playlist"
            disabled={isCreatingCsvPlaylist}
        />
        <input
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            disabled={isCreatingCsvPlaylist}
            // Add key to allow re-uploading same file name
            key={csvPlaylistName + csvTracks.length} // Simple key reset
        />
        <button
            onClick={handleCreatePlaylistFromCsv}
            disabled={!csvPlaylistName || csvTracks.length === 0 || isCreatingCsvPlaylist}
        >
          {isCreatingCsvPlaylist ? 'Creating...' : `Create Playlist from CSV (${csvTracks.length} tracks loaded)`}
        </button>
      </div>
    </div>
  );
}

export default Spotify;