"use client";

import React, { useState } from "react";
import axios from "axios";
import Image from "next/image";
import "./globals.css";

interface SignUpResponse {
  message: string;
  link?: string; // Link is optional, only provided if the user is approved
  position?: number; // Track user's position
}

const SplashPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null); // State for storing the link
  const [position, setPosition] = useState<number | null>(null); // State for storing position

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

      const response = await axios.post<SignUpResponse>(
        `${API_BASE_URL}/api/auth/signup`,
        { email }
      );

      setMessage(response.data.message);

      // If the user is approved, store the link in the state
      if (response.data.link) {
        setLink(response.data.link);
      }

      // Store the user's waitlist position
      if (response.data.position !== undefined) {
        setPosition(response.data.position);
      }
    } catch (error) {
      console.error("Error adding email to waitlist:", error);
      setMessage("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <Image
        src="/video-game-wingman-logo.png"
        alt="Video Game Wingman Logo"
        width={400}
        height={400}
        style={{ maxWidth: "100%", height: "auto", marginTop: "40px" }} // Increased top margin
      />
      <h1>Taking Video Games To Their Greatest Heights!</h1>
      <form onSubmit={handleSignUp} className="auth-form">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? <div className="loading-spinner"></div> : "Submit"}
        </button>
      </form>
      <ul className="bullet-points">
        <li>
          Incredible Video Game Guides (Simply upload an image of where you need
          help)
        </li>
        <li>Amazing Video Game Recommendations</li>
        <li>Discover Hidden Secrets</li>
        <li>Outstanding Video Game Tips and Tricks</li>
      </ul>
      <p className="quote">
        First 5,000 Users to sign up before December 31st get access to Wingman
        Pro 1 year for free!
      </p>
      {/* Center-align Wingman Pro Features section */}
      <div className="pro-features-section">
        <h4>Wingman Pro Features:</h4>
        <ul className="bullet-points-2">
          <li>Advanced Game Guides</li>
          <li>Real-Time Notifications</li>
          <li>Exclusive Access to Discord Bot</li>
        </ul>
      </div>
      {message && <p>{message}</p>}
      {link && (
        <p>
          You have been approved! Access the AI assistant{" "}
          <a href={link} target="_blank" rel="noopener noreferrer">
            here
          </a>
          .
        </p>
      )}
      {position !== null && <p>Your waitlist position: {position}</p>}
    </div>
  );
};

export default SplashPage;
