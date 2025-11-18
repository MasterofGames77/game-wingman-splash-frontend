"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  ForumPreviewProps,
  ForumPostsResponse,
  ForumPost,
  PostStatusResponse,
  CreatePostResponse,
  UpdatePostResponse,
  DeletePostResponse,
  LikePostResponse,
  ModerationErrorResponse,
  Attachment,
} from "../../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Helper function to extract URL from attachment (handles both string and object)
const getAttachmentUrl = (attachment: Attachment): string => {
  if (typeof attachment === "string") {
    return attachment;
  }
  if (attachment && typeof attachment === "object" && "url" in attachment) {
    return attachment.url;
  }
  return "";
};

const ForumPreview: React.FC<ForumPreviewProps> = ({
  initialLimit = 1,
  userId,
  userEmail,
}) => {
  const [forumData, setForumData] = useState<ForumPostsResponse | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Post management state
  const [postStatus, setPostStatus] = useState<PostStatusResponse | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [likingPostId, setLikingPostId] = useState<string | null>(null);
  const [moderationWarning, setModerationWarning] = useState<string | null>(
    null
  );
  const [detectedWords, setDetectedWords] = useState<string[]>([]);

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

  // Check post status when userId is available
  useEffect(() => {
    const checkPostStatus = async () => {
      if (!userId) {
        setPostStatus(null);
        return;
      }

      setCheckingStatus(true);
      try {
        const response = await axios.get<PostStatusResponse>(
          `${API_BASE_URL}/api/public/forum-posts/check-status`,
          { params: { userId } }
        );

        if (response.data.success) {
          setPostStatus(response.data);
          if (response.data.hasPost && response.data.post) {
            setPostContent(response.data.post.content);
            setIsEditing(false);
          } else {
            setPostContent("");
            setIsEditing(false);
          }
        }
      } catch (err) {
        console.error("Error checking post status:", err);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkPostStatus();
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    const fetchForumPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: any = {
          limit: initialLimit,
          offset: 0,
        };
        if (userId) {
          params.userId = userId;
        }

        const response = await axios.get<ForumPostsResponse>(
          `${API_BASE_URL}/api/public/forum-posts`,
          { params }
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
  }, [initialLimit, userId]);

  // Load more posts
  const handleLoadMore = async () => {
    if (!forumData || loadingMore) return;

    setLoadingMore(true);
    try {
      const params: any = {
        limit: 2, // Load 2 more posts
        offset: offset,
      };
      if (userId) {
        params.userId = userId;
      }

      const response = await axios.get<ForumPostsResponse>(
        `${API_BASE_URL}/api/public/forum-posts`,
        { params }
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

  // Refresh posts after creating/editing/deleting
  const refreshPosts = async () => {
    try {
      const params: any = {
        limit: initialLimit,
        offset: 0,
      };
      if (userId) {
        params.userId = userId;
      }

      const response = await axios.get<ForumPostsResponse>(
        `${API_BASE_URL}/api/public/forum-posts`,
        { params }
      );

      if (response.data.success) {
        setForumData(response.data);
        setPosts(response.data.posts);
        setOffset(initialLimit);
      }
    } catch (err) {
      console.error("Error refreshing posts:", err);
    }
  };

  // Handle like/unlike post
  const handleLikePost = async (postId: string, currentlyLiked: boolean) => {
    if (!userId || !postId) return;

    setLikingPostId(postId);
    try {
      const response = await axios.post<LikePostResponse>(
        `${API_BASE_URL}/api/public/forum-posts/${postId}/like`,
        { userId }
      );

      if (response.data.success) {
        // Update the post in the posts array
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId === postId
              ? {
                  ...post,
                  isLiked: response.data.liked,
                  likes: response.data.likes,
                }
              : post
          )
        );
      }
    } catch (err: any) {
      console.error("Error liking post:", err);
      alert(
        err.response?.data?.message || "Failed to like post. Please try again."
      );
    } finally {
      setLikingPostId(null);
    }
  };

  // Create or update post
  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !postContent.trim()) return;

    // Clear any previous moderation warnings
    setModerationWarning(null);
    setDetectedWords([]);

    setPosting(true);
    try {
      if (isEditing && postStatus?.postId) {
        // Update existing post
        const response = await axios.put<UpdatePostResponse>(
          `${API_BASE_URL}/api/public/forum-posts/${postStatus.postId}`,
          { userId, content: postContent.trim() }
        );

        if (response.data.success) {
          setIsEditing(false);
          await refreshPosts();
          // Re-check status to update state
          const statusResponse = await axios.get<PostStatusResponse>(
            `${API_BASE_URL}/api/public/forum-posts/check-status`,
            { params: { userId } }
          );
          if (statusResponse.data.success) {
            setPostStatus(statusResponse.data);
          }
        }
      } else {
        // Create new post
        const response = await axios.post<CreatePostResponse>(
          `${API_BASE_URL}/api/public/forum-posts`,
          { userId, content: postContent.trim() }
        );

        if (response.data.success) {
          setPostContent("");
          await refreshPosts();
          // Re-check status to update state
          const statusResponse = await axios.get<PostStatusResponse>(
            `${API_BASE_URL}/api/public/forum-posts/check-status`,
            { params: { userId } }
          );
          if (statusResponse.data.success) {
            setPostStatus(statusResponse.data);
            if (statusResponse.data.hasPost && statusResponse.data.post) {
              setPostContent(statusResponse.data.post.content);
            }
          }
        }
      }
    } catch (err: any) {
      // Check if this is a content moderation error
      const errorData = err.response?.data;

      if (errorData?.moderationWarning === true) {
        // This is expected - content moderation blocked the post
        // Show user-friendly message, don't throw or show alert
        const moderationError = errorData as ModerationErrorResponse;
        setModerationWarning(
          moderationError.message ||
            "Your post contains inappropriate or offensive content. Please remove any offensive or inappropriate words and try again."
        );
        if (
          moderationError.detectedWords &&
          moderationError.detectedWords.length > 0
        ) {
          setDetectedWords(moderationError.detectedWords);
          console.error(
            "Content moderation blocked post:",
            moderationError.detectedWords
          );
        } else {
          console.error("Content moderation blocked post");
        }
        // Don't throw, just return - this is expected validation behavior
        return;
      }

      // For other errors, handle appropriately
      console.error("Error submitting post:", err);
      alert(errorData?.message || "Failed to submit post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  // Delete post
  const handleDeletePost = async () => {
    if (!userId || !postStatus?.postId) return;

    if (!confirm("Are you sure you want to delete your post?")) {
      return;
    }

    setDeleting(true);
    try {
      const response = await axios.request<DeletePostResponse>({
        method: "DELETE",
        url: `${API_BASE_URL}/api/public/forum-posts/${postStatus.postId}`,
        data: { userId } as any,
      });

      if (response.data.success) {
        setPostContent("");
        setIsEditing(false);
        await refreshPosts();
        // Re-check status to update state
        const statusResponse = await axios.get<PostStatusResponse>(
          `${API_BASE_URL}/api/public/forum-posts/check-status`,
          { params: { userId } }
        );
        if (statusResponse.data.success) {
          setPostStatus(statusResponse.data);
        }
      }
    } catch (err: any) {
      console.error("Error deleting post:", err);
      alert(
        err.response?.data?.message ||
          "Failed to delete post. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  };

  // Start editing
  const handleStartEdit = () => {
    if (postStatus?.post?.content) {
      setPostContent(postStatus.post.content);
      setIsEditing(true);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    if (postStatus?.post?.content) {
      setPostContent(postStatus.post.content);
    } else {
      setPostContent("");
    }
    setIsEditing(false);
    // Clear any moderation warnings when canceling
    setModerationWarning(null);
    setDetectedWords([]);
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
              <span className="post-date">
                on {formatDate(post.timestamp)}
                {post.edited && post.editedAt && (
                  <span className="post-edited"> (edited on {formatDate(post.editedAt)})</span>
                )}
              </span>
            </div>
            <div className="post-content">{post.content}</div>
            {post.attachments && post.attachments.length > 0 && (
              <div className="post-attachments">
                {post.attachments.map((attachment, imgIndex) => {
                  const imageUrl = getAttachmentUrl(attachment);
                  if (!imageUrl) return null;
                  return (
                    <img
                      key={imgIndex}
                      src={imageUrl}
                      alt={`Attachment ${imgIndex + 1}`}
                      className="post-image"
                      loading="lazy"
                      onError={(e) => {
                        console.error("Failed to load image:", imageUrl);
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  );
                })}
              </div>
            )}
            <div className="post-footer">
              {userId && post.postId ? (
                <button
                  className={`like-button ${post.isLiked ? "liked" : ""}`}
                  onClick={() =>
                    handleLikePost(post.postId!, post.isLiked || false)
                  }
                  disabled={likingPostId === post.postId}
                  title={post.isLiked ? "Unlike this post" : "Like this post"}
                >
                  <span className="like-icon">
                    {post.isLiked ? "❤️" : "🤍"}
                  </span>
                  <span className="like-count">
                    {likingPostId === post.postId
                      ? "..."
                      : `${post.likes} ${post.likes === 1 ? "Like" : "Likes"}`}
                  </span>
                </button>
              ) : (
                <span className="post-likes">
                  ❤️ {post.likes} {post.likes === 1 ? "Like" : "Likes"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {forumData.hasMore && (
        <div className="load-more-container">
          <button
            className="load-more-button"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load More Posts"}
          </button>
          {!userId && (
            <p className="load-more-cta">
              Want to add your own post?{" "}
              <span className="cta-highlight">
                Sign up for early access above!
              </span>
            </p>
          )}
        </div>
      )}

      {/* Post Management Section - Only show if user is verified */}
      {userId && (
        <div className="post-management-section">
          {checkingStatus ? (
            <div className="post-management-loading">
              <div className="loading-spinner"></div>
              <p>Checking your post status...</p>
            </div>
          ) : postStatus?.hasPost ? (
            <div className="user-post-section">
              <h3 className="user-post-title">Your Post</h3>
              {!isEditing ? (
                <div className="user-post-display">
                  <div className="user-post-content">
                    {postStatus.post?.content}
                  </div>
                  {postStatus.post?.attachments && postStatus.post.attachments.length > 0 && (
                    <div className="post-attachments">
                      {postStatus.post.attachments.map((attachment, imgIndex) => {
                        const imageUrl = getAttachmentUrl(attachment);
                        if (!imageUrl) return null;
                        return (
                          <img
                            key={imgIndex}
                            src={imageUrl}
                            alt={`Attachment ${imgIndex + 1}`}
                            className="post-image"
                            loading="lazy"
                            onError={(e) => {
                              console.error("Failed to load image:", imageUrl);
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                  <div className="user-post-actions">
                    <button
                      className="edit-post-button"
                      onClick={handleStartEdit}
                      disabled={posting || deleting}
                    >
                      Edit
                    </button>
                    <button
                      className="delete-post-button"
                      onClick={handleDeletePost}
                      disabled={posting || deleting}
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitPost} className="post-form">
                  <textarea
                    className="post-textarea"
                    value={postContent}
                    onChange={(e) => {
                      setPostContent(e.target.value);
                      // Clear moderation warning when user starts typing
                      if (moderationWarning) {
                        setModerationWarning(null);
                        setDetectedWords([]);
                      }
                    }}
                    placeholder="Share your thoughts..."
                    rows={4}
                    required
                    disabled={posting}
                  />
                  {moderationWarning && (
                    <div className="moderation-warning">
                      <p className="moderation-warning-message">
                        ⚠️ {moderationWarning}
                      </p>
                      {detectedWords.length > 0 && (
                        <p className="moderation-detected-words">
                          Detected words: {detectedWords.join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="post-form-actions">
                    <button
                      type="submit"
                      className="submit-post-button"
                      disabled={posting || !postContent.trim()}
                    >
                      {posting ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      className="cancel-post-button"
                      onClick={handleCancelEdit}
                      disabled={posting}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : postStatus?.canPost ? (
            <div className="create-post-section">
              <h3 className="create-post-title">Add Your Post</h3>
              <p className="create-post-subtitle">
                Share your thoughts as {userEmail || "a waitlist member"}
              </p>
              <form onSubmit={handleSubmitPost} className="post-form">
                <textarea
                  className="post-textarea"
                  value={postContent}
                  onChange={(e) => {
                    setPostContent(e.target.value);
                    // Clear moderation warning when user starts typing
                    if (moderationWarning) {
                      setModerationWarning(null);
                      setDetectedWords([]);
                    }
                  }}
                  placeholder="Share your thoughts about your favorite hero..."
                  rows={4}
                  required
                  disabled={posting}
                />
                {moderationWarning && (
                  <div className="moderation-warning">
                    <p className="moderation-warning-message">
                      ⚠️ {moderationWarning}
                    </p>
                    {detectedWords.length > 0 && (
                      <p className="moderation-detected-words">
                        Detected words: {detectedWords.join(", ")}
                      </p>
                    )}
                  </div>
                )}
                <button
                  type="submit"
                  className="submit-post-button"
                  disabled={posting || !postContent.trim()}
                >
                  {posting ? "Posting..." : "Post"}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      )}

      {!userId && (
        <div className="preview-cta">
          <p className="preview-cta-text">
            <strong>Ready to join the conversation?</strong> Sign up for early
            access and become part of our gaming community!
          </p>
        </div>
      )}
    </div>
  );
};

export default ForumPreview;
