"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/authContext";
import Image from "next/image";
import "../globals.css";

interface WaitlistResponse {
  isApproved: boolean;
  position?: number;
}

interface LogoutResponse {
  message: string;
}

const MainPage: React.FC = () => {
  const [position, setPosition] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const router = useRouter();
  const { token } = useAuth();

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    const fetchPosition = async () => {
      setLoading(true);
      try {
        const response = await axios.get<WaitlistResponse>(
          `${API_BASE_URL}/api/getWaitlistPosition`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            withCredentials: true,
          }
        );

        if (response.data.isApproved) {
          setIsApproved(true);
        } else {
          setPosition(response.data.position || null);
        }
      } catch (error) {
        console.error("Error fetching waitlist position:", error);
        setMessage(
          "Error fetching your waitlist position. Please try again later."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPosition();
  }, [token, API_BASE_URL]);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const response = await axios.post<LogoutResponse>(
        `${API_BASE_URL}/api/auth/logout`,
        {},
        { withCredentials: true }
      );
      setMessage(response.data.message);
      setTimeout(() => router.push("/"), 2000);
    } catch (error) {
      console.error("Error logging out:", error);
      setMessage("An error occurred during logout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-container">
      <Image
        src="/video-game-wingman-logo.png"
        alt="Video Game Wingman Logo"
        className="logo"
        width={300}
        height={300}
        style={{ maxWidth: "100%", height: "auto" }}
      />
      <h1>Welcome to Video Game Wingman</h1>
      {isApproved ? (
        <p>
          You have been approved! Click{" "}
          <a
            href="https://video-game-wingman-57d61bef9e61.herokuapp.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            here
          </a>{" "}
          to access Video Game Wingman.
        </p>
      ) : position !== null ? (
        <p>Your waitlist position is: {position}</p>
      ) : (
        <p>{message}</p>
      )}
      <button onClick={handleLogout}>Log Out</button>
      {loading && (
        <div className="spinner-wrapper">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
};

export default MainPage;
