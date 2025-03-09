import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, getTableColumns, lt, or } from "drizzle-orm";
import { z } from "zod";

export const subscriptionsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId } = input;

      if (userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const [createdSubscription] = await db
        .insert(subscriptions)
        .values({ viewerId: ctx.user.id, creatorId: userId })
        .returning();
      return createdSubscription;
    }),
  remove: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      //userId jisne video upload kri h
      // ctx m joh logged in user h
      const { userId } = input;

      if (userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const [deletedSubscription] = await db
        .delete(subscriptions)
        .where(
          and(
            eq(subscriptions.viewerId, ctx.user.id),
            eq(subscriptions.creatorId, userId)
          )
        )
        .returning();
      return deletedSubscription;
    }),
  getMany: protectedProcedure
    .input(
      z.object({
        userId: z.string().nullish(),
        cursor: z
          .object({
            creatorId: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      // Destructure pagination parameters from input
      const { cursor, limit } = input;
      // Get current user's ID from context
      const { id: userId } = ctx.user;
      const data = await db
        .select({
          ...getTableColumns(subscriptions),
          user: {
            ...getTableColumns(users),
            subscriberCount: db.$count(
              subscriptions,
              eq(subscriptions.creatorId, users.id)
            ),
          },
        })
        .from(subscriptions)
        .innerJoin(users, eq(subscriptions.creatorId, users.id))
        .where(
          and(
            // Only show videos belonging to current user

            eq(subscriptions.viewerId, userId),

            // If cursor exists, apply pagination conditions
            cursor
              ? or(
                  // Condition 1: Get videos updated before cursor's timestamp means 3:00PM and earlier
                  lt(subscriptions.updatedAt, cursor.updatedAt),

                  // Condition 2: Get videos with same timestamp but lower ID
                  and(
                    // Same timestamp as cursor means at 3:00PM and with smaller id
                    eq(subscriptions.updatedAt, cursor.updatedAt),
                    // But ID must be less than cursor's ID
                    lt(subscriptions.creatorId, cursor.creatorId)
                  )
                )
              : undefined // If no cursor, get first page
          )
        )
        // Sort by newest first, then by ID for stable ordering
        .orderBy(desc(subscriptions.updatedAt), desc(subscriptions.creatorId))
        // Get one extra item to determine if there's a next page
        .limit(limit + 1);

      // Check if there are more items beyond this page
      const hasMore = data.length > limit;
      // Remove the extra item if we fetched more than limit
      const items = hasMore ? data.slice(0, -1) : data;

      // Get the last item for creating the next cursor
      const lastItem = items[items.length - 1];

      // Create cursor for next page if there are more items
      const nextCursor = hasMore
        ? {
            creatorId: lastItem.creatorId,
            updatedAt: lastItem.updatedAt,
          }
        : null; // No cursor if this is the last page

      // Return both the items and the cursor for the next page
      return { items, nextCursor };
    }),
});
