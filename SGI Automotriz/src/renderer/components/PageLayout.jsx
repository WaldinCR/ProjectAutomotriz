import Navbar from './Navbar';

export default function PageLayout({ children, title, subtitle, actions }) {
  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col text-slate-800">
      <Navbar />
      <main className="flex-1 px-8 py-7 max-w-screen-xl mx-auto w-full">
        {(title || actions) && (
          <div className="flex items-start justify-between mb-6">
            <div>
              {title && <h1 className="page-title">{title}</h1>}
              {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex gap-3">{actions}</div>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
