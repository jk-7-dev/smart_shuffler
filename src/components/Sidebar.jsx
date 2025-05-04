// src/components/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css'; // Ensure this CSS file exists and is styled

function Sidebar({ onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        {/* Optional: Add logo */}
        <h2>Smart Shuffler</h2>
      </div>
      <nav className="sidebar-nav">
        <ul>
          <li>
            <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              My Playlists
            </NavLink>
          </li>
          {/* New Link for Create Playlist Page */}
          <li>
            <NavLink to="/create" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              Create Playlist
            </NavLink>
          </li>
          <li>
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