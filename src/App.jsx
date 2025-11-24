// new commit with tags

// src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Modal from 'react-modal'; // Import react-modal

// Import Components
import LoginPage from './components/LoginPage';
import Spotify from './components/Spotify';
import ServicesPage from './components/ServicesPage';
import Callback from './components/Callback';
import Layout from './components/Layout';
import CreatePlaylistPage from './components/CreatePlaylistPage';

// Import Services / Utils
import { getUserId } from './services/spotifyService'; // Assuming path is correct

// --- IMPORTANT: Set Modal App Element ---
// This should match the ID of your main app container in public/index.html
// Do this ONCE, outside the component function.
Modal.setAppElement('#root');
// ---

function App() {
    const [token, setToken] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    // --- Logout Handler ---
    const handleLogout = useCallback(() => {
        console.log("Logging out...");
        setToken(null);
        setUserId(null);
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_token_expires');
        localStorage.removeItem('amazon_access_token');
        localStorage.removeItem('youtube_access_token');
        setIsInitializing(false);
    }, []);

    // --- Centralized API Error Handler ---
    const handleApiError = useCallback((error, logoutCallback) => {
        console.error("Global API Error Handler Caught:", error);
        const message = String(error?.message || '').toLowerCase();

        if (message.includes('401') || message.includes('403') || message.includes('token') || message.includes('unauthorized') || message.includes('invalid access token')) {
            if (localStorage.getItem('spotify_access_token')) {
                 alert(`Authentication error: ${error.message}.\nYour session may have expired. Logging out.`);
                 // Ensure logoutCallback is callable before invoking
                 if (typeof logoutCallback === 'function') {
                     logoutCallback();
                 } else {
                     console.warn("logoutCallback not provided or not a function in handleApiError");
                     // Attempt default logout if callback is missing
                     handleLogout(); // Call handleLogout defined in App scope
                 }
            }
        } else {
             alert(`An API error occurred:\n${error.message}\n\nPlease try again or check the console for details.`);
        }
    // Add handleLogout as a dependency since it's used via logoutCallback
    }, [handleLogout]); // Dependency added

    // --- Check Token on Initial Load & Expiry ---
    useEffect(() => {
        console.log("App initializing: Checking token...");
        const storedToken = localStorage.getItem('spotify_access_token');
        const expiryTime = localStorage.getItem('spotify_token_expires');
        let validTokenFound = false;

        if (storedToken && expiryTime && Date.now() < parseInt(expiryTime, 10)) {
            console.log("Found valid token in localStorage.");
            setToken(storedToken);
            validTokenFound = true;
        } else if (storedToken) {
            console.log("Token found but expired or expiry time missing.");
            handleLogout();
        } else {
            console.log("No token found in localStorage.");
        }

        if (!validTokenFound) {
            setIsInitializing(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleLogout]); // handleLogout is stable due to its own useCallback

    // --- Fetch User ID once token is set ---
    useEffect(() => {
        if (token && !userId) {
            console.log("Token set, fetching User ID...");
            getUserId(token)
                .then(id => {
                    console.log("User ID fetched:", id);
                    setUserId(id);
                    setIsInitializing(false);
                })
                .catch(err => {
                    console.error("Failed to get User ID in App:", err);
                    handleApiError(err, handleLogout); // Pass handleLogout as the callback
                    setIsInitializing(false);
                });
        } else if (!token) {
            setUserId(null);
            if (isInitializing) setIsInitializing(false);
        }
    // handleApiError and handleLogout are memoized, safe to include
    }, [token, userId, handleApiError, handleLogout, isInitializing]);

    // --- Playlist Refresh Trigger ---
    const triggerPlaylistRefresh = useCallback(() => {
        console.log("Triggering playlist refresh...");
        setRefreshKey(oldKey => oldKey + 1);
    }, []);


    // --- Render Logic ---
    if (isInitializing) {
        return <div className="loading-message">Initializing Application...</div>;
    }

    return (
        <Router>
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/" replace />} />
                <Route path="/callback" element={<Callback />} />

                {/* Protected Routes */}
                <Route
                    path="/"
                    element={token ? <Layout onLogout={handleLogout} /> : <Navigate to="/login" replace />}
                >
                    <Route
                        index
                        element={
                            <Spotify
                                key={refreshKey} // Use key to force remount on refresh
                                token={token}
                                onLogout={handleLogout}
                                // Pass central error handler if Spotify needs it directly
                                // handleApiError={handleApiError}
                            />
                        }
                     />
                    <Route
                        path="connect"
                        element={
                            <ServicesPage
                                // Pass props if needed, e.g.:
                                // handleApiError={handleApiError}
                                // onLogout={handleLogout}
                             />
                        }
                    />
                    <Route
                        path="create"
                        element={
                            <CreatePlaylistPage
                                token={token}
                                currentUserId={userId}
                                onLogout={handleLogout}
                                handleApiError={handleApiError} // Pass error handler
                                refreshPlaylists={triggerPlaylistRefresh}
                            />
                        }
                    />
                    {/* Add other protected routes here */}
                </Route>

                {/* Fallback Route */}
                <Route path="*" element={<Navigate to={token ? "/" : "/login"} replace />} />
            </Routes>
        </Router>
    );
}

export default App;