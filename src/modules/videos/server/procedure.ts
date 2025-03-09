import { db } from "@/db";
import {
  subscriptions,
  users,
  videoReactions,
  videos,
  videoUpdateSchema,
  videoViews,
} from "@/db/schema";
import { mux } from "@/lib/mux";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  lt,
  or,
} from "drizzle-orm";
import { UTApi } from "uploadthing/server";
import { z } from "zod";

export const videosRouter = createTRPCRouter({
  getTrending: baseProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(),
            viewCount: z.number(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input }) => {
      // Destructure pagination parameters from input
      const { cursor, limit } = input;
      // Get current user's ID from context
      const viewCountSubquery = db.$count(
        videoViews,
        eq(videoViews.videoId, videos.id)
      );
      const data = await db
        .select({
          ...getTableColumns(videos),
          user: users,

          viewCount: viewCountSubquery,
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
            // Only show videos belonging to current user
            eq(videos.visibility, "public"),
            // If cursor exists, apply pagination conditions
            cursor
              ? or(
                  // Condition 1: Get videos updated before cursor's timestamp means 3:00PM and earlier
                  lt(viewCountSubquery, cursor.viewCount),

                  // Condition 2: Get videos with same timestamp but lower ID
                  and(
                    // Same timestamp as cursor means at 3:00PM and with smaller id
                    eq(viewCountSubquery, cursor.viewCount),
                    // But ID must be less than cursor's ID
                    lt(videos.id, cursor.id)
                  )
                )
              : undefined // If no cursor, get first page
          )
        )
        // Sort by newest first, then by ID for stable ordering
        .orderBy(desc(viewCountSubquery), desc(videos.id))
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
            viewCount: lastItem.viewCount,
          }
        : null; // No cursor if this is the last page

      // Return both the items and the cursor for the next page
      return { items, nextCursor };
    }),
  getMany: baseProcedure
    .input(
      z.object({
        query: z.string().nullish(),
        userId: z.string().nullish(),
        categoryId: z.string().nullish(),
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
      const { cursor, limit, categoryId, userId } = input;
      // Get current user's ID from context

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
            // Only show videos belonging to current user
            eq(videos.visibility, "public"),
            userId ? eq(videos.userId, userId) : undefined,
            categoryId ? eq(videos.categoryId, categoryId) : undefined,

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
  getManySubscribed: protectedProcedure
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
      const { id: userId } = ctx.user;
      const { cursor, limit } = input;
      // Get current user's ID from context

      const viewerSubscriptions = db.$with("viewer_subscription").as(
        db
          .select({
            userId: subscriptions.creatorId,
          })
          .from(subscriptions)
          .where(eq(subscriptions.viewerId, userId))
      );
      const data = await db
        .with(viewerSubscriptions)
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
        .innerJoin(
          viewerSubscriptions,
          eq(viewerSubscriptions.userId, users.id)
        )
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
  getOne: baseProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { clerkUserId } = ctx;

      let userId;

      const [user] = await db
        .select()
        .from(users)
        .where(inArray(users.clerkId, clerkUserId ? [clerkUserId] : []));

      if (user) {
        userId = user.id;
      }
      // This creates a temporary result set named "viewer_reaction" that contains:
      // videoId - The ID of the video
      // type - The type of reaction (like/dislike)
      const viewerReactions = db.$with("viewer_reaction").as(
        db
          .select({
            videoId: videoReactions.videoId,
            type: videoReactions.type,
          })
          .from(videoReactions)
          .where(inArray(videoReactions.userId, userId ? [userId] : []))
        // to get authorize and unauthorize users
      );

      // It only includes reactions from the current user for all the videos that the current user has given
      // If userId exists, it filters to only show that user's reactions; otherwise, it returns an empty set.

      const viewerSubscriptions = db.$with("viewer_subscriptions").as(
        db
          .select()
          .from(subscriptions)
          .where(inArray(subscriptions.viewerId, userId ? [userId] : []))
      );

      const [existingVideo] = await db
        .with(viewerReactions, viewerSubscriptions)
        .select({
          ...getTableColumns(videos),
          user: {
            ...getTableColumns(users),

            subscriberCount: db.$count(
              subscriptions,
              eq(subscriptions.creatorId, users.id)
            ),
            viewerSubscribed: isNotNull(viewerSubscriptions.viewerId).mapWith(
              Boolean
            ),
          },
          // ek schema h jph video h, dusra schema ek view ka h isme saare views h aur uss schema , har video ki id h
          // is video id ke coressponding kitne views h unke rows ka count which is a number

          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "like")
            )
          ),
          dislikeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "dislike")
            )
          ),
          viewerReaction: viewerReactions.type,
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .leftJoin(viewerReactions, eq(viewerReactions.videoId, videos.id))
        .leftJoin(
          viewerSubscriptions,
          eq(viewerSubscriptions.creatorId, users.id)
        )
        .where(eq(videos.id, input.id));
      // .groupBy(videos.id, users.id, viewerReactions.type);

      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return existingVideo;
    }),

  revalidate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)));
      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (!existingVideo.muxUploadId) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const directUpload = await mux.video.uploads.retrieve(
        existingVideo.muxUploadId
      );
      if (!directUpload || !directUpload.asset_id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const asset = await mux.video.assets.retrieve(directUpload.asset_id);

      if (!asset) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const duration = asset.duration ? Math.round(asset.duration * 1000) : 0;
      const playbackId = asset.playback_ids?.[0].id;

      const [updatedVideo] = await db
        .update(videos)
        .set({
          muxStatus: asset.status,
          muxPlaybackId: playbackId,
          muxAssetId: asset.id,
          duration,
        })
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      return updatedVideo;
    }),
  restoreThumbnail: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)));

      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (existingVideo.thumbnailKey) {
        const utapi = new UTApi();
        await utapi.deleteFiles(existingVideo.thumbnailKey);
        await db
          .update(videos)
          .set({ thumbnailKey: null, thumbnailUrl: null })
          .where(and(eq(videos.id, input.id), eq(videos.userId, userId)));
      }
      if (!existingVideo.muxPlaybackId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const tempThumbnailUrl = `https://image.mux.com/${existingVideo.muxPlaybackId}/thumbnail.jpg`;

      const utapi = new UTApi();
      const uploadedThumbnail = await utapi.uploadFilesFromUrl(
        tempThumbnailUrl
      );

      if (!uploadedThumbnail.data) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      const { key: thumbnailKey, url: thumbnailUrl } = uploadedThumbnail.data;

      const [updatedVideo] = await db
        .update(videos)
        .set({ thumbnailUrl, thumbnailKey })
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      return updatedVideo;
    }),
  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [removedVideo] = await db
        .delete(videos)
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      if (!removedVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return removedVideo;
    }),

  update: protectedProcedure
    .input(videoUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      if (!input.id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const [updatedVideo] = await db
        .update(videos)
        .set({
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          visibility: input.visibility,
          updatedAt: new Date(),
        })
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      if (!updatedVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
    }),

  create: protectedProcedure.mutation(async ({ ctx }) => {
    const { id: userId } = ctx.user;

    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        passthrough: userId,
        playback_policy: ["public"],
        input: [
          {
            generated_subtitles: [
              {
                language_code: "en",
                name: "English",
              },
            ],
          },
        ],
      },
      cors_origin: "*",
    });

    const [video] = await db
      .insert(videos)
      .values({
        userId,
        title: "Untitled",
        muxStatus: "waiting",
        muxUploadId: upload.id,
      })
      .returning();

    return {
      video: video,
      url: upload.url,
    };
  }),
});
