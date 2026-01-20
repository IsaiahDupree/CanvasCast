"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

// Helper to get all focusable elements in the modal
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  );
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // Handle mounting for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Save previous focus when modal opens
  useEffect(() => {
    if (isOpen) {
      // Save the currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Announce modal opened
      setAnnouncement('Modal opened');

      // Focus the first focusable element or the modal itself
      // Use setTimeout to ensure modal is fully rendered
      const focusTimeout = setTimeout(() => {
        const modalElement = modalRef.current;
        if (!modalElement) return;

        const focusableElements = getFocusableElements(modalElement);

        // Exclude close button from initial focus
        const contentFocusable = focusableElements.filter(el => {
          return el.getAttribute('aria-label') !== 'Close modal';
        });

        if (contentFocusable.length > 0) {
          // Focus first non-close-button element
          contentFocusable[0].focus();
        } else {
          // No focusable content, focus the title
          const titleElement = modalElement.querySelector('#modal-title');
          if (titleElement) {
            (titleElement as HTMLElement).setAttribute('tabindex', '-1');
            (titleElement as HTMLElement).focus();
          }
        }
      }, 0);

      // Cleanup function to restore focus
      return () => {
        clearTimeout(focusTimeout);
        setAnnouncement('');

        // Restore focus to the previously focused element
        const elementToFocus = previousActiveElement.current;
        if (elementToFocus && document.body.contains(elementToFocus)) {
          // Use requestAnimationFrame to ensure DOM is updated
          requestAnimationFrame(() => {
            elementToFocus.focus();
          });
        }
      };
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap implementation
  useEffect(() => {
    if (!isOpen) return;

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const modalElement = modalRef.current;
      if (!modalElement) return;

      const focusableElements = getFocusableElements(modalElement);

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement;

      // Check if focus is within the modal
      const focusInModal = modalElement.contains(activeElement);

      if (!focusInModal) {
        // If focus somehow escaped, bring it back
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (event.shiftKey) {
        // Shift+Tab: moving backwards
        if (activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: moving forwards
        if (activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/80 animate-in fade-in-0"
        onClick={onClose}
        data-testid="modal-overlay"
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
          "w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg",
          "animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%]",
          className
        )}
      >
        {/* Title */}
        <h2
          id="modal-title"
          className="text-lg font-semibold leading-none tracking-tight mb-4"
        >
          {title}
        </h2>

        {/* Close Button */}
        <button
          onClick={onClose}
          className={cn(
            "absolute right-4 top-4 rounded-sm opacity-70",
            "ring-offset-background transition-opacity",
            "hover:opacity-100",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:pointer-events-none"
          )}
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        {/* Content */}
        <div className="mt-2">
          {children}
        </div>
      </div>

      {/* ARIA live region for announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
