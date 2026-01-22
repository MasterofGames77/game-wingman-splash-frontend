export interface SignUpResponse {
    message: string;
    link?: string; // Link is optional, only provided if the user is approved
    position?: number; // Track user's position
    userId?: string; // User ID for early access authentication
    emailSent?: boolean; // Whether the confirmation email was sent successfully
    hasProAccess?: boolean; // Whether user is eligible for 1 year of Wingman Pro (based on position and signup deadline)
    isApproved?: boolean; // Whether user has been approved for early access
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
    forumId?: string | null; // Optional forum ID, defaults to backend default
}

export interface AvailableForum {
    forumId: string;
    title: string;
    gameTitle: string;
    displayTitle?: string; // Optional display title without redundant game name
}

export interface AvailableForumsResponse {
    success: boolean;
    forums: AvailableForum[];
    defaultForumId: string;
    message?: string;
}

// Games list for unified feed filter
export interface Game {
    gameTitle: string;
    postCount: number;
}

export interface GamesListResponse {
    success: boolean;
    games: Game[];
    message?: string;
}

// Reply creation response
export interface ReplyResponse {
    success: boolean;
    message: string;
    reply?: ForumPost;
    requiresAuth?: boolean; // If true, user needs to login/signup
}

// Attachment can be a URL string or an object with url property
export type Attachment = string | { url: string;[key: string]: any };

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
    gameTitle?: string | null; // Game title for unified feed
    categoryDisplayName?: string | null; // Formatted category name (e.g., "Need Tips / Advice")
    forumTitle?: string | null; // Forum title for unified feed
    forumId?: string | null; // Forum ID for unified feed
    parentPostId?: string | null; // For replies - ID of parent post
    replies?: ForumPost[]; // Nested replies
}

export interface ForumPreviewData {
    forumId: string;
    title: string;
    gameTitle: string | null;
    displayTitle?: string; // Optional display title without redundant game name
    category: string | null;
    totalPosts: number;
}

export interface ForumPostsResponse {
    success: boolean;
    forum?: ForumPreviewData; // Optional for unified feed
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

// LinkedIn Posts Types
export interface LinkedInPost {
    id: number;
    title: string;
    content: string;
    linkedInUrl: string;
    game?: string;
    gameTitle?: string;
    imageUrl?: string;
    publishedDate: string;
    hashtags?: string[];
    metadata?: {
        seriesDay?: number;
        featuredStats?: Array<{
            label: string;
            value: string;
            icon?: string;
        }>;
    };
}

export interface LinkedInSeries {
    seriesId: string;
    seriesTitle: string;
    seriesDescription?: string;
    hasIntroPost?: boolean;
    postCount?: number;
}

export interface LinkedInSeriesResponse {
    success: boolean;
    series: LinkedInSeries[];
    message?: string;
}

export interface LinkedInPostsResponse {
    success: boolean;
    series: {
        seriesId: string;
        seriesTitle: string;
    };
    posts: LinkedInPost[];
    count: number;
    hasMore: boolean;
    message?: string;
}

export interface LinkedInIntroPostResponse {
    success: boolean;
    series: {
        seriesId: string;
        seriesTitle: string;
    };
    post: LinkedInPost;
    message?: string;
}

export interface LinkedInPostResponse {
    success: boolean;
    series: {
        seriesId: string;
        seriesTitle: string;
    };
    post: LinkedInPost;
    message?: string;
}

// Question Feature Types
export interface Question {
    id: string;
    email: string;
    question: string;
    response: string; // Contains markdown with shortened URLs
    timestamp: string;
    detectedGame?: string; // Extracted game title
    detectedGenre?: string[]; // Array of genre strings
    imageUrl?: string; // For future image support
}

export interface QuestionResponse {
    question: Question | null;
    message: string;
}

export interface AskQuestionResponse {
    message: string;
    question: Question;
}

export interface AskQuestionErrorResponse {
    message: string;
    existingQuestion?: Question;
    detectedWords?: string[];
}

export interface DeleteQuestionResponse {
    message: string;
}

export interface WaitlistPositionResponse {
    position?: number;
    isApproved: boolean;
    link?: string;
    userId?: string;
    email?: string;
    hasProAccess?: boolean;
    message?: string;
}
