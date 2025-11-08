'use server';

import { auth } from '@workspace/auth';
import { db } from '@workspace/db/client';
import { designs, messages, projects, assets, eq, desc } from '@workspace/db';
import { randomUUID } from 'crypto';
import { getWelcomeTemplate, getBlankTemplate } from '@/lib/tldraw-templates';
import { revalidatePath } from 'next/cache';

export async function loadDesign(designId: string) {
  const session = await auth.api.getSession({
    headers: await import('next/headers').then((mod) => mod.headers()),
  });

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const design = await db.query.designs.findFirst({
    where: eq(designs.id, designId),
    with: {
      project: true,
    },
  });

  if (!design) {
    throw new Error('Design not found');
  }

  // オーナーチェック
  if (design.project?.ownerId !== session.user.id) {
    throw new Error('Forbidden');
  }

  return design;
}

export async function saveDesign(params: {
  id: string;
  doc: unknown;
  thumbnailKey?: string;
}) {
  const session = await auth.api.getSession({
    headers: await import('next/headers').then((mod) => mod.headers()),
  });

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const design = await db.query.designs.findFirst({
    where: eq(designs.id, params.id),
    with: {
      project: true,
    },
  });

  if (!design) {
    throw new Error('Design not found');
  }

  if (design.project?.ownerId !== session.user.id) {
    throw new Error('Forbidden');
  }

  await db
    .update(designs)
    .set({
      doc: params.doc,
      thumbnailKey: params.thumbnailKey || design.thumbnailKey,
      updatedAt: new Date(),
    })
    .where(eq(designs.id, params.id));

  // プロジェクトのupdatedAtも更新
  await db
    .update(projects)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(projects.id, design.projectId));

  revalidatePath(`/editor/${params.id}`);

  return { success: true };
}

export async function appendMessage(params: {
  designId: string;
  content: string;
  selectionIds?: string[];
  role?: 'user' | 'system';
}) {
  const session = await auth.api.getSession({
    headers: await import('next/headers').then((mod) => mod.headers()),
  });

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const design = await db.query.designs.findFirst({
    where: eq(designs.id, params.designId),
    with: {
      project: true,
    },
  });

  if (!design) {
    throw new Error('Design not found');
  }

  if (design.project?.ownerId !== session.user.id) {
    throw new Error('Forbidden');
  }

  const messageId = randomUUID();
  await db.insert(messages).values({
    id: messageId,
    designId: params.designId,
    userId: session.user.id,
    role: params.role || 'user',
    content: params.content,
    selectionIds: params.selectionIds || null,
    createdAt: new Date(),
  });

  return { id: messageId };
}

export async function loadMessages(designId: string) {
  const session = await auth.api.getSession({
    headers: await import('next/headers').then((mod) => mod.headers()),
  });

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const design = await db.query.designs.findFirst({
    where: eq(designs.id, designId),
    with: {
      project: true,
    },
  });

  if (!design) {
    throw new Error('Design not found');
  }

  if (design.project?.ownerId !== session.user.id) {
    throw new Error('Forbidden');
  }

  const messageList = await db.query.messages.findMany({
    where: eq(messages.designId, designId),
    orderBy: (messages, { desc }) => [desc(messages.createdAt)],
    limit: 100,
  });

  return messageList.reverse(); // 古い順に並び替え
}

export async function createProjectAndDesign(params: {
  template?: 'welcome' | 'blank';
  projectName?: string;
  designName?: string;
}) {
  const session = await auth.api.getSession({
    headers: await import('next/headers').then((mod) => mod.headers()),
  });

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const projectId = randomUUID();
  const designId = randomUUID();

  // 初期ドキュメントを取得
  const template = params.template || 'welcome';
  const initialDoc =
    template === 'blank' ? getBlankTemplate() : getWelcomeTemplate();

  // プロジェクトとデザインを作成
  await db.insert(projects).values({
    id: projectId,
    ownerId: session.user.id,
    name: params.projectName || 'Untitled Project',
    visibility: 'private',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(designs).values({
    id: designId,
    projectId,
    name: params.designName || 'Untitled Design',
    doc: initialDoc,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { projectId, designId };
}

export async function saveAsset(params: {
  projectId: string;
  designId: string;
  key: string;
  type: 'image' | 'export';
  width?: number;
  height?: number;
  size?: number;
  contentType: string;
}) {
  const session = await auth.api.getSession({
    headers: await import('next/headers').then((mod) => mod.headers()),
  });

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, params.projectId),
  });

  if (!project || project.ownerId !== session.user.id) {
    throw new Error('Forbidden');
  }

  const assetId = randomUUID();
  await db.insert(assets).values({
    id: assetId,
    projectId: params.projectId,
    designId: params.designId,
    key: params.key,
    type: params.type,
    width: params.width,
    height: params.height,
    size: params.size,
    contentType: params.contentType,
    createdAt: new Date(),
  });

  return { id: assetId };
}
