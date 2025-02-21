import { formatDuration } from "@/lib/utils";
import Image from "next/image";
import { THUMBNAIL_FALLBACK } from "../../constants";

interface VideoThumbnailProps {
  imageUrl?: string;
  previewUrl?: string;
  title: string;
  duration: number;
}

export const VideoThumbnail = ({
  imageUrl,
  previewUrl,
  title,
  duration,
}: VideoThumbnailProps) => {
  return (
    <div className="relative">
      <div className="relative w-full overflow-hidden rounded-xl aspect-video">
        <Image
          src={imageUrl || THUMBNAIL_FALLBACK}
          alt={title}
          fill
          className="size-full object-cover hover:opacity-0"
        />
        <Image
          src={previewUrl || THUMBNAIL_FALLBACK}
          alt={title}
          fill
          unoptimized={!!previewUrl}
          className="size-full opacity-0 object-cover hover:opacity-100 "
        />
      </div>

      <div className="absolute bottom-2 right-2 px-1 py-0.5 rounded bg-black/80 text-white text-xs font-medium">
        {formatDuration(duration)}
      </div>
    </div>
  );
};
