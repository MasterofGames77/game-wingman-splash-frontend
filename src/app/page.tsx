"use client";

import React, { useState, useCallback } from "react";
import axios from "axios";
import Image from "next/image";
import "./globals.css";
import { FormState, SignUpResponse } from "../../types";

const initialFormState: FormState = {
  email: "",
  message: "",
  loading: false,
  link: null,
  position: null,
  userId: null,
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
          userId: response.data.userId || null,
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

  return (
    <div className="home-container">
      <Image
        src="/video-game-wingman-logo.png"
        alt="Video Game Wingman Logo"
        width={250}
        height={250}
        priority // Adding priority for LCP optimization
        style={{ maxWidth: "100%", height: "auto", marginTop: "4px" }}
      />
      <h1>Your AI Co-Pilot for Every Game You Play.</h1>
      <p className="subline">
        Master any game. Discover hidden secrets. Level up faster — with your
        ultimate Video Game Wingman.
      </p>
      <form onSubmit={handleSignUp} className="auth-form">
        <input
          type="email"
          value={formState.email}
          onChange={handleEmailChange}
          placeholder="you@example.com"
          required
        />
        <button type="submit" disabled={formState.loading}>
          {formState.loading ? (
            <div className="loading-spinner"></div>
          ) : (
            "Get Early Access"
          )}
        </button>
      </form>
      <p className="early-access-note">
        The first 5,000 gamers to join get Wingman Pro free for 1 year.
      </p>
      <div className="why-wingman-section">
        <h2>Why Gamers Love Wingman</h2>
        <p className="section-subline">Your Wingman gives you an edge:</p>
        <ul className="bullet-points">
          <li>
            <strong>Real-Time Game Intelligence</strong> — get instant guides,
            counters, and pro-level insights while you play.
          </li>
          <li>
            <strong>Smarter Recommendations</strong> — find your next favorite
            game based on your skill and style.
          </li>
          <li>
            <strong>Hidden Secrets & Easter Eggs</strong> — explore every corner
            of the worlds you love.
          </li>
          <li>
            <strong>Instant Tips & Tricks</strong> — dominate every level
            without breaking immersion.
          </li>
        </ul>
      </div>
      {/* Wingman Pro Features section */}
      <div className="pro-features-section">
        <h2>Wingman Pro</h2>
        <p className="section-subline">
          Upgrade to Pro — Free for Early Users:
        </p>
        <ul className="bullet-points-2">
          <li>
            <strong>Deeper, dynamic AI game guides</strong>
          </li>
          <li>
            <strong>Live in-game notifications and strategies</strong>
          </li>
          <li>
            <strong>
              Access to exclusive gamer forums and private Discord communities
            </strong>
          </li>
        </ul>
      </div>
      {formState.message && <p>{formState.message}</p>}
      {formState.link && (
        <p>
          You have been approved! Access Video Game Wingman{" "}
          <a
            href={`${formState.link}${
              formState.userId
                ? `?earlyAccess=true&userId=${encodeURIComponent(
                    formState.userId
                  )}`
                : ""
            }`}
            target="_blank"
            rel="noopener noreferrer"
          >
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
