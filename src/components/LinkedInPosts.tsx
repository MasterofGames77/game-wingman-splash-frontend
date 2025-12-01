"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import axios from "axios";
import {
  LinkedInSeriesResponse,
  LinkedInPostsResponse,
  LinkedInIntroPostResponse,
  LinkedInPost,
  LinkedInSeries,
} from "../../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface LinkedInPostsProps {
  // No props needed - this is a standalone display component
}

const LinkedInPosts: React.FC<LinkedInPostsProps> = () => {
  const [availableSeries, setAvailableSeries] = useState<LinkedInSeries[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [currentPost, setCurrentPost] = useState<LinkedInPost | null>(null);
  const [introPost, setIntroPost] = useState<LinkedInPost | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalPosts, setTotalPosts] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPost, setLoadingPost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [currentSeriesInfo, setCurrentSeriesInfo] = useState<{
    seriesId: string;
    seriesTitle: string;
  } | null>(null);

  // Fetch available series on mount
  useEffect(() => {
    const fetchSeries = async () => {
      setLoading(true);
      try {
        const response = await axios.get<LinkedInSeriesResponse>(
          `${API_BASE_URL}/api/public/linkedin-posts/series`
        );

        if (response.data.success && response.data.series.length > 0) {
          setAvailableSeries(response.data.series);
          // Set first series as default
          const firstSeries = response.data.series[0];
          setSelectedSeriesId(firstSeries.seriesId);
        } else {
          setError("No LinkedIn post series available");
        }
      } catch (err) {
        console.error("Error fetching LinkedIn series:", err);
        setError("Unable to load LinkedIn posts");
      } finally {
        setLoading(false);
      }
    };

    fetchSeries();
  }, []);

  // Fetch intro post when series is selected
  useEffect(() => {
    if (!selectedSeriesId) return;

    const fetchIntroPost = async () => {
      try {
        const response = await axios.get<LinkedInIntroPostResponse>(
          `${API_BASE_URL}/api/public/linkedin-posts/intro`,
          { params: { seriesId: selectedSeriesId } }
        );

        if (response.data.success) {
          setIntroPost(response.data.post);
          setCurrentSeriesInfo(response.data.series);
        }
      } catch (err) {
        console.error("Error fetching intro post:", err);
        // Intro post is optional, so don't set error
      }
    };

    fetchIntroPost();
  }, [selectedSeriesId]);

  // Fetch posts when series or offset changes
  useEffect(() => {
    if (!selectedSeriesId) return;

    const fetchPosts = async () => {
      setLoadingPost(true);
      try {
        const response = await axios.get<LinkedInPostsResponse>(
          `${API_BASE_URL}/api/public/linkedin-posts`,
          {
            params: {
              seriesId: selectedSeriesId,
              limit: 1,
              offset: currentOffset,
            },
          }
        );

        if (response.data.success && response.data.posts.length > 0) {
          setCurrentPost(response.data.posts[0]);
          setHasMore(response.data.hasMore);
          // Only set totalPosts on first fetch (offset 0)
          // The count from API should be the total count, not the count of returned posts
          if (currentOffset === 0) {
            setTotalPosts(response.data.count);
          }
          setCurrentSeriesInfo(response.data.series);
        } else {
          setCurrentPost(null);
          setHasMore(false);
          // Don't reset totalPosts here, keep the last known value
        }
      } catch (err) {
        console.error("Error fetching LinkedIn posts:", err);
        setError("Unable to load post");
      } finally {
        setLoadingPost(false);
      }
    };

    fetchPosts();
  }, [selectedSeriesId, currentOffset]);

  // Handle series selection
  const handleSeriesChange = (seriesId: string) => {
    setSelectedSeriesId(seriesId);
    setCurrentOffset(0);
    setShowIntro(false);
    setCurrentPost(null);
    setTotalPosts(null);
  };

  // Handle navigation
  const handlePrevious = () => {
    if (currentOffset > 0) {
      setCurrentOffset(currentOffset - 1);
      setShowIntro(false);
    }
  };

  const handleNext = () => {
    if (hasMore) {
      setCurrentOffset(currentOffset + 1);
      setShowIntro(false);
    }
  };

  const handleShowIntro = () => {
    setShowIntro(true);
    setCurrentOffset(0);
  };

  const handleShowPost = () => {
    setShowIntro(false);
  };

  // Format date
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Format content with line breaks
  const formatContent = (content: string): React.ReactNode => {
    return content.split("\n").map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < content.split("\n").length - 1 && <br />}
      </React.Fragment>
    ));
  };

  // Get icon emoji for stats
  const getIconEmoji = (icon?: string): string => {
    switch (icon) {
      case "clock":
        return "⏱️";
      case "chart":
        return "📉";
      case "robot":
        return "🤖";
      default:
        return "📊";
    }
  };

  // Get current post number (1-based)
  const getCurrentPostNumber = (): number => {
    return currentOffset + 1;
  };

  // Get total posts from API response or series metadata
  const getTotalPosts = (): number => {
    // First try to use series metadata (most reliable)
    const series = availableSeries.find((s) => s.seriesId === selectedSeriesId);
    if (series?.postCount) {
      return series.postCount;
    }
    // Fall back to API response count if available
    if (totalPosts !== null) {
      return totalPosts;
    }
    // Default fallback
    return 10;
  };

  if (loading) {
    return (
      <div className="preview-section linkedin-posts">
        <div className="loading-spinner"></div>
        <p className="preview-loading-text">Loading LinkedIn posts...</p>
      </div>
    );
  }

  if (error && !currentPost && !introPost) {
    return (
      <div className="preview-section linkedin-posts">
        <p className="preview-error">{error}</p>
      </div>
    );
  }

  const displayPost = showIntro ? introPost : currentPost;
  const isIntro = showIntro;

  return (
    <div className="preview-section linkedin-posts">
      <div className="preview-header">
        <h2 className="preview-title">Video Game Wingman Insights</h2>
        <p className="preview-subtitle">
          Explore our LinkedIn series showcasing how Video Game Wingman helps
          gamers overcome challenges and achieve 100% completion
        </p>

        {/* Series Selector */}
        {availableSeries.length > 1 && (
          <div className="forum-selector-container">
            <label htmlFor="series-select" className="forum-selector-label">
              Select Series:
            </label>
            <select
              id="series-select"
              className="forum-selector"
              value={selectedSeriesId || ""}
              onChange={(e) => handleSeriesChange(e.target.value)}
              disabled={loadingPost}
            >
              {availableSeries.map((series) => (
                <option key={series.seriesId} value={series.seriesId}>
                  {series.seriesTitle}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Series Info */}
      {currentSeriesInfo && (
        <div className="linkedin-series-info">
          <h3 className="linkedin-series-title">
            {currentSeriesInfo.seriesTitle}
          </h3>
        </div>
      )}

      {/* Post Display */}
      {loadingPost && !displayPost ? (
        <div className="linkedin-post-loading">
          <div className="loading-spinner"></div>
          <p>Loading post...</p>
        </div>
      ) : displayPost ? (
        <div className="linkedin-post-container">
          {/* Post Image */}
          {displayPost.imageUrl && (
            <div className="linkedin-post-image">
              <Image
                src={`${API_BASE_URL}${displayPost.imageUrl}`}
                alt={displayPost.title}
                width={600}
                height={400}
                className="linkedin-image"
                loading="lazy"
                unoptimized={true}
                onError={(e) => {
                  // Hide broken images
                  e.currentTarget.style.display = "none";
                }}
                style={{
                  width: "100%",
                  height: "auto",
                  maxWidth: "600px",
                }}
              />
            </div>
          )}

          {/* Post Header */}
          <div className="linkedin-post-header">
            <h4 className="linkedin-post-title">{displayPost.title}</h4>
            {displayPost.gameTitle && (
              <p className="linkedin-post-game">{displayPost.gameTitle}</p>
            )}
            <p className="linkedin-post-date">
              Published: {formatDate(displayPost.publishedDate)}
            </p>
            {displayPost.metadata?.seriesDay && !isIntro && (
              <p className="linkedin-post-day">
                Day {displayPost.metadata.seriesDay} of {getTotalPosts()}
              </p>
            )}
          </div>

          {/* Featured Stats */}
          {displayPost.metadata?.featuredStats &&
            displayPost.metadata.featuredStats.length > 0 && (
              <div className="linkedin-post-stats">
                {displayPost.metadata.featuredStats.map((stat, index) => (
                  <div key={index} className="linkedin-stat-item">
                    <span className="linkedin-stat-icon">
                      {getIconEmoji(stat.icon)}
                    </span>
                    <div className="linkedin-stat-content">
                      <span className="linkedin-stat-label">{stat.label}</span>
                      <span className="linkedin-stat-value">{stat.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

          {/* Post Content */}
          <div className="linkedin-post-content">
            {formatContent(displayPost.content)}
          </div>

          {/* Hashtags */}
          {displayPost.hashtags && displayPost.hashtags.length > 0 && (
            <div className="linkedin-post-hashtags">
              {displayPost.hashtags.map((hashtag, index) => (
                <span key={index} className="linkedin-hashtag">
                  {hashtag}
                </span>
              ))}
            </div>
          )}

          {/* LinkedIn Link */}
          <div className="linkedin-post-footer">
            <a
              href={displayPost.linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="linkedin-link-button"
            >
              View on LinkedIn →
            </a>
          </div>
        </div>
      ) : (
        <div className="linkedin-post-empty">
          <p>No posts available for this series.</p>
        </div>
      )}

      {/* Navigation Controls */}
      <div className="linkedin-navigation">
        <div className="linkedin-nav-buttons">
          {/* Intro Post Button */}
          {introPost && !showIntro && (
            <button
              className="linkedin-nav-button linkedin-intro-button"
              onClick={handleShowIntro}
              disabled={loadingPost}
            >
              View Intro
            </button>
          )}

          {/* Previous Button */}
          {!showIntro && (
            <button
              className="linkedin-nav-button linkedin-prev-button"
              onClick={handlePrevious}
              disabled={currentOffset === 0 || loadingPost}
            >
              ← Previous
            </button>
          )}

          {/* Post Counter */}
          {!showIntro && currentPost && (
            <span className="linkedin-post-counter">
              Post {getCurrentPostNumber()} of {getTotalPosts()}
            </span>
          )}

          {/* Next Button */}
          {!showIntro && (
            <button
              className="linkedin-nav-button linkedin-next-button"
              onClick={handleNext}
              disabled={!hasMore || loadingPost}
            >
              Next →
            </button>
          )}

          {/* Back to Posts Button (when viewing intro) */}
          {showIntro && (
            <button
              className="linkedin-nav-button linkedin-back-button"
              onClick={handleShowPost}
              disabled={loadingPost}
            >
              View Posts
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkedInPosts;
