import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "../api";
import {
  MessageSquare,
  Send,
  Plus,
  Search,
  X,
  Camera,
  ArrowLeft,
  CheckCheck,
  Image as ImageIcon,
} from "lucide-react";
import type { AppUser } from "../types";

interface ChatAttachment {
  id: string;
  nomOriginal: string;
  mimeType: string;
  tailleOctets: number;
}

interface ChatMessage {
  id: string;
  contenu: string;
  type: string;
  fichierUrl?: string;
  fichierType?: string;
  creeLe: string;
  auteur: { id: string; name: string; email: string; avatarUrl: string };
  piecesJointes?: ChatAttachment[];
}

interface ChatParticipant {
  id: string;
  utilisateurId: string;
  role: string;
  derniereVuLe?: string;
  utilisateur: { id: string; name: string; email: string; avatarUrl: string };
}

interface Conversation {
  id: string;
  reference: string;
  titre?: string;
  creeLe: string;
  modifieLe: string;
  participants: ChatParticipant[];
  messages: ChatMessage[];
}

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  department: string;
  jobTitle: string;
}

interface ChatModuleProps {
  currentUser: AppUser;
  onUnreadChange?: (count: number) => void;
}

interface PendingImage {
  dataUrl: string;
  base64: string;
  mime: string;
  name: string;
}

export default function ChatModule({ currentUser }: ChatModuleProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastMessageTimestamp = useRef<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiFetch("/api/chat/conversations");
      if (res.ok) {
        const json = await res.json();
        setConversations(json.data as Conversation[]);
      }
    } catch {
      /* silent */
    }
  }, []);

  const fetchMessages = useCallback(
    async (convId: string, poll = false) => {
      try {
        const params = poll && lastMessageTimestamp.current
          ? `?after=${encodeURIComponent(lastMessageTimestamp.current)}`
          : "";
        const res = await apiFetch(`/api/chat/conversations/${convId}/messages${params}`);
        if (res.ok) {
          const json = await res.json();
          const newMsgs = json.data.items as ChatMessage[];
          if (poll && newMsgs.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const fresh = newMsgs.filter((m) => !existingIds.has(m.id));
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
          } else if (!poll) {
            setMessages(newMsgs);
          }
          if (newMsgs.length > 0) {
            lastMessageTimestamp.current = newMsgs[newMsgs.length - 1].creeLe;
          }
        }
      } catch {
        /* silent */
      }
    },
    []
  );

  useEffect(() => {
    fetchConversations().then(() => setLoading(false));
  }, [fetchConversations]);

  useEffect(() => {
    if (activeConvId) {
      lastMessageTimestamp.current = "";
      fetchMessages(activeConvId, false);
      apiFetch(`/api/chat/conversations/${activeConvId}/read`, {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      }).catch(() => {});
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeConvId, fetchMessages]);

  useEffect(() => {
    if (!activeConvId) return;
    pollingRef.current = setInterval(() => {
      fetchMessages(activeConvId, true);
    }, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeConvId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!showNewConv || userSearchQuery.length < 2) {
      setUserSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await apiFetch(
          `/api/chat/users/search?q=${encodeURIComponent(userSearchQuery)}`
        );
        if (res.ok) {
          const json = await res.json();
          setUserSearchResults(json.data as UserSearchResult[]);
        }
      } catch {
        /* silent */
      } finally {
        setSearchingUsers(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchQuery, showNewConv]);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Seules les images (JPEG, PNG, WebP) sont acceptées.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("L'image ne doit pas dépasser 5 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setPendingImage({ dataUrl, base64, mime: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || sending) return;
    if (!newMessage.trim() && !pendingImage) return;

    setSending(true);
    try {
      const body: Record<string, unknown> = {
        contenu: newMessage.trim() || (pendingImage ? `[Image: ${pendingImage.name}]` : ""),
      };

      if (pendingImage) {
        body.imageBase64 = pendingImage.base64;
        body.imageMime = pendingImage.mime;
        body.imageNom = pendingImage.name;
      }

      const res = await apiFetch(`/api/chat/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = await res.json();
        setMessages((prev) => [...prev, json.data as ChatMessage]);
        lastMessageTimestamp.current = (json.data as ChatMessage).creeLe;
        setNewMessage("");
        setPendingImage(null);
        fetchConversations();
      }
    } catch {
      /* silent */
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async () => {
    if (selectedParticipants.length === 0) return;
    try {
      const res = await apiFetch("/api/chat/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          participantIds: selectedParticipants.map((u) => u.id),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const conv = json.data as Conversation;
        setConversations((prev) => [conv, ...prev]);
        setActiveConvId(conv.id);
        setShowNewConv(false);
        setSelectedParticipants([]);
        setUserSearchQuery("");
      }
    } catch {
      /* silent */
    }
  };

  const getConvTitle = (conv: Conversation) => {
    if (conv.titre) return conv.titre;
    const other = conv.participants.find(
      (p) => p.utilisateurId !== currentUser.id
    );
    return other?.utilisateur.name || "Conversation";
  };

  const getConvAvatar = (conv: Conversation) => {
    const other = conv.participants.find(
      (p) => p.utilisateurId !== currentUser.id
    );
    return other?.utilisateur.name?.charAt(0)?.toUpperCase() || "C";
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  const hasUnread = (conv: Conversation) => {
    const lastMsg = conv.messages?.[0];
    if (!lastMsg || lastMsg.auteur.id === currentUser.id) return false;
    const participant = conv.participants.find(
      (p) => p.utilisateurId === currentUser.id
    );
    if (!participant?.derniereVuLe) return true;
    return new Date(lastMsg.creeLe) > new Date(participant.derniereVuLe);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Sidebar: conversation list */}
      <div
        className={`${
          activeConvId ? "hidden md:flex" : "flex"
        } flex-col w-full md:w-80 lg:w-96 border-r border-slate-200`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Messagerie</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowNewConv(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition cursor-pointer"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Chargement...</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <MessageSquare size={28} className="text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">Aucune conversation</p>
              <p className="text-[11px] text-slate-400">
                Cliquez sur + pour démarrer une conversation.
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const lastMsg = conv.messages?.[0];
              const unread = hasUnread(conv);
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition cursor-pointer border-b border-slate-100 ${
                    activeConvId === conv.id
                      ? "bg-indigo-50"
                      : unread
                      ? "bg-indigo-50/40"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {getConvAvatar(conv)}
                    </div>
                    {unread && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs truncate ${unread ? "font-bold text-slate-900" : "font-semibold text-slate-800"}`}>
                        {getConvTitle(conv)}
                      </span>
                      {lastMsg && (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatDate(lastMsg.creeLe)}
                        </span>
                      )}
                    </div>
                    {lastMsg && (
                      <p className={`text-[11px] truncate mt-0.5 ${unread ? "text-slate-700 font-medium" : "text-slate-500"}`}>
                        <span className="font-semibold text-slate-600">
                          {lastMsg.auteur.name.split(" ")[0]}:
                        </span>{" "}
                        {lastMsg.type === "IMAGE" ? "📷 Image" : lastMsg.contenu}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main: message area */}
      <div
        className={`${
          activeConvId ? "flex" : "hidden md:flex"
        } flex-col flex-1`}
      >
        {activeConv ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveConvId(null)}
                className="md:hidden text-slate-500 hover:text-slate-700 p-1"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                {getConvAvatar(activeConv)}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">{getConvTitle(activeConv)}</p>
                <p className="text-[10px] text-slate-500">
                  {activeConv.participants.length} participant(s)
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {[...messages].reverse().map((msg) => {
                const isMe = msg.auteur.id === currentUser.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] px-3 py-2 rounded-xl text-xs ${
                        isMe
                          ? "bg-indigo-600 text-white rounded-br-sm"
                          : "bg-slate-100 text-slate-900 rounded-bl-sm"
                      }`}
                    >
                      {!isMe && (
                        <p className="text-[10px] font-bold mb-0.5 opacity-70">
                          {msg.auteur.name}
                        </p>
                      )}
                      {/* Render images from piecesJointes */}
                      {msg.piecesJointes?.map((pj) => (
                        <img
                          key={pj.id}
                          src={`/api/chat/attachments/${pj.id}`}
                          alt={pj.nomOriginal}
                          className="rounded-lg max-w-full max-h-64 object-cover mt-1 cursor-pointer"
                          loading="lazy"
                        />
                      ))}
                      {/* Legacy: single image via fichierUrl */}
                      {msg.type === "IMAGE" && msg.fichierUrl && !msg.piecesJointes?.length && (
                        <img
                          src={msg.fichierUrl}
                          alt="Image partagée"
                          className="rounded-lg max-w-full max-h-64 object-cover mt-1"
                          loading="lazy"
                        />
                      )}
                      {msg.contenu && (
                        <p className="whitespace-pre-wrap break-words">{msg.contenu}</p>
                      )}
                      <p className={`text-[9px] mt-1 ${isMe ? "text-indigo-200" : "text-slate-400"}`}>
                        {formatDate(msg.creeLe)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Pending image preview */}
            {pendingImage && (
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
                <div className="relative shrink-0">
                  <img
                    src={pendingImage.dataUrl}
                    alt="Aperçu"
                    className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setPendingImage(null)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow"
                  >
                    <X size={10} />
                  </button>
                </div>
                <span className="text-[11px] text-slate-500 truncate">
                  {pendingImage.name} ({Math.round(pendingImage.dataUrl.length * 0.75 / 1024)} Ko)
                </span>
              </div>
            )}

            {/* Message input */}
            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-2 px-4 py-3 border-t border-slate-200"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-slate-400 hover:text-indigo-600 p-1 cursor-pointer transition"
                title="Joindre une image"
              >
                <ImageIcon size={18} />
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="text-slate-400 hover:text-indigo-600 p-1 cursor-pointer transition"
                title="Prendre une photo"
              >
                <Camera size={18} />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={pendingImage ? "Ajouter un message..." : "Écrire un message..."}
                className="flex-1 text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={(!newMessage.trim() && !pendingImage) || sending}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white p-2.5 rounded-lg transition cursor-pointer"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 p-8">
            <MessageSquare size={40} className="text-slate-300" />
            <p className="text-sm font-bold text-slate-600">
              Sélectionnez ou créez une conversation
            </p>
            <p className="text-xs text-slate-400 max-w-sm">
              Utilisez la barre latérale pour naviguer entre vos conversations
              ou cliquez sur + pour démarrer une nouvelle discussion.
            </p>
          </div>
        )}
      </div>

      {/* New conversation modal */}
      {showNewConv && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Nouvelle conversation</h3>
              <button
                type="button"
                onClick={() => {
                  setShowNewConv(false);
                  setSelectedParticipants([]);
                  setUserSearchQuery("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Rechercher un collègue par nom, email..."
                autoFocus
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            {selectedParticipants.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedParticipants.map((u) => (
                  <span
                    key={u.id}
                    className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-semibold flex items-center gap-1 border border-indigo-200"
                  >
                    {u.name}
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedParticipants((prev) => prev.filter((p) => p.id !== u.id))
                      }
                      className="text-indigo-400 hover:text-indigo-600"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="max-h-48 overflow-y-auto space-y-1">
              {searchingUsers ? (
                <p className="text-[11px] text-slate-400 text-center py-3">Recherche...</p>
              ) : userSearchResults.length > 0 ? (
                userSearchResults.map((u) => {
                  const isSelected = selectedParticipants.some((p) => p.id === u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        if (!isSelected) {
                          setSelectedParticipants((prev) => [...prev, u]);
                        } else {
                          setSelectedParticipants((prev) => prev.filter((p) => p.id !== u.id));
                        }
                        setUserSearchQuery("");
                        setUserSearchResults([]);
                      }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 transition cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50 border border-indigo-200"
                          : "hover:bg-slate-50 border border-transparent"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                        {u.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {u.department} · {u.jobTitle}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCheck size={16} className="text-indigo-600 ml-auto shrink-0" />
                      )}
                    </button>
                  );
                })
              ) : userSearchQuery.length >= 2 ? (
                <p className="text-[11px] text-slate-400 text-center py-3">Aucun résultat</p>
              ) : (
                <p className="text-[11px] text-slate-400 text-center py-3">
                  Tapez au moins 2 caractères pour rechercher
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleCreateConversation}
              disabled={selectedParticipants.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold py-2.5 rounded-lg transition cursor-pointer"
            >
              Démarrer la conversation ({selectedParticipants.length} sélectionné(s))
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
