export type TestimonialStatus = 'draft' | 'pending' | 'approved' | 'published' | 'rejected';

const VALID_TRANSITIONS: Record<TestimonialStatus, TestimonialStatus[]> = {
  draft: ['pending'],
  pending: ['approved', 'rejected'],
  approved: ['published'],
  published: [],
  rejected: [],
};

export interface TestimonialProps {
  id: string;
  tenantId: string;
  createdById: string | null;
  authorName: string;
  content: string;
  rating: number;
  statusCode: TestimonialStatus;
  score: number;
  categoryId: string | null;
  moderationNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

export class Testimonial {
  private constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly createdById: string | null,
    public authorName: string,
    public content: string,
    public rating: number,
    private statusCode: TestimonialStatus,
    public score: number,
    public categoryId: string | null,
    public moderationNotes: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public publishedAt: Date | null,
  ) {}

  static create(props: {
    id: string;
    tenantId: string;
    createdById: string | null;
    authorName: string;
    content: string;
    rating: number;
    categoryId?: string | null;
  }): Testimonial {
    if (props.rating < 1 || props.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const now = new Date();
    return new Testimonial(
      props.id,
      props.tenantId,
      props.createdById,
      props.authorName,
      props.content,
      props.rating,
      'draft',
      0,
      props.categoryId ?? null,
      null,
      now,
      now,
      null,
    );
  }

  static reconstitute(props: TestimonialProps): Testimonial {
    return new Testimonial(
      props.id,
      props.tenantId,
      props.createdById,
      props.authorName,
      props.content,
      props.rating,
      props.statusCode,
      props.score,
      props.categoryId,
      props.moderationNotes,
      props.createdAt,
      props.updatedAt,
      props.publishedAt,
    );
  }

  get status(): TestimonialStatus {
    return this.statusCode;
  }

  submit(): void {
    this.assertTransition('pending');
    this.statusCode = 'pending';
    this.updatedAt = new Date();
  }

  approve(): void {
    this.assertTransition('approved');
    this.statusCode = 'approved';
    this.updatedAt = new Date();
  }

  reject(reason?: string): void {
    this.assertTransition('rejected');
    this.statusCode = 'rejected';
    this.moderationNotes = reason ?? null;
    this.updatedAt = new Date();
  }

  publish(): void {
    this.assertTransition('published');
    this.statusCode = 'published';
    this.publishedAt = new Date();
    this.updatedAt = new Date();
  }

  update(props: {
    authorName?: string;
    content?: string;
    rating?: number;
    categoryId?: string | null;
  }): void {
    if (!this.canEdit()) {
      throw new Error('Published testimonials cannot be edited');
    }

    if (props.rating !== undefined && (props.rating < 1 || props.rating > 5)) {
      throw new Error('Rating must be between 1 and 5');
    }

    if (props.authorName !== undefined) this.authorName = props.authorName;
    if (props.content !== undefined) this.content = props.content;
    if (props.rating !== undefined) this.rating = props.rating;
    if (props.categoryId !== undefined) this.categoryId = props.categoryId;
    this.updatedAt = new Date();
  }

  isPublished(): boolean {
    return this.statusCode === 'published';
  }

  canEdit(): boolean {
    return this.statusCode !== 'published';
  }

  private assertTransition(to: TestimonialStatus): void {
    const allowed = VALID_TRANSITIONS[this.statusCode];
    if (!allowed.includes(to)) {
      throw new Error(
        `Invalid status transition: ${this.statusCode} → ${to}`,
      );
    }
  }
}
