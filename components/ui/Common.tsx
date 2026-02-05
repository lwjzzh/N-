import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LucideIcon, X } from 'lucide-react';

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  icon: Icon, 
  size = 'md',
  className = '',
  ...props 
}) => {
  const baseStyle = "inline-flex items-center justify-center rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-95";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover shadow-sm hover:shadow-primary/20",
    secondary: "bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200",
    ghost: "hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200",
    danger: "bg-red-900/20 text-red-400 hover:bg-red-900/40 border border-red-900/50",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 py-2 text-sm",
    lg: "h-12 px-6 text-base",
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className={`mr-2 ${size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />}
      {children}
    </button>
  );
};

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium text-muted">{label}</label>}
      <input
        className={`flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-200 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary/50 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    </div>
  );
};

// --- Textarea ---
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, className = '', ...props }, ref) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium text-muted">{label}</label>}
      <textarea
        ref={ref}
        className={`flex min-h-[80px] w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-200 ring-offset-background placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary/50 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    </div>
  );
});
Textarea.displayName = 'Textarea';

// --- Select ---
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { label: string; value: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium text-muted">{label}</label>}
      <div className="relative">
        <select
          className={`flex h-10 w-full appearance-none rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-200 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary/50 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="absolute right-3 top-2.5 pointer-events-none text-muted">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
      </div>
    </div>
  );
};

// --- Card ---
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, ...props }) => {
  const contentPadding = className.includes('p-0') ? '' : 'p-6';

  return (
    <div className={`rounded-xl border border-zinc-800 bg-surface text-text shadow-sm hover:shadow-md transition-shadow ${className}`} {...props}>
      {title && (
        <div className="flex flex-col space-y-1.5 p-6 pb-4 border-b border-zinc-800/50">
          <h3 className="font-semibold leading-none tracking-tight text-zinc-100">{title}</h3>
        </div>
      )}
      <div className={contentPadding}>{children}</div>
    </div>
  );
};

// --- Badge ---
export const Badge: React.FC<{ children: React.ReactNode; variant?: 'default' | 'outline' | 'success' | 'error'; className?: string }> = ({ children, variant = 'default', className = '' }) => {
  const styles = {
    default: "bg-primary/20 text-blue-300 border-transparent",
    outline: "text-zinc-400 border-zinc-700 bg-transparent",
    success: "bg-green-900/30 text-green-400 border-green-900/30",
    error: "bg-red-900/30 text-red-400 border-red-900/30",
  };
  return (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${styles[variant]} ${className}`}>
      {children}
    </div>
  );
};

// --- Modal ---
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, width = 'md' }) => {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const widths = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl'
    };

    return createPortal(
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => { if(e.target === overlayRef.current) onClose(); }}
            ref={overlayRef}
        >
            <div className={`bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full mx-4 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 ${widths[width]}`} role="dialog">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {children}
                </div>

                {footer && (
                    <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 rounded-b-xl flex justify-end gap-3 shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};