"use client";

import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../utils/apiClient";
import {
  Question,
  QuestionResponse,
  AskQuestionResponse,
  AskQuestionErrorResponse,
  WaitlistPositionResponse,
} from "../../types";

interface QuestionSectionProps {
  userEmail: string | null;
}

const QuestionSection: React.FC<QuestionSectionProps> = ({ userEmail }) => {
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionInput, setQuestionInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedWords, setDetectedWords] = useState<string[]>([]);
  const [isResponseExpanded, setIsResponseExpanded] = useState(true);

  // Load existing question
  const loadQuestion = useCallback(async (email: string) => {
    try {
      const response = await apiClient.get<QuestionResponse>(
        `/api/questions?email=${encodeURIComponent(email)}`
      );
      if (response.data.question) {
        setCurrentQuestion(response.data.question);
        setIsResponseExpanded(true); // Reset to expanded when loading a question
      }
    } catch (error) {
      console.error("Error loading question:", error);
    }
  }, []);

  // Check eligibility and load existing question
  const checkEligibility = useCallback(
    async (email: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<WaitlistPositionResponse>(
          `/api/getWaitlistPosition?email=${encodeURIComponent(email)}`
        );
        setEligible(true);
        // Load existing question if eligible
        await loadQuestion(email);
      } catch (error: any) {
        if (error.response?.status === 404) {
          setEligible(false);
          setError("Please sign up for early access first");
        } else {
          setEligible(false);
          setError("Error checking eligibility. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [loadQuestion]
  );

  // Submit question
  const submitQuestion = useCallback(
    async (email: string, question: string) => {
      if (!question.trim()) {
        setError("Please enter a question");
        return;
      }

      setIsSubmitting(true);
      setError(null);
      setDetectedWords([]);

      try {
        const response = await apiClient.post<
          AskQuestionResponse | AskQuestionErrorResponse
        >("/api/questions", { email, question: question.trim() });

        if (response.status === 409) {
          // User already has a question
          const errorData = response.data as AskQuestionErrorResponse;
          setCurrentQuestion(errorData.existingQuestion || null);
          setError(errorData.message);
          if (errorData.detectedWords) {
            setDetectedWords(errorData.detectedWords);
          }
        } else if (response.status === 201) {
          const successData = response.data as AskQuestionResponse;
          setCurrentQuestion(successData.question);
          setIsResponseExpanded(true); // Reset to expanded when new question is submitted
          setQuestionInput(""); // Clear input
          setError(null);
        } else {
          setError(
            (response.data as any).message || "Failed to submit question"
          );
        }
      } catch (error: any) {
        if (error.response?.status === 400) {
          const errorData = error.response.data as AskQuestionErrorResponse;
          setError(errorData.message);
          if (errorData.detectedWords) {
            setDetectedWords(errorData.detectedWords);
          }
        } else if (error.response?.status === 404) {
          setError("Email not found. Please sign up for early access first.");
        } else if (error.response?.status === 429) {
          setError("Rate limit exceeded. Please wait a moment.");
        } else {
          setError("An error occurred. Please try again.");
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  // Delete question
  const deleteQuestion = useCallback(
    async (questionId: string, email: string) => {
      try {
        await apiClient.request({
          method: "DELETE",
          url: `/api/questions/${questionId}`,
          data: { email },
        });
        setCurrentQuestion(null);
        setQuestionInput(""); // Clear input
        setError(null);
      } catch (error: any) {
        if (error.response?.status === 403) {
          setError("You do not have permission to delete this question");
        } else if (error.response?.status === 404) {
          setError("Question not found");
        } else {
          setError("Failed to delete question. Please try again.");
        }
      }
    },
    []
  );

  // Clear question input (UI only)
  const clearQuestion = useCallback(() => {
    setQuestionInput("");
    setError(null);
    setDetectedWords([]);
  }, []);

  // Truncate response for collapsed view (shows first ~300 characters)
  const truncateResponse = useCallback(
    (response: string, maxLength: number = 300): string => {
      if (response.length <= maxLength) {
        return response;
      }
      // Find a good breaking point (end of sentence or word)
      const truncated = response.substring(0, maxLength);
      const lastPeriod = truncated.lastIndexOf(".");
      const lastSpace = truncated.lastIndexOf(" ");

      // Prefer breaking at sentence end, then word boundary
      if (lastPeriod > maxLength * 0.7) {
        return truncated.substring(0, lastPeriod + 1);
      } else if (lastSpace > maxLength * 0.7) {
        return truncated.substring(0, lastSpace) + "...";
      }
      return truncated + "...";
    },
    []
  );

  // Format response text - handle shortened URLs and basic markdown
  const formatResponse = useCallback((response: string): React.ReactNode => {
    // Split by lines to preserve line breaks
    const lines = response.split("\n");

    return lines.map((line, lineIndex) => {
      // Process each line for markdown and URLs
      const parts: React.ReactNode[] = [];
      let remaining = line;
      let keyIndex = 0;

      // Process shortened URLs in format ((url)) or (url)
      while (remaining.length > 0) {
        // First try double parentheses ((url))
        let urlMatch = remaining.match(/\(\(([^)]+)\)\)/);
        // If not found, try single parentheses (url) - but avoid markdown like (*text*)
        if (!urlMatch) {
          // Match (url) where url looks like a domain (contains .com, .net, etc. or starts with http)
          // This avoids matching markdown italic syntax like (*text*)
          urlMatch = remaining.match(
            /\(([a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}[^)]*|https?:\/\/[^)]+)\)/
          );
        }

        if (urlMatch) {
          const beforeUrl = remaining.substring(0, urlMatch.index);
          const url = urlMatch[1];

          // Add text before URL
          if (beforeUrl) {
            parts.push(formatMarkdown(beforeUrl, lineIndex, keyIndex++));
          }

          // Add clickable link
          const fullUrl = url.startsWith("http") ? url : `https://${url}`;
          parts.push(
            <a
              key={`url-${lineIndex}-${keyIndex++}`}
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="question-response-link"
            >
              {url}
            </a>
          );

          remaining = remaining.substring(
            (urlMatch.index || 0) + urlMatch[0].length
          );
        } else {
          // No more URLs, process remaining text
          if (remaining) {
            parts.push(formatMarkdown(remaining, lineIndex, keyIndex++));
          }
          break;
        }
      }

      // If line is empty or only whitespace, return a line break
      if (line.trim() === "" && lineIndex < lines.length - 1) {
        return <br key={`br-${lineIndex}`} />;
      }

      return (
        <React.Fragment key={`line-${lineIndex}`}>
          {parts.length > 0 ? parts : line}
          {lineIndex < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  }, []);

  // Format basic markdown (bold, italic)
  const formatMarkdown = (
    text: string,
    lineIndex: number,
    keyIndex: number
  ): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let partKey = 0;

    while (remaining.length > 0) {
      // Check for **bold**
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      // Check for *italic*
      const italicMatch = remaining.match(/\*([^*]+)\*/);

      let match = null;
      let isBold = false;

      if (
        boldMatch &&
        (!italicMatch || (boldMatch.index || 0) < (italicMatch.index || 0))
      ) {
        match = boldMatch;
        isBold = true;
      } else if (italicMatch) {
        match = italicMatch;
        isBold = false;
      }

      if (match) {
        const before = remaining.substring(0, match.index || 0);
        const content = match[1];

        if (before) {
          parts.push(before);
        }

        if (isBold) {
          parts.push(
            <strong key={`bold-${lineIndex}-${keyIndex}-${partKey++}`}>
              {content}
            </strong>
          );
        } else {
          parts.push(
            <em key={`italic-${lineIndex}-${keyIndex}-${partKey++}`}>
              {content}
            </em>
          );
        }

        remaining = remaining.substring((match.index || 0) + match[0].length);
      } else {
        parts.push(remaining);
        break;
      }
    }

    return (
      <React.Fragment key={`text-${lineIndex}-${keyIndex}`}>
        {parts}
      </React.Fragment>
    );
  };

  // Helper function to validate email format
  // Only validates complete emails with proper TLD (at least 2 characters after dot)
  // This prevents API calls for incomplete emails like "user@domain." or "user@domain.c"
  const isValidEmailFormat = (email: string): boolean => {
    // Must have @ with text before and after, domain with dot, and TLD with at least 2 characters
    // This only allows complete emails like "user@domain.com" or "user@domain.org"
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  // Check eligibility when email is available
  useEffect(() => {
    if (userEmail) {
      // Only check eligibility if email looks valid (contains @ and basic format)
      // This prevents API calls for incomplete emails while user is typing
      if (isValidEmailFormat(userEmail)) {
        checkEligibility(userEmail);
      } else {
        // Reset state if email is invalid/incomplete
        setEligible(null);
        setCurrentQuestion(null);
        setError(null);
      }
    } else {
      setEligible(null);
      setCurrentQuestion(null);
    }
  }, [userEmail, checkEligibility]);

  // Don't render if no email
  if (!userEmail) {
    return null;
  }

  // Loading state
  if (isLoading && eligible === null) {
    return (
      <div className="question-section">
        <div className="question-loading">
          <div className="loading-spinner"></div>
          <p>Checking eligibility...</p>
        </div>
      </div>
    );
  }

  // Not eligible state
  if (eligible === false) {
    return (
      <div className="question-section">
        <div className="question-not-eligible">
          <p className="question-not-eligible-message">
            {error ||
              "Please sign up for early access to ask Video Game Wingman a question"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="question-section">
      <h2 className="question-section-title">Ask Video Game Wingman</h2>
      <p className="question-section-subtitle">
        Ask a question and get an AI-powered response with tips, secrets, and
        insights.
      </p>

      {/* Error Display */}
      {error && (
        <div className="question-error">
          <p className="question-error-message">{error}</p>
          {detectedWords.length > 0 && (
            <p className="question-detected-words">
              Detected words: {detectedWords.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Question Display Section */}
      {currentQuestion && (
        <div className="question-display-container">
          {/* Question Box */}
          <div className="question-display-box">
            <div className="question-label">Your Question:</div>
            <div className="question-text">{currentQuestion.question}</div>
          </div>

          {/* Response Box */}
          <div className="question-response-box">
            <div className="question-response-header">
              <div className="question-label">Response:</div>
              <button
                className="question-response-toggle"
                onClick={() => setIsResponseExpanded(!isResponseExpanded)}
                aria-label={
                  isResponseExpanded ? "Collapse response" : "Expand response"
                }
              >
                <span className="question-response-toggle-text">
                  {isResponseExpanded ? "Collapse" : "Expand"}
                </span>
                <span
                  className={`question-response-toggle-icon ${
                    isResponseExpanded ? "expanded" : "collapsed"
                  }`}
                >
                  ▼
                </span>
              </button>
            </div>
            {isResponseExpanded && (
              <div className="question-response-text">
                {formatResponse(currentQuestion.response)}
              </div>
            )}
            {!isResponseExpanded && (
              <div className="question-response-collapsed">
                <div className="question-response-text question-response-preview">
                  {formatResponse(truncateResponse(currentQuestion.response))}
                </div>
                <div className="question-response-fade"></div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="question-actions">
            <button
              className="question-delete-button"
              onClick={() => deleteQuestion(currentQuestion.id, userEmail)}
              title="Delete question"
            >
              <span className="question-delete-icon">🗑️</span>
              <span>Delete</span>
            </button>
          </div>

          {/* Message if user tries to submit new question */}
          {error && error.includes("already have a question") && (
            <div className="question-already-exists-message">
              <p>You already have a question. Delete it to ask a new one.</p>
            </div>
          )}
        </div>
      )}

      {/* Question Input Section - Always show, but disabled when question exists */}
      <div className="question-input-container">
        {currentQuestion && (
          <p className="question-input-note">
            You already have a question. Delete it above to ask a new one.
          </p>
        )}
        <textarea
          className="question-input"
          value={questionInput}
          onChange={(e) => {
            setQuestionInput(e.target.value);
            setError(null);
            setDetectedWords([]);
          }}
          placeholder="Ask Video Game Wingman a question..."
          rows={4}
          disabled={isSubmitting || !!currentQuestion}
        />
        <div className="question-input-actions">
          <button
            className="question-submit-button"
            onClick={() => submitQuestion(userEmail, questionInput)}
            disabled={
              isSubmitting || !questionInput.trim() || !!currentQuestion
            }
          >
            {isSubmitting ? (
              <>
                <div className="loading-spinner"></div>
                <span>Generating response...</span>
              </>
            ) : (
              "Submit"
            )}
          </button>
          {questionInput && (
            <button
              className="question-clear-button"
              onClick={clearQuestion}
              disabled={isSubmitting}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionSection;
