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
    onShuffle,          // Handles both mood string OR image data
    onExport,
    onClean,
    isLoadingTracks,    // Loading state for viewing tracks
    isShufflingThis,    // Covers the ENTIRE shuffle process (incl. prediction)
    isExportingThis,
    isCleaningThis,
    isAnyActionRunning, // Global busy flag for ANY playlist action
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

    // Determine if THIS specific item is busy
    const isBusyThisItem = isShufflingThis || isExportingThis || isCleaningThis;
    // Global busy state for disabling interactions on other items
    const isAnyActionIncludingShuffleRunning = isAnyActionRunning || isShufflingThis;

    // --- Modal Control ---
    const openWebcamModal = useCallback((e) => {
        e.stopPropagation();
        if (isBusyThisItem) return;
        setShowManualMoodSelector(false);
        setIsWebcamReady(false);
        setModalStatus('idle');
        setModalMessage('');
        setIsWebcamModalOpen(true);
        clearActiveMenu();
    }, [isBusyThisItem, clearActiveMenu]);

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
        if (isBusyThisItem) return;
        setShowManualMoodSelector(prev => !prev);
     };
    const handleConfirmManualShuffle = useCallback(async (e) => {
        e.stopPropagation();
        if (isBusyThisItem) return;
        await onShuffle(selectedManualMood);
        setShowManualMoodSelector(false);
        clearActiveMenu();
    }, [onShuffle, selectedManualMood, isBusyThisItem, clearActiveMenu]);

    // --- Webcam Shuffle ---
    const handleCaptureAndShuffle = useCallback(async (e) => {
        e.stopPropagation();
        if (!webcamRef.current || !isWebcamReady || isBusyThisItem) {
            alert("Webcam not ready or another action is already in progress."); return;
        }
        const screenshot = webcamRef.current.getScreenshot();
        if (!screenshot) { alert("Failed to capture image."); return; }

        setModalStatus('processing');
        setModalMessage('Processing facial mood and shuffling playlist...');

        try {
            // Call parent shuffle handler - it handles prediction AND shuffling
            await onShuffle(screenshot);
            // --- Success State ---
            setModalStatus('success');
            setModalMessage('Shuffle initiated successfully!');
            successCloseTimerRef.current = setTimeout(closeWebcamModal, 2000); // Auto-close
        } catch (error) {
            // --- Error State ---
            console.error("Error captured in PlaylistItem during capture/shuffle:", error);
             setModalStatus('error');
             setModalMessage(`Error: ${error.message || 'Unknown error occurred during shuffle.'}`);
             // Keep modal open on error
        }
        // isShufflingThis prop reflects the ongoing process in parent

    }, [webcamRef, isWebcamReady, isBusyThisItem, onShuffle, closeWebcamModal]);

    // --- Other Actions ---
    const handleItemClick = useCallback((e) => {
        if (isAnyActionIncludingShuffleRunning) return;
        if (isMenuActive) { clearActiveMenu(); setShowManualMoodSelector(false); }
        else { setActiveMenu(); }
     }, [isAnyActionIncludingShuffleRunning, isMenuActive, clearActiveMenu, setActiveMenu]);

    const handleViewClick = useCallback((e) => {
        e.stopPropagation();
        if (isBusyThisItem) return; onViewTracks();
     }, [isBusyThisItem, onViewTracks]);

    const handleSimpleAction = useCallback((actionFn) => (e) => {
         e.stopPropagation();
         if (isBusyThisItem) return; actionFn(); clearActiveMenu();
     }, [isBusyThisItem, clearActiveMenu]);


    // --- Styling Classes & Busy Text ---
    const itemClasses = [
        'playlist-item',
        isMenuActive ? 'menu-active' : '',
        isTrackViewActive ? 'tracks-active' : '',
        isBusyThisItem ? 'busy' : '',
        isAnyActionIncludingShuffleRunning && !isBusyThisItem ? 'disabled-externally' : '',
    ].filter(Boolean).join(' ');

    const busyText = isShufflingThis ? 'Shuffling...' :
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
                        disabled={!isWebcamReady || isShufflingThis} // Disable until ready or if parent is shuffling
                        className="capture-button modal-capture"
                    >
                         {/* Text now relies only on parent shuffling state */}
                        {isShufflingThis ? 'Busy...' : 'Capture & Initiate Shuffle'}
                    </button>
                </div>
            </>
        );
    } else { // processing, success, or error
        modalContent = (
            <div className="webcam-modal-content processing-content">
                <p className={`processing-text status-${modalStatus}`}>{modalMessage}</p>
                 {/* Subtext only shown during processing */}
                {modalStatus === 'processing' && (<p className="processing-subtext">Please wait...</p>)}
                 {/* No explicit close/cancel button shown here anymore, use the 'X' or overlay */}
            </div>
        );
    }

    return (
        <>
            <li className={itemClasses}>
                 {/* Main Playlist Info Area */}
                <div className="playlist-info" onClick={handleItemClick} title={playlist.name}>
                    <span className="playlist-name">{playlist.name}</span>
                     <span className="playlist-track-count">({playlist.tracks?.total ?? 0} tracks)</span>
                     {isBusyThisItem && <span className="status-indicator busy">{busyText}</span>}
                     {isTrackViewActive && !isBusyThisItem && <span className="status-indicator viewing">Viewing</span>}
                    <span className="dropdown-indicator">{isMenuActive ? '▲' : '▼'}</span>
                </div>

                 {/* Dropdown Menu */}
                {isMenuActive && (
                    <div className="playlist-dropdown professional-dropdown">
                         {/* View Tracks */}
                        <button onClick={handleViewClick} disabled={isBusyThisItem || isLoadingTracks || isAnyActionIncludingShuffleRunning} className="action-button dropdown-item">
                           {isLoadingTracks ? 'Loading...' : (isTrackViewActive ? 'Hide Tracks' : 'View Tracks')}
                        </button>

                         {/* Shuffle Manually */}
                        <button onClick={handleToggleManualShuffle} disabled={isBusyThisItem || isAnyActionIncludingShuffleRunning} className="action-button dropdown-item" aria-expanded={showManualMoodSelector}>
                           Shuffle Manually...
                        </button>
                        {showManualMoodSelector && !isBusyThisItem && (
                            <div className="manual-mood-selector indented-section">
                                <select value={selectedManualMood} onChange={(e) => setSelectedManualMood(e.target.value)} onClick={(e) => e.stopPropagation()} disabled={isBusyThisItem || isAnyActionIncludingShuffleRunning}>
                                    {moodOptions.map(mood => (<option key={mood} value={mood}>{mood}</option>))}
                                </select>
                                <button onClick={handleConfirmManualShuffle} disabled={isBusyThisItem || isAnyActionIncludingShuffleRunning} className="confirm-button">
                                    Shuffle with '{selectedManualMood}'
                                </button>
                            </div>
                        )}

                         {/* Shuffle Webcam */}
                        <button onClick={openWebcamModal} disabled={isBusyThisItem || isAnyActionIncludingShuffleRunning} className="action-button dropdown-item">
                           Shuffle using Webcam...
                        </button>

                         {/* Divider */}
                        <hr className="dropdown-divider" />

                          {/* Export */}
                        <button onClick={handleSimpleAction(onExport)} disabled={isBusyThisItem || isAnyActionIncludingShuffleRunning} className="action-button dropdown-item">
                            {isExportingThis ? 'Exporting...' : 'Export CSV'}
                        </button>

                          {/* Clean */}
                        <button onClick={handleSimpleAction(onClean)} disabled={isBusyThisItem || isAnyActionIncludingShuffleRunning} className="action-button dropdown-item">
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
                      // Allow closing unless successful (auto-closes) or maybe during processing? Your choice.
                     // Let's allow closing anytime except successful auto-close phase.
                     disabled={modalStatus === 'success'}
                 >
                     &times;
                 </button>

                <h2>Detect Mood for Shuffle</h2>
                {modalContent} {/* Render content based on status */}

            </Modal>
        </>
    );
}

export default PlaylistItem;