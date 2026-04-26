/**
 * Home page — placeholder until M1 (video ingest) and M2 (video list API) are built.
 * Will be replaced with a real video list using TanStack Table in M3.
 */
export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Videos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Telugu sermon transcripts · parallel Telugu / English editor
        </p>
      </div>

      {/* Status banner — remove once M1 is wired up */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-5 py-4">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          Pipeline not yet wired
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
          M0 backend is running. M1 (transcript ingest) comes next — once that's done,
          videos will appear here.
        </p>
      </div>

      {/* Placeholder table shell — will be replaced by ParallelEditor in M3 */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <tr>
              {["Title", "Channel", "Duration", "Segments", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                No videos yet — add some via the ingest API (M1).
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
