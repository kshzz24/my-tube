import { db } from "@/db";
import {
  playlists,
  playlistVideos,
  users,
  videoReactions,
  videos,
  videoViews,
} from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, getTableColumns, lt, or, sql } from "drizzle-orm";
import { z } from "zod";

export const playlistRouter = createTRPCRouter({
  removePlaylist: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      const { id: userId } = ctx.user;

      const [existingPlaylist] = await db
        .select()
        .from(playlists)
        .where(and(eq(playlists.id, id), eq(playlists.userId, userId)));

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [deletedPlaylist] = await db
        .delete(playlists)
        .where(and(eq(playlists.id, id), eq(playlists.userId, userId)))
        .returning();

      return deletedPlaylist;
    }),
  getOne: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { id } = input;
      const { id: userId } = ctx.user;

      const [existingPlaylist] = await db
        .select()
        .from(playlists)
        .where(and(eq(playlists.id, id), eq(playlists.userId, userId)));

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return existingPlaylist;
    }),
  getVideos: protectedProcedure
    .input(
      z.object({
        playlistId: z.string().uuid(),
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      // Destructure pagination parameters from input
      const { cursor, limit, playlistId } = input;
      const { id: userId } = ctx.user;
      // Get current user's ID from context

      const [existingPlaylist] = await db
        .select()
        .from(playlists)
        .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)));

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const videoFromPlaylist = db.$with("playlist_videos").as(
        db
          .select({
            videoId: playlistVideos.videoId,
          })
          .from(playlistVideos)
          .where(eq(playlistVideos.playlistId, playlistId))
      );

      const data = await db
        .with(videoFromPlaylist)
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
        .innerJoin(videoFromPlaylist, eq(videos.id, videoFromPlaylist.videoId))

        .where(
          and(
            // Only show videos belonging to current user
            eq(videos.visibility, "public"),

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
  addVideo: protectedProcedure
    .input(
      z.object({ playlistId: z.string().min(1), videoId: z.string().min(1) })
    )
    .mutation(async ({ input, ctx }) => {
      const { playlistId, videoId } = input;
      const { id: userId } = ctx.user;

      const [existingPlaylist] = await db
        .select()
        .from(playlists)
        .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)));

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId));
      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [existingPlaylistVideo] = await db
        .select()
        .from(playlistVideos)
        .where(
          and(
            eq(playlistVideos.playlistId, playlistId),
            eq(playlistVideos.videoId, videoId)
          )
        );

      if (existingPlaylistVideo) {
        throw new TRPCError({ code: "CONFLICT" });
      }

      const [createdPlaylistVideo] = await db
        .insert(playlistVideos)
        .values({ playlistId, videoId })
        .returning();

      return createdPlaylistVideo;
    }),
  remove: protectedProcedure
    .input(
      z.object({ playlistId: z.string().min(1), videoId: z.string().min(1) })
    )
    .mutation(async ({ input, ctx }) => {
      const { playlistId, videoId } = input;
      const { id: userId } = ctx.user;

      const [existingPlaylist] = await db
        .select()
        .from(playlists)
        .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)));

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId));
      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [existingPlaylistVideo] = await db
        .select()
        .from(playlistVideos)
        .where(
          and(
            eq(playlistVideos.playlistId, playlistId),
            eq(playlistVideos.videoId, videoId)
          )
        );

      if (!existingPlaylistVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [deletedPlaylistVideo] = await db
        .delete(playlistVideos)
        .where(
          and(
            eq(playlistVideos.playlistId, playlistId),
            eq(playlistVideos.videoId, videoId)
          )
        )
        .returning();

      return deletedPlaylistVideo;
    }),
  getManyForVideo: protectedProcedure
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
    .query(async ({ input, ctx }) => {
      // Destructure pagination parameters from input
      const { cursor, limit, videoId } = input;
      const { id: userId } = ctx.user;
      // Get current user's ID from context

      const data = await db

        .select({
          ...getTableColumns(playlists),
          videoCount: db.$count(
            playlistVideos,
            eq(playlists.id, playlistVideos.playlistId)
          ),
          user: users,
          containsVideo: videoId
            ? sql<boolean>`(
            SELECT exists (
              SELECT 1 from ${playlistVideos} pv where pv.playlist_id = ${playlists.id} AND pv.video_id = ${videoId}
            )
          )`
            : sql<boolean>`false`,
        })
        .from(playlists)
        .innerJoin(users, eq(playlists.userId, users.id))
        .where(
          and(
            // Only show videos belonging to current user
            eq(playlists.userId, userId),
            // If cursor exists, apply pagination conditions
            cursor
              ? or(
                  // Condition 1: Get videos updated before cursor's timestamp means 3:00PM and earlier
                  lt(playlists.updatedAt, cursor.updatedAt),

                  // Condition 2: Get videos with same timestamp but lower ID
                  and(
                    // Same timestamp as cursor means at 3:00PM and with smaller id
                    eq(playlists.updatedAt, cursor.updatedAt),
                    // But ID must be less than cursor's ID
                    lt(playlists.id, cursor.id)
                  )
                )
              : undefined // If no cursor, get first page
          )
        )
        // Sort by newest first, then by ID for stable ordering
        .orderBy(desc(playlists.updatedAt), desc(playlists.id))
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
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const { name } = input;
      const { id: userId } = ctx.user;

      const [createdPlaylist] = await db
        .insert(playlists)
        .values({
          userId,
          name,
        })
        .returning();

      if (!createdPlaylist) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }
      return createdPlaylist;
    }),
  getMany: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      // Destructure pagination parameters from input
      const { cursor, limit } = input;
      const { id: userId } = ctx.user;
      // Get current user's ID from context

      const data = await db

        .select({
          ...getTableColumns(playlists),
          videoCount: db.$count(
            playlistVideos,
            eq(playlists.id, playlistVideos.playlistId)
          ),
          user: users,
          thumbnailUrl: sql<string | null>`(
            select v.thumbnail_url 
            from ${playlistVideos} pv 
            JOIN ${videos} v on v.id = pv.video_id 
            WHERE pv.playlist_id = ${playlists.id} 
            ORDER BY pv.updated_at DESC 
            limit 1
          )`,
        })
        .from(playlists)
        .innerJoin(users, eq(playlists.userId, users.id))
        .where(
          and(
            // Only show videos belonging to current user
            eq(playlists.userId, userId),
            // If cursor exists, apply pagination conditions
            cursor
              ? or(
                  // Condition 1: Get videos updated before cursor's timestamp means 3:00PM and earlier
                  lt(playlists.updatedAt, cursor.updatedAt),

                  // Condition 2: Get videos with same timestamp but lower ID
                  and(
                    // Same timestamp as cursor means at 3:00PM and with smaller id
                    eq(playlists.updatedAt, cursor.updatedAt),
                    // But ID must be less than cursor's ID
                    lt(playlists.id, cursor.id)
                  )
                )
              : undefined // If no cursor, get first page
          )
        )
        // Sort by newest first, then by ID for stable ordering
        .orderBy(desc(playlists.updatedAt), desc(playlists.id))
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
  getHistory: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(),
            viewedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      // Destructure pagination parameters from input
      const { cursor, limit } = input;
      const { id: userId } = ctx.user;
      // Get current user's ID from context

      const viewerVideoViews = db.$with("video_viewer_views").as(
        db
          .select({
            videoId: videoViews.videoId,
            viewedAt: videoViews.updatedAt,
          })
          .from(videoViews)
          .where(eq(videoViews.userId, userId))
      );

      const data = await db
        .with(viewerVideoViews)
        .select({
          ...getTableColumns(videos),
          user: users,
          viewedAt: viewerVideoViews.viewedAt,
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
        .innerJoin(viewerVideoViews, eq(videos.id, viewerVideoViews.videoId))

        .where(
          and(
            // Only show videos belonging to current user
            eq(videos.visibility, "public"),

            // If cursor exists, apply pagination conditions
            cursor
              ? or(
                  // Condition 1: Get videos updated before cursor's timestamp means 3:00PM and earlier
                  lt(viewerVideoViews.viewedAt, cursor.viewedAt),

                  // Condition 2: Get videos with same timestamp but lower ID
                  and(
                    // Same timestamp as cursor means at 3:00PM and with smaller id
                    eq(viewerVideoViews.viewedAt, cursor.viewedAt),
                    // But ID must be less than cursor's ID
                    lt(videos.id, cursor.id)
                  )
                )
              : undefined // If no cursor, get first page
          )
        )
        // Sort by newest first, then by ID for stable ordering
        .orderBy(desc(viewerVideoViews.viewedAt), desc(videos.id))
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
            viewedAt: lastItem.viewedAt,
          }
        : null; // No cursor if this is the last page

      // Return both the items and the cursor for the next page
      return { items, nextCursor };
    }),
  getLiked: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(),
            likedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      // Destructure pagination parameters from input
      const { cursor, limit } = input;
      const { id: userId } = ctx.user;
      // Get current user's ID from context

      const viewerVideoReactions = db.$with("video_viewer_reactions").as(
        db
          .select({
            videoId: videoReactions.videoId,
            likedAt: videoReactions.updatedAt,
          })
          .from(videoReactions)
          .where(
            and(
              eq(videoReactions.userId, userId),
              eq(videoReactions.type, "like")
            )
          )
      );

      const data = await db
        .with(viewerVideoReactions)
        .select({
          ...getTableColumns(videos),
          user: users,
          likedAt: viewerVideoReactions.likedAt,
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
        .innerJoin(
          viewerVideoReactions,
          eq(videos.id, viewerVideoReactions.videoId)
        )

        .where(
          and(
            // Only show videos belonging to current user
            eq(videos.visibility, "public"),

            // If cursor exists, apply pagination conditions
            cursor
              ? or(
                  // Condition 1: Get videos updated before cursor's timestamp means 3:00PM and earlier
                  lt(viewerVideoReactions.likedAt, cursor.likedAt),

                  // Condition 2: Get videos with same timestamp but lower ID
                  and(
                    // Same timestamp as cursor means at 3:00PM and with smaller id
                    eq(viewerVideoReactions.likedAt, cursor.likedAt),
                    // But ID must be less than cursor's ID
                    lt(videos.id, cursor.id)
                  )
                )
              : undefined // If no cursor, get first page
          )
        )
        // Sort by newest first, then by ID for stable ordering
        .orderBy(desc(viewerVideoReactions.likedAt), desc(videos.id))
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
            likedAt: lastItem.likedAt,
          }
        : null; // No cursor if this is the last page

      // Return both the items and the cursor for the next page
      return { items, nextCursor };
    }),
});
