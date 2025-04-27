// src/Spotify.jsx
import React, { useEffect, useState } from 'react';
import { fetchUser, fetchPlaylists, fetchPlaylistTracks, createPlaylist, addTracksToPlaylist } from './services/spotifyService';
import { sendPlaylistToShuffle } from './services/shuffleService';
import PlaylistList from './components/PlaylistList';
import TrackList from './components/TrackList';

const Spotify = () => {
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  useEffect(() => {
    const hash = window.location.hash;
    let _token = localStorage.getItem('token');

    if (!_token && hash) {
      _token = hash.substring(1).split('&').find(elem => elem.startsWith('access_token')).split('=')[1];
      localStorage.setItem('token', _token);
      window.location.hash = '';
    }

    if (_token) {
      setToken(_token);
      fetchUser(_token).then(data => setUserId(data.id));
    }
  }, []);

  const handleFetchPlaylists = async () => {
    const items = await fetchPlaylists(token);
    setPlaylists(items);
  };

  const handleSelectPlaylist = async (playlist) => {
    setSelectedPlaylist(playlist);
    const items = await fetchPlaylistTracks(token, playlist.id);
    const simplifiedTracks = items.map(t => ({
      id: t.track.id,
      name: t.track.name,
    }));
    setTracks(simplifiedTracks);
  };

  const handleShuffle = async () => {
    try {
      const shuffled = await sendPlaylistToShuffle(tracks);
      const newPlaylist = await createPlaylist(token, userId, `${selectedPlaylist.name} (Shuffled)`);
      const ids = shuffled.map(t => t.id);
      await addTracksToPlaylist(token, newPlaylist.id, ids);
      alert('Shuffled playlist created successfully!');
    } catch (err) {
      console.error(err);
      alert('Something went wrong during shuffle.');
    }
  };

  const logout = () => {
    setToken('');
    localStorage.removeItem('token');
  };

  if (!token) {
    return (
      <a href={`https://accounts.spotify.com/authorize?client_id=1d71d19478764af89e8836b6b5240bd3&redirect_uri=http://localhost:8888/callback&response_type=token&scope=playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public user-library-read user-library-modify user-read-private user-read-email`}>
        Login to Spotify
      </a>
    );
  }

  return (
    <div>
      <h1>Smart Shuffler</h1>
      <button onClick={logout}>Logout</button>
      <button onClick={handleFetchPlaylists}>Fetch Playlists</button>

      <PlaylistList playlists={playlists} onSelect={handleSelectPlaylist} />

      {tracks.length > 0 && (
        <>
          <TrackList tracks={tracks} />
          <button onClick={handleShuffle}>Shuffle This Playlist</button>
        </>
      )}
    </div>
  );
};

export default Spotify;
