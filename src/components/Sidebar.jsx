// src/components/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom'; // Use NavLink for active styling
import './Sidebar.css'; // Create this new CSS file
// You can import your actual logo here
// import logo from '../assets/logo.png';

function Sidebar({ onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        {/* <img src={logo} alt="Smart Shuffler Logo" /> */}
        <h2>Smart Shuffler</h2> {/* Placeholder if no image */}
      </div>
      <nav className="sidebar-nav">
        <ul>
          <li>
            {/* Link to the main Spotify features page */}
            <NavLink to="/" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              My Playlists
            </NavLink>
          </li>
          <li>
            {/* Link to the page for connecting external services */}
            <NavLink to="/connect" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              Connect Services
            </NavLink>
          </li>
          {/* Add other navigation links here if needed */}
        </ul>
      </nav>
      <div className="sidebar-logout">
        <button onClick={onLogout} className="logout-button-sidebar">
          Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;