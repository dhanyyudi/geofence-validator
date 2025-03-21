"use client";

import React from "react";

export default function DashboardHeader() {
  return (
    <header className="dashboard-header">
      <div className="flex items-center">
        <i className="fas fa-map-marked-alt text-blue-500 text-2xl mr-3"></i>
        <h1 className="text-xl font-bold">Geofence Validator</h1>
      </div>
      <div className="ml-auto flex items-center space-x-4">
        <a
          href="https://github.com/dhanyyudi"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 hover:text-gray-800"
        >
          <i className="fab fa-github text-lg"></i>
        </a>
        <a href="#help" className="text-gray-600 hover:text-gray-800">
          <i className="fas fa-question-circle text-lg"></i>
        </a>
      </div>
    </header>
  );
}
