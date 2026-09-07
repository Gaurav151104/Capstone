import React from 'react';
import classNames from 'classnames';

export default function Card({ title, subtitle, icon: Icon, children, className, action }) {
  return (
    <div className={classNames("card flex flex-col h-full", className)}>
      {(title || Icon) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            {Icon && (
              <div className="h-10 w-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center mr-3">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div>
              {title && <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>}
              {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
