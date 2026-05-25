import type { VaultCategory } from "@/features/keys/types";

export type CategoryTreeNode = VaultCategory & {
  children: CategoryTreeNode[];
  depth: number;
  totalKeyCount: number;
};

function sortCategories(first: VaultCategory, second: VaultCategory) {
  if (first.sortOrder !== second.sortOrder) return first.sortOrder - second.sortOrder;
  return first.name.localeCompare(second.name, "tr");
}

export function buildCategoryTree(categories: VaultCategory[]): CategoryTreeNode[] {
  const nodes = new Map<string, CategoryTreeNode>();

  categories.forEach((category) => {
    nodes.set(category.id, { ...category, children: [], depth: 0, totalKeyCount: category.keyCount ?? 0 });
  });

  const roots: CategoryTreeNode[] = [];

  nodes.forEach((node) => {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  });

  const visited = new Set<string>();

  function visit(node: CategoryTreeNode, depth: number, ancestors: Set<string>): number {
    if (ancestors.has(node.id)) return 0;

    visited.add(node.id);
    node.depth = depth;

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(node.id);
    node.children = node.children.filter((child) => !nextAncestors.has(child.id)).sort(sortCategories);
    node.totalKeyCount = (node.keyCount ?? 0) + node.children.reduce((total, child) => total + visit(child, depth + 1, nextAncestors), 0);
    return node.totalKeyCount;
  }

  roots.sort(sortCategories).forEach((node) => visit(node, 0, new Set()));

  nodes.forEach((node) => {
    if (visited.has(node.id)) return;
    roots.push(node);
    visit(node, 0, new Set());
  });

  return roots;
}

export function flattenCategoryTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategoryTree(node.children)]);
}

export function getCategoryDescendantIds(categories: VaultCategory[], categoryId: string) {
  const childrenByParent = new Map<string, VaultCategory[]>();

  categories.forEach((category) => {
    if (!category.parentId) return;
    const children = childrenByParent.get(category.parentId) ?? [];
    children.push(category);
    childrenByParent.set(category.parentId, children);
  });

  const ids = new Set<string>([categoryId]);
  const queue = [...(childrenByParent.get(categoryId) ?? [])];

  while (queue.length > 0) {
    const category = queue.shift();
    if (!category || ids.has(category.id)) continue;
    ids.add(category.id);
    queue.push(...(childrenByParent.get(category.id) ?? []));
  }

  return ids;
}

export function canMoveCategory(categories: VaultCategory[], categoryId: string, parentId: string | null) {
  if (!parentId) return true;
  if (categoryId === parentId) return false;

  const byId = new Map(categories.map((category) => [category.id, category]));
  const visited = new Set<string>();
  let currentId: string | null = parentId;

  while (currentId) {
    if (currentId === categoryId) return false;
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    currentId = byId.get(currentId)?.parentId ?? null;
  }

  return true;
}
