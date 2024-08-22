"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import "../globals.css"; // Adjust the path if needed

const ResetPasswordClient: React.FC = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

      await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
        token,
        newPassword,
      });

      setMessage("Password has been reset successfully!");
    } catch (error) {
      console.error("Error resetting password:", error);
      setMessage("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h1>Reset Password</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleResetPassword();
        }}
        className="auth-form"
      >
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New Password"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? <div className="loading-spinner"></div> : "Reset Password"}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default ResetPasswordClient;
