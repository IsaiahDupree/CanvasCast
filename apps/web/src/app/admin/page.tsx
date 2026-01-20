export default function AdminOverviewPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-400">System overview and management tools</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Quick Stats */}
        <div className="bg-gray-900 border border-white/10 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Total Users</div>
          <div className="text-3xl font-bold">-</div>
          <div className="text-xs text-gray-500 mt-2">Coming soon</div>
        </div>

        <div className="bg-gray-900 border border-white/10 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Active Jobs</div>
          <div className="text-3xl font-bold">-</div>
          <div className="text-xs text-gray-500 mt-2">Coming soon</div>
        </div>

        <div className="bg-gray-900 border border-white/10 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Queue Depth</div>
          <div className="text-3xl font-bold">-</div>
          <div className="text-xs text-gray-500 mt-2">Coming soon</div>
        </div>

        <div className="bg-gray-900 border border-white/10 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Daily API Cost</div>
          <div className="text-3xl font-bold">-</div>
          <div className="text-xs text-gray-500 mt-2">Coming soon</div>
        </div>
      </div>

      <div className="mt-8 bg-gray-900 border border-white/10 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Getting Started</h2>
        <div className="space-y-4 text-gray-400">
          <p>
            Welcome to the CanvasCast admin dashboard. Use the sidebar to navigate to different management tools:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong className="text-white">Job Inspector:</strong> View and debug pipeline jobs</li>
            <li><strong className="text-white">User Management:</strong> Manage user accounts and credits</li>
            <li><strong className="text-white">Queue Health:</strong> Monitor worker status and job queues</li>
            <li><strong className="text-white">Cost Dashboard:</strong> Track API costs and usage</li>
            <li><strong className="text-white">Appeals Queue:</strong> Review content moderation appeals</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
