"use client";

import React, { useState, useCallback, useMemo } from "react";
import axios from "axios";
import Image from "next/image";
import "./globals.css";

interface SignUpResponse {
  message: string;
  link?: string; // Link is optional, only provided if the user is approved
  position?: number; // Track user's position
}

interface FormState {
  email: string;
  message: string;
  loading: boolean;
  link: string | null;
  position: number | null;
}

const initialFormState: FormState = {
  email: "",
  message: "",
  loading: false,
  link: null,
  position: null,
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const SplashPage: React.FC = () => {
  const [formState, setFormState] = useState<FormState>(initialFormState);

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormState((prev) => ({ ...prev, email: e.target.value }));
    },
    []
  );

  const handleSignUp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      setFormState((prev) => ({ ...prev, loading: true, message: "" }));

      try {
        const response = await axios.post<SignUpResponse>(
          `${API_BASE_URL}/api/auth/signup`,
          { email: formState.email }
        );

        setFormState((prev) => ({
          ...prev,
          message: response.data.message,
          link: response.data.link || null,
          position: response.data.position ?? null,
          loading: false,
        }));
      } catch (error) {
        console.error("Error adding email to waitlist:", error);
        setFormState((prev) => ({
          ...prev,
          message: "An error occurred. Please try again.",
          loading: false,
        }));
      }
    },
    [formState.email]
  );

  const proFeatures = useMemo(
    () => [
      "Advanced Game Guides",
      "Real-Time Notifications",
      "Access to Exclusive Forums: Discuss games, and explore a variety of topics",
    ],
    []
  );

  return (
    <div className="home-container">
      <Image
        src="/video-game-wingman-logo.png"
        alt="Video Game Wingman Logo"
        width={250}
        height={250}
        priority // Adding priority for LCP optimization
        style={{ maxWidth: "100%", height: "auto", marginTop: "10px" }}
      />
      <h1>Taking Video Games To Their Greatest Heights!&apos;</h1>
      <form onSubmit={handleSignUp} className="auth-form">
        <input
          type="email"
          value={formState.email}
          onChange={handleEmailChange}
          placeholder="Enter your email"
          required
        />
        <button type="submit" disabled={formState.loading}>
          {formState.loading ? (
            <div className="loading-spinner"></div>
          ) : (
            "Submit"
          )}
        </button>
      </form>
      <ul className="bullet-points">
        <li>
          Incredible Video Game Guides (Simply upload an image of where you need
          help) – perfect for gamers of all skill levels, from beginners to
          experts!
        </li>
        <li>
          Amazing Video Game Recommendations – find the best games tailored to
          your preferences.
        </li>
        <li>
          Discover Hidden Secrets – encourage curiosity and problem-solving
          through exploring hidden game features.
        </li>
        <li>
          Outstanding Video Game Tips and Tricks – enhance gameplay while
          promoting healthy gaming habits.
        </li>
      </ul>
      <p className="quote">
        First 5,000 Users to sign up before December 31st, 2025 get access to
        Wingman Pro 1 year for free!
      </p>
      {/* Center-align Wingman Pro Features section */}
      <div className="pro-features-section">
        <h4>Wingman Pro Features:</h4>
        <ul className="bullet-points-2">
          {proFeatures.map((feature, index) => (
            <li key={index}>{feature}</li>
          ))}
        </ul>
      </div>
      {formState.message && <p>{formState.message}</p>}
      {formState.link && (
        <p>
          You have been approved! Access Video Game Wingman{" "}
          <a href={formState.link} target="_blank" rel="noopener noreferrer">
            here
          </a>
          .
        </p>
      )}
      {formState.position !== null && (
        <p>Your waitlist position: {formState.position}</p>
      )}
    </div>
  );
};

export default SplashPage;
