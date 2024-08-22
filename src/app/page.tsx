"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";

const SplashPage: React.FC = () => {
  return (
    <div className="home-container">
      <Image
        src="/video-game-wingman-logo.png"
        alt="Video Game Wingman Logo"
        className="logo"
        width={400}
        height={400}
        style={{ maxWidth: "100%", height: "auto" }}
      />
      <h1>What is Video Game Wingman?</h1>
      <p className="quote">
        &quot;Video Game Wingman empowers gamers with insights and analytics to
        elevate their gameplay and performance.&quot;
      </p>

      <h2>What Video Game Wingman Does:</h2>
      <ul className="features-list">
        <li>Delivers tailored game recommendations and detailed insights.</li>
        <li>
          Offers tips, tricks, and progression guides to enhance your gameplay.
        </li>
      </ul>
      <Link href="/sign-up">
        <button className="join-waitlist-button">Join Waitlist</button>
      </Link>
      <Link href="/sign-in">
        <button className="join-waitlist-button">Sign In</button>
      </Link>
    </div>
  );
};

export default SplashPage;
