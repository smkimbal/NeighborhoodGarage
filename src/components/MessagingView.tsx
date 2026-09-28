import React, { useState } from 'react';
import { 
  Send, 
  MessageSquare, 
  MapPin, 
  Key, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  User,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { Conversation, ChatMessage } from '../types';
import { CURRENT_USER } from '../data/mockData';

interface MessagingViewProps {
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
  onSendMessage: (conversationId: string, text: string) => void;
}

const QUICK_PROMPTS = [
  "When is a good time for porch pickup?",
  "I'm on my way! ETA 10 minutes.",
  "Could you confirm the lockbox code?",
  "Returned safely on your front porch!",
  "Thanks! The tool worked wonderfully.",
];

export const MessagingView: React.FC<MessagingViewProps> = ({
  conversations,
  messages,
  activeConversationId,
  setActiveConversationId,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');

  const activeConv = conversations.find(c => c.id === activeConversationId) || conversations[0];
  const activeMessageList = activeConv ? (messages[activeConv.id] || []) : [];

  const handleSend = () => {
    if (inputText.trim() && activeConv) {
      onSendMessage(activeConv.id, inputText.trim());
      setInputText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-7xl mx-auto h-[680px] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
      {/* Left Sidebar: Conversations List */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col bg-slate-950/60">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <h3 className="font-extrabold text-white text-sm">Handoff Chats</h3>
          </div>
          <span className="text-[11px] text-slate-400">
            {conversations.length} active
          </span>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {conversations.map((conv) => {
            const isSelected = conv.id === activeConversationId;
            return (
              <button
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={`w-full p-3.5 text-left transition flex items-start gap-3 ${
                  isSelected ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={conv.otherUser.avatar}
                    alt={conv.otherUser.name}
                    className="w-11 h-11 rounded-full object-cover border border-slate-700"
                  />
                  <img
                    src={conv.toolImage}
                    alt=""
                    className="w-5 h-5 rounded-md object-cover absolute -bottom-1 -right-1 border border-slate-900 shadow"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs truncate">{conv.otherUser.name}</span>
                    <span className="text-[10px] text-slate-400">{conv.lastMessageTime}</span>
                  </div>
                  <span className="text-[11px] text-amber-400/90 font-medium truncate block">
                    {conv.toolTitle}
                  </span>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {conv.lastMessage}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Active Chat Area */}
      {activeConv ? (
        <div className="flex-1 flex flex-col bg-slate-900">
          {/* Chat Header */}
          <div className="px-6 py-3.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={activeConv.otherUser.avatar}
                alt={activeConv.otherUser.name}
                className="w-10 h-10 rounded-full object-cover border border-amber-500/40"
              />
              <div>
                <h4 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                  <span>{activeConv.otherUser.name}</span>
                  <span className="text-[11px] text-amber-400 font-semibold">({activeConv.otherUser.rating}★)</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Coordinating pickup for <strong className="text-white">{activeConv.toolTitle}</strong> • {activeConv.otherUser.neighborhood}
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-700/50 text-[11px] text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Shield Protected</span>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {activeMessageList.map((msg) => {
              const isMe = msg.senderId === CURRENT_USER.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[70%]">
                    {!isMe && (
                      <img
                        src={msg.senderAvatar}
                        alt={msg.senderName}
                        className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0 mb-1"
                      />
                    )}

                    <div className="space-y-1.5">
                      <div
                        className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                          isMe
                            ? 'bg-amber-500 text-slate-950 font-medium rounded-br-none shadow-md'
                            : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/80 shadow-md'
                        }`}
                      >
                        {msg.text}
                      </div>

                      {/* Embedded Action Card */}
                      {msg.actionCard && (
                        <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 text-xs space-y-1 shadow-lg">
                          <div className="flex items-center gap-1.5 font-bold text-amber-400 text-[11px]">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{msg.actionCard.title}</span>
                          </div>
                          <p className="text-slate-300 text-[11px] leading-relaxed">
                            {msg.actionCard.details}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-500 mt-1 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Quick Coordination Chips */}
          <div className="px-6 py-2 border-t border-slate-800/60 overflow-x-auto flex items-center gap-1.5 scrollbar-none">
            <span className="text-[10px] text-slate-400 font-semibold shrink-0">Quick reply:</span>
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => setInputText(prompt)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] whitespace-nowrap transition border border-slate-700/60 shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center gap-3">
            <input
              type="text"
              placeholder={`Message ${activeConv.otherUser.name}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="p-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold transition shadow-lg shadow-amber-500/20 active:scale-95 shrink-0"
            >
              <Send className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs">
          Select a conversation from the left to coordinate pickup.
        </div>
      )}
    </div>
  );
};
