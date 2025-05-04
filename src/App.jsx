// src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import Components
import LoginPage from './components/LoginPage';
import Spotify from './components/Spotify';
import ServicesPage from './components/ServicesPage';
import Callback from './components/Callback';
import Layout from './components/Layout';
import CreatePlaylistPage from './components/CreatePlaylistPage'; // Import the new page

// Import Services / Utils (adjust path as needed)
// Assume getUserId is correctly implemented in spotifyService
import { getUserId } from './services/spotifyService';

function App() {
    const [token, setToken] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isInitializing, setIsInitializing] = useState(true); // Flag to prevent premature rendering/redirects
    const [refreshKey, setRefreshKey] = useState(0); // Key to force component remount/refresh

    // --- Logout Handler ---
    // useCallback prevents this function from changing on every render unless dependencies change
    const handleLogout = useCallback(() => {
        console.log("Logging out...");
        setToken(null);
        setUserId(null);
        // Clear all relevant localStorage items
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_token_expires');
        localStorage.removeItem('amazon_access_token'); // Clear others if used
        localStorage.removeItem('youtube_access_token');
        setIsInitializing(false); // Ensure initialization is marked as done
        // Navigation is handled declaratively by Navigate component below
    }, []); // No dependencies, this function is stable

    // --- Centralized API Error Handler ---
    // useCallback ensures stability when passed as prop
    const handleApiError = useCallback((error, logoutCallback) => {
        console.error("Global API Error Handler Caught:", error);
        const message = String(error?.message || '').toLowerCase();

        // Check for critical auth errors that require logout
        if (message.includes('401') || message.includes('403') || message.includes('token') || message.includes('unauthorized') || message.includes('invalid access token')) {
            // Avoid alert loop if logout fails somehow
            if (localStorage.getItem('spotify_access_token')) {
                 alert(`Authentication error: ${error.message}.\nYour session may have expired. Logging out.`);
                 logoutCallback(); // Use the passed logout function (handleLogout)
            }
        } else {
            // Handle other errors (e.g., rate limiting, server errors)
            // You could customize based on error status codes if available
            alert(`An API error occurred:\n${error.message}\n\nPlease try again or check the console for details.`);
            // Potentially reset specific loading states in child components if needed,
            // though that might be better handled within the component that made the call.
        }
    }, []); // Also stable, relies only on logic

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
            handleLogout(); // Clean up expired token
        } else {
            console.log("No token found in localStorage.");
            // No need to logout if already logged out state
        }

        // If a valid token was found, proceed to fetch User ID
        // If not, mark initialization as done
        if (!validTokenFound) {
            setIsInitializing(false);
        }
        // Fetching User ID will happen in the next effect if token was set

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleLogout]); // Run only once on mount, handleLogout is stable

    // --- Fetch User ID once token is set ---
    useEffect(() => {
        // Only run if we have a token but no user ID yet
        if (token && !userId) {
            console.log("Token set, fetching User ID...");
            getUserId(token)
                .then(id => {
                    console.log("User ID fetched:", id);
                    setUserId(id);
                    setIsInitializing(false); // Initialization complete after getting ID
                })
                .catch(err => {
                    console.error("Failed to get User ID in App:", err);
                    // Use the centralized error handler, which might trigger logout
                    handleApiError(err, handleLogout);
                    setIsInitializing(false); // Mark init done even on error
                });
        } else if (!token) {
            // If token becomes null (logout), ensure userId is also null
            setUserId(null);
             // If we were initializing and token disappeared, mark init done
            if (isInitializing) setIsInitializing(false);
        }
    }, [token, userId, handleApiError, handleLogout, isInitializing]); // Dependencies track state changes

    // --- Playlist Refresh Trigger ---
    // This function can be passed down to pages that create/modify playlists
    const triggerPlaylistRefresh = useCallback(() => {
        console.log("Triggering playlist refresh...");
        setRefreshKey(oldKey => oldKey + 1); // Increment key to force re-render/remount
    }, []); // Stable function


    // --- Render Logic ---

    // Show loading state while checking token/fetching user ID
    if (isInitializing) {
        return <div className="loading-message">Initializing Application...</div>; // Or a spinner component
    }

    return (
        <Router>
            <Routes>
                {/* Public Route: Login */}
                {/* Redirect to home if already logged in (token exists) */}
                <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/" replace />} />

                {/* Public Route: Callback */}
                <Route path="/callback" element={<Callback />} />

                {/* Protected Routes wrapped by Layout */}
                {/* If no token, redirect to login */}
                <Route
                    path="/"
                    element={token ? <Layout onLogout={handleLogout} /> : <Navigate to="/login" replace />}
                >
                    {/* Default route (My Playlists) */}
                    {/* Pass refreshKey to Spotify component */}
                    <Route
                        index
                        element={
                            <Spotify
                                key={refreshKey} // Use key to force remount on refresh
                                token={token}
                                onLogout={handleLogout}
                                // Pass error handler if Spotify needs to call it directly
                                // handleApiError={handleApiError}
                            />
                        }
                     />
                     {/* Connect Services route */}
                    <Route
                        path="connect"
                        element={
                            <ServicesPage
                                // Pass needed props, e.g., handleApiError if service calls can fail
                                // handleApiError={handleApiError}
                                // onLogout={handleLogout} // If service errors can trigger logout
                             />
                        }
                    />
                     {/* Create Playlist route (New) */}
                    <Route
                        path="create"
                        element={
                            <CreatePlaylistPage
                                token={token}
                                currentUserId={userId} // Pass fetched userId
                                onLogout={handleLogout}
                                handleApiError={handleApiError} // Pass error handler
                                refreshPlaylists={triggerPlaylistRefresh} // Pass refresh trigger
                            />
                        }
                    />
                    {/* Add other protected routes here that should use the Layout */}

                </Route>

                {/* Fallback for unmatched routes */}
                {/* Redirect to home if logged in, else to login */}
                <Route path="*" element={<Navigate to={token ? "/" : "/login"} replace />} />
            </Routes>
        </Router>
    );
}

export default App;