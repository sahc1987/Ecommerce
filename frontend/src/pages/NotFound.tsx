import { Link, useLocation } from 'react-router-dom';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <SearchX size={36} className="text-indigo-300" />
      </div>
      <h1 className="text-5xl font-extrabold text-gray-900 mb-2">404</h1>
      <p className="text-xl font-semibold text-gray-700 mb-2">Page not found</p>
      <p className="text-sm text-gray-400 mb-8 break-all">
        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{pathname}</span> does not exist.
      </p>
      <Link to="/" className="btn-primary">Back to Home</Link>
    </div>
  );
}
