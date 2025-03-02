import { studioRouter } from "@/modules/studio/server/procedures";
import { categoriesRouter } from "@/modules/categories/server/procedure";
import { createTRPCRouter } from "../init";
import { videosRouter } from "@/modules/videos/server/procedure";
import { videoViewsRouter } from "@/modules/video-views/procedure";
import { videoReactionRouter } from "@/modules/video-reactions/procedure";
import { subscriptionsRouter } from "@/modules/subscriptions/server/procedure";
import { commentsRouter } from "@/modules/comments/server/procedure";
import { commentReactionRouter } from "@/modules/comment-reactions/procedure";

export const appRouter = createTRPCRouter({
  categories: categoriesRouter,
  studio: studioRouter,
  videos: videosRouter,
  videoViews: videoViewsRouter,
  videoReactions: videoReactionRouter,
  subscriptions: subscriptionsRouter,
  comments: commentsRouter,
  commentReactions: commentReactionRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
