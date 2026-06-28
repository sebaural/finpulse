export default function ArticleSpokeLoading() {
  return (
    <div className="max-w-4xl mx-auto py-8 animate-pulse">
      <div className="h-4 w-24 bg-slate-200 rounded mb-4" />
      <div className="h-8 w-3/4 bg-slate-200 rounded mb-6" />
      <div className="space-y-3">
        <div className="h-4 bg-slate-200 rounded" />
        <div className="h-4 bg-slate-200 rounded w-5/6" />
        <div className="h-4 bg-slate-200 rounded w-4/6" />
      </div>
    </div>
  );
}
