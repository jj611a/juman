import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../shared/types';

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterMs: number;
}

/**
 * In-memory sliding-window rate limiter for the public login endpoint.
 * Keys on both the client IP and the attempted username so a single attacker
 * cannot hammer one account (lockout DoS) or spray across accounts.
 * Single-process local desktop app — no distributed store required.
 */
@Injectable()
export class LoginRateLimiterService {
  private readonly buckets = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxPerIp: number;
  private readonly maxPerUsername: number;

  constructor(config: ConfigService) {
    const auth = config.getOrThrow<AppConfig>('app').auth;
    this.windowMs = auth.loginRateLimitWindowMs;
    this.maxPerIp = auth.loginRateLimitMaxPerIp;
    this.maxPerUsername = auth.loginRateLimitMaxPerUsername;
  }

  /** Record the attempt and report whether it is allowed. */
  consume(ip: string, username: string): RateLimitDecision {
    const now = Date.now();
    this.prune(now);

    const ipBucket = this.touch(`ip:${ip}`, now);
    const userBucket = this.touch(`user:${username.trim().toLowerCase()}`, now);

    const ipBlocked = ipBucket.length > this.maxPerIp;
    const userBlocked = userBucket.length > this.maxPerUsername;

    if (ipBlocked || userBlocked) {
      return { allowed: false, retryAfterMs: this.retryAfter(ipBucket, userBucket, now) };
    }
    return { allowed: true, retryAfterMs: 0 };
  }

  private touch(key: string, now: number): number[] {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = [];
      this.buckets.set(key, bucket);
    }
    bucket.push(now);
    return bucket;
  }

  private prune(now: number): void {
    if (this.buckets.size > 10_000) {
      this.buckets.clear();
      return;
    }
    const cutoff = now - this.windowMs;
    for (const [key, bucket] of this.buckets) {
      const live = bucket.filter((t) => t > cutoff);
      if (live.length === 0) this.buckets.delete(key);
      else if (live.length !== bucket.length) this.buckets.set(key, live);
    }
  }

  private retryAfter(ip: number[], user: number[], now: number): number {
    const oldest = Math.min(ip[0] ?? now, user[0] ?? now);
    const elapsed = now - oldest;
    return Math.max(0, this.windowMs - elapsed);
  }
}
