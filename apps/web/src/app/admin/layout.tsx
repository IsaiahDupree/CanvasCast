import Link from "next/link";
import { Shield, Users, Briefcase, Activity, DollarSign, AlertTriangle, ArrowLeft, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, email, display_name")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return null;
  }

  return {
    ...user,
    display_name: profile.display_name,
    email: profile.email,
  };
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAdminUser();

  if (!user) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-white/10 flex flex-col">
        <div className="p-6">
          <Link href="/admin" className="flex items-center gap-2">
            <Shield className="w-10 h-10 text-brand-500" />
            <div>
              <span className="text-xl font-bold block">Admin</span>
              <span className="text-xs text-gray-400">Dashboard</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4">
          <ul className="space-y-1">
            <li>
              <Link
                href="/admin"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition"
              >
                <Activity className="w-5 h-5" />
                Overview
              </Link>
            </li>
            <li>
              <Link
                href="/admin/jobs"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition"
              >
                <Briefcase className="w-5 h-5" />
                Job Inspector
              </Link>
            </li>
            <li>
              <Link
                href="/admin/users"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition"
              >
                <Users className="w-5 h-5" />
                User Management
              </Link>
            </li>
            <li>
              <Link
                href="/admin/queues"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition"
              >
                <Activity className="w-5 h-5" />
                Queue Health
              </Link>
            </li>
            <li>
              <Link
                href="/admin/costs"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition"
              >
                <DollarSign className="w-5 h-5" />
                Cost Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/admin/appeals"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition"
              >
                <AlertTriangle className="w-5 h-5" />
                Appeals Queue
              </Link>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-white/10">
          <Link
            href="/app"
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </Link>

          <div className="text-sm text-gray-400 mb-2 truncate">
            {user.display_name || user.email}
          </div>

          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="bg-brand-500/10 border-b border-brand-500/20 px-6 py-3">
          <div className="flex items-center gap-2 text-brand-400 text-sm">
            <Shield className="w-4 h-4" />
            <span className="font-medium">Admin Access</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">Restricted area</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
