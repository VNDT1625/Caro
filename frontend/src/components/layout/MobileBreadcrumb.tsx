import React from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

interface BreadcrumbItem {
  label: string
  href?: string
  icon?: string
}

interface MobileBreadcrumbProps {
  items: BreadcrumbItem[]
  showBackButton?: boolean
  onBack?: () => void
}

export default function MobileBreadcrumb({ items, showBackButton = true, onBack }: MobileBreadcrumbProps) {
  const { t } = useLanguage()
  
  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      window.location.hash = '#home'
    }
  }
  
  return (
    <div className="mobile-breadcrumb">
      <div className="mobile-breadcrumb-inner">
        {showBackButton && (
          <button onClick={handleBack} aria-label={t('common.back')}>
            ← {t('breadcrumb.home')}
          </button>
        )}
        
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {(showBackButton || index > 0) && (
              <span className="breadcrumb-separator">›</span>
            )}
            
            {item.href ? (
              <a href={item.href}>
                {item.icon && <span>{item.icon}</span>}
                {item.label}
              </a>
            ) : (
              <span className="breadcrumb-current">
                {item.icon && <span>{item.icon}</span>}
                {item.label}
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
