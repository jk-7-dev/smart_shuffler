import React, { useState, useEffect } from 'react';
import { fetchYouTubePlaylists, fetchAmazonPlaylists } from '../services/externalService'; // Assuming these exist
import { fetchYouTubeTracks, fetchAmazonTracks } from '../services/migrationService'; // Assuming these exist
import { createPlaylist, addTracksToPlaylist, getCurrentUserId, searchSpotifyTrack } from '../services/spotifyService';

// Auth URLs (ensure these are correct and handle the callback appropriately in your app)
// IMPORTANT: Replace YOUR_AMAZON_CLIENT_ID and YOUR_GOOGLE_CLIENT_ID with your actual client IDs
const amazonAuthUrl = `https://www.amazon.com/ap/oa?client_id=YOUR_AMAZON_CLIENT_ID&scope=profile&response_type=code&redirect_uri=http://localhost:8888/callback&state=amazon`;
const youtubeAuthUrl = `https://accounts.google.com/o/oauth2/auth?client_id=YOUR_GOOGLE_CLIENT_ID&redirect_uri=http://localhost:8888/callback&response_type=token&scope=https://www.googleapis.com/auth/youtube.readonly&state=youtube`;

// Mock services if not implemented - REMOVE IN PRODUCTION
// const fetchYouTubePlaylists = async () => { console.warn("Mock fetchYouTubePlaylists called"); return [{ id: 'yt1', name: 'YT Favs', trackCount: 10 }, { id: 'yt2', name: 'Workout Mix YT', trackCount: 23 }]; };
// const fetchAmazonPlaylists = async () => { console.warn("Mock fetchAmazonPlaylists called"); return [{ id: 'amz1', name: 'Amazon Chill', trackCount: 15 }]; };
// const fetchYouTubeTracks = async (playlistId) => { console.warn(`Mock fetchYouTubeTracks for ${playlistId}`); return [{ title: 'YT Song 1' }, { title: 'YT Song 2' }]; };
// const fetchAmazonTracks = async (playlistId) => { console.warn(`Mock fetchAmazonTracks for ${playlistId}`); return [{ title: 'Amazon Hit 1' }, { title: 'Amazon Hit 2' }]; };


function ServicesPage({ onLogout }) {
  const [youtubePlaylists, setYouTubePlaylists] = useState([]);
  const [amazonPlaylists, setAmazonPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState(''); // For user feedback

  // Simulate fetching on component mount if tokens are present (example)
  // In a real app, you'd check for existing tokens or states from OAuth callback
  useEffect(() => {
    // Example: Check if a URL parameter indicates a successful OAuth callback
    // const params = new URLSearchParams(window.location.search);
    // if (params.get('code') && params.get('state') === 'amazon') {
    //   // Handle Amazon OAuth code exchange here
    //   // Then call handleFetchAmazon();
    // }
    // if (params.get('access_token') && params.get('state') === 'youtube') {
    //   // Store YouTube token
    //   // localStorage.setItem('youtube_token', params.get('access_token'));
    //   // Then call handleFetchYouTube();
    //   // Clean up URL: window.history.replaceState({}, document.title, window.location.pathname);
    // }
  }, []);


  const handleFetchYouTube = async () => {
    setLoading(true);
    setMigrationStatus('Fetching YouTube playlists...');
    try {
      // Ensure fetchYouTubePlaylists is implemented and handles auth
      // This might involve using a token obtained from localStorage or an OAuth flow
      const playlists = await fetchYouTubePlaylists();
      setYouTubePlaylists(playlists || []);
      setMigrationStatus(playlists && playlists.length > 0 ? 'YouTube playlists fetched.' : 'No YouTube playlists found. Ensure you are connected and have granted permissions.');
    } catch (error) {
      console.error("Error fetching YouTube playlists:", error);
      alert(`Error fetching YouTube playlists: ${error.message}`);
      setMigrationStatus(`Error fetching YouTube playlists: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchAmazon = async () => {
    setLoading(true);
    setMigrationStatus('Fetching Amazon Music playlists...');
    try {
      // Ensure fetchAmazonPlaylists is implemented and handles auth
      const playlists = await fetchAmazonPlaylists();
      setAmazonPlaylists(playlists || []);
      setMigrationStatus(playlists && playlists.length > 0 ? 'Amazon Music playlists fetched.' : 'No Amazon Music playlists found. Ensure you are connected and have granted permissions.');
    } catch (error) {
      console.error("Error fetching Amazon playlists:", error);
      alert(`Error fetching Amazon Music playlists: ${error.message}`);
      setMigrationStatus(`Error fetching Amazon Music playlists: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMigratePlaylist = async (service, playlistId, playlistName) => {
    setLoading(true);
    setMigrationStatus(`Migrating "${playlistName}" from ${service}...`);
    let tracks = [];
    let successfullyMigrated = false;

    try {
      if (service === 'youtube') {
        tracks = await fetchYouTubeTracks(playlistId);
      } else if (service === 'amazon') {
        tracks = await fetchAmazonTracks(playlistId);
      }

      if (!tracks || tracks.length === 0) {
        setMigrationStatus(`No tracks found in "${playlistName}" to migrate.`);
        alert(`No tracks found in "${playlistName}" to migrate.`);
        setLoading(false);
        return;
      }
      console.log('Fetched Tracks for migration:', tracks);

      const token = localStorage.getItem('spotify_access_token');
      if (!token) {
        throw new Error("Spotify access token missing. Please login to Spotify first.");
      }

      const userId = await getCurrentUserId(token);
      // Appending source to playlist name for clarity on Spotify
      const newSpotifyPlaylist = await createPlaylist(token, userId, `${playlistName} (from ${service.charAt(0).toUpperCase() + service.slice(1)})`);

      const spotifyTrackIds = [];
      const unmatchedTracks = [];
      let matchedCount = 0;

      setMigrationStatus(`Searching for ${tracks.length} tracks on Spotify...`);

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        // Provide more granular progress updates
        if ( (i + 1) % 5 === 0 || i === tracks.length -1 || tracks.length < 5){
            setMigrationStatus(`Searching for "${track.title || 'track '+(i+1)}" on Spotify... (${i + 1}/${tracks.length})`);
        }

        let matchedTrack = null;
        // Attempt 1: Full title (if available and reasonable length)
        if (track.title) {
            matchedTrack = await searchSpotifyTrack(token, { title: track.title.trim() });
        }

        // Attempt 2: Title and Artist (if available) - often more accurate
        if (!matchedTrack && track.title && track.artist) {
             // Construct a query that might be more specific, e.g., "track:title artist:name"
             // For simplicity, spotifyService.searchSpotifyTrack currently only takes {title}.
             // If it were enhanced, you could pass artist too.
             // For now, combining them in the title search.
             matchedTrack = await searchSpotifyTrack(token, { title: `${track.title.trim()} ${track.artist.trim()}` });
        }
        
        // Attempt 3: First few words of title (fallback)
        if (!matchedTrack && track.title) {
            const titleWords = track.title.trim().split(' ');
            // Use a more robust way to get a few words, e.g., first 3-5 words
            const searchTerm = titleWords.slice(0, Math.min(titleWords.length, 4)).join(' '); 
            if (searchTerm) {
                 matchedTrack = await searchSpotifyTrack(token, { title: searchTerm });
            }
        }

        if (matchedTrack && matchedTrack.id) {
          spotifyTrackIds.push(matchedTrack.id);
          matchedCount++;
        } else {
          unmatchedTracks.push(track.title || `Unknown Track ${i+1}`);
          console.warn(`No match found for track: ${track.title || `Unknown Track ${i+1}`}`);
        }
      }

      if (spotifyTrackIds.length > 0) {
        await addTracksToPlaylist(token, newSpotifyPlaylist.id, spotifyTrackIds);
        successfullyMigrated = true;
      }

      let finalMessage = '';
      if (successfullyMigrated) {
        finalMessage = `Successfully migrated "${playlistName}" to Spotify as "${newSpotifyPlaylist.name}"! Matched ${matchedCount} of ${tracks.length} tracks.`;
      } else {
        finalMessage = `Could not match any tracks for "${playlistName}" on Spotify. The new playlist "${newSpotifyPlaylist.name}" was created but is empty.`;
      }

      if (unmatchedTracks.length > 0) {
        finalMessage += `\nThe following ${unmatchedTracks.length} tracks could not be matched:\n${unmatchedTracks.slice(0,10).join('\n')}`; // Show first 10
        if(unmatchedTracks.length > 10) finalMessage += '\n...and more (check console for full list).';
        console.warn('Unmatched Tracks (Full List):', unmatchedTracks);
      }
      
      setMigrationStatus(finalMessage);
      alert(finalMessage);

    } catch (error) {
      console.error("Error migrating playlist:", error);
      const errorMessage = `Migration failed for "${playlistName}": ${error.message}`;
      setMigrationStatus(errorMessage);
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Main container for the services page with Tailwind CSS classes for styling
    <div className="services-page bg-gray-900 text-white min-h-screen p-4 md:p-8 font-inter">
      {/* Page Title */}
      <h1 className="text-4xl font-bold text-center text-green-500 mb-8">Connect External Services</h1>
      
      {/* Migration status message bar */}
      {migrationStatus && (
        <div className={`p-4 mb-6 rounded-md text-sm text-center ${migrationStatus.includes('Error') || migrationStatus.includes('failed') || migrationStatus.includes('Could not match') ? 'bg-red-800 border border-red-700 text-red-100' : 'bg-blue-700 border border-blue-600 text-blue-100'}`}>
          {/* Using a <pre> tag to preserve newlines in the status message */}
          <pre className="whitespace-pre-wrap font-inter">{migrationStatus}</pre>
        </div>
      )}

      {/* Informational warning message */}
      <div className="warning-message">
      </div>

      {/* Grid layout for service cards */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Amazon Music Service Card */}
        <div className="service-card action-card bg-gray-800 p-6 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold text-green-400 mb-4">Amazon Music</h2>
          <div className="service-actions mb-4">
            {/* "Connect to Amazon" button - styled as a primary action link */}
            <a href={amazonAuthUrl} className="service-button primary-button">
              Connect to Amazon
            </a>
            {/* "Fetch Amazon Playlists" button */}
            <button onClick={handleFetchAmazon} disabled={loading} className="secondary-button">
              {loading ? 'Fetching...' : 'Fetch Amazon Playlists'}
            </button>
          </div>
          {/* Display fetched Amazon playlists */}
          {amazonPlaylists.length > 0 && (
            <div>
              <h3 className="text-xl font-medium mt-6 mb-3 text-gray-300">Your Amazon Playlists:</h3>
              <ul className="service-playlist-list">
                {amazonPlaylists.map((pl) => (
                  <li key={pl.id} className="service-playlist-item">
                    <span className="truncate max-w-[calc(100%-150px)]" title={pl.name}>{pl.name} ({pl.trackCount || 'N/A'} tracks)</span>
                    <button 
                      onClick={() => handleMigratePlaylist('amazon', pl.id, pl.name)} 
                      disabled={loading}
                      className="migrate-button tertiary-button"
                    >
                      {loading && migrationStatus.includes(pl.name) ? 'Migrating...' : 'Migrate'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
           {/* Message if no Amazon playlists are fetched */}
           {amazonPlaylists.length === 0 && !loading && (
             <p className="text-gray-500 mt-4 text-sm">No Amazon playlists fetched yet, or none found. Try connecting and then fetching.</p>
           )}
        </div>

        {/* YouTube Music Service Card */}
        <div className="service-card action-card bg-gray-800 p-6 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold text-green-400 mb-4">YouTube Music</h2>
          <div className="service-actions mb-4">
            {/* "Connect to YouTube" button - styled as a primary action link */}
            <a href={youtubeAuthUrl} className="service-button primary-button">
              Connect to YouTube
            </a>
            {/* "Fetch YouTube Playlists" button */}
            <button onClick={handleFetchYouTube} disabled={loading} className="secondary-button">
              {loading ? 'Fetching...' : 'Fetch YouTube Playlists'}
            </button>
          </div>
          {/* Display fetched YouTube playlists */}
          {youtubePlaylists.length > 0 && (
            <div>
              <h3 className="text-xl font-medium mt-6 mb-3 text-gray-300">Your YouTube Playlists:</h3>
              <ul className="service-playlist-list">
                {youtubePlaylists.map((pl) => (
                  <li key={pl.id} className="service-playlist-item">
                    <span className="truncate max-w-[calc(100%-150px)]" title={pl.name}>{pl.name} ({pl.trackCount || 'N/A'} tracks)</span>
                    <button 
                      onClick={() => handleMigratePlaylist('youtube', pl.id, pl.name)} 
                      disabled={loading}
                      className="migrate-button tertiary-button"
                    >
                      {loading && migrationStatus.includes(pl.name) ? 'Migrating...' : 'Migrate'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Message if no YouTube playlists are fetched */}
          {youtubePlaylists.length === 0 && !loading && (
             <p className="text-gray-500 mt-4 text-sm">No YouTube playlists fetched yet, or none found. Try connecting and then fetching.</p>
           )}
        </div>
      </div>

      {/* Logout button section */}
      <div className="mt-12 text-center">
        <button onClick={onLogout} className="logout-button danger-button">
          Logout from Spotify
        </button>
      </div>
    </div>
  );
}

export default ServicesPage;
