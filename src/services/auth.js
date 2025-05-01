export const getToken = () => {
  const hash = window.location.hash;
  let token = localStorage.getItem('spotify_access_token');

  if (!token && hash) {
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    if (accessToken) {
      token = accessToken;
      const expiresIn = params.get('expires_in');
      const expiryTime = new Date().getTime() + expiresIn * 1000;

      localStorage.setItem('spotify_access_token', token);
      localStorage.setItem('spotify_token_expiry_time', expiryTime);
      window.location.hash = '';
    }
  }

  const expiryTime = localStorage.getItem('spotify_token_expiry_time');
  if (token && expiryTime && new Date().getTime() > expiryTime) {
    logout();
    return null;
  }

  return token;
};

export const logout = () => {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_token_expiry_time');
};