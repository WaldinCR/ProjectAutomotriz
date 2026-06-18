import Navbar from './Navbar';
export default function PageLayout({ children, title, actions }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="flex-1 p-6">
        {(title || actions) && (
          <div className="flex items-center justify-between mb-6">
            {title && <h1 className="text-2xl font-bold text-blue-900">{title}</h1>}
            {actions && <div className="flex gap-3">{actions}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
