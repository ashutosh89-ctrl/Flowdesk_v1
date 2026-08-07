'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { PortalComment } from '../../../types';
import {
  MessageSquare,
  Send,
  Paperclip,
  CheckCircle2,
  CornerDownRight,
  AtSign,
  User,
  Sparkles,
  Smile,
} from 'lucide-react';

interface CommentsPanelProps {
  comments: PortalComment[];
  clientName: string;
  clientAvatar?: string;
  onPostComment: (text: string, replyToId?: string) => void;
  onToggleResolve?: (commentId: string) => void;
}

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  comments,
  clientName,
  clientAvatar,
  onPostComment,
  onToggleResolve,
}) => {
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<PortalComment | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    onPostComment(newCommentText, replyingTo?.id);
    setNewCommentText('');
    setReplyingTo(null);
  };

  const filteredComments = comments.filter((c) => (showResolved ? true : !c.isResolved));

  return (
    <div className="space-y-6 font-sans">
      {/* Discussion Header */}
      <Card variant="crystal" className="p-6 border-white/15 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Workspace Discussion Thread</h2>
            <p className="text-xs text-zinc-400">Direct asynchronous communication with Rivera Studio</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResolved(!showResolved)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                showResolved
                  ? 'bg-white text-zinc-950 font-bold'
                  : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              {showResolved ? 'Showing Resolved' : 'Hide Resolved'}
            </button>
          </div>
        </div>

        {/* New Comment Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {replyingTo && (
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-300">
                <CornerDownRight className="w-3.5 h-3.5" />
                <span>Replying to <strong>{replyingTo.author}</strong>: &quot;{replyingTo.text.slice(0, 40)}...&quot;</span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="text-[10px] text-zinc-400 hover:text-white font-mono"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="relative">
            <textarea
              rows={3}
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Type your feedback, question, or note... Use @Alex to mention freelancer"
              className="w-full p-3.5 rounded-2xl bg-zinc-900 border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all resize-none"
            />

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <AtSign className="w-3 h-3 text-indigo-400" />
                  Mentions supported
                </span>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!newCommentText.trim()}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                Post Comment
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Threaded Comments List */}
      <div className="space-y-4">
        {filteredComments.length === 0 ? (
          <Card variant="crystal" className="p-12 text-center space-y-3">
            <MessageSquare className="w-10 h-10 text-zinc-600 mx-auto" />
            <h3 className="text-base font-bold text-white">No Comments Yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Start a thread above to leave notes or feedback for your lead designer.
            </p>
          </Card>
        ) : (
          filteredComments.map((comment) => {
            const isClient = comment.authorRole === 'client' || comment.author === clientName;

            return (
              <Card
                key={comment.id}
                variant="crystal"
                className={`p-5 space-y-3 transition-all ${
                  comment.isResolved ? 'opacity-60 border-white/5' : 'border-white/15 hover:border-white/25'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/15 flex items-center justify-center font-bold text-xs text-white shrink-0">
                      {comment.author.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{comment.author}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                            isClient ? 'bg-indigo-500/20 text-indigo-300' : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {isClient ? 'Client' : 'Freelancer'}
                        </span>
                        {comment.unread && (
                          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" title="Unread" />
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono block">{comment.timestamp}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setReplyingTo(comment)}
                      className="text-xs text-zinc-400 hover:text-white font-medium px-2 py-1 rounded hover:bg-white/5 transition-all"
                    >
                      Reply
                    </button>
                    {onToggleResolve && (
                      <button
                        onClick={() => onToggleResolve(comment.id)}
                        className="p-1 rounded text-zinc-500 hover:text-emerald-400 transition-colors"
                        title={comment.isResolved ? 'Mark Unresolved' : 'Mark Resolved'}
                      >
                        <CheckCircle2 className={`w-4 h-4 ${comment.isResolved ? 'text-emerald-400' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-zinc-200 leading-relaxed pl-11">{comment.text}</p>

                {/* Attachments if any */}
                {comment.attachments && comment.attachments.length > 0 && (
                  <div className="pl-11 flex items-center gap-2 flex-wrap">
                    {comment.attachments.map((att, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-zinc-300 flex items-center gap-1.5">
                        <Paperclip className="w-3 h-3 text-zinc-400" />
                        <span>{att.name}</span>
                        <span className="text-zinc-500">({att.size})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Nested Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="pl-11 pt-2 space-y-2 border-l-2 border-white/10 ml-4">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{reply.author}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{reply.timestamp}</span>
                        </div>
                        <p className="text-xs text-zinc-300">{reply.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
