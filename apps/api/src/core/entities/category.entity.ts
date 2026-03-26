export interface CategoryProps {
  id: string;
  tenantId: string;
  name: string;
}

export class Category {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public name: string,
  ) {}

  static create(props: CategoryProps): Category {
    return new Category(props.id, props.tenantId, props.name);
  }
}
