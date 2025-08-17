import React, { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";

const DEFAULT_SYSTEM_PROMPT = `You are "Z Bookstore Assistant" for an online bookstore.
You only answer questions related to this bookstore: books, authors, prices, stock, orders, shipping, categories, grade, and subject.
Be concise. If you don't know, say so.
You are not a general-purpose assistant and should not answer unrelated questions.
You are not a human, so do not use phrases like "as an AI" or "as a chatbot".
You are not a search engine, so do not provide search results or links.
You are not a customer support agent, so do not handle issues like refunds or complaints.
You are a friendly and helpful assistant focused on providing information about the bookstore.
Our bookstore has the following features:
- Books are categorized by grade and subject.
- Book categories include: Exercise, Question Books, Answer Books, and Stationery.
- Subjects include: Writing, Myanmar, English, Mathematics, Pencil Control, Science, Spelling, Thet Pont, Social, Moral, Geology & History, Mathematics Skill, Time, Multiply, Grammer.
- Grades include: KG to Grade 7.
- Question books prices are 12000 Kyats.
- Answer books prices are 3000 Kyats.
- We offer home delivery, Royal Express pick-up, and car gate pick-up.
- Home delivery requires State/Region, Township, and Full Address.
- Royal Express pick-up requires State/Region and Township.
- Car gate pick-up requires State/Region and Township.

Language:
- Always respond in English.`;

const DEFAULT_MODEL = "deepseek/deepseek-r1-0528:free";

const apiKey =
  "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";

export default function BookstoreChat() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I am Z Bookstore Chatbot. Ask me anything about the bookstore: titles, prices, shipping, grades, subjects, etc.",
    },
  ]);
  const [input, setInput] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef(null);

  const referer =
    typeof window !== "undefined" ? window.location.origin : "http://localhost";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const canSend = useMemo(
    () => input.trim().length > 0 && !isStreaming,
    [input, isStreaming]
  );

  async function sendMessage(userText) {
    const text = (userText ?? input).trim();
    if (!text || isStreaming) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");

    const assistantIndex = nextMessages.length;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setIsStreaming(true);

    try {
      const payload = {
        model: DEFAULT_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...nextMessages],
        stream: true,
        temperature: 0.2,
      };

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": referer,
          "X-Title": "Bookstore Chatbot",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 402) {
          throw new Error("Your free plan quota is exceeded.");
        } else {
          throw new Error(`OpenRouter error: ${res.status} ${res.statusText}`);
        }
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false,
        assistantText = "",
        buffer = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        buffer += decoder.decode(value || new Uint8Array(), { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.replace(/^data:\s?/, "").trim();
            if (data === "[DONE]") {
              done = true;
              break;
            }
            const json = JSON.parse(data);
            const delta = json?.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              assistantText += delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[assistantIndex] = {
                  role: "assistant",
                  content: assistantText,
                };
                return copy;
              });
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ API request failed: ${err.message}` },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }

  const suggestionChips = [
    "Which subjects are available in school books?",
    "What is the shipping cost for home delivery?",
    "Do you have a Grade 9 Chemistry book?",
    "Which townships support Royal Express pick-up?",
  ];

  return (
    <div className="chat-container">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-header-content">
          <div className="chat-logo">Z</div>
          <div>
            <h1>Bookstore Chatbot</h1>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="chat-body">
        {/* System Prompt Editor */}
        <details className="system-prompt">
          <summary>System Prompt (edit if needed)</summary>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </details>

        {/* Chat messages */}
        <div className="chat-messages">
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))}
          {isStreaming && (
            <div className="typing-indicator">assistant is typing…</div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggestions */}
        <div className="suggestions">
          {suggestionChips.map((s, idx) => (
            <button key={idx} onClick={() => sendMessage(s)}>
              {s}
            </button>
          ))}
        </div>
      </main>

      {/* Composer */}
      <footer className="chat-footer">
        {!apiKey && (
          <div className="api-warning">
            <strong>Missing API Key</strong> — please add it in the JSX
          </div>
        )}
        <div className="composer">
          <input
            placeholder="Write your question… (Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey && canSend && sendMessage()
            }
          />
          <button onClick={() => sendMessage()} disabled={!canSend}>
            {isStreaming ? "Sending…" : "Send"}
          </button>
        </div>
        <p className="model-info">
          Powered by OpenRouter — model: <code>{DEFAULT_MODEL}</code>
        </p>
      </footer>
    </div>
  );
}

function MessageBubble({ role, content }) {
  const isUser = role === "user";
  const bubbleClass = isUser
    ? "message-bubble user"
    : "message-bubble assistant";

  return (
    <div className={bubbleClass}>
      <div className="role-label">{role}</div>
      <div className="message-content">{content}</div>
    </div>
  );
}
