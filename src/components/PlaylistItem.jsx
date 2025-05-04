// src/components/PlaylistItem.jsx
import React, { useState } from 'react';
import './PlaylistItem.css'; // Create or update this CSS file

const moodOptions = ['Angry', 'Calm', 'Excited', 'Happy', 'Sad'];

function PlaylistItem({
    playlist,
    isMenuActive,           // Is this item's ACTION dropdown menu active?
    setActiveMenu,          // Function to set this item's menu active
    clearActiveMenu,        // Function to clear the active menu
    isTrackViewActive,      // Is the track view panel currently showing THIS playlist's tracks?
    onViewTracks,           // Function to trigger loading tracks in the separate panel
    onShuffle,              // Function to trigger shuffle
    onExport,               // Function to trigger export
    onClean,                // Function to trigger clean
    // isLoadingTracks is now handled by the parent and shown in the TrackListView panel
    isShufflingThis,        // Is this specific playlist currently shuffling?
    isExportingThis,        // Is this specific playlist currently exporting?
    isCleaningThis,         // Is this specific playlist currently cleaning?
    isAnyActionRunning,     // Is *any* playlist action (shuffle, export, clean) running?
}) {
    const [showMoodSelector, setShowMoodSelector] = useState(false);
    const [selectedMood, setSelectedMood] = useState(moodOptions[0]);

    // Item is considered "busy" if an action (shuffle, export, clean) is running *on this specific item*
    const isBusyThisItem = isShufflingThis || isExportingThis || isCleaningThis;

    const handleItemClick = (e) => {
         // Prevent click event from bubbling if clicking on buttons inside later
        // e.stopPropagation();

        // Allow opening menu ONLY if no other playlist action is running globally
        if (!isAnyActionRunning) {
            if (isMenuActive) {
                clearActiveMenu();
                setShowMoodSelector(false); // Close mood selector if menu is closed
            } else {
                setActiveMenu(); // Make this item's menu active
            }
        } else {
            console.log("Action already running on another playlist, preventing menu toggle.");
            // Optionally provide visual feedback that interaction is blocked
        }
    };

    const handleViewClick = (e) => {
        e.stopPropagation(); // Prevent item click handler
        // Allow viewing tracks ONLY if no action is running on *this specific* playlist
        if (!isBusyThisItem) {
            onViewTracks();
            // Menu will be closed by parent component when track view state changes
        } else {
            console.log("Action running on this playlist, preventing view tracks click.");
        }
    };

    const handleShuffleClick = (e) => {
        e.stopPropagation();
        if (!isBusyThisItem) {
            setShowMoodSelector(true); // Show mood selector
        }
    };

    const handleConfirmShuffle = (e) => {
        e.stopPropagation();
        if (selectedMood && !isBusyThisItem) {
            onShuffle(selectedMood);
            // Menu and mood selector will be closed by parent state changes initiating shuffle
        }
    };

    const handleCancelShuffle = (e) => {
        e.stopPropagation();
        setShowMoodSelector(false);
    };

    const handleExportClick = (e) => {
        e.stopPropagation();
        if (!isBusyThisItem) {
            onExport();
            // Menu will be closed by parent state changes initiating export
        }
    };

    const handleCleanClick = (e) => {
        e.stopPropagation();
        if (!isBusyThisItem) {
            onClean();
            // Menu will be closed by parent state changes initiating clean
        }
    };

    // Determine overall item class for styling
    const itemClasses = [
        'playlist-item',
        isMenuActive ? 'menu-active' : '',
        isTrackViewActive ? 'tracks-active' : '', // Style differently if its tracks are shown
        isBusyThisItem ? 'busy' : '',           // Style if an action runs on THIS item
        isAnyActionRunning && !isBusyThisItem ? 'disabled-externally' : '', // Style if another item is busy
    ].filter(Boolean).join(' ');


    return (
        <li className={itemClasses}>
            {/* Main Playlist Info - Click triggers menu (if not busy elsewhere) */}
            <div className="playlist-info" onClick={handleItemClick} title={playlist.name}>
                 <span className="playlist-name">{playlist.name}</span>
                 <span className="playlist-track-count">({playlist.tracks?.total ?? 0} tracks)</span>
                 {/* Indicator for action running on THIS item */}
                 {isBusyThisItem && <span className="status-indicator busy">Busy...</span>}
                  {/* Indicator for tracks being viewed */}
                 {isTrackViewActive && <span className="status-indicator viewing">Viewing</span>}
                 {/* Dropdown arrow - visual only */}
                 <span className="dropdown-indicator">{isMenuActive ? '▲' : '▼'}</span>
            </div>

            {/* Dropdown Menu - Shows when menu active AND no action is running on this item */}
            {isMenuActive && !isBusyThisItem && (
                <div className="playlist-dropdown">
                    {/* View Tracks Button - Always visible in dropdown, disabled if busy */}
                    <button onClick={handleViewClick} disabled={isBusyThisItem} className="action-button view-button">
                        {/* Text changes based on whether tracks are already active */}
                        {isTrackViewActive ? 'Hide Tracks' : 'View Tracks'}
                     </button>

                     {/* Show actions only if mood selector is NOT open */}
                     {!showMoodSelector && (
                        <>
                             <button onClick={handleShuffleClick} disabled={isBusyThisItem} className="action-button shuffle-button">
                                Shuffle...
                            </button>
                             <button onClick={handleExportClick} disabled={isBusyThisItem} className="action-button export-button">
                                Export CSV
                            </button>
                             <button onClick={handleCleanClick} disabled={isBusyThisItem} className="action-button clean-button">
                                Clean Duplicates
                            </button>
                        </>
                    )}

                    {/* Mood Selector - Shows within dropdown area if Shuffle was clicked */}
                    {showMoodSelector && (
                        <div className="mood-selector">
                            <label htmlFor={`mood-select-${playlist.id}`}>Select Mood:</label>
                            <select
                                id={`mood-select-${playlist.id}`}
                                value={selectedMood}
                                onChange={(e) => setSelectedMood(e.target.value)}
                                disabled={isShufflingThis} // Specifically disable during shuffle
                                onClick={(e) => e.stopPropagation()} // Prevent closing dropdown when clicking select
                            >
                                {moodOptions.map(mood => (
                                    <option key={mood} value={mood}>{mood}</option>
                                ))}
                            </select>
                            <div className="mood-confirm-buttons">
                                <button onClick={handleConfirmShuffle} disabled={isShufflingThis} className="confirm-button">
                                    {isShufflingThis ? 'Shuffling...' : 'Confirm'}
                                </button>
                                <button onClick={handleCancelShuffle} disabled={isShufflingThis} className="cancel-button">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
             {/* Removed Track List Display from here */}
             {/* Removed inline loading indicator for tracks */}
        </li>
    );
}

export default PlaylistItem;