export const fetchYouTubePlaylists = async () => {
    const token = localStorage.getItem('youtube_access_token');
    if (!token) {
      throw new Error('YouTube access token is missing. Please connect to YouTube.');
    }
  
    const response = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true', {
      headers: { Authorization: `Bearer ${token}` },
    });
  
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to fetch YouTube playlists: ${errorData.error.message}`);
    }
  
    const data = await response.json();
    return data.items.map((item) => ({
      id: item.id,
      name: item.snippet.title,
      trackCount: item.contentDetails?.itemCount || 0,
    }));
  };
  
  export const fetchAmazonPlaylists = async () => {
    const token = localStorage.getItem('amazon_access_token');
    if (!token) {
      throw new Error('Amazon access token is missing. Please connect to Amazon.');
    }
  
    const response = await fetch('https://api.amazonmusic.com/playlists', {
      headers: { Authorization: `Bearer ${token}` },
    });
  
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to fetch Amazon playlists: ${errorData.error.message}`);
    }
  
    const data = await response.json();
    return data.playlists.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      trackCount: playlist.trackCount,
    }));
  };