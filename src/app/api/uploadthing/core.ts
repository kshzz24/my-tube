import { db } from "@/db";
import { users, videos } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";
import { z } from "zod";

const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  bannerUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    // Set permissions and file types for this FileRoute
    .middleware(async ({}) => {
      // This code runs on your server before upload
      const { userId: clerkUserId } = await auth();

      // If you throw, the user will not be able to upload
      if (!clerkUserId) throw new UploadThingError("Unauthorized");
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkUserId));
      if (!existingUser) {
        throw new UploadThingError("Unauthorized");
      }

      if (existingUser.bannerKey) {
        const utapi = new UTApi();
        await utapi.deleteFiles(existingUser.bannerKey);
        await db
          .update(users)
          .set({ bannerKey: null, bannerUrl: null })
          .where(eq(users.id, existingUser.id));
      }

      return { userId: existingUser.id };

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await db
        .update(users)
        .set({ bannerUrl: file.url, bannerKey: file.key })
        .where(eq(users.id, metadata.userId));
      return { uploadedBy: metadata.userId };
    }),
  thumbnailUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .input(
      z.object({
        videoId: z.string().uuid(),
      })
    )
    // Set permissions and file types for this FileRoute
    .middleware(async ({ input }) => {
      // This code runs on your server before upload
      const { userId: clerkUserId } = await auth();

      // If you throw, the user will not be able to upload
      if (!clerkUserId) throw new UploadThingError("Unauthorized");
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkUserId));
      if (!user) {
        throw new UploadThingError("Unauthorized");
      }
      const [existingVideo] = await db
        .select({ thumbnailKey: videos.thumbnailKey })
        .from(videos)
        .where(and(eq(videos.id, input.videoId), eq(videos.userId, user.id)));

      if (!existingVideo) {
        throw new UploadThingError("Not Found");
      }

      if (existingVideo.thumbnailKey) {
        const utapi = new UTApi();
        await utapi.deleteFiles(existingVideo.thumbnailKey);
        await db
          .update(videos)
          .set({ thumbnailKey: null, thumbnailUrl: null })
          .where(and(eq(videos.id, input.videoId), eq(videos.userId, user.id)));
      }

      return { user, ...input };

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await db
        .update(videos)
        .set({ thumbnailUrl: file.url, thumbnailKey: file.key })
        .where(
          and(
            eq(videos.id, metadata.videoId),
            eq(videos.userId, metadata.user.id)
          )
        );
      return { uploadedBy: metadata.user.id };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
