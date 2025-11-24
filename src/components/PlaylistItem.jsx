// src/components/PlaylistItem.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Webcam from "react-webcam";
import Modal from 'react-modal';
import './PlaylistItem.css'; // Ensure styles are updated/created

const moodOptions = ['Angry', 'Calm', 'Excited', 'Happy', 'Sad'];

const customModalStyles = {
    content: {
        top: '50%', left: '50%', right: 'auto', bottom: 'auto', marginRight: '-50%',
        transform: 'translate(-50%, -50%)', backgroundColor: '#282828', color: '#ffffff',
        border: '1px solid #535353', borderRadius: '8px', padding: '25px 35px 25px 25px',
        minWidth: '460px', maxWidth: '550px', textAlign: 'center', minHeight: '300px',
        position: 'relative', height: 'auto', overflowY: 'auto' // Allow resizing
    },
    overlay: { backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1000 },
};

function PlaylistItem({
    playlist,
    isMenuActive,
    setActiveMenu,
    clearActiveMenu,
    isTrackViewActive,
    onViewTracks,
    onPlayRequest,      // <-- NEW PROP for play
    isPlayingThis,      // <-- NEW PROP to indicate if this item is being played
    onShuffle,          // Handles both mood string OR image data
    onExport,
    onClean,
    isLoadingTracks,    // Loading state for viewing tracks
    isShufflingThis,    // Covers the ENTIRE shuffle process (incl. prediction)
    isExportingThis,
    isCleaningThis,
    isAnyActionRunning, // Global busy flag for ANY playlist action (from parent)
}) {
    // --- Component State ---
    const [showManualMoodSelector, setShowManualMoodSelector] = useState(false);
    const [selectedManualMood, setSelectedManualMood] = useState(moodOptions[0]);
    const [isWebcamModalOpen, setIsWebcamModalOpen] = useState(false);
    const [isWebcamReady, setIsWebcamReady] = useState(false);
    const webcamRef = useRef(null);

    // --- Modal Specific State ---
    const [modalStatus, setModalStatus] = useState('idle'); // 'idle', 'processing', 'success', 'error'
    const [modalMessage, setModalMessage] = useState('');

    // Timer ref for auto-closing modal on success
    const successCloseTimerRef = useRef(null);

    // Determine if THIS specific item is busy with any of its primary actions
    const isBusyThisItem = isShufflingThis || isExportingThis || isCleaningThis || isPlayingThis; // Added isPlayingThis

    // Determine if this item should be disabled because another item is busy
    // isAnyActionRunning is true if any loading action OR any play action is active globally
    const isDisabledGlobally = isAnyActionRunning && !isBusyThisItem;


    // --- Modal Control ---
    const openWebcamModal = useCallback((e) => {
        e.stopPropagation();
        // Disable if this item is busy OR any other action is running globally
        if (isBusyThisItem || isAnyActionRunning) return;
        setShowManualMoodSelector(false);
        setIsWebcamReady(false);
        setModalStatus('idle');
        setModalMessage('');
        setIsWebcamModalOpen(true);
        clearActiveMenu();
    }, [isBusyThisItem, isAnyActionRunning, clearActiveMenu]);

    const closeWebcamModal = useCallback(() => {
        if (successCloseTimerRef.current) {
            clearTimeout(successCloseTimerRef.current);
            successCloseTimerRef.current = null;
        }
        setIsWebcamModalOpen(false);
        setIsWebcamReady(false);
        setModalStatus('idle');
        setModalMessage('');
    }, []);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => { if (successCloseTimerRef.current) clearTimeout(successCloseTimerRef.current); };
    }, []);


    // --- Manual Shuffle ---
    const handleToggleManualShuffle = (e) => {
        e.stopPropagation();
        if (isBusyThisItem || isAnyActionRunning) return;
        setShowManualMoodSelector(prev => !prev);
    };
    const handleConfirmManualShuffle = useCallback(async (e) => {
        e.stopPropagation();
        if (isBusyThisItem || isAnyActionRunning) return;
        await onShuffle(selectedManualMood);
        setShowManualMoodSelector(false);
        clearActiveMenu();
    }, [onShuffle, selectedManualMood, isBusyThisItem, isAnyActionRunning, clearActiveMenu]);

    // --- Webcam Shuffle ---
    const handleCaptureAndShuffle = useCallback(async (e) => {
        e.stopPropagation();
        if (!webcamRef.current || !isWebcamReady || isBusyThisItem || isAnyActionRunning) {
            alert("Webcam not ready or another action is already in progress."); return;
        }
        const screenshot = webcamRef.current.getScreenshot();
        if (!screenshot) { alert("Failed to capture image."); return; }

        setModalStatus('processing');
        setModalMessage('Processing facial mood and shuffling playlist...');

        try {
            await onShuffle(screenshot);
            setModalStatus('success');
            setModalMessage('Shuffle initiated successfully!');
            successCloseTimerRef.current = setTimeout(closeWebcamModal, 2000);
        } catch (error) {
            console.error("Error captured in PlaylistItem during capture/shuffle:", error);
            setModalStatus('error');
            setModalMessage(`Error: ${error.message || 'Unknown error occurred during shuffle.'}`);
        }
    }, [webcamRef, isWebcamReady, isBusyThisItem, isAnyActionRunning, onShuffle, closeWebcamModal]);

    // --- Other Actions ---
    const handleItemClick = useCallback((e) => {
        // The guard 'if (isAnyActionRunning) return;' is handled by the caller in JSX.
        // If we are here, global isAnyActionRunning is false.
        // Prevent menu toggle if this item is shuffling (as per original logic derivation)
        // Other 'isBusyThisItem' states (like playing) might still allow menu toggle,
        // but their actions within the menu will be disabled.
        if (isShufflingThis) {
            return;
        }
        if (isMenuActive) { clearActiveMenu(); setShowManualMoodSelector(false); }
        else { setActiveMenu(); }
    }, [isShufflingThis, isMenuActive, clearActiveMenu, setActiveMenu]);


    const handleViewClick = useCallback((e) => {
        e.stopPropagation();
        if (isBusyThisItem || isAnyActionRunning) return;
        onViewTracks();
        // No clearActiveMenu() here as viewing tracks is not a final menu action
    }, [isBusyThisItem, isAnyActionRunning, onViewTracks]);

    const handleSimpleAction = useCallback((actionFn) => (e) => {
        e.stopPropagation();
        if (isBusyThisItem || isAnyActionRunning) return;
        actionFn();
        clearActiveMenu();
    }, [isBusyThisItem, isAnyActionRunning, clearActiveMenu]);


    // --- Styling Classes & Busy Text ---
    const itemClasses = [
        'playlist-item',
        isMenuActive ? 'menu-active' : '',
        isTrackViewActive ? 'tracks-active' : '',
        isBusyThisItem ? 'busy' : '',
        isDisabledGlobally ? 'disabled-externally' : '',
    ].filter(Boolean).join(' ');

    const busyText = isPlayingThis ? 'Playing...' :
        isShufflingThis ? 'Shuffling...' :
            isExportingThis ? 'Exporting...' :
                isCleaningThis ? 'Cleaning...' : 'Busy...';


    // --- Determine Modal Content ---
    let modalContent = null;
    if (modalStatus === 'idle') {
        modalContent = (
            <>
                <p>Position your face clearly in the frame.</p>
                <div className="webcam-modal-content">
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        width={426} height={320}
                        videoConstraints={{ width: 426, height: 320, facingMode: "user" }}
                        className="webcam-element-modal"
                        onUserMedia={() => { setIsWebcamReady(true); }}
                        onUserMediaError={(err) => {
                            console.error("Webcam Error:", err); setIsWebcamReady(false);
                            alert("Could not access webcam. Please check browser permissions.");
                            closeWebcamModal();
                        }}
                    />
                    {!isWebcamReady && <p className="webcam-loading-text">Initializing webcam...</p>}
                    <button
                        onClick={handleCaptureAndShuffle}
                        disabled={!isWebcamReady || isShufflingThis || isAnyActionRunning} // Check parent's isShufflingThis and global isAnyActionRunning
                        className="capture-button modal-capture"
                    >
                        {isShufflingThis ? 'Busy...' : 'Capture & Initiate Shuffle'}
                    </button>
                </div>
            </>
        );
    } else { // processing, success, or error
        modalContent = (
            <div className="webcam-modal-content processing-content">
                <p className={`processing-text status-${modalStatus}`}>{modalMessage}</p>
                {modalStatus === 'processing' && (<p className="processing-subtext">Please wait...</p>)}
            </div>
        );
    }

    return (
        <>
            <li className={itemClasses}>
                {/* Main Playlist Info Area */}
                <div className="playlist-info" onClick={(e) => {
                    if (isAnyActionRunning && !isBusyThisItem) return; // Prevent opening menu if a *different* item/action is busy
                    handleItemClick(e);
                }} title={playlist.name}>
                    <span className="playlist-name">{playlist.name}</span>
                    <span className="playlist-track-count">({playlist.tracks?.total ?? 0} tracks)</span>
                    {isBusyThisItem && <span className="status-indicator busy">{busyText}</span>}
                    {isTrackViewActive && !isBusyThisItem && <span className="status-indicator viewing">Viewing</span>}
                    <span className="dropdown-indicator">{isMenuActive ? '▲' : '▼'}</span>
                </div>

                {/* Dropdown Menu */}
                {isMenuActive && (
                    <div className="playlist-dropdown professional-dropdown">
                        {/* Play Playlist Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isBusyThisItem || isAnyActionRunning) return;
                                onPlayRequest();
                                clearActiveMenu();
                            }}
                            disabled={isBusyThisItem || isAnyActionRunning}
                            className="action-button dropdown-item"
                        >
                            {isPlayingThis ? 'Playing...' : '▶️ Play Playlist'}
                        </button>

                        {/* View Tracks */}
                        <button onClick={handleViewClick}
                            disabled={isBusyThisItem || isLoadingTracks || isAnyActionRunning}
                            className="action-button dropdown-item">
                            {isLoadingTracks ? 'Loading...' : (isTrackViewActive ? 'Hide Tracks' : 'View Tracks')}
                        </button>

                        {/* Shuffle Manually */}
                        <button onClick={handleToggleManualShuffle}
                            disabled={isBusyThisItem || isAnyActionRunning}
                            className="action-button dropdown-item" aria-expanded={showManualMoodSelector}>
                            Shuffle Manually...
                        </button>
                        {showManualMoodSelector && !isBusyThisItem && ( //Also check !isAnyActionRunning for rendering this section? No, button disabled handles it.
                            <div className="manual-mood-selector indented-section">
                                <select value={selectedManualMood}
                                    onChange={(e) => setSelectedManualMood(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={isBusyThisItem || isAnyActionRunning}>
                                    {moodOptions.map(mood => (<option key={mood} value={mood}>{mood}</option>))}
                                </select>
                                <button onClick={handleConfirmManualShuffle}
                                    disabled={isBusyThisItem || isAnyActionRunning}
                                    className="confirm-button">
                                    Shuffle with '{selectedManualMood}'
                                </button>
                            </div>
                        )}

                        {/* Shuffle Webcam */}
                        <button onClick={openWebcamModal}
                            disabled={isBusyThisItem || isAnyActionRunning}
                            className="action-button dropdown-item">
                            Shuffle using Webcam...
                        </button>

                        {/* Divider */}
                        <hr className="dropdown-divider" />

                        {/* Export */}
                        <button onClick={handleSimpleAction(onExport)}
                            disabled={isBusyThisItem || isAnyActionRunning}
                            className="action-button dropdown-item">
                            {isExportingThis ? 'Exporting...' : 'Export CSV'}
                        </button>

                        {/* Clean */}
                        <button onClick={handleSimpleAction(onClean)}
                            disabled={isBusyThisItem || isAnyActionRunning}
                            className="action-button dropdown-item">
                            {isCleaningThis ? 'Cleaning...' : 'Clean Duplicates'}
                        </button>
                    </div>
                )}
            </li>

            {/* --- Webcam Modal --- */}
            <Modal
                isOpen={isWebcamModalOpen}
                onRequestClose={closeWebcamModal}
                style={customModalStyles}
                contentLabel="Webcam Mood Prediction"
                closeTimeoutMS={200}
            >
                {/* Top-Right Close Button */}
                <button
                    onClick={closeWebcamModal}
                    className="modal-close-button top-right"
                    aria-label="Close webcam modal"
                    disabled={modalStatus === 'success'} // Allow closing unless successful auto-close phase
                >
                    &times;
                </button>
                <h2>Detect Mood for Shuffle</h2>
                {modalContent}
            </Modal>
        </>
    );
}

export default PlaylistItem;