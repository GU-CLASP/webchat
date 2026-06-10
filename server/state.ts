import { randomUUID } from 'node:crypto';
import type { Message } from '../shared/chat';
import type { AdminNotification, ParticipantState } from '../shared/admin';

export const participantState = new Map<string, ParticipantState>();
const chatHistory: Message[] = [];
const adminNotifications: AdminNotification[] = [];
const maxAdminNotifications = 100;

export function upsertParticipant(
  senderId: string,
  senderName: string,
  updates: Partial<Omit<ParticipantState, 'senderId' | 'senderName' | 'connectedAt'>>,
) {
  const existing = participantState.get(senderId);
  const nextState: ParticipantState = {
    senderId,
    senderName,
    isTyping: existing?.isTyping ?? false,
    isReady: existing?.isReady ?? false,
    draft: existing?.draft ?? '',
    cursorStart: existing?.cursorStart ?? null,
    cursorEnd: existing?.cursorEnd ?? null,
    lastKeypress: existing?.lastKeypress ?? null,
    connectedAt: existing?.connectedAt ?? new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    ...existing,
    ...updates,
  };

  participantState.set(senderId, nextState);
  return nextState;
}

export function removeParticipant(senderId: string) {
  participantState.delete(senderId);
}

export function getParticipants() {
  return Array.from(participantState.values());
}

export function getChatHistory() {
  return chatHistory;
}

export function appendMessage(message: Message) {
  chatHistory.push(message);
}

export function appendAdminNotification(
  notification: Omit<AdminNotification, 'id' | 'createdAt'>,
) {
  const nextNotification: AdminNotification = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...notification,
  };

  adminNotifications.unshift(nextNotification);
  adminNotifications.splice(maxAdminNotifications);
  return nextNotification;
}

export function getAdminNotifications() {
  return adminNotifications;
}
