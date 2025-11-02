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
export interface ForumPost {
    author: string;
    content: string;
    timestamp: string;
    likes: number;
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