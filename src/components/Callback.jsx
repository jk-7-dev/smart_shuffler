// src/components/Callback.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Callback() {
    const navigate = useNavigate();

    useEffect(() => {
        const hash = window.location.hash.substring(1); // Get hash string without '#'
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(hash); // Parse hash string like query params

        // --- Extract parameters ---
        const code = searchParams.get('code'); // For Amazon Auth Code flow
        const searchState = searchParams.get('state'); // State from search params (e.g., Amazon)
        const searchError = searchParams.get('error'); // Error from search params

        const hashAccessToken = hashParams.get('access_token'); // Token from hash (Spotify Implicit, YouTube Implicit)
        const hashState = hashParams.get('state'); // State from hash (e.g., YouTube)
        const hashError = hashParams.get('error'); // Error from hash
        const expiresIn = hashParams.get('expires_in'); // Expiry from hash (Spotify, YouTube)

        // Combine errors
        const error = searchError || hashError;

        // --- Log extracted values ---
        console.log("Callback Loaded");
        console.log("Full URL:", window.location.href);
        console.log("Hash String:", hash);
        console.log("Search Params:", searchParams.toString());
        console.log("Code (from search):", code);
        console.log("State (from search):", searchState);
        console.log("Access Token (from hash):", hashAccessToken ? '*** Present ***' : null); // Don't log token itself
        console.log("State (from hash):", hashState);
        console.log("Combined Error:", error);
        console.log("Expires In (from hash):", expiresIn);

        // --- 1. Handle Errors First ---
        if (error) {
            console.error('Authentication Error received:', error);
            alert(`Authentication failed: ${decodeURIComponent(error)}`);
            // Navigate appropriately based on state if possible, otherwise default
            const originatingState = searchState || hashState;
            const errorRedirectPath = originatingState === 'amazon' || originatingState === 'youtube' ? '/connect' : '/login';
            console.log(`Navigating to ${errorRedirectPath} on error...`);
            navigate(errorRedirectPath, { replace: true });
            return; // Stop further processing
        }

        // --- 2. Handle Amazon Code Grant ---
        if (code && searchState === 'amazon') {
            console.log("Detected Amazon code and state. Exchanging for token...");
            // Use a separate function or keep fetch here
            exchangeAmazonCode(code, navigate);
            return; // Stop processing
        }

        // --- 3. Handle YouTube Implicit Grant ---
        if (hashAccessToken && hashState === 'youtube') {
            console.log("Detected YouTube token and state=youtube.");
            console.log("Storing YouTube token in localStorage...");
            localStorage.setItem('youtube_access_token', hashAccessToken);
            if (expiresIn) {
                 // Store expiry if needed for YouTube token refresh later
                const expiryTime = Date.now() + parseInt(expiresIn, 10) * 1000;
                localStorage.setItem('youtube_token_expires', expiryTime.toString());
                console.log("Stored YouTube token expiry time.");
            }
            alert('YouTube connection successful!');
            console.log("Navigating to /connect ...");
            navigate('/connect', { replace: true });
            return; // Stop processing
        }

        // --- 4. Handle Spotify Implicit Grant ---
        // Assumes Spotify callback *only* has access_token in hash and NO state parameter
        // OR a state parameter *not* equal to 'youtube' or 'amazon' (adjust if Spotify uses state)
        if (hashAccessToken && (hashState !== 'youtube' && hashState !== 'amazon')) {
             // Added check ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
            console.log("Detected hash access_token, assuming Spotify."); // Make sure this assumption is correct for your Spotify flow!
            console.log("Storing Spotify token in localStorage...");
            localStorage.setItem('spotify_access_token', hashAccessToken);
            if (expiresIn) {
                const expiryTime = Date.now() + parseInt(expiresIn, 10) * 1000;
                localStorage.setItem('spotify_token_expires', expiryTime.toString());
                console.log("Stored Spotify token expiry time.");
            }
             // Don't alert here, let App.jsx handle successful login flow
            console.log("Navigating to / (Spotify Login)...");
            // Use timeout to allow localStorage to potentially write? Usually not needed but safe.
            setTimeout(() => navigate('/', { replace: true }), 0);
            return; // Stop processing
        }

        // --- 5. No Recognizable Parameters ---
        console.warn('Callback received without recognizable parameters or state mismatch.');
        alert('Received an unexpected callback response. Please try logging in again.');
        console.log("Navigating to /login as fallback...");
        navigate('/login', { replace: true });

    // }, [navigate]); // Keep navigate as the only dependency
    }, [navigate]); // Ensure navigate is the only dependency


    // Helper function for Amazon code exchange (moved out for clarity)
    const exchangeAmazonCode = (authCode, navigate) => {
        fetch('http://localhost:5001/exchange_amazon_token', { // Ensure your backend URL is correct
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: authCode }), // Send the code extracted
        })
        .then(async (res) => {
            if (!res.ok) {
                const errorBody = await res.text();
                throw new Error(`Amazon token exchange failed: ${res.status} - ${errorBody}`);
            }
            return res.json();
        })
        .then((data) => {
            if (data.access_token) {
                console.log("Amazon token exchange successful.");
                localStorage.setItem('amazon_access_token', data.access_token);
                // Store refresh token and expiry if provided by your backend
                if(data.refresh_token) localStorage.setItem('amazon_refresh_token', data.refresh_token);
                if(data.expires_in) {
                    const expiryTime = Date.now() + parseInt(data.expires_in, 10) * 1000;
                    localStorage.setItem('amazon_token_expires', expiryTime.toString());
                }
                alert('Amazon connection successful!');
                console.log("Navigating to /connect ...");
                navigate('/connect', { replace: true });
            } else {
                throw new Error('Amazon access_token not found in backend response.');
            }
        })
        .catch((exchangeError) => {
            console.error('Amazon token exchange process failed:', exchangeError);
            alert(`Failed to connect Amazon: ${exchangeError.message}`);
            console.log("Navigating to /connect after Amazon error...");
            navigate('/connect', { replace: true });
        });
    };


    // Render the processing message (remains the same)
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            backgroundColor: '#121212', // Match theme
            color: '#ffffff',
            fontFamily: 'sans-serif'
            }}>
            Processing authentication... Please wait.
        </div>
    );
}

export default Callback;