export interface SignUpResponse {
    message: string;
    link?: string; // Link is optional, only provided if the user is approved
    position?: number; // Track user's position
    userId?: string; // User ID for early access authentication
}
  
export interface FormState {
    email: string;
    message: string;
    loading: boolean;
    link: string | null;
    position: number | null;
    userId: string | null;
}

export interface AuthContextType {
    token: string | null;
    isAuthenticated: boolean;
    setAuth: (token: string | null) => void;
    clearAuth: () => void;
}

// Forum Preview Types
export interface ForumPreviewProps {
    initialLimit?: number;
    userId?: string | null;
    userEmail?: string | null;
}

// Attachment can be a URL string or an object with url property
export type Attachment = string | { url: string; [key: string]: any };

export interface ForumPost {
    author: string;
    content: string;
    timestamp: string;
    likes: number;
    postId?: string; // For like operations
    isLiked?: boolean; // Whether current user has liked this post
    attachments?: Attachment[]; // Array of image URLs or attachment objects
    edited?: boolean; // Whether the post has been edited
    editedAt?: string | null; // Timestamp of the last edit (or null if never edited)
}

export interface ForumPreviewData {
    forumId: string;
    title: string;
    gameTitle: string | null;
    category: string | null;
    totalPosts: number;
}

export interface ForumPostsResponse {
    success: boolean;
    forum: ForumPreviewData;
    posts: ForumPost[];
    count: number;
    hasMore: boolean;
}

// Post Management Types
export interface VerifyUserResponse {
    success: boolean;
    userId?: string;
    email?: string;
    isApproved?: boolean;
    hasProAccess?: boolean;
    message?: string;
}

export interface PostStatusResponse {
    success: boolean;
    canPost: boolean;
    hasPost: boolean;
    postId?: string;
    post?: {
        content: string;
        timestamp: string;
        attachments?: Attachment[]; // Array of image URLs or attachment objects
        edited?: boolean; // Whether the post has been edited
        editedAt?: string | null; // Timestamp of the last edit (or null if never edited)
    };
    message?: string;
}

// Image Upload Types
export interface UploadImageResponse {
    success: boolean;
    imageUrl?: string; // Legacy support
    imagePublicId?: string; // Legacy support
    image?: {
        url: string;
        publicId: string;
        name?: string;
        size?: number;
        type?: string;
    };
    // New format: images array (matches main app and new backend)
    images?: Array<{
        url: string;
        name: string;
        size?: number;
        type?: string;
        publicId?: string;
    }>;
    count?: number; // Number of images uploaded
    message?: string;
    moderationWarning?: boolean;
    detectedContent?: string[];
}

export interface CreatePostResponse {
    success: boolean;
    message: string;
    postId?: string;
    post?: ForumPost;
}

export interface UpdatePostResponse {
    success: boolean;
    message: string;
    postId?: string;
}

export interface DeletePostResponse {
    success: boolean;
    message: string;
}

export interface LikePostResponse {
    success: boolean;
    message: string;
    liked: boolean; // Whether the post is now liked (true) or unliked (false)
    likes: number; // Updated like count
}

// Content Moderation Error Response
export interface ModerationErrorResponse {
    success: false;
    message: string;
    detectedWords?: string[];
    moderationWarning: true;
}