import type { Message } from './chat';

export type ParticipantState = {
  senderId: string;
  senderName: string;
  isTyping: boolean;
  isReady: boolean;
  draft: string;
  cursorStart: number | null;
  cursorEnd: number | null;
  lastKeypress: {
    key: string;
    code: string;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    at: string;
  } | null;
  connectedAt: string;
  lastSeenAt: string;
};

export type ServerAdminEvent =
  | {
      type: 'snapshot';
      participants: ParticipantState[];
      messages: Message[];
    }
  | {
      type: 'participant-state';
      participant: ParticipantState;
    }
  | {
      type: 'message';
      message: Message;
    }
  | {
      type: 'participant-left';
      senderId: string;
    };

export function formatTime(value: string) {
  return new Intl.DateTimeFormat([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}
