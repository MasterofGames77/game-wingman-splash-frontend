"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import apiClient from "../utils/apiClient";
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
  UploadImageResponse,
  AvailableForumsResponse,
  AvailableForum,
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
  initialLimit = 5,
  userId,
  userEmail,
  forumId: propForumId,
}) => {
  const [forumData, setForumData] = useState<ForumPostsResponse | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Forum selection state
  const [availableForums, setAvailableForums] = useState<AvailableForum[]>([]);
  const [selectedForumId, setSelectedForumId] = useState<string | null>(null);
  const [defaultForumId, setDefaultForumId] = useState<string | null>(null);
  const [loadingForums, setLoadingForums] = useState(true);

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

  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedImagePublicId, setUploadedImagePublicId] = useState<
    string | null
  >(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageModerationWarning, setImageModerationWarning] = useState<
    string | null
  >(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select an image file");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    // Validate file size (e.g., 5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Image size must be less than 5MB");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setSelectedImage(file);
    setImageModerationWarning(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle button click to trigger file input
  const handleImageButtonClick = () => {
    if (fileInputRef.current && !posting && !uploadingImage) {
      fileInputRef.current.click();
    }
  };

  // Handle image upload
  const handleImageUpload = async (): Promise<{
    success: boolean;
    imageUrl?: string;
    imagePublicId?: string;
  }> => {
    if (!selectedImage || !userId) {
      // console.log("Image upload failed: missing selectedImage or userId", {
      //   selectedImage: !!selectedImage,
      //   userId: !!userId,
      // });
      return { success: false };
    }

    setUploadingImage(true);
    setImageModerationWarning(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedImage);
      formData.append("userId", userId);

      // Don't include postId in image upload - let the frontend handle the PUT request separately
      // The backend's automatic update feature seems to be causing issues

      // Try the new route first, fallback to main app route if 404
      let response;
      try {
        response = await axios.post<UploadImageResponse>(
          `${API_BASE_URL}/api/public/forum-posts/upload-image`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      } catch (firstError: any) {
        // If 404, try the alternative route (main app route)
        if (firstError.response?.status === 404) {
          // console.log(
          //   "Route /api/public/forum-posts/upload-image not found, trying /api/uploadForumImage"
          // );
          response = await axios.post<UploadImageResponse>(
            `${API_BASE_URL}/api/uploadForumImage`,
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );
        } else {
          throw firstError; // Re-throw if it's not a 404
        }
      }

      // Handle multiple response formats:
      // 1. New format: { success: true, images: [{ url, name, size, type }] }
      // 2. Legacy format: { success: true, image: { url, publicId } }
      // 3. Legacy format: { success: true, imageUrl, imagePublicId }

      let imageUrl: string | undefined;
      let imagePublicId: string | undefined;

      // Type assertion to handle the response data
      const responseData = response.data as UploadImageResponse & {
        images?: Array<{ url: string; name: string; publicId?: string }>;
      };

      // Check for new format (images array)
      if (
        responseData.images &&
        Array.isArray(responseData.images) &&
        responseData.images.length > 0
      ) {
        const firstImage = responseData.images[0];
        imageUrl = firstImage.url;
        imagePublicId = firstImage.name || firstImage.publicId; // Use name as publicId fallback
        // console.log("Using new images array format:", firstImage);
      }
      // Check for legacy nested image object format
      else if (responseData.image) {
        imageUrl = responseData.image.url;
        imagePublicId = responseData.image.publicId;
        // console.log("Using legacy image object format");
      }
      // Check for legacy flat format
      else {
        imageUrl = responseData.imageUrl;
        imagePublicId = responseData.imagePublicId;
        // console.log("Using legacy flat format");
      }

      // console.log("Image upload response:", {
      //   success: responseData.success,
      //   hasImagesArray: !!responseData.images,
      //   hasImageObject: !!responseData.image,
      //   imageUrl: imageUrl,
      //   imagePublicId: imagePublicId,
      //   fullResponse: responseData,
      // });

      if (response.data.success && imageUrl) {
        // Validate the image URL format
        if (
          !imageUrl.startsWith("http://") &&
          !imageUrl.startsWith("https://")
        ) {
          console.error("Invalid image URL format:", imageUrl);
          setErrorMessage("Invalid image URL received from server");
          setTimeout(() => setErrorMessage(null), 5000);
          return { success: false };
        }

        // console.log("Setting uploaded image URL:", imageUrl);
        // console.log("Image publicId/name:", imagePublicId);

        // Use the image name as publicId if publicId is not provided
        // The backend returns name in the images array, which we can use for deletion
        // responseData is already declared above
        const finalPublicId =
          imagePublicId ||
          (responseData.images && responseData.images[0]?.name) ||
          "image";

        setUploadedImageUrl(imageUrl);
        setUploadedImagePublicId(finalPublicId);
        // Show success message
        setSuccessMessage(
          response.data.message || "Image uploaded successfully"
        );
        setTimeout(() => setSuccessMessage(null), 3000); // Auto-hide after 3 seconds
        return {
          success: true,
          imageUrl: imageUrl,
          imagePublicId: finalPublicId,
        };
      } else if (response.data.moderationWarning) {
        // Image moderation failed
        setImageModerationWarning(
          response.data.message ||
            "Image contains inappropriate content and cannot be uploaded."
        );
        // Clear selected image
        setSelectedImage(null);
        setImagePreview(null);
        return { success: false };
      } else {
        setErrorMessage(response.data.message || "Failed to upload image");
        setTimeout(() => setErrorMessage(null), 5000); // Auto-hide after 5 seconds
        return { success: false };
      }
    } catch (err: any) {
      const errorData = err.response?.data;

      // Handle 404 specifically - route not found
      if (err.response?.status === 404) {
        console.error("Image upload route not found (404):", {
          attemptedRoutes: [
            `${API_BASE_URL}/api/public/forum-posts/upload-image`,
            `${API_BASE_URL}/api/uploadForumImage`,
          ],
          error: err.message,
        });
        setErrorMessage(
          "Image upload endpoint not found. Please check that the backend server is running and the route is registered."
        );
        setTimeout(() => setErrorMessage(null), 5000);
        return { success: false };
      }

      if (errorData?.moderationWarning) {
        setImageModerationWarning(
          errorData.message ||
            "Image contains inappropriate content and cannot be uploaded."
        );
        setSelectedImage(null);
        setImagePreview(null);
      } else {
        console.error("Error uploading image:", err);
        setErrorMessage(
          errorData?.message ||
            errorData?.error ||
            `Failed to upload image: ${
              err.message || "Unknown error"
            }. Please try again.`
        );
        setTimeout(() => setErrorMessage(null), 5000); // Auto-hide after 5 seconds
      }
      return { success: false };
    } finally {
      setUploadingImage(false);
    }
  };

  // Remove selected/uploaded image
  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setUploadedImageUrl(null);
    setUploadedImagePublicId(null);
    setImageModerationWarning(null);
  };

  // Fetch available forums on mount
  useEffect(() => {
    const fetchAvailableForums = async () => {
      setLoadingForums(true);
      try {
        const response = await axios.get<AvailableForumsResponse>(
          `${API_BASE_URL}/api/public/forum-posts/available-forums`
        );

        if (response.data.success) {
          setAvailableForums(response.data.forums);
          setDefaultForumId(response.data.defaultForumId);

          // Set selected forum: use propForumId if provided, otherwise use default
          const forumToUse = propForumId || response.data.defaultForumId;
          setSelectedForumId(forumToUse);
        }
      } catch (err: any) {
        // Handle errors gracefully - 500/404 are backend issues
        // Only log unexpected errors in development
        if (err?.response?.status !== 500 && err?.response?.status !== 404) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "Error fetching available forums:",
              err?.message || err
            );
          }
        }

        // If offline or backend error, try to find cached forum data
        if (
          !navigator.onLine ||
          err.code === "ERR_NETWORK" ||
          err.response?.status === 503 ||
          err.response?.status === 500 ||
          err.response?.status === 404
        ) {
          try {
            const RUNTIME_CACHE = "wingman-runtime-v2.0";
            const cache = await caches.open(RUNTIME_CACHE);
            const keys = await cache.keys();

            // Try to find any cached forum posts to determine available forums
            const cachedForumIds = new Set<string>();
            for (const key of keys) {
              const keyUrl = new URL(key.url);
              if (keyUrl.pathname === "/api/public/forum-posts") {
                const params = new URLSearchParams(keyUrl.search);
                const forumId = params.get("forumId");
                if (forumId) {
                  cachedForumIds.add(forumId);
                }
              }
            }

            // If we found cached forums, create forum list from cache
            if (cachedForumIds.size > 0) {
              // Create a basic forum list from cached data
              const cachedForums = Array.from(cachedForumIds).map(
                (forumId) => ({
                  forumId,
                  gameTitle: "Cached Forum", // Placeholder
                  title: forumId,
                  category: "general",
                  postCount: 0,
                })
              );

              setAvailableForums(cachedForums);
              // Use first cached forum as default
              const firstCachedForum = cachedForums[0];
              setDefaultForumId(firstCachedForum.forumId);
              const forumToUse = propForumId || firstCachedForum.forumId;
              setSelectedForumId(forumToUse);
              console.log(
                "[ForumPreview] Loaded forums from cache:",
                cachedForums.length
              );
            }
          } catch (cacheErr) {
            console.error("Error loading forums from cache:", cacheErr);
          }
        }
      } finally {
        setLoadingForums(false);
      }
    };

    fetchAvailableForums();
  }, [propForumId]);

  // Check post status when userId or selectedForumId is available
  useEffect(() => {
    const checkPostStatus = async () => {
      if (!userId || !selectedForumId) {
        setPostStatus(null);
        return;
      }

      setCheckingStatus(true);
      try {
        const response = await axios.get<PostStatusResponse>(
          `${API_BASE_URL}/api/public/forum-posts/check-status`,
          { params: { userId, forumId: selectedForumId } }
        );

        if (response.data.success) {
          setPostStatus(response.data);
          if (response.data.hasPost && response.data.post) {
            setPostContent(response.data.post.content);
            setIsEditing(false);
            // Load existing image if present
            if (
              response.data.post.attachments &&
              response.data.post.attachments.length > 0
            ) {
              const firstAttachment = response.data.post.attachments[0];
              const imageUrl = getAttachmentUrl(firstAttachment);
              if (imageUrl) {
                setUploadedImageUrl(imageUrl);
                // Note: publicId might not be in the response, but that's okay for display
              }
            } else {
              setUploadedImageUrl(null);
              setUploadedImagePublicId(null);
            }
          } else {
            setPostContent("");
            setIsEditing(false);
            setUploadedImageUrl(null);
            setUploadedImagePublicId(null);
          }
        }
      } catch (err: any) {
        // Handle errors gracefully - don't show errors for expected failures
        // 500 errors are backend issues, 404 means endpoint doesn't exist yet
        // Only log unexpected errors in development
        if (err?.response?.status === 500 || err?.response?.status === 404) {
          // Backend error or endpoint not found - silently handle
          setPostStatus(null);
        } else if (
          process.env.NODE_ENV === "development" &&
          err?.code !== "ERR_NETWORK"
        ) {
          // Only log non-network errors in development
          console.warn("Error checking post status:", err?.message || err);
        }
        // Network errors are expected when backend is down - don't log
      } finally {
        setCheckingStatus(false);
      }
    };

    checkPostStatus();
  }, [userId, selectedForumId]);

  // Initial fetch - reload when forum changes
  useEffect(() => {
    if (!selectedForumId) return; // Wait for forum to be selected

    const fetchForumPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: any = {
          limit: initialLimit,
          offset: 0,
          forumId: selectedForumId,
        };
        if (userId) {
          params.userId = userId;
        }

        const response = await axios.get<ForumPostsResponse>(
          `${API_BASE_URL}/api/public/forum-posts`,
          { params }
        );

        // Handle offline/cached response
        if (response.status === 503 && (response.data as any)?.offline) {
          // Service worker returned offline response - try direct cache check as fallback
          try {
            const RUNTIME_CACHE = "wingman-runtime-v2.0";
            const cache = await caches.open(RUNTIME_CACHE);

            // Try exact match first
            const requestUrl = `${API_BASE_URL}/api/public/forum-posts?limit=${initialLimit}&offset=0&forumId=${selectedForumId}${
              userId ? `&userId=${userId}` : ""
            }`;
            let cachedResponse = await cache.match(requestUrl);

            // If no exact match, try matching by pathname + forumId
            if (!cachedResponse) {
              const keys = await cache.keys();
              for (const key of keys) {
                const keyUrl = new URL(key.url);
                if (keyUrl.pathname === "/api/public/forum-posts") {
                  const params = new URLSearchParams(keyUrl.search);
                  if (params.get("forumId") === selectedForumId) {
                    cachedResponse = await cache.match(key);
                    if (cachedResponse) break;
                  }
                }
              }
            }

            if (cachedResponse) {
              const cachedData = await cachedResponse.json();
              if (cachedData.success) {
                setForumData(cachedData);
                setPosts(cachedData.posts);
                setOffset(cachedData.posts.length);
                setLoading(false);
                console.log(
                  "[ForumPreview] Loaded from cache after 503 response"
                );
                return;
              }
            }
          } catch (cacheErr) {
            console.error("Error checking cache directly:", cacheErr);
          }

          // No cache available for this specific request
          setError(
            "You're offline and this forum isn't cached. Only forums you've viewed while online are available offline. Please go online to load this forum."
          );
          setLoading(false);
          return;
        }

        if (response.data.success) {
          setForumData(response.data);
          setPosts(response.data.posts);
          setOffset(response.data.posts.length);
        } else {
          setError("Failed to load forum posts");
        }
      } catch (err: any) {
        // Handle errors gracefully - don't log backend errors (500/404)
        const isBackendError =
          err?.response?.status === 500 || err?.response?.status === 404;
        const isNetworkError =
          !navigator.onLine ||
          err.code === "ERR_NETWORK" ||
          err.response?.status === 503;

        // Only log unexpected errors in development
        if (
          !isBackendError &&
          !isNetworkError &&
          process.env.NODE_ENV === "development"
        ) {
          console.warn("Error fetching forum posts:", err?.message || err);
        }

        // Check if offline or network error
        if (isNetworkError) {
          // Check if we got cached data despite the error
          if (err.response?.data && !err.response.data.offline) {
            // We might have cached data in the response
            try {
              const cachedData = err.response.data;
              if (cachedData.success) {
                setForumData(cachedData);
                setPosts(cachedData.posts);
                setOffset(cachedData.posts.length);
                setLoading(false);
                return;
              }
            } catch (e) {
              // Not valid cached data
            }
          }
          setError(
            "You're offline. Forum posts require an internet connection or cached data."
          );
        } else if (isBackendError) {
          // Backend error (500/404) - show user-friendly message
          setError("Unable to load forum preview. Please try again later.");
        } else {
          setError("Unable to load forum preview");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchForumPosts();
  }, [initialLimit, userId, selectedForumId]);

  // Load more posts (for infinite scroll)
  const loadMorePosts = useCallback(async () => {
    if (!forumData || loadingMore || !forumData.hasMore || !selectedForumId)
      return;

    setLoadingMore(true);
    try {
      const params: any = {
        limit: 5, // Load 5 more posts at a time
        offset: offset,
        forumId: selectedForumId,
      };
      if (userId) {
        params.userId = userId;
      }

      const response = await axios.get<ForumPostsResponse>(
        `${API_BASE_URL}/api/public/forum-posts`,
        { params }
      );

      // Handle offline/cached response
      if (response.status === 503 && (response.data as any)?.offline) {
        // Service worker returned offline response - no cache available
        console.log("Offline: No cached posts available for load more");
        setLoadingMore(false);
        return;
      }

      if (response.data.success) {
        setPosts((prev) => [...prev, ...response.data.posts]);
        setForumData((prev) =>
          prev ? { ...prev, hasMore: response.data.hasMore } : response.data
        );
        setOffset((prev) => prev + response.data.posts.length);
      }
    } catch (err: any) {
      // Handle errors gracefully - don't log backend errors (500/404)
      const isBackendError =
        err?.response?.status === 500 || err?.response?.status === 404;
      const isNetworkError =
        !navigator.onLine ||
        err.code === "ERR_NETWORK" ||
        err.response?.status === 503;

      // Only log unexpected errors in development
      if (
        !isBackendError &&
        !isNetworkError &&
        process.env.NODE_ENV === "development"
      ) {
        console.warn("Error loading more posts:", err?.message || err);
      }

      // Handle offline scenarios gracefully
      if (isNetworkError) {
        // Check if it's an offline response with cached data
        if (err.response?.data?.offline) {
          console.log("Offline: No cached posts available for load more");
        } else {
          console.log("Offline: Cannot load more posts");
        }
        // Don't show error to user - just silently fail
      }
    } finally {
      setLoadingMore(false);
    }
  }, [forumData, loadingMore, offset, userId, selectedForumId]);

  // Infinite scroll handler
  useEffect(() => {
    const handleScroll = () => {
      // Check if we're near the bottom of the page
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Trigger when user is within 300px of the bottom
      const threshold = 300;

      if (
        documentHeight - (scrollTop + windowHeight) < threshold &&
        forumData?.hasMore &&
        !loadingMore
      ) {
        loadMorePosts();
      }
    };

    // Throttle scroll events for better performance
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", throttledHandleScroll);
    return () => {
      window.removeEventListener("scroll", throttledHandleScroll);
    };
  }, [forumData?.hasMore, loadingMore, loadMorePosts]);

  // Refresh posts after creating/editing/deleting
  const refreshPosts = async () => {
    if (!selectedForumId) return;

    try {
      const params: any = {
        limit: initialLimit,
        offset: 0,
        forumId: selectedForumId,
      };
      if (userId) {
        params.userId = userId;
      }

      const response = await axios.get<ForumPostsResponse>(
        `${API_BASE_URL}/api/public/forum-posts`,
        { params }
      );

      // Handle offline/cached response
      if (response.status === 503 && (response.data as any)?.offline) {
        // Service worker returned offline response - can't refresh
        console.log("Offline: Cannot refresh posts");
        return;
      }

      if (response.data.success) {
        setForumData(response.data);
        setPosts(response.data.posts);
        setOffset(response.data.posts.length);
      }
    } catch (err: any) {
      // Handle errors gracefully - don't log backend errors (500/404)
      const isBackendError =
        err?.response?.status === 500 || err?.response?.status === 404;
      const isNetworkError =
        !navigator.onLine ||
        err.code === "ERR_NETWORK" ||
        err.response?.status === 503;

      // Only log unexpected errors in development
      if (
        !isBackendError &&
        !isNetworkError &&
        process.env.NODE_ENV === "development"
      ) {
        console.warn("Error refreshing posts:", err?.message || err);
      }

      // Silently fail when offline or backend error - don't show error
      if (isNetworkError) {
        console.log("Offline: Cannot refresh posts");
      }
      // Backend errors (500/404) are silently handled - no user notification needed
    }
  };

  // Handle like/unlike post
  const handleLikePost = async (postId: string, currentlyLiked: boolean) => {
    if (!userId || !postId || !selectedForumId) return;

    setLikingPostId(postId);
    try {
      const response = await apiClient.post<LikePostResponse>(
        `/api/public/forum-posts/${postId}/like`,
        { userId, forumId: selectedForumId }
      );

      // Handle queued response
      if (response.status === 202 || (response.data as any)?.queued) {
        // Request was queued - show optimistic update
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId === postId
              ? {
                  ...post,
                  isLiked: !currentlyLiked,
                  likes: currentlyLiked ? post.likes - 1 : post.likes + 1,
                }
              : post
          )
        );
        return;
      }

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

      // If offline and request was queued, show success message instead of error
      if (
        err.code === "OFFLINE_QUEUED" ||
        err.response?.status === 202 ||
        (err.response?.data as any)?.queued
      ) {
        // Request was queued - show optimistic update
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId === postId
              ? {
                  ...post,
                  isLiked: !currentlyLiked,
                  likes: currentlyLiked ? post.likes - 1 : post.likes + 1,
                }
              : post
          )
        );
        return;
      }

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
    if (!userId) return;

    // Validate: must have either content or image (or both)
    const hasContent = postContent.trim().length > 0;
    const hasImage = uploadedImageUrl && uploadedImagePublicId;
    const hasNewImage = selectedImage && !uploadedImageUrl;

    if (!hasContent && !hasImage && !hasNewImage) {
      setErrorMessage("Please add a message or upload an image");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    // Clear any previous moderation warnings
    setModerationWarning(null);
    setDetectedWords([]);
    setImageModerationWarning(null);

    setPosting(true);
    try {
      // Track if post had an image before editing
      const hadImageBefore =
        isEditing &&
        postStatus?.post?.attachments &&
        postStatus.post.attachments.length > 0;

      // If there's a new image selected, upload it first
      let finalImageUrl = uploadedImageUrl;
      let finalImagePublicId = uploadedImagePublicId;

      // Always upload if a new image file is selected (even if there's an existing image)
      if (selectedImage) {
        // console.log("New image selected, uploading...");
        // console.log(
        //   "Current state - isEditing:",
        //   isEditing,
        //   "postId:",
        //   postStatus?.postId
        // );
        const uploadResult = await handleImageUpload();
        // console.log("Upload result:", uploadResult);
        if (
          !uploadResult.success ||
          !uploadResult.imageUrl ||
          !uploadResult.imagePublicId
        ) {
          console.error("Image upload failed, aborting post update");
          setPosting(false);
          return; // Image upload failed or was moderated
        }
        // console.log("Image uploaded successfully:", uploadResult.imageUrl);
        finalImageUrl = uploadResult.imageUrl;
        finalImagePublicId = uploadResult.imagePublicId;
        // Also update state immediately
        setUploadedImageUrl(uploadResult.imageUrl);
        setUploadedImagePublicId(uploadResult.imagePublicId);
      } else {
        // console.log("No new image selected. Using existing:", finalImageUrl);
      }

      // console.log(
      //   "About to check if editing. isEditing:",
      //   isEditing,
      //   "postId:",
      //   postStatus?.postId
      // );
      // console.log(
      //   "Final image URL:",
      //   finalImageUrl,
      //   "Final image PublicId:",
      //   finalImagePublicId
      // );

      if (isEditing && postStatus?.postId) {
        // console.log("Proceeding with PUT request to update post");
        // console.log(
        //   "PUT URL will be:",
        //   `${API_BASE_URL}/api/public/forum-posts/${postStatus.postId}`
        // );
        // Update existing post
        const updateData: any = {
          userId,
        };

        // Always include content (even if empty, backend might need it)
        if (postContent.trim()) {
          updateData.content = postContent.trim();
        }

        // Handle image changes - use attachments array format (like main app)
        if (finalImageUrl && finalImagePublicId) {
          // Image is present (either new upload or existing)
          // Validate URL before sending
          if (
            !finalImageUrl.startsWith("http://") &&
            !finalImageUrl.startsWith("https://")
          ) {
            console.error("Invalid image URL in update data:", finalImageUrl);
            setErrorMessage(
              "Invalid image URL. Please try uploading the image again."
            );
            setTimeout(() => setErrorMessage(null), 5000);
            setPosting(false);
            setIsEditing(false);
            return;
          }
          // Use attachments array format (like main app) - this is more reliable
          updateData.attachments = [
            {
              type: "image",
              url: finalImageUrl,
              name: finalImagePublicId || "image",
              publicId: finalImagePublicId, // Include publicId for deletion
            },
          ];
          // console.log("Including image in update (attachments format):", {
          //   attachments: updateData.attachments,
          //   imageUrl: finalImageUrl,
          //   imagePublicId: finalImagePublicId,
          //   urlPreview: finalImageUrl.substring(0, 80) + "...",
          //   fullUrl: finalImageUrl, // Log full URL for debugging
          //   urlIsImageKit: finalImageUrl.includes("ik.imagekit.io"),
          // });

          // Warn if URL doesn't look like a valid ImageKit URL
          if (
            !finalImageUrl.includes("ik.imagekit.io") &&
            !finalImageUrl.includes("imagekit")
          ) {
            console.warn(
              "Image URL doesn't appear to be from ImageKit:",
              finalImageUrl
            );
          }
        } else if (hadImageBefore && !finalImageUrl && !finalImagePublicId) {
          // Post had image before but now it's removed (user clicked remove)
          updateData.removeImage = true;
          // console.log("Removing image from post");
        } else {
          // console.log("No image changes - keeping existing or no image");
        }

        // Always ensure we have content or image (backend requirement)
        if (
          !updateData.content &&
          !updateData.attachments &&
          !updateData.removeImage
        ) {
          // This shouldn't happen due to validation, but just in case
          console.warn("Update request has neither content nor image");
        }

        // console.log("Updating post with data:", updateData);
        // console.log("Post ID:", postStatus.postId);
        // console.log("Post ID type:", typeof postStatus.postId);
        // console.log("Post ID length:", postStatus.postId?.length);

        // Validate postId before making request
        if (
          !postStatus.postId ||
          typeof postStatus.postId !== "string" ||
          postStatus.postId.trim().length === 0
        ) {
          console.error("Invalid postId:", postStatus.postId);
          setErrorMessage(
            "Invalid post ID. Please refresh the page and try again."
          );
          setTimeout(() => setErrorMessage(null), 5000);
          setPosting(false);
          setIsEditing(false);
          return;
        }

        // Ensure postId is a valid MongoDB ObjectId format (24 hex characters)
        const postIdPattern = /^[0-9a-fA-F]{24}$/;
        if (!postIdPattern.test(postStatus.postId)) {
          console.error(
            "PostId is not a valid MongoDB ObjectId:",
            postStatus.postId
          );
          setErrorMessage(
            "Invalid post ID format. Please refresh the page and try again."
          );
          setTimeout(() => setErrorMessage(null), 5000);
          setPosting(false);
          setIsEditing(false);
          return;
        }

        try {
          const putUrl = `${API_BASE_URL}/api/public/forum-posts/${postStatus.postId}`;
          // console.log("Sending PUT request to:", putUrl);
          // console.log(
          //   "PUT request payload:",
          //   JSON.stringify(updateData, null, 2)
          // );

          // Add forumId to update data
          if (selectedForumId) {
            updateData.forumId = selectedForumId;
          }

          const response = await apiClient.put<UpdatePostResponse>(
            `/api/public/forum-posts/${postStatus.postId}`,
            updateData
          );

          // Handle queued response
          if (response.status === 202 || (response.data as any)?.queued) {
            setSuccessMessage(
              "Post update queued. It will be saved when you're back online."
            );
            setTimeout(() => setSuccessMessage(null), 5000);
            setIsEditing(false);
            setPosting(false);
            return;
          }

          // console.log("Update response:", response.data);

          if (response.data.success) {
            // Show success message
            setSuccessMessage("Post updated successfully");
            setTimeout(() => setSuccessMessage(null), 3000);

            // Close edit mode immediately - do this first
            setIsEditing(false);

            // Clear temporary image state
            setSelectedImage(null);
            setImagePreview(null);

            // Refresh posts list
            await refreshPosts();

            // Re-check status to update state with new image
            const statusResponse = await axios.get<PostStatusResponse>(
              `${API_BASE_URL}/api/public/forum-posts/check-status`,
              { params: { userId, forumId: selectedForumId } }
            );
            // console.log("Status check response:", statusResponse.data);

            if (statusResponse.data.success) {
              setPostStatus(statusResponse.data);
              // Reload image from updated post
              if (statusResponse.data.hasPost && statusResponse.data.post) {
                setPostContent(statusResponse.data.post.content);
                if (
                  statusResponse.data.post.attachments &&
                  statusResponse.data.post.attachments.length > 0
                ) {
                  const firstAttachment =
                    statusResponse.data.post.attachments[0];
                  const imageUrl = getAttachmentUrl(firstAttachment);
                  // console.log("Loaded image from post:", {
                  //   imageUrl: imageUrl,
                  //   attachment: firstAttachment,
                  //   attachmentType: typeof firstAttachment,
                  // });
                  if (imageUrl) {
                    // Verify the image URL is valid before setting it
                    if (
                      imageUrl.startsWith("http://") ||
                      imageUrl.startsWith("https://")
                    ) {
                      setUploadedImageUrl(imageUrl);
                      // Extract publicId from attachment if available
                      if (
                        typeof firstAttachment === "object" &&
                        "publicId" in firstAttachment
                      ) {
                        setUploadedImagePublicId(
                          firstAttachment.publicId as string
                        );
                      }
                    } else {
                      console.warn(
                        "Invalid image URL format from post:",
                        imageUrl
                      );
                      setUploadedImageUrl(null);
                      setUploadedImagePublicId(null);
                    }
                  } else {
                    setUploadedImageUrl(null);
                    setUploadedImagePublicId(null);
                  }
                } else {
                  // console.log("No attachments in updated post");
                  setUploadedImageUrl(null);
                  setUploadedImagePublicId(null);
                }
              }
            }
          } else {
            // Update failed - show error but still close edit mode
            console.error("Update failed:", response.data);
            setErrorMessage(response.data.message || "Failed to update post");
            setTimeout(() => setErrorMessage(null), 5000);
            setIsEditing(false);
          }
        } catch (updateError: any) {
          console.error("Error updating post:", updateError);
          console.error("Error response:", updateError.response?.data);
          console.error("Error status:", updateError.response?.status);
          console.error("Error message:", updateError.message);

          // Check if it's a network error or server error
          const errorMessage =
            updateError.response?.data?.message ||
            updateError.response?.data?.error ||
            updateError.message ||
            "Failed to update post. Please try again.";

          // If the image was uploaded successfully but the update failed,
          // the image is still in ImageKit, so we should still close the edit UI
          // and let the user know they may need to refresh
          if (finalImageUrl && finalImagePublicId) {
            console.warn(
              "Image was uploaded but post update failed. Image URL:",
              finalImageUrl
            );
            setErrorMessage(
              `${errorMessage} The image was uploaded successfully. Please refresh the page to see it.`
            );
          } else {
            setErrorMessage(errorMessage);
          }

          setTimeout(() => setErrorMessage(null), 5000);
          setIsEditing(false);
        }
      } else {
        // Create new post
        try {
          const createData: any = {
            userId,
            content: postContent.trim() || undefined,
          };

          // Use attachments array format (like main app) - this is more reliable
          if (finalImageUrl && finalImagePublicId) {
            // Validate URL before sending
            if (
              !finalImageUrl.startsWith("http://") &&
              !finalImageUrl.startsWith("https://")
            ) {
              console.error("Invalid image URL in create data:", finalImageUrl);
              setErrorMessage(
                "Invalid image URL. Please try uploading the image again."
              );
              setTimeout(() => setErrorMessage(null), 5000);
              setPosting(false);
              return;
            }
            createData.attachments = [
              {
                type: "image",
                url: finalImageUrl,
                name: finalImagePublicId || "image",
                publicId: finalImagePublicId, // Include publicId for deletion
              },
            ];
            // console.log("Including image in create (attachments format):", {
            //   attachments: createData.attachments,
            //   imageUrl: finalImageUrl,
            //   imagePublicId: finalImagePublicId,
            // });
          }

          // Add forumId to create data
          if (selectedForumId) {
            createData.forumId = selectedForumId;
          }

          const response = await apiClient.post<CreatePostResponse>(
            `/api/public/forum-posts`,
            createData
          );

          // Handle queued response
          if (response.status === 202 || (response.data as any)?.queued) {
            setPostContent("");
            setSelectedImage(null);
            setImagePreview(null);
            setUploadedImageUrl(null);
            setUploadedImagePublicId(null);
            setSuccessMessage(
              "Post queued. It will be published when you're back online."
            );
            setTimeout(() => setSuccessMessage(null), 5000);
            setPosting(false);
            return;
          }

          if (response.data.success) {
            setPostContent("");
            // Clear image state
            setSelectedImage(null);
            setImagePreview(null);
            setUploadedImageUrl(null);
            setUploadedImagePublicId(null);
            await refreshPosts();
            // Re-check status to update state
            const statusResponse = await axios.get<PostStatusResponse>(
              `${API_BASE_URL}/api/public/forum-posts/check-status`,
              { params: { userId, forumId: selectedForumId } }
            );
            if (statusResponse.data.success) {
              setPostStatus(statusResponse.data);
              if (statusResponse.data.hasPost && statusResponse.data.post) {
                setPostContent(statusResponse.data.post.content);
              }
            }
          }
        } catch (createError: any) {
          console.error("Error creating post:", createError);
          const errorData = createError.response?.data;
          setErrorMessage(
            errorData?.message || "Failed to create post. Please try again."
          );
          setTimeout(() => setErrorMessage(null), 5000);
        }
      }
    } catch (err: any) {
      // Check if this is a content moderation error
      const errorData = err.response?.data;

      console.error("Error in handleSubmitPost:", err);
      console.error("Error response data:", errorData);

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
        // But still close edit mode if we're editing
        if (isEditing) {
          setIsEditing(false);
        }
        return;
      }

      // For other errors, handle appropriately
      console.error("Error submitting post:", err);
      setErrorMessage(
        errorData?.message || "Failed to submit post. Please try again."
      );
      setTimeout(() => setErrorMessage(null), 5000);
      // Always close edit mode on error so user isn't stuck
      if (isEditing) {
        setIsEditing(false);
      }
    } finally {
      setPosting(false);
    }
  };

  // Delete post
  const handleDeletePost = async () => {
    if (!userId || !postStatus?.postId) return;
    setShowDeleteModal(true);
  };

  // Confirm delete post
  const handleConfirmDelete = async () => {
    if (!userId || !postStatus?.postId) return;

    setShowDeleteModal(false);
    setDeleting(true);
    try {
      const response = await apiClient.delete<DeletePostResponse>(
        `/api/public/forum-posts/${postStatus.postId}`,
        {
          params: { userId, forumId: selectedForumId },
        }
      );

      // Handle queued response
      if (response.status === 202 || (response.data as any)?.queued) {
        setPostContent("");
        setIsEditing(false);
        setSuccessMessage(
          "Post deletion queued. It will be deleted when you're back online."
        );
        setTimeout(() => setSuccessMessage(null), 5000);
        setDeleting(false);
        return;
      }

      if (response.data.success) {
        setPostContent("");
        setIsEditing(false);
        await refreshPosts();
        // Re-check status to update state
        const statusResponse = await axios.get<PostStatusResponse>(
          `${API_BASE_URL}/api/public/forum-posts/check-status`,
          { params: { userId, forumId: selectedForumId } }
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

  // Cancel delete
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
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
    // Reset image state to existing image
    if (
      postStatus?.post?.attachments &&
      postStatus.post.attachments.length > 0
    ) {
      const firstAttachment = postStatus.post.attachments[0];
      const imageUrl = getAttachmentUrl(firstAttachment);
      if (imageUrl) {
        setUploadedImageUrl(imageUrl);
      }
    } else {
      setSelectedImage(null);
      setImagePreview(null);
      setUploadedImageUrl(null);
      setUploadedImagePublicId(null);
    }
  };

  if (loadingForums) {
    return (
      <div className="preview-section forum-preview">
        <div className="loading-spinner"></div>
        <p className="preview-loading-text">Loading forums...</p>
      </div>
    );
  }

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
        {!navigator.onLine && (
          <p
            className="preview-error"
            style={{ fontSize: "0.9rem", marginTop: "8px", opacity: 0.8 }}
          >
            💡 Tip: Load posts while online to view them offline later.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="preview-section forum-preview">
      {/* Success/Error Toast Messages */}
      {successMessage && (
        <div className="toast-message toast-success">
          <span className="toast-icon">✓</span>
          <span className="toast-text">{successMessage}</span>
          <button
            className="toast-close"
            onClick={() => setSuccessMessage(null)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
      {errorMessage && (
        <div className="toast-message toast-error">
          <span className="toast-icon">⚠</span>
          <span className="toast-text">{errorMessage}</span>
          <button
            className="toast-close"
            onClick={() => setErrorMessage(null)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Delete Post</h3>
            <p className="modal-message">
              Are you sure you want to delete your post?
            </p>
            <div className="modal-actions">
              <button
                className="modal-button modal-button-cancel"
                onClick={handleCancelDelete}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="modal-button modal-button-confirm"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="preview-header">
        <h2 className="preview-title">Join Our Gaming Community</h2>
        <p className="preview-subtitle">
          See what gamers are discussing about{" "}
          {forumData.forum.gameTitle && (
            <span className="game-title">{forumData.forum.gameTitle}</span>
          )}
        </p>
        {/* Forum Selector */}
        {availableForums.length > 1 && (
          <div className="forum-selector-container">
            <label htmlFor="forum-select" className="forum-selector-label">
              Select Forum:
            </label>
            <select
              id="forum-select"
              className="forum-selector"
              value={selectedForumId || ""}
              onChange={async (e) => {
                const newForumId = e.target.value;

                // If offline, check if we can load this forum from cache first
                if (!navigator.onLine && newForumId !== selectedForumId) {
                  // Try to check cache before changing
                  try {
                    const testUrl = `${API_BASE_URL}/api/public/forum-posts?limit=${initialLimit}&offset=0&forumId=${newForumId}`;
                    // Check cache using the same strategy as service worker
                    const RUNTIME_CACHE = "wingman-runtime-v2.0";
                    const cache = await caches.open(RUNTIME_CACHE);

                    // Try exact match first
                    let cachedResponse = await cache.match(testUrl);

                    // If no exact match, try matching by pathname + forumId
                    if (!cachedResponse) {
                      const keys = await cache.keys();
                      for (const key of keys) {
                        const keyUrl = new URL(key.url);
                        if (keyUrl.pathname === "/api/public/forum-posts") {
                          const params = new URLSearchParams(keyUrl.search);
                          if (params.get("forumId") === newForumId) {
                            cachedResponse = await cache.match(key);
                            if (cachedResponse) break;
                          }
                        }
                      }
                    }

                    if (!cachedResponse) {
                      // No cache available - show warning but don't change
                      setErrorMessage(
                        `This forum isn't cached offline. Please go online to load it, or select a forum you've viewed while online.`
                      );
                      setTimeout(() => setErrorMessage(null), 5000);
                      // Reset dropdown to previous value
                      e.target.value = selectedForumId || "";
                      return;
                    }
                  } catch (err) {
                    // Cache check failed - allow the change and let it fail gracefully
                  }
                }

                setSelectedForumId(newForumId);
                // Reset posts and offset when switching forums
                setPosts([]);
                setOffset(0);
                setForumData(null);
                // Reset post status to check for new forum
                setPostStatus(null);
                setPostContent("");
                setIsEditing(false);
                setUploadedImageUrl(null);
                setUploadedImagePublicId(null);
                setSelectedImage(null);
                setImagePreview(null);
              }}
              disabled={loading || loadingForums}
            >
              {availableForums.map((forum) => {
                // Prioritize displayTitle (explicit field from backend)
                // Fallback to title (backend now sets it correctly)
                // Final fallback: construct from gameTitle and title
                const displayText =
                  forum.displayTitle ||
                  forum.title ||
                  `${forum.gameTitle} - ${forum.title}`;
                return (
                  <option key={forum.forumId} value={forum.forumId}>
                    {displayText}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      <div className="forum-info">
        <h3 className="forum-topic-title">
          {forumData.forum.displayTitle || forumData.forum.title}
        </h3>
        {forumData.forum.category && (
          <span className="forum-category">{forumData.forum.category}</span>
        )}
      </div>

      <div className="forum-posts-container" ref={scrollContainerRef}>
        {posts.map((post, index) => (
          <div key={index} className="forum-post-preview">
            <div className="post-header">
              <span className="post-author">Posted by {post.author}</span>
              <span className="post-date">
                on {formatDate(post.timestamp)}
                {post.edited && post.editedAt && (
                  <span className="post-edited">
                    {" "}
                    (edited on {formatDate(post.editedAt)})
                  </span>
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
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={imgIndex}
                      src={imageUrl}
                      alt={`Attachment ${imgIndex + 1}`}
                      className="post-image"
                      loading="lazy"
                      onError={(e) => {
                        // Silently hide broken images - don't log as error since this is expected
                        // when images are uploaded but not yet saved to posts, or when images are deleted
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
          {loadingMore && (
            <div className="loading-more-indicator">
              <div className="loading-spinner"></div>
              <p className="loading-more-text">Loading more posts...</p>
            </div>
          )}
          {!userId && !loadingMore && (
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
                  <div className="post-header">
                    <span className="post-author">
                      Posted by {userEmail || "you"}
                    </span>
                    <span className="post-date">
                      on{" "}
                      {postStatus.post?.timestamp
                        ? formatDate(postStatus.post.timestamp)
                        : "Unknown date"}
                      {postStatus.post?.edited && postStatus.post?.editedAt && (
                        <span className="post-edited">
                          {" "}
                          (edited on {formatDate(postStatus.post.editedAt)})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="user-post-content">
                    {postStatus.post?.content}
                  </div>
                  {postStatus.post?.attachments &&
                    postStatus.post.attachments.length > 0 && (
                      <div className="post-attachments">
                        {postStatus.post.attachments.map(
                          (attachment, imgIndex) => {
                            const imageUrl = getAttachmentUrl(attachment);
                            if (!imageUrl) return null;
                            return (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={imgIndex}
                                src={imageUrl}
                                alt={`Attachment ${imgIndex + 1}`}
                                className="post-image"
                                loading="lazy"
                                onError={(e) => {
                                  // Silently hide broken images - don't log as error
                                  // This is expected when images are uploaded but not yet saved to posts
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            );
                          }
                        )}
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
                <form
                  onSubmit={handleSubmitPost}
                  className="post-form edit-post-form"
                >
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
                    disabled={posting}
                  />
                  {/* Image Upload Section - Inline layout */}
                  <div className="image-upload-section-inline">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      disabled={posting || uploadingImage}
                      className="image-upload-input"
                    />
                    <button
                      type="button"
                      className="change-image-button"
                      onClick={handleImageButtonClick}
                      disabled={posting || uploadingImage}
                    >
                      {uploadingImage
                        ? "Uploading..."
                        : uploadedImageUrl || selectedImage
                        ? "Change Image"
                        : "Upload Image"}
                    </button>
                    {(imagePreview || uploadedImageUrl) && (
                      <div className="image-preview-inline">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagePreview || uploadedImageUrl || ""}
                          alt="Preview"
                          className="image-preview-small"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="remove-image-button"
                          disabled={posting || uploadingImage}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    {imageModerationWarning && (
                      <div className="moderation-warning">
                        <p className="moderation-warning-message">
                          ⚠️ {imageModerationWarning}
                        </p>
                      </div>
                    )}
                  </div>
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
                      disabled={
                        posting ||
                        (!postContent.trim() &&
                          !uploadedImageUrl &&
                          !selectedImage)
                      }
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
              <form
                onSubmit={handleSubmitPost}
                className="post-form create-post-form"
              >
                <textarea
                  className="post-textarea create-textarea"
                  value={postContent}
                  onChange={(e) => {
                    setPostContent(e.target.value);
                    // Clear moderation warning when user starts typing
                    if (moderationWarning) {
                      setModerationWarning(null);
                      setDetectedWords([]);
                    }
                  }}
                  placeholder="What's new..?"
                  rows={6}
                  disabled={posting}
                />
                {/* Image Upload Section - Inline layout (matching main app) */}
                <div className="image-upload-section-inline">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    disabled={posting || uploadingImage}
                    className="image-upload-input"
                  />
                  <button
                    type="button"
                    className="attach-images-button"
                    onClick={handleImageButtonClick}
                    disabled={posting || uploadingImage}
                  >
                    <span className="attach-icon">🖼️</span>
                    <span className="attach-text">
                      {uploadingImage
                        ? "Uploading..."
                        : "Add Screenshot (max 1)"}
                    </span>
                  </button>
                  {(imagePreview || uploadedImageUrl) && (
                    <div className="image-preview-inline">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview || uploadedImageUrl || ""}
                        alt="Preview"
                        className="image-preview-small"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="remove-image-button"
                        disabled={posting || uploadingImage}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {imageModerationWarning && (
                    <div className="moderation-warning">
                      <p className="moderation-warning-message">
                        ⚠️ {imageModerationWarning}
                      </p>
                    </div>
                  )}
                </div>
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
                  className="post-submit-button"
                  disabled={
                    posting ||
                    (!postContent.trim() && !uploadedImageUrl && !selectedImage)
                  }
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
