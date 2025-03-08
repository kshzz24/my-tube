import { ResponsiveModal } from "@/components/responsive-modal";
import { Button } from "@/components/ui/button";

import { trpc } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface PlaylistCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
const formSchema = z.object({
  name: z.string().min(1),
});
export const PlaylistCreateModal = ({
  open,
  onOpenChange,
}: PlaylistCreateModalProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  const utils = trpc.useUtils();
  const create = trpc.playlist.create.useMutation({
    onSuccess: () => {
      toast.success("Playlist created");
      form.reset();
      utils.playlist.getMany.invalidate();
      onOpenChange(false);
    },
    onError: () => {
      toast.error("SOmething went wrong");
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    create.mutate(values);
  };

  return (
    <ResponsiveModal
      title="Create a playlist"
      open={open}
      onOpenChange={onOpenChange}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <FormControl>
                    <Input {...field} className="My Favorite videos"></Input>
                  </FormControl>
                </FormLabel>
              </FormItem>
            )}
          />
          <div className="flex justify-end">
            <Button disabled={create.isPending} type="submit">
              Save
            </Button>
          </div>
        </form>
      </Form>
    </ResponsiveModal>
  );
};
