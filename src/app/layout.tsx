import React from "react";
import "./globals.css"; // Import your global CSS here
import { AuthProvider } from "../context/authContext"; // Adjust the path as needed

export const metadata = {
  title: "Video Game Wingman",
  description: "Empowering gamers with insights and analytics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
