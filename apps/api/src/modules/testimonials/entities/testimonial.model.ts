export type TestimonialStatus = 'draft' | 'pending' | 'approved' | 'published' | 'rejected';

export const VALID_TRANSITIONS: Record<TestimonialStatus, TestimonialStatus[]> = {
  draft: ['pending'],
  pending: ['approved', 'rejected'],
  approved: ['published', 'rejected'],
  published: ['rejected'],
  rejected: [],
};

export interface TestimonialView {
  id: string;
  tenantId: string;
  createdById: string | null;
  authorName: string;
  content: string;
  rating: number;
  status: TestimonialStatus;
  score: number;
  categoryId: string | null;
  moderationNotes: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  videoTitle: string | null;
  videoThumbnailUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}
