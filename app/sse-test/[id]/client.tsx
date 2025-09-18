"use client";

import { useState, useEffect } from "react";

export function SSETestPageClient({ id }: { id: string }) {
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(`/channel/${id}`);

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
  }, [id]);

  const postMessage = async () => {
    if (!inputMessage.trim()) return;

    setIsPosting(true);
    try {
      const response = await fetch(`/channel/${id}`, {
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
          {messages.length === 0 ? (
            <div style={{ color: "#666", fontStyle: "italic" }}>
              No messages received yet. Post a message to see it appear here.
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

      <div style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
        <p>
          <strong>How to use:</strong>
        </p>
        <ul>
          <li>
            Type a message in the input field and click "Post" or press Enter
          </li>
          <li>
            The message will be posted to <code>/channel/{id}</code>
          </li>
          <li>
            You should see the message appear in the "Received Messages" section
            via SSE
          </li>
          <li>
            Open this page in multiple tabs to see real-time message
            broadcasting
          </li>
        </ul>
      </div>
    </div>
  );
}
