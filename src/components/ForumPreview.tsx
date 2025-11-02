"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { ForumPostsResponse, ForumPost } from "../../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface ForumPreviewProps {
  initialLimit?: number;
}

const ForumPreview: React.FC<ForumPreviewProps> = ({ initialLimit = 1 }) => {
  const [forumData, setForumData] = useState<ForumPostsResponse | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Format timestamp to readable date
  const formatDate = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "Unknown date";
    }
  };

  // Initial fetch
  useEffect(() => {
    const fetchForumPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get<ForumPostsResponse>(
          `${API_BASE_URL}/api/public/forum-posts`,
          {
            params: {
              limit: initialLimit,
              offset: 0,
            },
          }
        );

        if (response.data.success) {
          setForumData(response.data);
          setPosts(response.data.posts);
          setOffset(initialLimit);
        } else {
          setError("Failed to load forum posts");
        }
      } catch (err) {
        console.error("Error fetching forum posts:", err);
        setError("Unable to load forum preview");
      } finally {
        setLoading(false);
      }
    };

    fetchForumPosts();
  }, [initialLimit]);

  // Load more posts
  const handleLoadMore = async () => {
    if (!forumData || loadingMore) return;

    setLoadingMore(true);
    try {
      const response = await axios.get<ForumPostsResponse>(
        `${API_BASE_URL}/api/public/forum-posts`,
        {
          params: {
            limit: 2, // Load 2 more posts
            offset: offset,
          },
        }
      );

      if (response.data.success) {
        setPosts((prev) => [...prev, ...response.data.posts]);
        setForumData((prev) =>
          prev ? { ...prev, hasMore: response.data.hasMore } : response.data
        );
        setOffset((prev) => prev + response.data.posts.length);
      }
    } catch (err) {
      console.error("Error loading more posts:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="preview-section forum-preview">
        <div className="loading-spinner"></div>
        <p className="preview-loading-text">Loading community preview...</p>
      </div>
    );
  }

  if (error || !forumData) {
    return (
      <div className="preview-section forum-preview">
        <p className="preview-error">{error || "Unable to load preview"}</p>
      </div>
    );
  }

  return (
    <div className="preview-section forum-preview">
      <div className="preview-header">
        <h2 className="preview-title">Join Our Gaming Community</h2>
        <p className="preview-subtitle">
          See what gamers are discussing about{" "}
          {forumData.forum.gameTitle && (
            <span className="game-title">{forumData.forum.gameTitle}</span>
          )}
        </p>
      </div>

      <div className="forum-info">
        <h3 className="forum-topic-title">{forumData.forum.title}</h3>
        {forumData.forum.category && (
          <span className="forum-category">{forumData.forum.category}</span>
        )}
      </div>

      <div className="forum-posts-container">
        {posts.map((post, index) => (
          <div key={index} className="forum-post-preview">
            <div className="post-header">
              <span className="post-author">Posted by {post.author}</span>
              <span className="post-date">{formatDate(post.timestamp)}</span>
            </div>
            <div className="post-content">{post.content}</div>
            <div className="post-footer">
              <span className="post-likes">
                ❤️ {post.likes} {post.likes === 1 ? "Like" : "Likes"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {forumData.hasMore && (
        <button
          className="load-more-button"
          onClick={handleLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading..." : "Load More Posts"}
        </button>
      )}

      <div className="preview-cta">
        <p className="preview-cta-text">
          Want to join the conversation and create your own posts?{" "}
          <span className="cta-highlight">Sign up for early access!</span>
        </p>
      </div>
    </div>
  );
};

export default ForumPreview;
