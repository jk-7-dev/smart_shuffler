export const fetchYouTubeTracks = async (playlistId) => {
    const token = localStorage.getItem('youtube_access_token');
    if (!token) throw new Error('YouTube access token is missing. Please connect to YouTube.');

    const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        if (response.status === 401) {
            alert('Your YouTube access token is invalid or expired. Please reconnect your YouTube account.');
        }
        const errorData = await response.json();
        console.error('Error fetching YouTube tracks:', errorData);
        throw new Error(`Failed to fetch YouTube tracks: ${errorData.error.message}`);
    }

    const data = await response.json();
    console.log('YouTube API Response:', data); // Log the full response

    return data.items.map((item) => ({
        title: item.snippet.title, // Ensure track titles are returned
    }));
};

export const fetchAmazonTracks = async (playlistId) => {
    const token = localStorage.getItem('amazon_access_token');
    if (!token) throw new Error('Amazon access token is missing. Please connect to Amazon.');

    const response = await fetch(`https://api.amazonmusic.com/playlists/${playlistId}/tracks`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        if (response.status === 401) {
            alert('Your Amazon access token is invalid or expired. Please reconnect your Amazon Music account.');
        }
        const errorData = await response.json();
        console.error('Error fetching Amazon tracks:', errorData);
        throw new Error(`Failed to fetch Amazon tracks: ${errorData.error.message}`);
    }

    const data = await response.json();
    console.log('Amazon API Response:', data); // Log the full response

    return data.tracks.map((track) => ({
        title: track.name,
    }));
};

