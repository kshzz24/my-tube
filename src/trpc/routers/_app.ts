import { studioRouter } from "@/modules/studio/server/procedures";
import { categoriesRouter } from "@/modules/categories/server/procedure";
import { createTRPCRouter } from "../init";
import { videosRouter } from "@/modules/videos/server/procedure";
import { videoViewsRouter } from "@/modules/video-views/procedure";
import { videoReactionRouter } from "@/modules/video-reactions/procedure";

export const appRouter = createTRPCRouter({
  categories: categoriesRouter,
  studio: studioRouter,
  videos: videosRouter,
  videoViews: videoViewsRouter,
  videoReactions: videoReactionRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
