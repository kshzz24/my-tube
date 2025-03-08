"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { PlaylistCreateModal } from "../components/create-modal";
import { useState } from "react";
import { PlaylistSection } from "../sections/playlist-section";

export const PlaylistView = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  return (
    <div className="max-w-[2400px] mx-auto mb-10 px-4 pt-2.5 flex flex-col gap-y-6">
      <PlaylistCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Playlist</h1>
          <p className="text-sm text-muted-foreground">
            Your Video COllections{" "}
          </p>
        </div>
        <Button
          variant={"outline"}
          size={"icon"}
          className="rounded-full"
          onClick={() => setCreateModalOpen(true)}
        >
          <PlusIcon />
        </Button>
      </div>
      <PlaylistSection />
    </div>
  );
};
