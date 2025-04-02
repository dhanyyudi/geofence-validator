"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardHeader() {
  const pathname = usePathname();

  return (
    <header className="dashboard-header">
      <div className="flex items-center">
        <i className="fas fa-map-marked-alt text-blue-500 text-2xl mr-3"></i>
        <h1 className="text-xl font-bold">Geofence Validator</h1>
      </div>

      <div className="mx-auto">
        <nav className="flex space-x-6">
          <Link
            href="/"
            className={`py-2 px-3 ${
              pathname === "/"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <span className="flex items-center">
              <i className="fas fa-check-circle mr-2"></i>
              Validator
            </span>
          </Link>
          <Link
            href="/compare"
            className={`py-2 px-3 ${
              pathname === "/compare"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <span className="flex items-center">
              <i className="fas fa-exchange-alt mr-2"></i>
              Compare
            </span>
          </Link>
        </nav>
      </div>

      <div className="ml-auto flex items-center space-x-4">
        <a
          href="https://github.com/dhanyyudi/geofence-validator"
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
