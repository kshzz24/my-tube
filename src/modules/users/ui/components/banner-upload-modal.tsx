import { ResponsiveModal } from "@/components/responsive-modal";
import { UploadDropzone } from "@/lib/uploadthing";
import { trpc } from "@/trpc/client";

interface BannerUploadModalProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BannerUploadModal = ({
  userId,
  open,
  onOpenChange,
}: BannerUploadModalProps) => {
  const utils = trpc.useUtils();

  const onUploadComplete = () => {
    utils.studio.getOne.invalidate({ id: userId });
    utils.studio.getMany.invalidate();

    onOpenChange(false);
  };

  return (
    <ResponsiveModal
      title="Upload a Banner"
      open={open}
      onOpenChange={onOpenChange}
    >
      <UploadDropzone
        endpoint={"bannerUploader"}
        onClientUploadComplete={onUploadComplete}
      />
    </ResponsiveModal>
  );
};
