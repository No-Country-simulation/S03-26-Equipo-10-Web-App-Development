export interface TagProps {
  id: string;
  tenantId: string;
  name: string;
}

export class Tag {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public name: string,
  ) {}

  static create(props: TagProps): Tag {
    return new Tag(props.id, props.tenantId, props.name);
  }
}
