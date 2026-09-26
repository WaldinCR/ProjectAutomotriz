import Sidebar from './Sidebar';

export default function PageLayout({ children, title, subtitle, icon = 'ti-settings', actions }) {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="content">
          {(title || actions) && (
            <div className="page-head">
              <div className="page-icon-group">
                <div className="page-icon">
                  <i className={`ti ${icon}`}></i>
                </div>
                <div>
                  <div className="page-title">{title}</div>
                  {subtitle && <div className="page-sub">{subtitle}</div>}
                  <div className="orange-bar"></div>
                </div>
              </div>
              {actions && <div className="page-actions">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
