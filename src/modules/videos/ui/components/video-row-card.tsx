import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { UserInfo } from "@/modules/users/ui/components/user-info";
import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import { useMemo } from "react";
import { VideoMenu } from "./video-menu";
import { VideoThumbnail } from "./video-thumbnail";
import { VideoGetManyOutput } from "../../types";

const videoRowCardsVariants = cva("flex group min-w-0", {
  variants: {
    size: {
      default: "gap-4",
      compact: "gap-2",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

const ThumbnailVariants = cva("relative flex-none", {
  variants: {
    size: {
      default: "w-[38%]",
      compact: "w-[168px]",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

interface VideoRowCardProps extends VariantProps<typeof videoRowCardsVariants> {
  data: VideoGetManyOutput["items"][number];
  onRemove?: () => void;
}

export const VideoCardSkeleton = () => {
  return (
    <div>
      <Skeleton />
    </div>
  );
};

export const VideoRowCard = ({ data, onRemove, size }: VideoRowCardProps) => {
  const compactViews = useMemo(() => {
    return Intl.NumberFormat("en", {
      notation: "compact",
    }).format(data.viewCount);
  }, [data.viewCount]);
  const compactLikes = useMemo(() => {
    return Intl.NumberFormat("en", {
      notation: "compact",
    }).format(data.likeCount);
  }, [data.likeCount]);
  console.log(data, "datadatadata");

  return (
    <div className={videoRowCardsVariants({ size })}>
      <Link href={`/videos/${data.id}`} className={ThumbnailVariants({ size })}>
        <VideoThumbnail
          imageUrl={data.thumbnailUrl!}
          previewUrl={data.previewUrl!}
          title={data.title}
          duration={data.duration}
        />
      </Link>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between gap-x-2">
          <Link href={`/videos/${data.id}`} className="flex-1 min-w-0">
            <h3
              className={cn(
                "font-medium line-clamp-2",
                size === "compact" ? "text-sm" : "text-base"
              )}
            >
              {data.title}
            </h3>
            {size === "default" && (
              <p className="text-sm text-muted-foreground mt-1">
                {compactViews} Views | {compactLikes} Likes
              </p>
            )}
            {size === "default" && (
              <>
                <div className="flex items-center gap-2 my-3">
                  <UserAvatar
                    size={"sm"}
                    imageUrl={data.user.imageUrl}
                    name={data.user.name}
                  />
                  <UserInfo size={"sm"} name={data.user.name} />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xs text-muted-foreground w-fit line-clamp-2">
                      {data.description ?? "No Description"}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="center"
                    className="bg-black/70"
                  >
                    <p>From the video Description</p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
            {size === "compact" && (
              <UserInfo size={"sm"} name={data.user.name} />
            )}
            {size === "compact" && (
              <p className="text-sm text-muted-foreground mt-1">
                {compactViews} Views | {compactLikes} Likes
              </p>
            )}
          </Link>
          <div className="flex-none">
            <VideoMenu videoId={data.id} onRemove={onRemove} />
          </div>
        </div>
      </div>
    </div>
  );
};
