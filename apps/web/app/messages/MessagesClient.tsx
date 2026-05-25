"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Conversation, Message } from "@crewlink/domain";
import AppNav from "../components/AppNav";
import {
  createConversation,
  demoUsers,
  getConversationThread,
  getStoredCurrentUser,
  listConversations,
  sendMessage,
  setStoredCurrentUser,
  type MessagingUser,
} from "../utils/messaging-client";
import "../components/Messages.css";

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function MessagesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<MessagingUser>(() => getStoredCurrentUser());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    searchParams.get("conversationId"),
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, conversations],
  );

  const refreshConversations = useCallback(async () => {
    const result = await listConversations(currentUser);
    setConversations(result.conversations);
  }, [currentUser]);

  const refreshThread = useCallback(
    async (conversationId: string) => {
      const thread = await getConversationThread(currentUser, conversationId);
      setMessages(thread.messages);
      setConversations((existing) => {
        const others = existing.filter((entry) => entry.id !== thread.conversation.id);
        return [thread.conversation, ...others].sort(
          (a, b) =>
            new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
        );
      });
    },
    [currentUser],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        await refreshConversations();
        const requestedConversationId = searchParams.get("conversationId");
        const recipientId = searchParams.get("recipientId");
        const recipientName = searchParams.get("recipientName");
        const title = searchParams.get("title");
        const contextId = searchParams.get("contextId");

        if (recipientId && recipientName) {
          const created = await createConversation(currentUser, {
            recipientId,
            recipientName,
            recipientRole: "pilot",
            title: title ?? undefined,
            contextType: contextId ? "match" : undefined,
            contextId: contextId ?? undefined,
            initialMessage: `Hi ${recipientName}, we'd like to connect about staffing coverage.`,
          });
          if (!cancelled) {
            setActiveConversationId(created.conversation.id);
            setMessages(created.messages);
            await refreshConversations();
            router.replace(`/messages?conversationId=${created.conversation.id}`);
          }
          return;
        }

        if (requestedConversationId && !cancelled) {
          setActiveConversationId(requestedConversationId);
          await refreshThread(requestedConversationId);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Unable to load messages.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser, refreshConversations, refreshThread, router, searchParams]);

  useEffect(() => {
    if (!activeConversationId) return;
    refreshThread(activeConversationId).catch(() => undefined);
    const interval = window.setInterval(() => {
      refreshThread(activeConversationId).catch(() => undefined);
      refreshConversations().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [activeConversationId, refreshConversations, refreshThread]);

  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">
        <div className="container">
          <div className="page-header">
            <div>
              <span className="tag">Direct messaging</span>
              <h1>Messages</h1>
            </div>
          </div>

          <div className="messages-layout">
            <aside className="messages-sidebar">
              <div className="messages-sidebar-header">
                <div style={{ width: "100%" }}>
                  <h2>Inbox</h2>
                  <label className="field messages-user-select">
                    <span>Acting as</span>
                    <select
                      value={currentUser.id}
                      onChange={(event) => {
                        const nextUser =
                          demoUsers.find((user) => user.id === event.target.value) ??
                          demoUsers[0];
                        setStoredCurrentUser(nextUser.id);
                        setCurrentUser(nextUser);
                        setActiveConversationId(null);
                        setMessages([]);
                      }}
                    >
                      {demoUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.role})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="conversation-list">
                {loading && <p className="messages-empty">Loading conversations…</p>}
                {!loading && conversations.length === 0 && (
                  <p className="messages-empty">
                    No conversations yet. Message a pilot from the Matches page to start
                    a thread.
                  </p>
                )}
                {conversations.map((conversation) => {
                  const other =
                    conversation.participants.find(
                      (participant) => participant.id !== currentUser.id,
                    ) ?? conversation.participants[0];
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      className={`conversation-item${
                        conversation.id === activeConversationId ? " active" : ""
                      }`}
                      onClick={() => {
                        setActiveConversationId(conversation.id);
                        router.replace(`/messages?conversationId=${conversation.id}`);
                      }}
                    >
                      <strong>{other?.name ?? conversation.title}</strong>
                      <span>{conversation.lastMessagePreview}</span>
                      <time dateTime={conversation.lastMessageAt}>
                        {formatTime(conversation.lastMessageAt)}
                      </time>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="messages-thread">
              {activeConversation ? (
                <>
                  <div className="messages-thread-header">
                    <div>
                      <h2>{activeConversation.title}</h2>
                      <p className="meta">
                        {activeConversation.participants
                          .map((participant) => participant.name)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>

                  <div className="message-list">
                    {messages.map((message) => (
                      <article
                        key={message.id}
                        className={`message-bubble${
                          message.senderId === currentUser.id ? " own" : ""
                        }`}
                      >
                        <header>
                          <strong>{message.senderName}</strong>
                          <time dateTime={message.createdAt}>
                            {formatTime(message.createdAt)}
                          </time>
                        </header>
                        <p>{message.body}</p>
                      </article>
                    ))}
                    {messages.length === 0 && (
                      <p className="messages-empty">No messages yet. Say hello below.</p>
                    )}
                  </div>

                  <form
                    className="message-compose"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!draft.trim() || !activeConversationId) return;
                      setStatus("");
                      try {
                        const result = await sendMessage(currentUser, {
                          conversationId: activeConversationId,
                          body: draft,
                        });
                        setMessages(result.messages);
                        setDraft("");
                        await refreshConversations();
                      } catch (error) {
                        setStatus(
                          error instanceof Error ? error.message : "Unable to send message.",
                        );
                      }
                    }}
                  >
                    <textarea
                      placeholder="Write a message…"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                    />
                    <button className="btn primary" type="submit">
                      Send
                    </button>
                  </form>
                </>
              ) : (
                <p className="messages-empty">
                  Select a conversation or start one from Matches.
                </p>
              )}
              {status && <p className="fineprint">{status}</p>}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
