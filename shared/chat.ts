export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  sentAt: string;
};

export type ClientChatEvent =
  | {
      type: 'message';
      senderId: string;
      content: string;
      senderName: string;
    }
  | {
      type: 'typing';
      senderId: string;
      senderName: string;
      isTyping: boolean;
    }
  | {
      type: 'keypress';
      senderId: string;
      senderName: string;
      key: string;
      code: string;
      altKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
      cursorStart: number | null;
      cursorEnd: number | null;
      draft: string;
    }
  | {
      type: 'draft-update';
      senderId: string;
      senderName: string;
      draft: string;
      cursorStart: number | null;
      cursorEnd: number | null;
    }
  | {
      type: 'cursor-move';
      senderId: string;
      senderName: string;
      cursorStart: number | null;
      cursorEnd: number | null;
      draft: string;
    }
  | {
      type: 'ready-state';
      senderId: string;
      senderName: string;
      isReady: boolean | null;
    }
  | {
      type: 'image-click';
      senderId: string;
      imageId: 'pic1' | 'pic2';
      x: number;
      y: number;
      action: 'add' | 'remove';
    };

export type ServerChatEvent =
  | {
      type: 'history';
      messages: Message[];
    }
  | {
      type: 'identity';
      senderId: string;
      senderName: string;
    }
  | {
      type: 'message';
      message: Message;
    }
  | {
      type: 'chat-enabled';
      enabled: boolean;
    }
  | {
      type: 'broadcast-message';
      content: string;
    }
  | {
      type: 'typing';
      senderId: string;
      senderName: string;
      isTyping: boolean;
    };
