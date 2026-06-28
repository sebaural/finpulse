export interface Topic {
  id: string;
  name: string;
  slug: string;
  parentVertical: 'geopolitics' | 'markets' | 'tech';
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
