import { db } from "@/db";
import { users, videoReactions, videos, videoViews } from "@/db/schema";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { eq, and, or, lt, desc, getTableColumns, not } from "drizzle-orm";
import { z } from "zod";
export const suggestionsRouter = createTRPCRouter({
  getMany: baseProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input }) => {
      // Destructure pagination parameters from input
      const { videoId, cursor, limit } = input;
      // Get current user's ID from context

      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId));
      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const data = await db
        .select({
          ...getTableColumns(videos),
          user: users,
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "like")
            )
          ),
          dislike: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "dislike")
            )
          ),
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .where(
          and(
            not(eq(videos.id, existingVideo.id)),
            eq(videos.visibility, "public"),
            existingVideo.categoryId
              ? // Only show videos belonging to current user
                eq(videos.categoryId, existingVideo.categoryId)
              : undefined,

            // If cursor exists, apply pagination conditions
            cursor
              ? or(
                  // Condition 1: Get videos updated before cursor's timestamp means 3:00PM and earlier
                  lt(videos.updatedAt, cursor.updatedAt),

                  // Condition 2: Get videos with same timestamp but lower ID
                  and(
                    // Same timestamp as cursor means at 3:00PM and with smaller id
                    eq(videos.updatedAt, cursor.updatedAt),
                    // But ID must be less than cursor's ID
                    lt(videos.id, cursor.id)
                  )
                )
              : undefined // If no cursor, get first page
          )
        )
        // Sort by newest first, then by ID for stable ordering
        .orderBy(desc(videos.updatedAt), desc(videos.id))
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
            id: lastItem.id,
            updatedAt: lastItem.updatedAt,
          }
        : null; // No cursor if this is the last page

      // Return both the items and the cursor for the next page
      return { items, nextCursor };
    }),
});
