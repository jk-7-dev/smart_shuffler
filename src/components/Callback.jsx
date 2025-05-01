import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Amazon now returns code in the query string
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state === 'amazon') {
      // Exchange the code for an access token via your Flask backend
      fetch('http://localhost:5001/exchange_amazon_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          localStorage.setItem('amazon_access_token', data.access_token);
          alert('Amazon access token stored!');
          navigate('/', { replace: true });
        })
        .catch((error) => {
          console.error('Amazon token exchange failed', error);
        });
    } else {
      console.warn('Missing code or state');
    }
  }, [navigate]);

  return <p>Processing authentication... Please wait.</p>;
}

export default Callback;
