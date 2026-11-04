import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Avatar } from '@/frontend/shared/ui/avatar';
import { CommentService } from '@/backend/freelancer';
import { WorkspaceSummary, WorkspaceComment } from '@/shared/types';
import {
  Send,
  MessageSquare,
  Bold,
  Italic,
  Code,
  Paperclip,
  Trash2,
  CheckCheck,
  Pin,
  Reply,
  AtSign,
  FileText,
  X,
  Lock,
} from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';
import { useAuth } from '@/frontend/auth/auth-context';

export interface CommentsTabProps {
  summary: WorkspaceSummary;
  onRefresh: () => void;
}

export const CommentsTab: React.FC<CommentsTabProps> = ({ summary, onRefresh }) => {
  const { comments, client } = summary;
  const { showToast } = useToast();
  const { profile } = useAuth();

  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<WorkspaceComment | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!newComment.trim() && attachments.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await CommentService.addComment(client.id, {
        text: newComment.trim(),
        author: profile?.name || 'You',
        isOwner: true,
        isInternal,
        replyToId: replyingTo?.id,
        replyToAuthor: replyingTo?.author,
        replyToText: replyingTo?.text,
        attachments,
      });

      setNewComment('');
      setIsInternal(false);
      setReplyingTo(null);
      setAttachments([]);
      showToast(
        isInternal ? 'Internal Note Saved' : 'Message Posted',
        isInternal ? 'Private note recorded (hidden from client).' : 'Update sent to workspace discussion.',
        'success'
      );
      onRefresh();
    } catch (err: any) {
      const msg = err?.message || 'Failed to post message. Please try again.';
      setErrorMessage(msg);
      showToast('Posting Error', msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePin = (commentId: string) => {
    CommentService.togglePinComment(commentId).then(() => {
      showToast('Comment Pin Updated', 'Thread status updated.', 'info');
      onRefresh();
    });
  };

  const handleDeleteComment = (commentId: string) => {
    CommentService.deleteComment(commentId).then(() => {
      showToast('Comment Deleted', 'Message removed from workspace thread.', 'info');
      onRefresh();
    });
  };

  const handleFormatting = (tag: string) => {
    setNewComment((prev) => `${prev} ${tag} `);
  };

  const handleAddMention = () => {
    setNewComment((prev) => `${prev} @${client.name} `);
  };

  const handleSimulateAttachment = () => {
    const fileName = `spec_v${attachments.length + 1}.pdf`;
    setAttachments((prev) => [...prev, fileName]);
    showToast('File Attached', `Attached ${fileName}`, 'info');
  };

  return (
    <Card variant="crystal">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{client.company || client.name} Async Discussion</CardTitle>
            <CardDescription>Direct messaging, threaded client communication, and private workspace notes</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comment Thread */}
        <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
          {comments.length === 0 ? (
            <div className="p-8 text-center space-y-2 rounded-2xl bg-white/[0.02] border border-white/5">
              <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-xs font-semibold text-zinc-300">No messages in workspace thread yet</p>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                Start an asynchronous discussion with your client or log an internal project note below.
              </p>
            </div>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className={`p-4 rounded-xl border space-y-2 transition-all ${
                  c.isInternal
                    ? 'bg-amber-500/[0.04] border-amber-500/25'
                    : c.isPinned
                    ? 'bg-[#176B5B]/15 border-[#176B5B]/40'
                    : c.isOwner
                    ? 'bg-white/[0.04] border-white/15'
                    : 'bg-[#191F1D] border-[#176B5B]/30'
                }`}
              >
                {/* Pinned Tag */}
                {c.isPinned && (
                  <div className="flex items-center gap-1 text-[10px] font-mono text-[#43D6B0] font-bold uppercase mb-1">
                    <Pin className="w-3 h-3" /> Pinned Workspace Message
                  </div>
                )}

                {/* Internal Note Tag */}
                {c.isInternal && (
                  <div className="flex items-center gap-1 text-[10px] font-mono text-amber-400 font-bold uppercase mb-1">
                    <Lock className="w-3 h-3" /> Internal Freelancer Note (Hidden from Client)
                  </div>
                )}

                {/* Reply To Quote Box */}
                {c.replyToText && (
                  <div className="p-2.5 rounded-lg bg-black/40 border-l-2 border-white/30 text-[11px] text-zinc-400 space-y-0.5">
                    <span className="font-bold text-white">Replying to {c.replyToAuthor}:</span>
                    <p className="truncate italic">{c.replyToText}</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={c.author} src={c.avatar} size="sm" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{c.author}</span>
                        {c.isOwner ? (
                          <span className="text-[9px] font-mono font-bold text-[#43D6B0] bg-[#176B5B]/20 border border-[#176B5B]/40 px-1.5 py-0.5 rounded">
                            Freelancer
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono font-bold text-[#A6B4AE] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                            Client
                          </span>
                        )}
                        {c.isInternal && (
                          <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" /> Private
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono">{c.time}</span>
                    <button
                      type="button"
                      onClick={() => handleTogglePin(c.id)}
                      className={`p-1 transition-colors ${c.isPinned ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                      title={c.isPinned ? 'Unpin' : 'Pin Message'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(c)}
                      className="text-zinc-500 hover:text-white p-1 transition-colors"
                      title="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    {c.isOwner && (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                        title="Delete Message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed pl-9 whitespace-pre-line">{c.text}</p>

                {/* Attachment Pills */}
                {c.attachments && c.attachments.length > 0 && (
                  <div className="pl-9 flex items-center gap-2 flex-wrap pt-1">
                    {c.attachments.map((att, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-300 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg"
                      >
                        <FileText className="w-3 h-3 text-white" />
                        {att}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Post Comment Input with Formatting Bar */}
        <form onSubmit={handlePostComment} className="space-y-3 pt-4 border-t border-white/10">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-300 flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-[11px] underline hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Active Reply Banner */}
          {replyingTo && (
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
              <span className="text-zinc-300">
                Replying to <strong className="text-white">{replyingTo.author}</strong>: &quot;{replyingTo.text.slice(0, 40)}...&quot;
              </span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Attachments preview bar */}
          {attachments.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {attachments.map((att, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-200 bg-zinc-900 border border-white/10 px-2.5 py-1 rounded-lg font-mono"
                >
                  <FileText className="w-3 h-3 text-white" />
                  {att}
                  <button
                    type="button"
                    onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                    className="text-zinc-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleFormatting('**bold**')}
                className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 text-xs font-bold"
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('*italic*')}
                className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 text-xs italic"
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('`code`')}
                className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 text-xs font-mono"
                title="Code"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleAddMention}
                className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 text-xs font-mono"
                title="Mention Client"
              >
                <AtSign className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleSimulateAttachment}
                className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 text-xs"
                title="Attach File"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Internal Note Toggle */}
            <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer hover:text-zinc-200 select-none">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500/20"
              />
              <Lock className={`w-3 h-3 ${isInternal ? 'text-amber-400' : 'text-zinc-500'}`} />
              <span className={isInternal ? 'text-amber-400 font-medium' : ''}>Internal Note (Private)</span>
            </label>
          </div>

          <div className="flex gap-2">
            <textarea
              rows={2}
              value={newComment}
              disabled={isSubmitting}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handlePostComment(e);
                }
              }}
              placeholder={isInternal ? "Write a private freelancer note (Enter ↵ to save, Shift+Enter for new line)..." : "Write a message or project update for the client... (Enter ↵ to send, Shift+Enter for new line)"}
              className={`flex-1 border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-colors ${
                isInternal
                  ? 'bg-amber-500/[0.03] border-amber-500/30 focus:border-amber-500/50 placeholder-amber-400/40'
                  : 'bg-zinc-900/60 border-white/10 focus:border-white/30 placeholder-zinc-500'
              }`}
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              disabled={isSubmitting || (!newComment.trim() && attachments.length === 0)}
              rightIcon={<Send className="w-3.5 h-3.5" />}
            >
              {isSubmitting ? 'Posting...' : isInternal ? 'Save Note' : 'Send'}
            </Button>
          </div>
          <div className="flex justify-end pr-1 text-[10px] font-mono text-zinc-500">
            <span>Press <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300">Enter ↵</kbd> to send • <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300">Shift + Enter</kbd> for newline</span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
