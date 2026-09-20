export type TestimonialStatus = 'draft' | 'pending' | 'approved' | 'published' | 'rejected';

export const VALID_TRANSITIONS: Record<TestimonialStatus, TestimonialStatus[]> = {
  draft: ['pending'],
  pending: ['approved', 'rejected'],
  approved: ['published', 'rejected'],
  published: ['rejected'],
  rejected: [],
};

export interface TestimonialView {
  readonly id: string;
  readonly tenantId: string;
  readonly createdById: string | null;
  readonly authorName: string;
  readonly content: string;
  readonly rating: number;
  readonly status: TestimonialStatus;
  readonly score: number;
  readonly categoryId: string | null;
  readonly category?: { readonly id: string; readonly name: string } | null;
  readonly tags?: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly moderationNotes: string | null;
  readonly imageUrl: string | null;
  readonly videoUrl: string | null;
  readonly videoTitle: string | null;
  readonly videoThumbnailUrl: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly publishedAt: Date | null;
}
