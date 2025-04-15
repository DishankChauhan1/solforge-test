import React from "react";

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className = "", children }: CardProps) {
  return (
    <div className={`bg-white shadow rounded-lg overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function CardHeader({ className = "", children }: CardHeaderProps) {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  className?: string;
  children: React.ReactNode;
}

export function CardTitle({ className = "", children }: CardTitleProps) {
  return (
    <h3 className={`text-lg font-medium leading-6 text-gray-900 ${className}`}>
      {children}
    </h3>
  );
}

interface CardContentProps {
  className?: string;
  children: React.ReactNode;
}

export function CardContent({ className = "", children }: CardContentProps) {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  className?: string;
  children: React.ReactNode;
}

export function CardFooter({ className = "", children }: CardFooterProps) {
  return (
    <div className={`px-6 py-4 bg-gray-50 border-t border-gray-200 ${className}`}>
      {children}
    </div>
  );
} 