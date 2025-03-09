import { DEFAULT_LIMIT } from "@/constants";
import { VideosView } from "@/modules/playlist/ui/views/videos-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ playlistId: string }>;
}

const Page = async ({ params }: PageProps) => {
  const { playlistId } = await params;

  void trpc.playlist.getOne.prefetch({ id: playlistId });
  void trpc.playlist.getVideos.prefetchInfinite({
    playlistId,
    limit: DEFAULT_LIMIT,
  });
  return (
    <HydrateClient>
      <VideosView playlistId={playlistId} />
    </HydrateClient>
  );
};

export default Page;
