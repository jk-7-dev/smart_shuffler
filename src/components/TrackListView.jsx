// src/components/TrackListView.jsx
import React from 'react';
import './TrackListView.css'; // Create this CSS file

function TrackListView({ playlistName, tracks, onClose, isLoading }) {

    if (isLoading) {
        return (
            <div className="track-list-view loading">
                 <h2>Loading tracks for "{playlistName}"...</h2>
                {/* Optional: Add a spinner */}
            </div>
        );
    }

    if (!tracks) {
        // This shouldn't normally be shown if isLoading handles the initial state,
        // but good as a fallback or if loading finishes with no data.
        return null; // Or a "No tracks to display" message if preferred
    }

    return (
        <div className="track-list-view">
            <div className="track-view-header">
                <h2>Tracks in "{playlistName}"</h2>
                <button onClick={onClose} className="close-button" title="Close track view">×</button>
            </div>
            <ul className="track-scroll-list">
                {tracks.length > 0 ? (
                    tracks.map((item, index) => (
                        item?.track ? (
                            <li key={item.track.id ? `${item.track.id}-${index}` : `track-${index}`} className="track-item">
                                <span className="track-name">{item.track.name || 'N/A'}</span>
                                <span className="track-artist">{item.track.artists?.map(artist => artist.name).join(', ') || 'N/A'}</span>
                                {/* <span className="track-album">{item.track.album?.name || 'N/A'}</span> */}
                            </li>
                        ) : <li key={`missing-${index}`} className="track-item missing">Track data unavailable</li>
                    ))
                ) : (
                    <li className="track-item empty">No tracks found in this playlist.</li>
                )}
            </ul>
        </div>
    );
}

export default TrackListView;