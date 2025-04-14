'use client';

import { SubmissionReview } from '@/components/dashboard/SubmissionReview';

export default function ReviewPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Review Submissions</h1>
      <SubmissionReview />
    </div>
  );
} 