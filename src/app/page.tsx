"use client";

import React, { useState } from "react";
import axios from "axios";
import Image from "next/image";
import "./globals.css";

interface SignUpResponse {
  message: string;
  link?: string; // Link is optional, only provided if the user is approved
}

const SplashPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null); // State for storing the link

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
        style={{ maxWidth: "100%", height: "auto" }}
      />
      <h1>
        Elevate Your Gameplay with Strategic Insights and Personalized Analytics
      </h1>
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
      <p className="quote">
        Don&apos;t miss out on your unfair advantage. Sign up now and get ahead
        of the competition!
      </p>
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
    </div>
  );
};

export default SplashPage;
