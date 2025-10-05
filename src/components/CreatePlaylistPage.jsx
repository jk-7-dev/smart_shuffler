// src/components/CreatePlaylistPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Import services (assuming paths are correct)
import {
    createPlaylist, addTracksToPlaylist, searchSpotifyTrack
} from '../services/spotifyService';
// Import utils
import { parseCsvFile, parseMetadataCsv } from '../utils/csvUtils';
import './CreatePlaylistPage.css'; // Create this CSS file

// Assume handleApiError is passed as a prop or imported from a utility
// function handleApiError(error, logoutCallback) { ... }

function CreatePlaylistPage({ token, currentUserId, onLogout, handleApiError, refreshPlaylists }) {
    const navigate = useNavigate();

    // --- State for this page ---
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [csvIdPlaylistName, setCsvIdPlaylistName] = useState('');
    const [csvIdTracks, setCsvIdTracks] = useState([]);
    const [csvMetaPlaylistName, setCsvMetaPlaylistName] = useState('');
    const [csvMetadata, setCsvMetadata] = useState([]);

    // --- Loading States ---
    const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
    const [isCreatingCsvIdPlaylist, setIsCreatingCsvIdPlaylist] = useState(false);
    const [isCreatingCsvMetaPlaylist, setIsCreatingCsvMetaPlaylist] = useState(false);
    const [isSearchingTracks, setIsSearchingTracks] = useState(false); // For metadata search

    // Redirect if no token or user ID
    useEffect(() => {
        if (!token || !currentUserId) {
            console.warn("Create page: No token or user ID, redirecting to login or home.");
            navigate('/'); // Or '/login'
        }
    }, [token, currentUserId, navigate]);

    // --- Handlers (Moved from Spotify.jsx) ---

    const handleCreatePlaylist = async () => {
        if (!newPlaylistName || !token || !currentUserId || isCreatingPlaylist) return;
        setIsCreatingPlaylist(true);
        console.log(`Creating playlist: ${newPlaylistName}`);
        try {
            await createPlaylist(token, currentUserId, newPlaylistName, 'New playlist created by Smart Shuffler');
            alert('Playlist created!');
            setNewPlaylistName('');
            if (refreshPlaylists) refreshPlaylists(); // Refresh list on main page
            // Optionally navigate back or show success inline
        } catch (error) {
            handleApiError(error, onLogout);
        } finally {
            setIsCreatingPlaylist(false);
        }
    };

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
            if (refreshPlaylists) refreshPlaylists();
        } catch (error) {
            handleApiError(error, onLogout);
        } finally {
            setIsCreatingCsvIdPlaylist(false);
        }
    };

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
                    // Limit search to increase chance of correct match, can be adjusted
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
                    // Optional: Implement retry or delay here if rate limiting is suspected
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
            if (refreshPlaylists) refreshPlaylists();

        } catch (error) {
            handleApiError(error, onLogout);
            setIsSearchingTracks(false); // Ensure this resets on creation error too
        } finally {
            setIsCreatingCsvMetaPlaylist(false);
        }
    };


    // Render Logic
    if (!token || !currentUserId) {
        return <div className="loading-message">Loading user data or redirecting...</div>; // Or a more specific message
    }

    return (
        <div className="create-playlist-page">
            <h1>Create Spotify Playlists</h1>

            {/* Create New Playlist Section */}
            <div className="action-card create-section">
                <h2>Create Blank Playlist</h2>
                <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="Enter new playlist name"
                    disabled={isCreatingPlaylist}
                 />
                <button
                    onClick={handleCreatePlaylist}
                    disabled={!newPlaylistName.trim() || isCreatingPlaylist}
                >
                    {isCreatingPlaylist ? 'Creating...' : 'Create Playlist'}
                </button>
            </div>

            {/* Create Playlist from CSV (ID Based) */}
            <div className="action-card create-section">
                <h2>Create Playlist from ID CSV</h2>
                 <p className="description">Upload a CSV file containing a column with Spotify Track IDs (e.g., 'track_id', 'id').</p>
                <input
                    type="text"
                    value={csvIdPlaylistName}
                    onChange={(e) => setCsvIdPlaylistName(e.target.value)}
                    placeholder="Enter name for ID CSV playlist"
                    disabled={isCreatingCsvIdPlaylist}
                />
                 <label className="file-input-label">
                    {csvIdTracks.length > 0 ? `${csvIdTracks.length} IDs loaded` : 'Choose ID CSV File'}
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleCsvIdUpload}
                        disabled={isCreatingCsvIdPlaylist}
                        key={"csvIdFile" + csvIdTracks.length} // Reset input field
                        style={{ display: 'none' }} // Hide default input
                    />
                </label>
                <button
                    onClick={handleCreatePlaylistFromCsvId}
                    disabled={!csvIdPlaylistName.trim() || csvIdTracks.length === 0 || isCreatingCsvIdPlaylist}
                >
                    {isCreatingCsvIdPlaylist ? 'Creating...' : `Create from ${csvIdTracks.length} IDs`}
                </button>
             </div>

            {/* Create Playlist from CSV (Metadata Based - Title Only) */}
            <div className="action-card create-section">
                <h2>Create Playlist from Metadata CSV (Title Search)</h2>
                <p className="description">Upload a CSV with a column for song titles (e.g., 'song_title', 'title'). We'll search Spotify for matches.</p>
                <input
                    type="text"
                    value={csvMetaPlaylistName}
                    onChange={(e) => setCsvMetaPlaylistName(e.target.value)}
                    placeholder="Enter name for Metadata playlist"
                    disabled={isCreatingCsvMetaPlaylist}
                 />
                <label className="file-input-label">
                     {csvMetadata.length > 0 ? `${csvMetadata.length} titles loaded` : 'Choose Metadata CSV File'}
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleCsvMetadataUpload}
                        disabled={isCreatingCsvMetaPlaylist}
                        key={"csvMetaFile" + csvMetadata.length} // Reset input field
                        style={{ display: 'none' }} // Hide default input
                    />
                 </label>
                <button
                    onClick={handleCreatePlaylistFromMetadata}
                    disabled={!csvMetaPlaylistName.trim() || csvMetadata.length === 0 || isCreatingCsvMetaPlaylist}
                 >
                    {isCreatingCsvMetaPlaylist ? (isSearchingTracks ? 'Searching...' : 'Creating...') : `Create from ${csvMetadata.length} Titles`}
                </button>
            </div>
        </div>
    );
}

export default CreatePlaylistPage;