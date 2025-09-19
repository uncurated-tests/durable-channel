"use client";

import { useState, useEffect } from "react";

export function SSETestPageClient({ id }: { id: string }) {
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeConnection = async () => {
      try {
        // First, download initial messages via GET request
        const response = await fetch(`/channel/chat-${id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages && Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        }
      } catch (error) {
        console.error("Error loading initial messages:", error);
      } finally {
        setIsLoading(false);
      }

      // Then establish SSE connection
      const eventSource = new EventSource(`/channel/chat-${id}/sse`);

      eventSource.onopen = () => {
        setIsConnected(true);
        console.log("SSE connection opened");
      };

      eventSource.onmessage = (event) => {
        setMessages((prev) => [...prev, event.data]);
      };

      eventSource.onerror = (error) => {
        console.error("SSE error:", error);
        setIsConnected(false);
      };

      return () => {
        eventSource.close();
        setIsConnected(false);
      };
    };

    initializeConnection();
  }, [id]);

  const postMessage = async () => {
    if (!inputMessage.trim()) return;

    setIsPosting(true);
    try {
      const response = await fetch(`/channel/chat-${id}`, {
        method: "POST",
        body: inputMessage,
        headers: {
          "Content-Type": "text/plain",
        },
      });

      if (response.ok) {
        setInputMessage("");
      } else {
        console.error("Failed to post message");
      }
    } catch (error) {
      console.error("Error posting message:", error);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1>SSE Test - Channel {id}</h1>

      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            padding: "10px",
            backgroundColor: isConnected ? "#d4edda" : "#f8d7da",
            border: `1px solid ${isConnected ? "#c3e6cb" : "#f5c6cb"}`,
            borderRadius: "4px",
            marginBottom: "10px",
          }}
        >
          Status: {isConnected ? "Connected" : "Disconnected"}
        </div>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Post Message</h3>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Enter your message..."
            style={{
              flex: 1,
              padding: "8px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
            onKeyPress={(e) => e.key === "Enter" && postMessage()}
            disabled={isPosting}
          />
          <button
            onClick={postMessage}
            disabled={isPosting || !inputMessage.trim()}
            style={{
              padding: "8px 16px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              opacity: isPosting || !inputMessage.trim() ? 0.6 : 1,
            }}
          >
            {isPosting ? "Posting..." : "Post"}
          </button>
        </div>
      </div>

      <div>
        <h3>Received Messages ({messages.length})</h3>
        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "10px",
            backgroundColor: "#f9f9f9",
            maxHeight: "400px",
            overflowY: "auto",
          }}
        >
          {isLoading ? (
            <div style={{ color: "#666", fontStyle: "italic" }}>
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div style={{ color: "#666", fontStyle: "italic" }}>
              No messages yet. Post a message to see it appear here.
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                style={{
                  marginBottom: "8px",
                  padding: "8px",
                  backgroundColor: "white",
                  borderRadius: "4px",
                  border: "1px solid #e0e0e0",
                }}
              >
                <small style={{ color: "#666" }}>Message {index + 1}:</small>
                <div>{message}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
