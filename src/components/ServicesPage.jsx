// src/components/ServicesPage.jsx
import React, { useState, useEffect } from 'react';
import { fetchYouTubePlaylists, fetchAmazonPlaylists } from '../services/externalService';
import { fetchYouTubeTracks, fetchAmazonTracks } from '../services/migrationService';
import { createPlaylist, addTracksToPlaylist, searchSpotifyTrack, getUserId } from '../services/spotifyService';

// Auth URLs remain the same
const amazonAuthUrl = `https://www.amazon.com/ap/oa?client_id=amzn1.application-oa2-client.12947e30d18f426c820bee8a9846cf32&scope=profile&response_type=code&redirect_uri=http://localhost:8888/callback&state=amazon`;
const youtubeAuthUrl = `https://accounts.google.com/o/oauth2/auth?client_id=644871216893-utk85qa5330ngjk1tt7lab4pjbiauuk6.apps.googleusercontent.com&redirect_uri=http://localhost:8888/callback&response_type=token&scope=https://www.googleapis.com/auth/youtube.readonly&state=youtube`;

function ServicesPage() {
  const [youtubePlaylists, setYouTubePlaylists] = useState([]);
  const [amazonPlaylists, setAmazonPlaylists] = useState([]);
  const [loading, setLoading] = useState({ youtube: false, amazon: false, migrate: null });
  const [spotifyToken, setSpotifyToken] = useState(null);

  useEffect(() => {
      const token = localStorage.getItem('spotify_access_token');
      if (token) {
          setSpotifyToken(token);
      } else {
          console.error("Spotify token missing. Migration requires Spotify login.");
          // You could show a persistent message instead of an alert
          // setSpotifyConnected(false); // Example state
      }
  }, []);


  const handleFetchYouTube = async () => {
    // ... (implementation remains the same)
    setLoading(prev => ({ ...prev, youtube: true }));
    try {
      const playlists = await fetchYouTubePlaylists();
      setYouTubePlaylists(playlists || []);
    } catch (error) {
      alert(`Error fetching YouTube playlists: ${error.message}`);
      setYouTubePlaylists([]);
    } finally {
      setLoading(prev => ({ ...prev, youtube: false }));
    }
  };

  const handleFetchAmazon = async () => {
     // ... (implementation remains the same)
     setLoading(prev => ({ ...prev, amazon: true }));
    try {
        const playlists = await fetchAmazonPlaylists();
        setAmazonPlaylists(playlists || []);
    } catch (error) {
        alert(`Error fetching Amazon playlists: ${error.message}`);
        setAmazonPlaylists([]);
    } finally {
       setLoading(prev => ({ ...prev, amazon: false }));
    }
  };

  const handleMigratePlaylist = async (service, playlistId, playlistName) => {
      if (!spotifyToken) {
          alert("Spotify is not connected. Please log in via the main Spotify section first.");
          return;
      }
      setLoading(prev => ({ ...prev, migrate: playlistId }));
      let tracks = [];
      let migrationSuccess = false; // Initialize success flag
      let newPlaylistCreatedId = null; // Track if the playlist was created

      try {
          // 1. Fetch tracks from the source service
          console.log(`Workspaceing tracks for ${service} playlist: ${playlistName} (${playlistId})`);
          if (service === 'youtube') {
              tracks = await fetchYouTubeTracks(playlistId);
          } else if (service === 'amazon') {
              tracks = await fetchAmazonTracks(playlistId);
          }
           if (!tracks || tracks.length === 0) {
                alert(`Playlist "${playlistName}" appears to be empty or could not be fetched from ${service}.`);
                // No need to proceed further
                setLoading(prev => ({ ...prev, migrate: null }));
                return;
            }
          console.log(`Workspaceed ${tracks.length} tracks from ${service}.`);

          // 2. Get Spotify User ID
          const userId = await getUserId(spotifyToken);
          if (!userId) throw new Error("Could not get Spotify User ID. Is Spotify token valid?");

          // 3. Create new Spotify playlist
          const newSpotifyPlaylistName = `${playlistName} (Migrated from ${service.charAt(0).toUpperCase() + service.slice(1)})`;
          console.log(`Creating Spotify playlist: ${newSpotifyPlaylistName}`);
          const playlist = await createPlaylist(spotifyToken, userId, newSpotifyPlaylistName, `Migrated from ${service} via Smart Shuffler`);
          if (!playlist?.id) throw new Error("Failed to create new playlist on Spotify.");
          newPlaylistCreatedId = playlist.id; // Store ID after successful creation
          console.log(`Created Spotify playlist ID: ${newPlaylistCreatedId}`);


          // 4. Search for tracks on Spotify and collect IDs
          const spotifyTrackIds = [];
          const unmatchedTracks = [];
          console.log(`Matching ${tracks.length} tracks on Spotify...`);

          for (const track of tracks) {
              // Basic check for valid track data from source
              if (!track || !track.title) {
                   console.warn("Skipping track with missing title data:", track);
                   unmatchedTracks.push("(Track with missing title)"); // Log it as unmatched
                   continue;
               }

               let matchedTrack = null;
               try {
                   // Attempt search (adapt query as needed)
                   const searchQuery = { title: track.title };
                   if (track.artist) searchQuery.artist = track.artist; // Use artist if available
                   matchedTrack = await searchSpotifyTrack(spotifyToken, searchQuery, 1); // Limit to 1 match

                   // Optional: Add fallback search logic here if needed

               } catch (searchError) {
                   console.error(`Error searching for track "${track.title}":`, searchError);
                   // Don't add to spotifyTrackIds, log as unmatched with error note
                   unmatchedTracks.push(`${track.title} (Search Error)`);
               }

              if (matchedTrack?.id) {
                  spotifyTrackIds.push(matchedTrack.id);
              } else if (!unmatchedTracks.find(t => t.startsWith(track.title))) { // Avoid double-logging if search error occurred
                  unmatchedTracks.push(track.title + (track.artist ? ` by ${track.artist}` : ''));
                  console.warn(`No Spotify match found for: ${track.title}`);
              }
          }
          console.log(`Found ${spotifyTrackIds.length} matches on Spotify.`);

          // 5. Add matched tracks to the new Spotify playlist
          if (spotifyTrackIds.length > 0) {
              console.log(`Adding ${spotifyTrackIds.length} tracks to Spotify playlist ${newPlaylistCreatedId}...`);
              await addTracksToPlaylist(spotifyToken, newPlaylistCreatedId, spotifyTrackIds); // Assumes service handles batching
              // Set success flag *after* adding tracks
              migrationSuccess = true;
              alert(`Successfully migrated ${spotifyTrackIds.length} tracks from "${playlistName}" to Spotify!`);
          } else {
              alert(`No tracks from "${playlistName}" could be matched on Spotify. An empty playlist named "${newSpotifyPlaylistName}" was created.`);
              // Technically the playlist creation was successful, but migration wasn't useful.
              migrationSuccess = false; // Consider this not fully successful
          }

          // 6. Report unmatched tracks
          if (unmatchedTracks.length > 0) {
              console.warn('Unmatched Tracks:', unmatchedTracks);
              const unmatchedSample = unmatchedTracks.slice(0, 5).join('\n');
              // Append to the previous alert or show separately
              alert(`Additionally, could not find matches for ${unmatchedTracks.length} tracks:\n${unmatchedSample}${unmatchedTracks.length > 5 ? '\n...' : ''}\n(See browser console for full list)`);
          }

      } catch (error) {
          console.error(`Migration failed for ${playlistName}:`, error);
          alert(`Migration failed: ${error.message}`);
          migrationSuccess = false; // Explicitly mark as failed on error
          // Optional: Attempt to delete the empty playlist if it was created before error
          // if (newPlaylistCreatedId) { /* Call delete playlist API */ }

      } finally {
           // Log the final outcome using the migrationSuccess flag
           console.log(`Migration process finished for "${playlistName}". Success: ${migrationSuccess}`);
           setLoading(prev => ({ ...prev, migrate: null })); // Clear loading state for this item
      }
  };


  return (
    <>
      <h1>Connect External Services</h1>
      <p>Connect to YouTube or Amazon Music to migrate playlists to Spotify.</p>
        {!spotifyToken && (
            <p style={{ color: '#ffcc00', fontWeight: 'bold' }}>
                Warning: Spotify not connected. Please log in via the "My Playlists" section first to enable migration.
            </p>
        )}

      {/* Amazon Music Section */}
      <div> {/* Styled as card */}
        <h2>Amazon Music</h2>
        <a href={amazonAuthUrl} className="service-button">Connect to Amazon</a>
         <button onClick={handleFetchAmazon} disabled={loading.amazon || !localStorage.getItem('amazon_access_token')}>
           {loading.amazon ? 'Fetching...' : 'Fetch Amazon Playlists'}
         </button>
         {!localStorage.getItem('amazon_access_token') && <p style={{fontSize: '0.9em', color: '#aaa'}}>(Connect first to fetch)</p>}

        {loading.amazon && <p>Loading Amazon playlists...</p>}
        {amazonPlaylists.length > 0 && (
          <div>
            <h3>Your Amazon Playlists</h3>
            <ul>
              {amazonPlaylists.map((pl) => (
                <li key={pl.id}>
                  <span>{pl.name} ({pl.trackCount || 'N/A'} tracks)</span>
                  <button onClick={() => handleMigratePlaylist('amazon', pl.id, pl.name)} disabled={!spotifyToken || !!loading.migrate /* Disable if any migration is running */}>
                     {loading.migrate === pl.id ? 'Migrating...' : 'Migrate to Spotify'}
                   </button>
                </li>
              ))}
            </ul>
          </div>
        )}
         {amazonPlaylists.length === 0 && !loading.amazon && localStorage.getItem('amazon_access_token') && <p>No Amazon playlists found or fetched yet.</p>}
      </div>


      {/* YouTube Music Section */}
       <div> {/* Styled as card */}
        <h2>YouTube Music</h2>
         <a href={youtubeAuthUrl} className="service-button">Connect to YouTube</a>
         {/* Adjust check based on how you store YT token */}
         <button onClick={handleFetchYouTube} disabled={loading.youtube || !localStorage.getItem('youtube_access_token')}>
             {loading.youtube ? 'Fetching...' : 'Fetch YouTube Playlists'}
         </button>
          {!localStorage.getItem('youtube_access_token') && <p style={{fontSize: '0.9em', color: '#aaa'}}>(Connect first to fetch)</p>}

         {loading.youtube && <p>Loading YouTube playlists...</p>}
        {youtubePlaylists.length > 0 && (
          <div>
            <h3>Your YouTube Playlists</h3>
            <ul>
              {youtubePlaylists.map((pl) => (
                <li key={pl.id}>
                  <span>{pl.name} ({pl.trackCount || 'N/A'} tracks)</span>
                   <button onClick={() => handleMigratePlaylist('youtube', pl.id, pl.name)} disabled={!spotifyToken || !!loading.migrate /* Disable if any migration is running */}>
                     {loading.migrate === pl.id ? 'Migrating...' : 'Migrate to Spotify'}
                   </button>
                </li>
              ))}
            </ul>
          </div>
        )}
         {youtubePlaylists.length === 0 && !loading.youtube && localStorage.getItem('youtube_access_token') && <p>No YouTube playlists found or fetched yet.</p>}
      </div>
    </>
  );
}

export default ServicesPage;