import { StudioLayout } from "@/modules/studio/ui/layouts/studio-layout";
export const dynamic = 'force-dynamic'
interface LayoutProps {
  children: React.ReactNode;
}


const Layout = ({ children }: LayoutProps) => {
  return <StudioLayout>{children}</StudioLayout>;
};

export default Layout;
