"use client";

import { useState, useEffect, useRef } from "react";

export function WSTestPageClient({ id }: { id: string }) {
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;

    const connectWebSocket = async () => {
      try {
        // Fetch the WebSocket URL from the endpoint
        const response = await fetch(`/channel/${id}/ws`);
        if (!response.ok) {
          throw new Error(`Failed to get WebSocket URL: ${response.status}`);
        }

        const { url: wsUrl } = await response.json();
        console.log("Retrieved WebSocket URL:", wsUrl);

        // Connect to the WebSocket
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          console.log("WebSocket connection opened");
        };

        ws.onmessage = (event) => {
          setMessages((prev) => [...prev, event.data]);
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log("WebSocket connection closed");
          setIsConnected(false);
        };
      } catch (error) {
        console.error("Error connecting to WebSocket:", error);
        setIsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
      setIsConnected(false);
    };
  }, [id]);

  const sendMessage = () => {
    if (
      !inputMessage.trim() ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    )
      return;

    setIsSending(true);
    try {
      wsRef.current.send(inputMessage);
      setInputMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1>WebSocket Test - Channel {id}</h1>

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
        <h3>Send Message</h3>
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
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            disabled={isSending || !isConnected}
          />
          <button
            onClick={sendMessage}
            disabled={isSending || !inputMessage.trim() || !isConnected}
            style={{
              padding: "8px 16px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              opacity:
                isSending || !inputMessage.trim() || !isConnected ? 0.6 : 1,
            }}
          >
            {isSending ? "Sending..." : "Send"}
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
              No messages received yet. Send a message to see it appear here.
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
            Type a message in the input field and click "Send" or press Enter
          </li>
          <li>
            The message will be sent via WebSocket to{" "}
            <code>/channel/{id}/ws</code>
          </li>
          <li>
            You should see the message appear in the "Received Messages" section
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
