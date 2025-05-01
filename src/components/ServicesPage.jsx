import React, { useState } from 'react';
import { fetchYouTubePlaylists, fetchAmazonPlaylists } from '../services/externalService';
import { fetchYouTubeTracks, fetchAmazonTracks } from '../services/migrationService';
import { createPlaylist, addTracksToPlaylist, getCurrentUserId,searchSpotifyTrack } from '../services/spotifyService'; // assuming you have this

// Updated auth URLs with state
const amazonAuthUrl = `https://www.amazon.com/ap/oa?client_id=amzn1.application-oa2-client.12947e30d18f426c820bee8a9846cf32&scope=profile&response_type=code&redirect_uri=http://localhost:8888/callback&state=amazon`;
const youtubeAuthUrl = `https://accounts.google.com/o/oauth2/auth?client_id=644871216893-utk85qa5330ngjk1tt7lab4pjbiauuk6.apps.googleusercontent.com&redirect_uri=http://localhost:8888/callback&response_type=token&scope=https://www.googleapis.com/auth/youtube.readonly&state=youtube`;

function ServicesPage({ onLogout }) {
  const [youtubePlaylists, setYouTubePlaylists] = useState([]);
  const [amazonPlaylists, setAmazonPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);



  const handleFetchYouTube = async () => {
    try {
      const playlists = await fetchYouTubePlaylists();
      setYouTubePlaylists(playlists);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleFetchAmazon = async () => {
    try {
      const playlists = await fetchAmazonPlaylists();
      setAmazonPlaylists(playlists);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleMigratePlaylist = async (service, playlistId, playlistName) => {
    try {
        setLoading(true);
        let tracks = [];

        // Fetch tracks based on the selected service
        if (service === 'youtube') {
            tracks = await fetchYouTubeTracks(playlistId); // Fetch individual tracks
        } else if (service === 'amazon') {
            tracks = await fetchAmazonTracks(playlistId);
        }

        console.log('Fetched Tracks:', tracks); // Log the fetched tracks

        const token = localStorage.getItem('spotify_access_token');
        if (!token) throw new Error("Spotify access token missing. Please login.");

        const userId = await getCurrentUserId(token);
        const playlist = await createPlaylist(token, userId, playlistName);

        const spotifyTrackIds = [];
        const unmatchedTracks = []; // To store tracks that couldn't be matched

        for (const track of tracks) {
            let matchedTrack = null;

            // Try searching with the first word
            const firstWord = track.title.split(' ')[0];
            matchedTrack = await searchSpotifyTrack(token, { title: firstWord });

            // If no match, try searching with the first two words
            if (!matchedTrack && track.title.split(' ').length > 1) {
                const firstTwoWords = track.title.split(' ').slice(0, 2).join(' ');
                matchedTrack = await searchSpotifyTrack(token, { title: firstTwoWords });
            }

            // If still no match, log the track as unmatched
            if (matchedTrack) {
                spotifyTrackIds.push(matchedTrack.id);
            } else {
                unmatchedTracks.push(track.title); // Add unmatched track to the list
                console.warn(`No match found for track: ${track.title}`);
            }
        }

        if (spotifyTrackIds.length > 0) {
            await addTracksToPlaylist(token, playlist.id, spotifyTrackIds);
            alert(`Successfully migrated "${playlistName}" to Spotify!`);
        } else {
            alert(`No tracks could be matched for "${playlistName}".`);
        }

        // Log or display unmatched tracks
        if (unmatchedTracks.length > 0) {
            console.warn('Unmatched Tracks:', unmatchedTracks);
            alert(`The following tracks could not be matched:\n${unmatchedTracks.join('\n')}`);
        }
    } catch (error) {
        alert(error.message);
    } finally {
        setLoading(false);
    }
};

  return (
    <div className="services-container">
      <h1>Connect to Services</h1>
      <p>Select a service to migrate your playlists:</p>

      <div>
        <a href={amazonAuthUrl} className="service-button">Connect to Amazon</a>
        <button onClick={handleFetchAmazon} disabled={loading}>
          Fetch Amazon Playlists
        </button>
        {amazonPlaylists.length > 0 && (
          <div>
            <h3>Amazon Playlists</h3>
            <ul>
              {amazonPlaylists.map((pl) => (
                <li key={pl.id}>
                  {pl.name} ({pl.trackCount} tracks)
                  <button onClick={() => handleMigratePlaylist('amazon', pl.id, pl.name)} disabled={loading}>
                    Migrate to Spotify
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <a href={youtubeAuthUrl} className="service-button">Connect to YouTube</a>
        <button onClick={handleFetchYouTube} disabled={loading}>
          Fetch YouTube Playlists
        </button>
        {youtubePlaylists.length > 0 && (
          <div>
            <h3>YouTube Playlists</h3>
            <ul>
              {youtubePlaylists.map((pl) => (
                <li key={pl.id}>
                  {pl.name} ({pl.trackCount} tracks)
                  <button onClick={() => handleMigratePlaylist('youtube', pl.id, pl.name)} disabled={loading}>
                    Migrate to Spotify
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button onClick={onLogout} className="logout-button">Logout</button>
    </div>
  );
}

export default ServicesPage;
