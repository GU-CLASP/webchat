export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  sentAt: string;
};

export type ClientChatEvent = {
  type: 'message';
  senderId: string;
  content: string;
  senderName: string;
};

export type ServerChatEvent =
  | {
      type: 'history';
      messages: Message[];
    }
  | {
      type: 'message';
      message: Message;
    };
