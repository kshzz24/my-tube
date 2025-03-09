import { SidebarTrigger } from "@/components/ui/sidebar";
import Image from "next/image";
import Link from "next/link";
import { SearchInput } from "./search-input";
import { AuthButton } from "@/modules/auth/ui/components/auth-button";

export const HomeNavbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 flex bg-white items-center px-2 pr-5 z-50">
      <div className="flex items-center gap-4 w-full">
        <div className="flex items-center flex-shrink-0">
          <SidebarTrigger />
          <Link prefetch href={"/"} className="hidden md:block">
            <div className="flex p-4 items-center gap-1">
              <Image src={"/logo.svg"} height={32} width={32} alt="Logo" />
              <p className="text-xl font-semibold tracking-tight">MyTube</p>
            </div>
          </Link>
        </div>

        {/* Searchbar */}
        <div className="flex-1 flex justify-center mx-auto max-w-[720px]">
          <SearchInput />
        </div>

        <div className="flex-shrink-0 items-center flex gap-4">
          <AuthButton />
        </div>
      </div>
    </nav>
  );
};
