import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center space-y-8 max-w-md px-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400">404</p>
        <h1 className="text-5xl font-serif text-slate-900">Page Not Found</h1>
        <p className="text-slate-500">The page you're looking for doesn't exist or has been moved.</p>
        <Link href="/" className="inline-block bg-slate-900 text-white px-10 py-5 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all">
          Return Home
        </Link>
      </div>
    </div>
  );
}
