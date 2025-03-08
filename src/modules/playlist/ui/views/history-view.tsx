import { HistoryVideosSection } from "../sections/history-video-views";

export const HistoryView = () => {
  return (
    <div className="max-w-[2400px] mx-auto mb-10 px-4 pt-2.5 flex flex-col gap-y-6">
      <div>
        <h1 className="text-2xl font-bold">History</h1>
        <p className="text-sm text-muted-foreground">
          Videos you have watched{" "}
        </p>
      </div>

      <HistoryVideosSection />
    </div>
  );
};
