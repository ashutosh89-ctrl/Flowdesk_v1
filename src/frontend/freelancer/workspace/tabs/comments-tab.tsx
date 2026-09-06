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
  const [replyingTo, setReplyingTo] = useState<WorkspaceComment | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && attachments.length === 0) return;

    CommentService.addComment(client.id, {
      text: newComment,
      author: profile?.name || 'You',
      isOwner: true,
      replyToId: replyingTo?.id,
      replyToAuthor: replyingTo?.author,
      replyToText: replyingTo?.text,
      attachments,
    }).then(() => {
      setNewComment('');
      setReplyingTo(null);
      setAttachments([]);
      onRefresh();
    });
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
            <CardTitle>{client.company} Async Discussion Thread</CardTitle>
            <CardDescription>Direct messaging, threaded replies and file attachment trail</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comment Thread */}
        <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
          {comments.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">No messages in thread yet. Post an update below.</p>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className={`p-4 rounded-xl border space-y-2 transition-all ${
                  c.isPinned
                    ? 'bg-amber-500/[0.04] border-amber-500/30'
                    : c.isOwner
                    ? 'bg-white/[0.04] border-white/15'
                    : 'bg-zinc-900/60 border-white/10'
                }`}
              >
                {/* Pinned Tag */}
                {c.isPinned && (
                  <div className="flex items-center gap-1 text-[10px] font-mono text-amber-400 font-bold uppercase mb-1">
                    <Pin className="w-3 h-3" /> Pinned Workspace Message
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
                      <span className="text-xs font-bold text-white">{c.author}</span>
                      {c.isOwner && (
                        <span className="ml-2 text-[10px] font-mono text-zinc-400 bg-white/10 px-1.5 py-0.5 rounded">
                          YOU
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono">{c.time}</span>
                    <button
                      onClick={() => handleTogglePin(c.id)}
                      className={`p-1 transition-colors ${c.isPinned ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                      title={c.isPinned ? 'Unpin' : 'Pin Message'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setReplyingTo(c)}
                      className="text-zinc-500 hover:text-white p-1 transition-colors"
                      title="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    {c.isOwner && (
                      <button
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

          <div className="flex gap-2">
            <textarea
              rows={2}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a message or project update for the client..."
              className="flex-1 bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/30"
            />
            <Button type="submit" variant="primary" size="md" rightIcon={<Send className="w-3.5 h-3.5" />}>
              Send
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
