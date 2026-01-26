import Link from "next/link";
import { Play, Home, FolderOpen, Settings, CreditCard, LogOut, Mic, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SignupTracker } from "@/components/SignupTracker";
import { ActivationTracker } from "@/components/ActivationTracker";

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function getCredits(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_credit_balance", { p_user_id: userId });
  return data ?? 0;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  
  if (!user) {
    redirect("/login");
  }

  const credits = await getCredits(user.id);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-white/10 flex flex-col" role="complementary" aria-label="Sidebar navigation">
        <div className="p-6">
          <Link href="/app" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-lg">
            <img src="/images/logo-icon.png" alt="CanvasCast" className="w-10 h-10" />
            <span className="text-xl font-bold">CanvasCast</span>
          </Link>
        </div>

        <nav className="flex-1 px-4" aria-label="Main navigation">
          <ul className="space-y-1" role="list">
            <li>
              <Link
                href="/app"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                <Home className="w-5 h-5" aria-hidden="true" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/app/projects"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                <FolderOpen className="w-5 h-5" aria-hidden="true" />
                Projects
              </Link>
            </li>
            <li>
              <Link
                href="/app/settings/voice"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                <Mic className="w-5 h-5" aria-hidden="true" />
                Voice Cloning
              </Link>
            </li>
            <li>
              <Link
                href="/app/credits"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                <Coins className="w-5 h-5" aria-hidden="true" />
                Buy Credits
              </Link>
            </li>
            <li>
              <Link
                href="/app/settings"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                <Settings className="w-5 h-5" aria-hidden="true" />
                Settings
              </Link>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-white/10">
          <Link href="/app/credits" className="block p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 mb-4 hover:bg-brand-500/20 transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-gray-900">
            <div className="flex items-center gap-2 text-brand-400 text-sm font-medium mb-1">
              <CreditCard className="w-4 h-4" aria-hidden="true" />
              Credits
            </div>
            <div className="text-2xl font-bold">{credits} min</div>
          </Link>

          <div className="text-sm text-gray-400 mb-2 truncate" aria-label={`Signed in as ${user.email}`}>
            {user.email}
          </div>

          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-md"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main id="main-content" className="flex-1 overflow-auto" role="main">
        <SignupTracker />
        <ActivationTracker creditsBalance={credits} />
        {children}
      </main>
    </div>
  );
}
