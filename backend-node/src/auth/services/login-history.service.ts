import { Injectable } from '@nestjs/common';
import { LOGIN_HISTORY_EVENT } from '../../core/auth.constants';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LoginHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: {
    userId?: string | null;
    usernameAttempted: string;
    eventType: string;
    success: boolean;
    failureReason?: string | null;
    ipAddress?: string | null;
    deviceName?: string | null;
    userAgent?: string | null;
    sessionId?: string | null;
  }) {
    return this.prisma.loginHistory.create({
      data: {
        userId: input.userId ?? null,
        usernameAttempted: input.usernameAttempted,
        eventType: input.eventType,
        success: input.success,
        failureReason: input.failureReason ?? null,
        ipAddress: input.ipAddress ?? null,
        deviceName: input.deviceName ?? null,
        userAgent: input.userAgent ?? null,
        sessionId: input.sessionId ?? null,
      },
    });
  }

  recordLoginSuccess(input: {
    userId: string;
    username: string;
    sessionId: string;
    ipAddress?: string;
    deviceName?: string;
    userAgent?: string;
  }) {
    return this.record({
      ...input,
      usernameAttempted: input.username,
      eventType: LOGIN_HISTORY_EVENT.LOGIN,
      success: true,
    });
  }

  recordLoginFailure(input: {
    userId?: string;
    username: string;
    failureReason: string;
    ipAddress?: string;
    deviceName?: string;
    userAgent?: string;
  }) {
    return this.record({
      userId: input.userId,
      usernameAttempted: input.username,
      eventType: LOGIN_HISTORY_EVENT.LOGIN,
      success: false,
      failureReason: input.failureReason,
      ipAddress: input.ipAddress,
      deviceName: input.deviceName,
      userAgent: input.userAgent,
    });
  }

  recordLogout(input: {
    userId: string;
    username: string;
    sessionId?: string;
    ipAddress?: string;
    deviceName?: string;
  }) {
    return this.record({
      userId: input.userId,
      usernameAttempted: input.username,
      eventType: LOGIN_HISTORY_EVENT.LOGOUT,
      success: true,
      sessionId: input.sessionId,
      ipAddress: input.ipAddress,
      deviceName: input.deviceName,
    });
  }

  recordAccountLocked(input: {
    userId: string;
    username: string;
    ipAddress?: string;
    deviceName?: string;
  }) {
    return this.record({
      userId: input.userId,
      usernameAttempted: input.username,
      eventType: LOGIN_HISTORY_EVENT.ACCOUNT_LOCKED,
      success: false,
      failureReason: 'locked',
      ipAddress: input.ipAddress,
      deviceName: input.deviceName,
    });
  }
}
