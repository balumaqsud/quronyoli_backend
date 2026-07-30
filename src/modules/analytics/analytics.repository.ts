import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NormalizedAnalyticsEvent } from './analytics.constants';
import { chunkArray } from './analytics.validation';

export interface InsertManyResult {
  accepted: number;
  duplicates: number;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insertMany(
    events: NormalizedAnalyticsEvent[],
    chunkSize: number,
  ): Promise<InsertManyResult> {
    if (events.length === 0) {
      return { accepted: 0, duplicates: 0 };
    }

    let accepted = 0;
    for (const chunk of chunkArray(events, chunkSize)) {
      const result = await this.prisma.analyticsEvent.createMany({
        data: chunk.map((event) => ({
          userId: event.userId,
          eventName: event.eventName,
          occurredAt: event.occurredAt,
          deviceId: event.deviceId,
          sessionId: event.sessionId,
          schemaVersion: event.schemaVersion,
          properties:
            event.properties === null || event.properties === undefined
              ? Prisma.JsonNull
              : (event.properties as Prisma.InputJsonValue),
          idempotencyKey: event.idempotencyKey,
        })),
        skipDuplicates: true,
      });
      accepted += result.count;
    }

    return {
      accepted,
      duplicates: Math.max(0, events.length - accepted),
    };
  }

  async countByEventName(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ eventName: string; count: number }>> {
    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['eventName'],
      where: {
        userId,
        occurredAt: { gte: from, lte: to },
      },
      _count: { _all: true },
      orderBy: { eventName: 'asc' },
    });

    return rows.map((row) => ({
      eventName: row.eventName,
      count: row._count._all,
    }));
  }

  async countTotal(userId: string, from: Date, to: Date): Promise<number> {
    return await this.prisma.analyticsEvent.count({
      where: {
        userId,
        occurredAt: { gte: from, lte: to },
      },
    });
  }

  async findFirstLast(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<{ firstEventAt: Date | null; lastEventAt: Date | null }> {
    const [first, last] = await Promise.all([
      this.prisma.analyticsEvent.findFirst({
        where: { userId, occurredAt: { gte: from, lte: to } },
        orderBy: { occurredAt: 'asc' },
        select: { occurredAt: true },
      }),
      this.prisma.analyticsEvent.findFirst({
        where: { userId, occurredAt: { gte: from, lte: to } },
        orderBy: { occurredAt: 'desc' },
        select: { occurredAt: true },
      }),
    ]);

    return {
      firstEventAt: first?.occurredAt ?? null,
      lastEventAt: last?.occurredAt ?? null,
    };
  }

  async dailySeries(
    userId: string,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<Array<{ localDate: string; count: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ local_date: string; count: bigint }>
    >`
      SELECT
        to_char(timezone(${timezone}, "occurred_at"), 'YYYY-MM-DD') AS local_date,
        COUNT(*)::bigint AS count
      FROM "analytics_events"
      WHERE "user_id" = ${userId}::uuid
        AND "occurred_at" >= ${from}
        AND "occurred_at" <= ${to}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return rows.map((row) => ({
      localDate: row.local_date,
      count: Number(row.count),
    }));
  }

  async topProperty(
    userId: string,
    from: Date,
    to: Date,
    eventName: string,
    propertyKey: string,
    limit = 10,
  ): Promise<Array<{ key: string; count: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ key: string; count: bigint }>
    >`
      SELECT
        COALESCE("properties"->>${propertyKey}, '') AS key,
        COUNT(*)::bigint AS count
      FROM "analytics_events"
      WHERE "user_id" = ${userId}::uuid
        AND "event_name" = ${eventName}
        AND "occurred_at" >= ${from}
        AND "occurred_at" <= ${to}
        AND "properties" ? ${propertyKey}
      GROUP BY 1
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    return rows
      .filter((row) => row.key.length > 0)
      .map((row) => ({
        key: row.key,
        count: Number(row.count),
      }));
  }

  async uniqueActiveDays(
    userId: string,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ days: bigint }>>`
      SELECT COUNT(DISTINCT to_char(timezone(${timezone}, "occurred_at"), 'YYYY-MM-DD'))::bigint AS days
      FROM "analytics_events"
      WHERE "user_id" = ${userId}::uuid
        AND "occurred_at" >= ${from}
        AND "occurred_at" <= ${to}
    `;
    return Number(rows[0]?.days ?? 0);
  }
}
