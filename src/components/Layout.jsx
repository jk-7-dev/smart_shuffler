// src/components/Layout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom'; // Assuming you use React Router
import Sidebar from './Sidebar';
import './Layout.css'; // Create this new CSS file

function Layout({ onLogout }) {
  return (
    <div className="layout-container">
      <Sidebar onLogout={onLogout} />
      <main className="main-content">
        <Outlet /> {/* Child routes will render here */}
      </main>
    </div>
  );
}

export default Layout;