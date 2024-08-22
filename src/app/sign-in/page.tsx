"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuth } from "../../context/authContext";
import Image from "next/image";
import "../globals.css";

interface SignInResponse {
  accessToken: string;
  message?: string;
}

const SignInPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const { setAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

      const response = await axios.post<SignInResponse>(
        `${API_BASE_URL}/api/auth/login`,
        {
          email,
          password,
        }
      );

      if (response.status === 200) {
        setMessage("Login successful! Redirecting to main page...");
        setAuth(response.data.accessToken);
        router.push("/main");
      } else {
        setMessage(
          response.data.message || "An error occurred. Please try again."
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      setMessage("An error occurred during login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <Image
        src="/video-game-wingman-logo.png"
        alt="Video Game Wingman Logo"
        className="logo"
        width={500}
        height={500}
      />
      <h1>Sign In</h1>
      <form onSubmit={handleSignIn} className="auth-form">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? <div className="loading-spinner"></div> : "Sign In"}
        </button>
      </form>
      {message && <p>{message}</p>}
      <a className="forgot-password-link" href="/forgot-password">
        Forgot Password?
      </a>
    </div>
  );
};

export default SignInPage;
