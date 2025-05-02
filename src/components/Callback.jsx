// src/components/Callback.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    // Combine error checking from both hash and search params
    const searchError = params.get('error');
    const hashError = hash.substring(1).split('&').find(elem => elem.startsWith('error'))?.split('=')[1];
    const error = searchError || hashError;

    console.log("Callback Loaded");
    console.log("Full URL:", window.location.href); // Log the exact URL
    console.log("Hash:", hash);
    console.log("Search Params:", params.toString());
    console.log("Extracted Code:", code);
    console.log("Extracted State:", state);
    console.log("Extracted Error:", error);

    // --- 1. Handle Errors First ---
    if (error) {
        console.error('Authentication Error received:', error);
        alert(`Authentication failed: ${decodeURIComponent(error)}`); // Decode potential URL encoding
        console.log("Navigating to / on error...");
        navigate('/', { replace: true });
        return; // Stop further processing
    }

    // --- 2. Handle Spotify Token (Implicit Grant from Hash) ---
    // Check specifically for access_token in the hash
    if (hash && hash.includes('access_token=')) {
        console.log("Detected hash with potential Spotify token.");
        const spotifyToken = hash.substring(1).split('&').find(elem => elem.startsWith('access_token'))?.split('=')[1];
        // Optional: Extract expires_in etc.
        const expiresIn = hash.substring(1).split('&').find(elem => elem.startsWith('expires_in'))?.split('=')[1];

        if (spotifyToken) {
            console.log("Successfully extracted Spotify access_token.");
            console.log("Storing Spotify token in localStorage...");
            localStorage.setItem('spotify_access_token', spotifyToken);
            if (expiresIn) {
                 // Store expiry time (current time + duration in milliseconds)
                 const expiryTime = Date.now() + parseInt(expiresIn, 10) * 1000;
                 localStorage.setItem('spotify_token_expires', expiryTime.toString());
                 console.log("Stored token expiry time.");
            }
            console.log("Attempting to navigate to / ...");
            // Use a minimal timeout to ensure localStorage is written before navigation might trigger re-renders
            setTimeout(() => navigate('/', { replace: true }), 0);
            return; // Stop further processing this effect run
        } else {
             console.warn("URL Hash contained 'access_token=' but token extraction failed. This shouldn't happen.");
             // Fall through to generic handler might be okay, or navigate away
             alert("Error processing Spotify login. Please try again.");
             navigate('/login', { replace: true });
             return;
        }
    }

    // --- 3. Handle Amazon Code (Authorization Code Grant from Search Params) ---
    else if (code && state === 'amazon') {
      console.log("Detected Amazon code and state. Exchanging for token...");
      fetch('http://localhost:5001/exchange_amazon_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
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
        return; // Stop further processing
    }

     // --- 4. Handle YouTube Token (Example: Implicit Grant from Hash + State) ---
     // Adjust based on your actual YouTube auth flow. Implicit grant is less common now.
     else if (hash && hash.includes('access_token=') && state === 'youtube') {
        console.log("Detected hash with potential YouTube token and state=youtube.");
        const youtubeToken = hash.substring(1).split('&').find(elem => elem.startsWith('access_token'))?.split('=')[1];
        // Optional: Extract YT expiry, scope etc.

        if (youtubeToken) {
            console.log("Extracted YouTube access_token.");
            localStorage.setItem('youtube_access_token', youtubeToken);
             // Store expiry if available
            alert('YouTube connection successful!');
            console.log("Navigating to /connect ...");
            navigate('/connect', { replace: true });
        } else {
             console.warn("Hash/State indicated YouTube, but token extraction failed.");
             alert("Error processing YouTube login. Please try again.");
             navigate('/connect', { replace: true });
        }
        return; // Stop further processing
     }

    // --- 5. No Recognizable Parameters ---
    else {
      // This block should ideally not be reached during a valid callback
      console.warn('Callback received without recognizable parameters (Error, Spotify Hash, Amazon Code/State, etc.).');
      alert('Received an unexpected callback response. Navigating home.');
      console.log("Navigating to / as fallback...");
      navigate('/', { replace: true });
    }

  // }, [navigate]); // Keep navigate as the only dependency
  }, [navigate]); // Ensure navigate is the only dependency


  // Render the processing message
  return (
      <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#121212',
          color: '#ffffff',
          fontFamily: 'sans-serif'
         }}>
          Processing authentication... Please wait.
      </div>
  );
}

export default Callback;