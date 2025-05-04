// src/components/PlaylistItem.jsx
import React, { useState } from 'react';

const moodOptions = ['Angry', 'Calm', 'Excited', 'Happy', 'Sad'];

function PlaylistItem({
    playlist,
    isActive,            // Is this item's dropdown/details currently active?
    setActive,           // Function to set this item as active
    clearActive,         // Function to clear the active item
    onViewTracks,        // Function to request loading tracks for this playlist
    onShuffle,           // Function to trigger shuffle with a selected mood
    onExport,            // Function to trigger export
    onClean,             // Function to trigger clean (remove duplicates)
    onCloseTracks,       // Function to close the track view
    tracksData,          // Track data for this playlist (if loaded and active) { items: [] }
    isLoadingTracks,     // Is this playlist currently loading tracks?
    isShufflingThis,     // Is this playlist currently shuffling?
    isExportingThis,     // Is this playlist currently exporting?
    isCleaningThis,      // Is this playlist currently cleaning?
}) {
    const [showMoodSelector, setShowMoodSelector] = useState(false);
    const [selectedMood, setSelectedMood] = useState(moodOptions[0]); // Default to first mood

    // Combine all loading states for disabling actions
    const isBusy = isLoadingTracks || isShufflingThis || isExportingThis || isCleaningThis;

    const handleItemClick = () => {
        if (isActive) {
            // If already active, clicking again could toggle dropdown (or do nothing)
            // For now, let's keep it simple: clicking sets active
        } else {
            setActive(); // Make this item active (opens dropdown)
            setShowMoodSelector(false); // Ensure mood selector is closed if dropdown was reopened
        }
    };

    const handleViewClick = () => {
        onViewTracks();
        // Keep dropdown open while tracks load/show? Or close? Let's close it.
        // clearActive(); // Decided against closing dropdown automatically
        setShowMoodSelector(false);
    };

    const handleShuffleClick = () => {
        setShowMoodSelector(true); // Show mood selector below dropdown
    };

    const handleConfirmShuffle = () => {
        if (selectedMood) {
            onShuffle(selectedMood); // Pass playlistId, name (handled in parent), and mood
            setShowMoodSelector(false);
            clearActive(); // Close dropdown after initiating shuffle
        }
    };

    const handleCancelShuffle = () => {
        setShowMoodSelector(false);
    };

    const handleExportClick = () => {
        onExport();
        clearActive(); // Close dropdown after initiating export
    };

    const handleCleanClick = () => {
        onClean();
        clearActive(); // Close dropdown after initiating clean
    };

    const handleCloseTracksClick = () => {
        onCloseTracks(); // Parent handles clearing tracks and active state
    }

    return (
        <li className={`playlist-item ${isActive ? 'active' : ''} ${isBusy ? 'busy' : ''}`}>
            {/* Main Playlist Info - Clickable Area */}
            <div className="playlist-info" onClick={handleItemClick}>
                <span>{playlist.name} ({playlist.tracks?.total ?? 0} tracks)</span>
                {/* Optional: Add an icon indicator for dropdown */}
                <span className="dropdown-indicator">{isActive ? '▲' : '▼'}</span>
            </div>

            {/* Dropdown Menu - Shows when active */}
            {isActive && (
                <div className="playlist-dropdown">
                    <button onClick={handleViewClick} disabled={isBusy || isLoadingTracks}>
                        {isLoadingTracks ? 'Loading...' : 'View Tracks'}
                    </button>
                    <button onClick={handleShuffleClick} disabled={isBusy}>
                        {isShufflingThis ? '...' : 'Shuffle'}
                    </button>
                    <button onClick={handleExportClick} disabled={isBusy}>
                        {isExportingThis ? '...' : 'Export'}
                    </button>
                    <button onClick={handleCleanClick} disabled={isBusy}>
                        {isCleaningThis ? '...' : 'Clean'}
                    </button>

                    {/* Mood Selector - Shows within dropdown area if Shuffle was clicked */}
                    {showMoodSelector && !isBusy && (
                        <div className="mood-selector">
                            <select
                                value={selectedMood}
                                onChange={(e) => setSelectedMood(e.target.value)}
                                disabled={isShufflingThis}
                            >
                                {moodOptions.map(mood => (
                                    <option key={mood} value={mood}>{mood}</option>
                                ))}
                            </select>
                            <button onClick={handleConfirmShuffle} disabled={isShufflingThis}>
                                {isShufflingThis ? 'Shuffling...' : 'Confirm'}
                            </button>
                            <button onClick={handleCancelShuffle} disabled={isShufflingThis}>
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Track List Display - Shows below the item if active and tracks are loaded */}
            {/* Note: isActive ensures this only shows for the correct item */}
            {isActive && tracksData && !isLoadingTracks && (
                <div className="track-details inline-track-view">
                    <div className="track-view-header">
                        <h3>Tracks in "{playlist.name}"</h3>
                        <button onClick={handleCloseTracksClick} className="close-button">×</button>
                    </div>
                    <ul>
                        {tracksData.items.length > 0 ? (
                            tracksData.items.map((item, index) => (
                                item?.track ? (
                                    <li key={item.track.id ? `${item.track.id}-${index}` : `track-${index}`}>
                                        <p><strong>{item.track.name || 'N/A'}</strong> by {item.track.artists?.map(artist => artist.name).join(', ') || 'N/A'}</p>
                                        {/* <p><small>Album: {item.track.album?.name || 'N/A'}</small></p> */}
                                    </li>
                                ) : <li key={`missing-${index}`}>Track data missing</li>
                            ))
                        ) : (
                            <li>No tracks found in this playlist.</li>
                        )}
                    </ul>
                </div>
            )}
             {/* Show loading indicator specifically for tracks below item */}
             {isActive && isLoadingTracks && (
                <div className="inline-loading">Loading tracks...</div>
             )}
        </li>
    );
}

export default PlaylistItem;